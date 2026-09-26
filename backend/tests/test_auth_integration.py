"""Autenticação com PostgreSQL real, pela aplicação completa (marcador `integration`; TASK-038).

Login, sessão, gestão de usuários, desativação, logout e WebSocket com a composição de `app.main`
(repositórios SQLAlchemy, Argon2id). Os usuários são gravados de verdade e apagados no fim, com
nomes únicos por teste. Senhas FICTÍCIAS.
"""

import threading
import uuid
from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, inspect, text
from starlette.websockets import WebSocketDisconnect

from app.domain.entities.user import User, UserRole
from app.infrastructure.database.engine import create_session_factory
from app.infrastructure.repositories.sqlalchemy_user_repository import SqlAlchemyUserRepository
from app.infrastructure.repositories.sqlalchemy_user_session_repository import (
    SqlAlchemyUserSessionRepository,
)
from app.infrastructure.security.argon2_password_hasher import Argon2PasswordHasher
from app.infrastructure.security.login_attempt_limiter import InMemoryLoginAttemptLimiter
from app.main import create_database_app
from app.presentation.api.auth import LOGIN_PATH, LOGOUT_PATH, SESSION_PATH
from app.presentation.api.authorization import AuthDependencies
from app.presentation.api.main import create_app
from app.presentation.api.users import USERS_PATH
from app.presentation.websocket.evaluation import EVALUATION_WEBSOCKET_PATH
from tests.fixtures.auth_api_ficticia import CSRF_HEADERS
from tests.fixtures.auth_postgres_ficticia import (
    LOCAL_HTTP_ENVIRON,
    ORIGIN_TESTSERVER,
    SENHA_INTEGRACAO_FICTICIA,
    StoredUser,
    log_in,
    stored_user,
    websocket_headers,
)
from tests.infrastructure.database.postgres_integration_support import (
    integration_engine,
    skip_or_fail,
)

pytestmark = pytest.mark.integration


@pytest.fixture
def engine() -> Iterator[Engine]:
    for engine in integration_engine():
        if not all(inspect(engine).has_table(table) for table in ("app_user", "user_session")):
            skip_or_fail("tabelas da TASK-038 ausentes: rode `uv run alembic upgrade head` antes")
        yield engine


@pytest.fixture
def admin(engine: Engine) -> Iterator[StoredUser]:
    with stored_user(engine, UserRole.ADMIN) as user:
        yield user


@pytest.fixture
def client(engine: Engine) -> Iterator[TestClient]:
    with TestClient(create_database_app(engine, LOCAL_HTTP_ENVIRON)) as client:
        yield client


def test_login_session_and_logout(client: TestClient, admin: StoredUser) -> None:
    assert client.get(SESSION_PATH).json() == {"authEnabled": True, "user": None}

    log_in(client, admin)
    session = client.get(SESSION_PATH).json()
    assert session["user"]["username"] == admin.username
    assert session["user"]["role"] == "ADMIN"

    assert client.post(LOGOUT_PATH, headers=CSRF_HEADERS).status_code == 204
    assert client.get(SESSION_PATH).json()["user"] is None


def test_wrong_password_is_a_generic_401(client: TestClient, admin: StoredUser) -> None:
    response = client.post(
        LOGIN_PATH,
        json={"username": admin.username, "password": "senha-errada-ficticia"},
        headers=CSRF_HEADERS,
    )

    assert response.status_code == 401
    assert response.json()["code"] == "INVALID_CREDENTIALS"


def test_admin_creates_and_deactivates_an_operator(
    engine: Engine, client: TestClient, admin: StoredUser
) -> None:
    log_in(client, admin)
    username = f"t038-novo-{uuid.uuid4().hex[:12]}"
    try:
        created = client.post(
            USERS_PATH,
            json={
                "username": username.upper(),
                "displayName": "Operador de integração FICTÍCIO",
                "password": SENHA_INTEGRACAO_FICTICIA,
                "role": "OPERATOR",
            },
            headers=CSRF_HEADERS,
        )
        assert created.status_code == 201, created.text
        assert created.json()["username"] == username

        duplicate = client.post(
            USERS_PATH,
            json={
                "username": username,
                "displayName": "Outro",
                "password": SENHA_INTEGRACAO_FICTICIA,
                "role": "OPERATOR",
            },
            headers=CSRF_HEADERS,
        )
        assert duplicate.status_code == 409
        assert duplicate.json()["code"] == "USERNAME_TAKEN"

        with TestClient(create_database_app(engine, LOCAL_HTTP_ENVIRON)) as operator_client:
            log_in(operator_client, StoredUser(username, SENHA_INTEGRACAO_FICTICIA))
            assert operator_client.get(USERS_PATH).status_code == 403

            deactivated = client.patch(
                f"{USERS_PATH}/{created.json()['id']}",
                json={"active": False},
                headers=CSRF_HEADERS,
            )
            assert deactivated.status_code == 200
            assert operator_client.get(SESSION_PATH).json()["user"] is None
    finally:
        with engine.begin() as connection:
            connection.execute(
                text("DELETE FROM app_user WHERE username = :username"), {"username": username}
            )


