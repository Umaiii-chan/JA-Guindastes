"""Rotas `/api/v1/users*` (ADR-016 §§ 2 e 4; TASK-038). Dados FICTÍCIOS, sem banco."""

from dataclasses import replace

import pytest
from fastapi.testclient import TestClient

from app.domain.entities.user import User, UserRole
from app.presentation.api.auth import SESSION_PATH
from app.presentation.api.main import create_app
from app.presentation.api.users import USERS_PATH
from tests.fixtures.auth_api_ficticia import (
    CSRF_HEADERS,
    auth_client,
    auth_dependencies,
    login,
    login_as_admin,
    login_as_operator,
)
from tests.fixtures.auth_ficticia import (
    OPERADOR_FICTICIO_SENHA,
    OPERADOR_FICTICIO_USERNAME,
    AuthFicticia,
    user_ficticio,
)

SENHA_NOVA_FICTICIA = "senha-nova-ficticia-789"


@pytest.fixture
def auth() -> AuthFicticia:
    return AuthFicticia()


@pytest.fixture
def client(auth: AuthFicticia) -> TestClient:
    return auth_client(create_app(auth=auth_dependencies(auth)))


@pytest.fixture
def admin_client(client: TestClient) -> TestClient:
    login_as_admin(client)
    return client


def new_user_body(**changes: object) -> dict[str, object]:
    body: dict[str, object] = {
        "username": "Novo.Operador",
        "displayName": "Novo Operador FICTÍCIO",
        "password": SENHA_NOVA_FICTICIA,
        "role": "OPERATOR",
    }
    body.update(changes)
    return body


def test_user_routes_require_a_session(client: TestClient) -> None:
    responses = [
        client.get(USERS_PATH),
        client.post(USERS_PATH, json=new_user_body(), headers=CSRF_HEADERS),
        client.patch(f"{USERS_PATH}/qualquer", json={}, headers=CSRF_HEADERS),
    ]

    for response in responses:
        assert response.status_code == 401
        assert response.json() == {
            "detail": "sessão ausente ou expirada",
            "code": "NOT_AUTHENTICATED",
        }


def test_user_routes_are_forbidden_to_the_operator(client: TestClient, auth: AuthFicticia) -> None:
    login_as_operator(client)

    responses = [
        client.get(USERS_PATH),
        client.post(USERS_PATH, json=new_user_body(), headers=CSRF_HEADERS),
        client.patch(f"{USERS_PATH}/{auth.operator.id}", json={}, headers=CSRF_HEADERS),
    ]

    for response in responses:
        assert response.status_code == 403
        assert response.json()["code"] == "FORBIDDEN"
    assert len(auth.users.users) == 2


def test_admin_lists_the_users(admin_client: TestClient, auth: AuthFicticia) -> None:
    response = admin_client.get(USERS_PATH)

    assert response.status_code == 200
    items = response.json()["items"]
    assert [item["username"] for item in items] == [auth.admin.username, auth.operator.username]
    assert set(items[0]) == {"id", "username", "displayName", "role", "active", "createdAt"}


def test_admin_creates_a_user_who_can_log_in(admin_client: TestClient, auth: AuthFicticia) -> None:
    response = admin_client.post(USERS_PATH, json=new_user_body(), headers=CSRF_HEADERS)

    assert response.status_code == 201
    assert response.json() == {
        "id": "id-gerado-1",
        "username": "novo.operador",
        "displayName": "Novo Operador FICTÍCIO",
        "role": "OPERATOR",
        "active": True,
        "createdAt": "2026-09-26T12:00:00Z",
    }
    assert SENHA_NOVA_FICTICIA not in response.text
    other = auth_client(admin_client.app)  # type: ignore[arg-type]
    assert login(other, "novo.operador", SENHA_NOVA_FICTICIA).status_code == 200


def test_taken_username_gives_409(admin_client: TestClient) -> None:
    response = admin_client.post(
        USERS_PATH,
        json=new_user_body(username=OPERADOR_FICTICIO_USERNAME.upper()),
        headers=CSRF_HEADERS,
    )

    assert response.status_code == 409
    assert response.json()["code"] == "USERNAME_TAKEN"


@pytest.mark.parametrize(
    ("changes", "field"),
    [
        ({"username": "ab"}, "username"),
        ({"displayName": "   "}, "displayName"),
        ({"password": "curta"}, "password"),
        ({"password": "x" * 129}, "password"),
    ],
)
def test_rule_violations_give_422_on_the_field_without_echoing_it(
    admin_client: TestClient, changes: dict[str, object], field: str
) -> None:
    response = admin_client.post(USERS_PATH, json=new_user_body(**changes), headers=CSRF_HEADERS)

    assert response.status_code == 422
    [error] = response.json()["detail"]
    assert error["loc"] == ["body", field]
    assert error["type"] == "value_error"
    assert "input" not in error
    assert SENHA_NOVA_FICTICIA not in response.text


