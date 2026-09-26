"""Admin FICTÍCIO gravado de verdade no PostgreSQL, para os testes de integração da API (TASK-038).

Os testes que sobem a aplicação com banco (`create_database_app`) precisam de sessão desde o
ADR-016. A aplicação abre as próprias conexões e não enxergaria uma transação desfeita, então o
usuário é gravado e **apagado no fim** (as sessões saem em `CASCADE`), com nome único por teste.
A senha é FICTÍCIA e só existe nestes testes.
"""

import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass

from fastapi.testclient import TestClient
from sqlalchemy import Engine, text

from app.application.use_cases.manage_users import ManageUsers
from app.domain.entities.user import UserRole
from app.infrastructure.database.engine import create_session_factory
from app.infrastructure.repositories.sqlalchemy_user_repository import SqlAlchemyUserRepository
from app.infrastructure.repositories.sqlalchemy_user_session_repository import (
    SqlAlchemyUserSessionRepository,
)
from app.infrastructure.security.argon2_password_hasher import Argon2PasswordHasher
from app.presentation.api.auth import LOGIN_PATH
from tests.fixtures.auth_api_ficticia import CSRF_HEADERS

SENHA_INTEGRACAO_FICTICIA = "senha-ficticia-integracao-038"
ORIGIN_TESTSERVER = {"Origin": "http://testserver"}
# O `TestClient` usa http://testserver: o cookie precisa sair sem `Secure` para voltar.
LOCAL_HTTP_ENVIRON = {"SESSION_COOKIE_SECURE": "false"}


@dataclass(frozen=True)
class StoredUser:
    username: str
    password: str


@contextmanager
def stored_user(engine: Engine, role: UserRole = UserRole.ADMIN) -> Iterator[StoredUser]:
    username = f"t038-{role.value.lower()}-{uuid.uuid4().hex[:12]}"
    session_factory = create_session_factory(engine)
    ManageUsers(
        SqlAlchemyUserRepository(session_factory),
        SqlAlchemyUserSessionRepository(session_factory),
        Argon2PasswordHasher(),
    ).create_user(
        username=username,
        display_name="Usuário de integração FICTÍCIO",
        password=SENHA_INTEGRACAO_FICTICIA,
        role=role,
    )
    try:
        yield StoredUser(username=username, password=SENHA_INTEGRACAO_FICTICIA)
    finally:
        with engine.begin() as connection:
            connection.execute(
                text("DELETE FROM app_user WHERE username = :username"), {"username": username}
            )


def log_in(client: TestClient, user: StoredUser) -> None:
    response = client.post(
        LOGIN_PATH,
        json={"username": user.username, "password": user.password},
        headers=CSRF_HEADERS,
    )
    assert response.status_code == 200, response.text


def websocket_headers(client: TestClient) -> dict[str, str]:
    """`Origin` da mesma origem e o cookie da sessão, para o handshake do WebSocket."""
    return {**ORIGIN_TESTSERVER, "Cookie": f"crane_session={client.cookies['crane_session']}"}
