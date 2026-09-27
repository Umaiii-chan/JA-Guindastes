"""Gestão de usuários sem banco (ADR-016 § 2; TASK-038). Dados FICTÍCIOS."""

from dataclasses import replace

import pytest

from app.application.ports.user_repository import UsernameTakenError, UserNotFoundError
from app.application.use_cases.authentication import Login
from app.application.use_cases.manage_users import (
    LastAdminError,
    ManageUsers,
    OwnAdminAccessError,
)
from app.domain.entities.user import UserRole
from app.domain.exceptions.user_errors import (
    InvalidDisplayNameError,
    InvalidPasswordError,
    InvalidUsernameError,
)
from tests.fixtures.auth_ficticia import (
    OPERADOR_FICTICIO_SENHA,
    OPERADOR_FICTICIO_USERNAME,
    AuthFicticia,
    user_ficticio,
)

SENHA_NOVA_FICTICIA = "senha-nova-ficticia-456"


@pytest.fixture
def auth() -> AuthFicticia:
    return AuthFicticia()


def manage(auth: AuthFicticia) -> ManageUsers:
    return ManageUsers(
        auth.users, auth.sessions, auth.hasher, clock=auth.clock, id_generator=auth.generate_id
    )


def test_list_users_is_ordered_by_username(auth: AuthFicticia) -> None:
    assert manage(auth).list_users() == [auth.admin, auth.operator]


def test_create_user_normalizes_and_hashes(auth: AuthFicticia) -> None:
    user = manage(auth).create_user(
        username="Novo.Operador",
        display_name="  Novo Operador FICTÍCIO ",
        password=SENHA_NOVA_FICTICIA,
        role=UserRole.OPERATOR,
    )

    assert user.id == "id-gerado-1"
    assert user.username == "novo.operador"
    assert user.display_name == "Novo Operador FICTÍCIO"
    assert user.role is UserRole.OPERATOR
    assert user.active is True
    assert user.created_at == auth.clock.now
    assert auth.users.get_by_id(user.id) == user
    stored_hash = auth.users.password_hashes[user.id]
    assert stored_hash != SENHA_NOVA_FICTICIA
    assert auth.hasher.verify(stored_hash, SENHA_NOVA_FICTICIA)


@pytest.mark.parametrize(
    ("fields", "error"),
    [
        ({"username": "ab"}, InvalidUsernameError),
        ({"username": "com espaço"}, InvalidUsernameError),
        ({"display_name": "  "}, InvalidDisplayNameError),
        ({"password": "curta"}, InvalidPasswordError),
        ({"password": "x" * 129}, InvalidPasswordError),
    ],
)
def test_create_user_applies_the_name_and_password_rules(
    auth: AuthFicticia, fields: dict[str, str], error: type[Exception]
) -> None:
    arguments = {
        "username": "novo.usuario",
        "display_name": "Novo FICTÍCIO",
        "password": SENHA_NOVA_FICTICIA,
    } | fields

    with pytest.raises(error):
        manage(auth).create_user(**arguments, role=UserRole.OPERATOR)
    assert len(auth.users.users) == 2


def test_create_user_with_a_taken_username_in_other_case_fails(auth: AuthFicticia) -> None:
    with pytest.raises(UsernameTakenError):
        manage(auth).create_user(
            username=OPERADOR_FICTICIO_USERNAME.upper(),
            display_name="Outro",
            password=SENHA_NOVA_FICTICIA,
            role=UserRole.OPERATOR,
        )


def test_update_changes_only_the_given_fields(auth: AuthFicticia) -> None:
    updated = manage(auth).update_user(
        actor=auth.admin, user_id=auth.operator.id, display_name=" Nome Novo FICTÍCIO "
    )

    assert updated == replace(auth.operator, display_name="Nome Novo FICTÍCIO")
    assert auth.users.get_by_id(auth.operator.id) == updated


def test_update_can_promote_and_change_the_password(auth: AuthFicticia) -> None:
    updated = manage(auth).update_user(
        actor=auth.admin,
        user_id=auth.operator.id,
        role=UserRole.ADMIN,
        password=SENHA_NOVA_FICTICIA,
    )

    assert updated.role is UserRole.ADMIN
    stored_hash = auth.users.password_hashes[auth.operator.id]
    assert auth.hasher.verify(stored_hash, SENHA_NOVA_FICTICIA)
    assert not auth.hasher.verify(stored_hash, OPERADOR_FICTICIO_SENHA)