@pytest.mark.parametrize(
    "body",
    [
        new_user_body(role="SUPERUSER"),
        new_user_body(display_name="snake_case"),
        {"username": "sem.senha", "displayName": "X", "role": "OPERATOR"},
    ],
)
def test_malformed_body_gives_422_without_echoing_the_password(
    admin_client: TestClient, body: dict[str, object]
) -> None:
    response = admin_client.post(USERS_PATH, json=body, headers=CSRF_HEADERS)

    assert response.status_code == 422
    assert SENHA_NOVA_FICTICIA not in response.text


def test_admin_updates_name_role_and_password(admin_client: TestClient, auth: AuthFicticia) -> None:
    response = admin_client.patch(
        f"{USERS_PATH}/{auth.operator.id}",
        json={
            "displayName": "Operador Promovido",
            "role": "ADMIN",
            "password": SENHA_NOVA_FICTICIA,
        },
        headers=CSRF_HEADERS,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["displayName"] == "Operador Promovido"
    assert body["role"] == "ADMIN"
    other = auth_client(admin_client.app)  # type: ignore[arg-type]
    assert login(other, OPERADOR_FICTICIO_USERNAME, OPERADOR_FICTICIO_SENHA).status_code == 401
    assert login(other, OPERADOR_FICTICIO_USERNAME, SENHA_NOVA_FICTICIA).status_code == 200


def test_deactivation_ends_the_sessions_of_the_user(
    admin_client: TestClient, auth: AuthFicticia
) -> None:
    operator_client = auth_client(admin_client.app)  # type: ignore[arg-type]
    login_as_operator(operator_client)
    assert operator_client.get(SESSION_PATH).json()["user"] is not None

    response = admin_client.patch(
        f"{USERS_PATH}/{auth.operator.id}", json={"active": False}, headers=CSRF_HEADERS
    )

    assert response.status_code == 200
    assert response.json()["active"] is False
    assert operator_client.get(SESSION_PATH).json()["user"] is None


def test_update_of_a_missing_user_gives_404(admin_client: TestClient) -> None:
    response = admin_client.patch(
        f"{USERS_PATH}/nao-existe", json={"active": False}, headers=CSRF_HEADERS
    )

    assert response.status_code == 404
    assert response.json()["code"] == "USER_NOT_FOUND"


@pytest.mark.parametrize("change", [{"active": False}, {"role": "OPERATOR"}])
def test_admin_cannot_remove_own_admin_access(
    admin_client: TestClient, auth: AuthFicticia, change: dict[str, object]
) -> None:
    auth.users.add(user_ficticio("admin.dois", UserRole.ADMIN), "hash-ficticio")

    response = admin_client.patch(
        f"{USERS_PATH}/{auth.admin.id}", json=change, headers=CSRF_HEADERS
    )

    assert response.status_code == 409
    assert response.json()["code"] == "OWN_ADMIN_ACCESS"
    assert auth.users.get_by_id(auth.admin.id) == auth.admin


def test_last_admin_protection_gives_409(admin_client: TestClient, auth: AuthFicticia) -> None:
    # Simula uma corrida: o admin da sessão passou pela guarda, mas outra requisição o rebaixa logo
    # antes da gravação; o alvo vira o último admin ativo e o repositório recusa.
    second_admin = user_ficticio("admin.dois", UserRole.ADMIN)
    auth.users.add(second_admin, "hash-ficticio")
    original_update = auth.users.update

    def update_after_a_concurrent_demotion(user: User, password_hash: str | None = None) -> None:
        auth.users.users[auth.admin.id] = replace(auth.admin, role=UserRole.OPERATOR)
        original_update(user, password_hash)

    auth.users.update = update_after_a_concurrent_demotion  # type: ignore[method-assign]

    response = admin_client.patch(
        f"{USERS_PATH}/{second_admin.id}", json={"role": "OPERATOR"}, headers=CSRF_HEADERS
    )

    assert response.status_code == 409
    assert response.json()["code"] == "LAST_ADMIN"


def test_invalid_new_password_gives_422(admin_client: TestClient, auth: AuthFicticia) -> None:
    response = admin_client.patch(
        f"{USERS_PATH}/{auth.operator.id}", json={"password": "curta"}, headers=CSRF_HEADERS
    )

    assert response.status_code == 422
    assert response.json()["detail"][0]["loc"] == ["body", "password"]
