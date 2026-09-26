"""Entidade `User` e regras de nome e senha (ADR-016 §§ 1 e 2; TASK-038). Dados FICTÍCIOS."""

from dataclasses import replace
from datetime import datetime

import pytest

from app.domain.entities.user import (
    User,
    UserRole,
    normalize_display_name,
    normalize_username,
    validate_password,
)
from app.domain.exceptions.domain_errors import DomainError
from app.domain.exceptions.user_errors import (
    InvalidDisplayNameError,
    InvalidPasswordError,
    InvalidUsernameError,
)
from tests.fixtures.auth_ficticia import INSTANTE_FICTICIO, user_ficticio


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("abc", "abc"),
        ("Operador.Ficticio", "operador.ficticio"),
        ("ADMIN_01-x", "admin_01-x"),
        ("a" * 64, "a" * 64),
    ],
)
def test_username_is_stored_in_lowercase(raw: str, expected: str) -> None:
    assert normalize_username(raw) == expected


@pytest.mark.parametrize(
    "raw",
    ["ab", "a" * 65, "", "com espaço", "joão", "nome@ficticio", " abc", "abc\n", "ab/c"],
)
def test_username_outside_the_rule_is_rejected(raw: str) -> None:
    with pytest.raises(InvalidUsernameError) as error:
        normalize_username(raw)

    assert error.value.field == "username"
    assert isinstance(error.value, DomainError)


@pytest.mark.parametrize("password", ["a" * 10, "b" * 128, "senha com espaços ok"])
def test_password_between_10_and_128_characters_is_accepted(password: str) -> None:
    validate_password(password)


@pytest.mark.parametrize("password", ["", "a" * 9, "b" * 129])
def test_password_outside_the_limits_is_rejected_without_echoing_it(password: str) -> None:
    with pytest.raises(InvalidPasswordError) as error:
        validate_password(password)

    assert error.value.field == "password"
    if password:
        assert password not in str(error.value)


def test_display_name_is_trimmed_and_required() -> None:
    assert normalize_display_name("  Operador FICTÍCIO ") == "Operador FICTÍCIO"
    for blank in ("", "   "):
        with pytest.raises(InvalidDisplayNameError):
            normalize_display_name(blank)


def test_user_carries_role_and_active_flag() -> None:
    admin = user_ficticio("admin.ficticio", UserRole.ADMIN)
    inactive_admin = replace(admin, active=False)
    operator = user_ficticio("operador.ficticio", UserRole.OPERATOR)

    assert admin.role is UserRole.ADMIN and admin.active
    assert admin.is_active_admin
    assert not inactive_admin.is_active_admin
    assert not operator.is_active_admin


@pytest.mark.parametrize(
    ("changes", "error"),
    [
        ({"username": "Maiusculo"}, InvalidUsernameError),
        ({"username": "x"}, InvalidUsernameError),
        ({"display_name": " com espaço "}, InvalidDisplayNameError),
        ({"display_name": ""}, InvalidDisplayNameError),
        ({"id": " "}, ValueError),
        ({"role": "ADMIN"}, ValueError),
        ({"active": 1}, ValueError),
        ({"created_at": datetime(2026, 9, 26, 12, 0)}, ValueError),
    ],
)
def test_user_rejects_invalid_fields(changes: dict[str, object], error: type[Exception]) -> None:
    fields: dict[str, object] = {
        "id": "id-ficticio",
        "username": "usuario.ficticio",
        "display_name": "Usuário FICTÍCIO",
        "role": UserRole.OPERATOR,
        "active": True,
        "created_at": INSTANTE_FICTICIO,
    }
    fields.update(changes)

    with pytest.raises(error):
        User(**fields)  # type: ignore[arg-type]
