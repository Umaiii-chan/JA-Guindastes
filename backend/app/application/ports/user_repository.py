"""Porta de gravação e consulta de usuários (ADR-016 § 2; TASK-038).

O hash da senha fica fora da entidade `User`: só a gravação e o login o veem (`UserCredentials`).
"""

from dataclasses import dataclass
from typing import Protocol

from app.domain.entities.user import User


@dataclass(frozen=True)
class UserCredentials:
    """Usuário e o hash da senha dele (Argon2id, no formato PHC do adapter)."""

    user: User
    password_hash: str


class UsernameTakenError(Exception):
    """Já existe um usuário com esse `username` (a comparação é em minúsculas)."""

    def __init__(self, username: str) -> None:
        self.username = username
        super().__init__(f"já existe um usuário com o nome {username!r}")


class UserNotFoundError(Exception):
    """Não existe usuário com esse id."""

    def __init__(self, user_id: str) -> None:
        self.user_id = user_id
        super().__init__(f"usuário com id {user_id!r} não existe")


class UserRepository(Protocol):
    def add(self, user: User, password_hash: str) -> None:
        """Grava um usuário novo; `UsernameTakenError` se o `username` já existe."""
        ...

    def get_by_id(self, user_id: str) -> User | None: ...

    def get_credentials_by_username(self, username: str) -> UserCredentials | None:
        """Usuário e hash pelo `username` já normalizado (minúsculas); `None` se não existe."""
        ...

    def list_users(self) -> list[User]:
        """Todos os usuários, por `username`."""
        ...

    def update(self, user: User, password_hash: str | None = None) -> None:
        """Grava nome, perfil e situação de `user`; troca o hash se `password_hash` vier.

        O `username` e a data de criação não mudam. `UserNotFoundError` se o id não existe.
        """
        ...

    def count_active_admins(self) -> int:
        """Quantos usuários ativos têm o perfil `ADMIN`."""
        ...
