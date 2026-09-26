"""Autenticação com PostgreSQL real, pela aplicação completa (marcador `integration`; TASK-038).

Login, sessão, gestão de usuários, desativação, logout e WebSocket com a composição de `app.main`
(repositórios SQLAlchemy, Argon2id). Os usuários são gravados de verdade e apagados no fim, com
nomes únicos por teste. Senhas FICTÍCIAS.
"""

import uuid
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, inspect, text
from starlette.websockets import WebSocketDisconnect

from app.domain.entities.user import UserRole
from app.main import create_database_app
from app.presentation.api.auth import LOGIN_PATH, LOGOUT_PATH, SESSION_PATH
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