def test_update_rejects_an_invalid_password_without_saving(auth: AuthFicticia) -> None:
    with pytest.raises(InvalidPasswordError):
        manage(auth).update_user(
            actor=auth.admin, user_id=auth.operator.id, display_name="X", password="curta"
        )

    assert auth.users.get_by_id(auth.operator.id) == auth.operator


def test_update_of_a_missing_user_fails(auth: AuthFicticia) -> None:
    with pytest.raises(UserNotFoundError):
        manage(auth).update_user(actor=auth.admin, user_id="nao-existe", active=False)


def test_deactivation_revokes_the_sessions(auth: AuthFicticia) -> None:
    login = Login(auth.users, auth.sessions, auth.hasher, auth.limiter, clock=auth.clock)
    login.execute(OPERADOR_FICTICIO_USERNAME, OPERADOR_FICTICIO_SENHA)
    assert auth.sessions.sessions

    updated = manage(auth).update_user(actor=auth.admin, user_id=auth.operator.id, active=False)

    assert updated.active is False
    assert auth.sessions.sessions == {}


@pytest.mark.parametrize("changes", [{"active": False}, {"role": UserRole.OPERATOR}])
def test_admin_cannot_remove_own_admin_access(
    auth: AuthFicticia, changes: dict[str, object]
) -> None:
    second_admin = user_ficticio("admin.dois", UserRole.ADMIN)
    auth.users.add(second_admin, auth.hasher.hash(SENHA_NOVA_FICTICIA))

    with pytest.raises(OwnAdminAccessError):
        manage(auth).update_user(actor=auth.admin, user_id=auth.admin.id, **changes)  # type: ignore[arg-type]

    assert auth.users.get_by_id(auth.admin.id) == auth.admin


def test_admin_can_change_own_name_and_password(auth: AuthFicticia) -> None:
    updated = manage(auth).update_user(
        actor=auth.admin,
        user_id=auth.admin.id,
        display_name="Admin Renomeado",
        password=SENHA_NOVA_FICTICIA,
        role=UserRole.ADMIN,
        active=True,
    )

    assert updated.display_name == "Admin Renomeado"


@pytest.mark.parametrize("changes", [{"active": False}, {"role": UserRole.OPERATOR}])
def test_the_last_active_admin_cannot_lose_access(
    auth: AuthFicticia, changes: dict[str, object]
) -> None:
    # O ator é um admin cuja conta já foi desativada por outra requisição (visão desatualizada):
    # o alvo é o único admin ativo.
    stale_actor = user_ficticio("admin.antigo", UserRole.ADMIN, active=False)

    with pytest.raises(LastAdminError):
        manage(auth).update_user(actor=stale_actor, user_id=auth.admin.id, **changes)  # type: ignore[arg-type]

    assert auth.users.get_by_id(auth.admin.id) == auth.admin


def test_another_admin_can_be_demoted_when_one_admin_remains(auth: AuthFicticia) -> None:
    second_admin = user_ficticio("admin.dois", UserRole.ADMIN)
    auth.users.add(second_admin, auth.hasher.hash(SENHA_NOVA_FICTICIA))

    updated = manage(auth).update_user(
        actor=auth.admin, user_id=second_admin.id, role=UserRole.OPERATOR
    )

    assert updated.role is UserRole.OPERATOR
    assert [user.username for user in auth.users.list_users() if user.is_active_admin] == [
        auth.admin.username
    ]


@pytest.mark.parametrize("changes", [{"active": False}, {"role": UserRole.OPERATOR}])
def test_repository_refuses_to_remove_the_last_active_admin_without_saving(
    auth: AuthFicticia, changes: dict[str, object]
) -> None:
    # A garantia é do repositório (conferência e escrita juntas), não só do caso de uso.
    with pytest.raises(LastAdminError):
        auth.users.update(replace(auth.admin, **changes))  # type: ignore[arg-type]

    assert auth.users.get_by_id(auth.admin.id) == auth.admin


def test_repository_allows_other_changes_to_the_last_admin(auth: AuthFicticia) -> None:
    auth.users.update(replace(auth.admin, display_name="Admin Renomeado"), "fake$nova")

    assert auth.users.get_by_id(auth.admin.id) == replace(
        auth.admin, display_name="Admin Renomeado"
    )


def test_inactive_user_can_be_reactivated(auth: AuthFicticia) -> None:
    auth.users.update(replace(auth.operator, active=False))

    updated = manage(auth).update_user(actor=auth.admin, user_id=auth.operator.id, active=True)

    assert updated.active is True
