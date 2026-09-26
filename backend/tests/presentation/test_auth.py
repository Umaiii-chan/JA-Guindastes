"""Rotas `/api/v1/auth/*`, cookie e CSRF (ADR-016 §§ 3–5; TASK-038). Dados FICTÍCIOS, sem banco."""

import logging
from dataclasses import replace

import pytest
from fastapi.testclient import TestClient

from app.presentation.api.auth import LOGIN_PATH, LOGOUT_PATH, SESSION_PATH
from app.presentation.api.main import create_app
from app.presentation.api.users import USERS_PATH
from tests.fixtures.auth_api_ficticia import (
    CSRF_HEADERS,
    auth_client,
    auth_dependencies,
    login,
    login_as_admin,
)
from tests.fixtures.auth_ficticia import (
    ADMIN_FICTICIO_SENHA,
    ADMIN_FICTICIO_USERNAME,
    OPERADOR_FICTICIO_SENHA,
    OPERADOR_FICTICIO_USERNAME,
    AuthFicticia,
)

INVALID_CREDENTIALS_BODY = {
    "detail": "usuário ou senha inválidos",
    "code": "INVALID_CREDENTIALS",
}


@pytest.fixture
def auth() -> AuthFicticia:
    return AuthFicticia()


@pytest.fixture
def client(auth: AuthFicticia) -> TestClient:
    return auth_client(create_app(auth=auth_dependencies(auth)))


def test_session_without_cookie_has_no_user(client: TestClient) -> None:
    response = client.get(SESSION_PATH)

    assert response.status_code == 200
    assert response.json() == {"authEnabled": True, "user": None}


def test_login_returns_the_user_in_camel_case_and_sets_the_cookie(
    client: TestClient, auth: AuthFicticia
) -> None:
    response = login_as_admin(client)

    assert response.json() == {
        "user": {
            "id": auth.admin.id,
            "username": ADMIN_FICTICIO_USERNAME,
            "displayName": auth.admin.display_name,
            "role": "ADMIN",
            "active": True,
            "createdAt": "2026-09-26T12:00:00Z",
        }
    }
    set_cookie = response.headers["set-cookie"]
    assert set_cookie.startswith("crane_session=")
    attributes = {part.strip().lower() for part in set_cookie.split(";")[1:]}
    assert {"httponly", "samesite=strict", "path=/", "secure", "max-age=28800"} <= attributes
    token = client.cookies["crane_session"]
    assert len(token) == 43
    assert ADMIN_FICTICIO_SENHA not in response.text


def test_cookie_is_not_secure_when_configured_for_local_http(auth: AuthFicticia) -> None:
    client = TestClient(create_app(auth=auth_dependencies(auth, cookie_secure=False)))

    response = login(client, ADMIN_FICTICIO_USERNAME, ADMIN_FICTICIO_SENHA)

    attributes = {part.strip().lower() for part in response.headers["set-cookie"].split(";")}
    assert "secure" not in attributes
    assert client.get(SESSION_PATH).json()["user"]["username"] == ADMIN_FICTICIO_USERNAME


def test_session_shows_the_logged_in_user(client: TestClient, auth: AuthFicticia) -> None:
    login(client, OPERADOR_FICTICIO_USERNAME.upper(), OPERADOR_FICTICIO_SENHA)

    body = client.get(SESSION_PATH).json()

    assert body["authEnabled"] is True
    assert body["user"]["id"] == auth.operator.id
    assert body["user"]["role"] == "OPERATOR"


@pytest.mark.parametrize(
    ("username", "password"),
    [
        (ADMIN_FICTICIO_USERNAME, "senha-errada-ficticia"),
        ("nao.existe", ADMIN_FICTICIO_SENHA),
        ("", ""),
    ],
)
def test_failed_login_is_a_generic_401(client: TestClient, username: str, password: str) -> None:
    response = login(client, username, password)

    assert response.status_code == 401
    assert response.json() == INVALID_CREDENTIALS_BODY
    assert "set-cookie" not in response.headers


def test_inactive_user_gets_the_same_401(client: TestClient, auth: AuthFicticia) -> None:
    auth.users.update(replace(auth.operator, active=False))

    response = login(client, OPERADOR_FICTICIO_USERNAME, OPERADOR_FICTICIO_SENHA)

    assert response.status_code == 401
    assert response.json() == INVALID_CREDENTIALS_BODY


