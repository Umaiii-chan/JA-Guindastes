"""Usuário do sistema, com perfil e situação (ADR-016 §§ 1 e 2; TASK-038).

- Perfis: `ADMIN` (tudo, inclusive cadastros, tabelas de carga e usuários) e `OPERATOR` (consulta,
  validação sem gravar e avaliação).
- `username`: 3 a 64 caracteres `[a-z0-9._-]`, guardado em minúsculas (`normalize_username`).
- Senha: 10 a 128 caracteres (`validate_password`). A senha nunca fica na entidade: o hash é
  guardado pelo repositório, à parte.
- `display_name`: obrigatório, sem espaços nas pontas. O ADR-016 não fixa limite de tamanho, e
  nenhum foi inventado aqui.
"""

import re
from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum

from app.domain.exceptions.user_errors import (
    InvalidDisplayNameError,
    InvalidPasswordError,
    InvalidUsernameError,
)

USERNAME_MIN_LENGTH = 3
USERNAME_MAX_LENGTH = 64
PASSWORD_MIN_LENGTH = 10
PASSWORD_MAX_LENGTH = 128

# Só ASCII: `[a-z]` não aceita letras acentuadas nem outros alfabetos.
_USERNAME_PATTERN = re.compile(rf"[a-z0-9._-]{{{USERNAME_MIN_LENGTH},{USERNAME_MAX_LENGTH}}}")


class UserRole(StrEnum):
    """Perfil do usuário (ADR-016 § 1)."""

    ADMIN = "ADMIN"
    OPERATOR = "OPERATOR"


def normalize_username(raw: str) -> str:
    """`raw` em minúsculas, se cumprir a regra do ADR-016 § 2; senão `InvalidUsernameError`."""
    if not isinstance(raw, str):
        raise InvalidUsernameError("o nome de usuário deve ser texto")
    username = raw.lower()
    if not _USERNAME_PATTERN.fullmatch(username):
        raise InvalidUsernameError(
            f"o nome de usuário deve ter de {USERNAME_MIN_LENGTH} a {USERNAME_MAX_LENGTH} "
            "caracteres, só letras sem acento, dígitos, ponto, sublinhado e hífen"
        )
    return username


def normalize_display_name(raw: str) -> str:
    """Nome de exibição sem espaços nas pontas; vazio ou só espaços → `InvalidDisplayNameError`."""
    if not isinstance(raw, str) or not raw.strip():
        raise InvalidDisplayNameError("o nome de exibição deve ser informado")
    return raw.strip()


def validate_password(password: str) -> None:
    """Confere o tamanho da senha (ADR-016 § 2). A mensagem nunca repete a senha."""
    if not isinstance(password, str):
        raise InvalidPasswordError("a senha deve ser texto")
    if not PASSWORD_MIN_LENGTH <= len(password) <= PASSWORD_MAX_LENGTH:
        raise InvalidPasswordError(
            f"a senha deve ter de {PASSWORD_MIN_LENGTH} a {PASSWORD_MAX_LENGTH} caracteres"
        )


@dataclass(frozen=True, slots=True)
class User:
    """Conta de acesso. Criada só por um admin ou pelo comando `app.create_admin` (ADR-016 § 2)."""

    id: str
    username: str
    display_name: str
    role: UserRole
    active: bool
    created_at: datetime

    def __post_init__(self) -> None:
        if not isinstance(self.id, str) or not self.id.strip():
            raise ValueError("o id do usuário deve ser informado")
        if normalize_username(self.username) != self.username:
            raise InvalidUsernameError("o nome de usuário deve estar em minúsculas")
        if normalize_display_name(self.display_name) != self.display_name:
            raise InvalidDisplayNameError("o nome de exibição não pode ter espaços nas pontas")
        if not isinstance(self.role, UserRole):
            raise ValueError(f"perfil desconhecido: {self.role!r}")
        if not isinstance(self.active, bool):
            raise ValueError("a situação do usuário (ativo) deve ser booleana")
        if self.created_at.tzinfo is None:
            raise ValueError("a data de criação do usuário deve ter fuso horário")

    @property
    def is_active_admin(self) -> bool:
        return self.active and self.role is UserRole.ADMIN
