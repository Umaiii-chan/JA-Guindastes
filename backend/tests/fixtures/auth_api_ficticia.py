"""Apoio aos testes da API com autenticação (TASK-038; ADR-016). Dados FICTÍCIOS.

- `auth_dependencies(auth)`: as `AuthDependencies` da API com os dublês em memória de
  `tests/fixtures/auth_ficticia.py`;
- `auth_client(app)`: `TestClient` em `https://testserver`, para o cookie `Secure` (padrão do
  ADR-016) voltar nas requisições seguintes;
- `login`, `login_as_admin`, `login_as_operator`: `POST /auth/login` com o cabeçalho CSRF; o
  `TestClient` guarda o cookie da resposta.
"""

from fastapi import FastAPI
from fastapi.testclient import TestClient
from httpx2 import Response

from app.presentation.api.auth import LOGIN_PATH
from app.presentation.api.authorization import (
    CSRF_HEADER_NAME,
    CSRF_HEADER_VALUE,
    AuthDependencies,
)
from tests.fixtures.auth_ficticia import (
    ADMIN_FICTICIO_SENHA,
    ADMIN_FICTICIO_USERNAME,
    OPERADOR_FICTICIO_SENHA,
    OPERADOR_FICTICIO_USERNAME,
    AuthFicticia,
)

CSRF_HEADERS = {CSRF_HEADER_NAME: CSRF_HEADER_VALUE}
TEST_BASE_URL = "https://testserver"
SAME_ORIGIN = {"Origin": TEST_BASE_URL}


def auth_dependencies(auth: AuthFicticia, *, cookie_secure: bool = True) -> AuthDependencies:
    return AuthDependencies(
        users=auth.users,
        sessions=auth.sessions,
        password_hasher=auth.hasher,
        attempt_limiter=auth.limiter,
        cookie_secure=cookie_secure,
        clock=auth.clock,
        id_generator=auth.generate_id,
    )


def auth_client(app: FastAPI, **kwargs: bool) -> TestClient:
    return TestClient(app, base_url=TEST_BASE_URL, **kwargs)


def login(client: TestClient, username: str, password: str) -> Response:
    return client.post(
        LOGIN_PATH, json={"username": username, "password": password}, headers=CSRF_HEADERS
    )


def login_as_admin(client: TestClient) -> Response:
    response = login(client, ADMIN_FICTICIO_USERNAME, ADMIN_FICTICIO_SENHA)
    assert response.status_code == 200, response.text
    return response


def login_as_operator(client: TestClient) -> Response:
    response = login(client, OPERADOR_FICTICIO_USERNAME, OPERADOR_FICTICIO_SENHA)
    assert response.status_code == 200, response.text
    return response