def test_five_failures_in_a_row_give_429(client: TestClient) -> None:
    for _ in range(5):
        assert login(client, ADMIN_FICTICIO_USERNAME, "senha-errada-ficticia").status_code == 401

    response = login(client, ADMIN_FICTICIO_USERNAME, ADMIN_FICTICIO_SENHA)

    assert response.status_code == 429
    assert response.json()["code"] == "TOO_MANY_ATTEMPTS"


def test_logout_revokes_the_session_and_clears_the_cookie(
    client: TestClient, auth: AuthFicticia
) -> None:
    login_as_admin(client)
    assert auth.sessions.sessions

    response = client.post(LOGOUT_PATH, headers=CSRF_HEADERS)

    assert response.status_code == 204
    set_cookie = response.headers["set-cookie"].lower()
    assert set_cookie.startswith('crane_session=""') or set_cookie.startswith("crane_session=;")
    assert "max-age=0" in set_cookie
    assert auth.sessions.sessions == {}
    assert client.get(SESSION_PATH).json()["user"] is None


def test_logout_without_session_is_idempotent(client: TestClient) -> None:
    assert client.post(LOGOUT_PATH, headers=CSRF_HEADERS).status_code == 204
    assert client.post(LOGOUT_PATH, headers=CSRF_HEADERS).status_code == 204


@pytest.mark.parametrize("headers", [{}, {"X-Requested-With": "XMLHttpRequest"}])
def test_unsafe_methods_without_the_csrf_header_get_403(
    client: TestClient, headers: dict[str, str]
) -> None:
    body = {"username": ADMIN_FICTICIO_USERNAME, "password": ADMIN_FICTICIO_SENHA}

    responses = [
        client.post(LOGIN_PATH, json=body, headers=headers),
        client.post(LOGOUT_PATH, headers=headers),
        client.patch(f"{USERS_PATH}/qualquer", json={}, headers=headers),
        client.put(USERS_PATH, json={}, headers=headers),
        client.delete(USERS_PATH, headers=headers),
    ]

    for response in responses:
        assert response.status_code == 403
        assert response.json() == {
            "detail": "envie o cabeçalho X-Requested-With: crane-simulator",
            "code": "CSRF_HEADER_MISSING",
        }
    assert "set-cookie" not in responses[0].headers


def test_malformed_login_body_does_not_echo_the_password(client: TestClient) -> None:
    response = client.post(
        LOGIN_PATH,
        json={"username": ADMIN_FICTICIO_USERNAME, "password": ADMIN_FICTICIO_SENHA, "extra": 1},
        headers=CSRF_HEADERS,
    )

    assert response.status_code == 422
    assert ADMIN_FICTICIO_SENHA not in response.text
    assert all("input" not in error for error in response.json()["detail"])


def test_logs_never_contain_the_password_or_the_token(
    client: TestClient, caplog: pytest.LogCaptureFixture
) -> None:
    with caplog.at_level(logging.DEBUG):
        login(client, ADMIN_FICTICIO_USERNAME, "senha-errada-ficticia")
        login_as_admin(client)
        token = client.cookies["crane_session"]
        client.post(LOGOUT_PATH, headers=CSRF_HEADERS)

    assert caplog.records
    for secret in (ADMIN_FICTICIO_SENHA, "senha-errada-ficticia", token):
        assert secret not in caplog.text


# --- sem banco (ADR-016 § 5) ------------------------------------------------------------------


def test_without_database_the_session_says_auth_is_disabled() -> None:
    client = TestClient(create_app())

    response = client.get(SESSION_PATH)

    assert response.status_code == 200
    assert response.json() == {"authEnabled": False, "user": None}


def test_without_database_login_and_user_routes_do_not_exist() -> None:
    client = TestClient(create_app())

    assert client.post(LOGIN_PATH, json={}, headers=CSRF_HEADERS).status_code == 404
    assert client.post(LOGOUT_PATH, headers=CSRF_HEADERS).status_code == 404
    assert client.get(USERS_PATH).status_code == 404
    paths = client.get("/openapi.json").json()["paths"]
    assert SESSION_PATH in paths
    assert LOGIN_PATH not in paths
    assert USERS_PATH not in paths