def test_session_token_is_stored_only_as_its_hash(
    engine: Engine, client: TestClient, admin: StoredUser
) -> None:
    log_in(client, admin)
    token = client.cookies["crane_session"]

    with engine.connect() as connection:
        hashes = connection.execute(
            text(
                "SELECT s.token_hash FROM user_session s JOIN app_user u ON u.id = s.user_id "
                "WHERE u.username = :username"
            ),
            {"username": admin.username},
        ).scalars()
        stored = list(hashes)

    assert len(stored) == 1
    assert token not in stored[0]
    assert len(stored[0]) == 64


def test_websocket_requires_the_session(client: TestClient, admin: StoredUser) -> None:
    with client.websocket_connect(EVALUATION_WEBSOCKET_PATH, headers=ORIGIN_TESTSERVER) as ws:
        with pytest.raises(WebSocketDisconnect) as closed:
            ws.receive_json()
    assert closed.value.code == 4401

    log_in(client, admin)
    headers = {**websocket_headers(client), "Origin": "http://site-malicioso.invalid"}
    with client.websocket_connect(EVALUATION_WEBSOCKET_PATH, headers=headers) as ws:
        with pytest.raises(WebSocketDisconnect) as closed:
            ws.receive_json()
    assert closed.value.code == 4403


class UpdateBarrierRepository:
    """`SqlAlchemyUserRepository` que segura cada `update` até as duas requisições chegarem.

    Assim as duas passam pela guarda de perfil (ainda são admins) e entram juntas na gravação: é a
    corrida que a trava de linhas do repositório precisa resolver.
    """

    def __init__(self, inner: SqlAlchemyUserRepository, barrier: threading.Barrier) -> None:
        self._inner = inner
        self._barrier = barrier

    def __getattr__(self, name: str) -> Any:
        return getattr(self._inner, name)

    def update(self, user: User, password_hash: str | None = None) -> None:
        self._barrier.wait(timeout=15)
        self._inner.update(user, password_hash)


def test_concurrent_demotion_of_the_last_two_admins_keeps_one(engine: Engine) -> None:
    with engine.connect() as connection:
        existing = connection.execute(
            text("SELECT count(*) FROM app_user WHERE role = 'ADMIN' AND active")
        ).scalar_one()
    if existing:
        skip_or_fail(
            f"o banco já tem {existing} admin(s) ativo(s): a corrida exige só os dois do teste"
        )

    session_factory = create_session_factory(engine)
    app = create_app(
        auth=AuthDependencies(
            users=UpdateBarrierRepository(
                SqlAlchemyUserRepository(session_factory), threading.Barrier(2)
            ),
            sessions=SqlAlchemyUserSessionRepository(session_factory),
            password_hasher=Argon2PasswordHasher(),
            attempt_limiter=InMemoryLoginAttemptLimiter(),
            cookie_secure=False,
        )
    )
    with stored_user(engine) as first, stored_user(engine) as second:
        first_client, second_client = TestClient(app), TestClient(app)
        log_in(first_client, first)
        log_in(second_client, second)
        ids = {
            name: client.get(SESSION_PATH).json()["user"]["id"]
            for name, client in (("first", first_client), ("second", second_client))
        }

        def demote(client: TestClient, target_id: str) -> Any:
            return client.patch(
                f"{USERS_PATH}/{target_id}", json={"role": "OPERATOR"}, headers=CSRF_HEADERS
            )

        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [
                pool.submit(demote, first_client, ids["second"]),
                pool.submit(demote, second_client, ids["first"]),
            ]
            responses = [future.result(timeout=60) for future in futures]

        statuses = sorted(response.status_code for response in responses)
        assert statuses == [200, 409], [response.text for response in responses]
        [conflict] = [response for response in responses if response.status_code == 409]
        assert conflict.json()["code"] == "LAST_ADMIN"
        with engine.connect() as connection:
            remaining = connection.execute(
                text(
                    "SELECT count(*) FROM app_user "
                    "WHERE role = 'ADMIN' AND active AND username IN (:first, :second)"
                ),
                {"first": first.username, "second": second.username},
            ).scalar_one()
        assert remaining == 1
