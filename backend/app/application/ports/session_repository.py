"""Porta das sessões de login (ADR-016 § 3; TASK-038).

A sessão é opaca: o cliente guarda o token no cookie e o repositório guarda **só o SHA-256** dele
(`token_hash`), nunca o token. A expiração é absoluta (`expires_at`, 8 h desde o login).
"""

from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from app.domain.entities.user import User


@dataclass(frozen=True)
class UserSession:
    """Sessão gravada: hash do token, dono, criação e expiração (com fuso horário)."""

    token_hash: str
    user_id: str
    created_at: datetime
    expires_at: datetime


class SessionRepository(Protocol):
    def add(self, session: UserSession) -> None: ...

    def find_active_user(self, token_hash: str, now: datetime) -> User | None:
        """Dono da sessão, se ela existe, não expirou em `now` e o usuário está ativo."""
        ...

    def delete(self, token_hash: str) -> None:
        """Revoga a sessão; não faz nada se ela não existe (logout idempotente)."""
        ...

    def delete_for_user(self, user_id: str) -> None:
        """Revoga todas as sessões do usuário (desativação)."""
        ...

    def delete_expired(self, now: datetime) -> None:
        """Apaga as sessões já expiradas em `now` (limpeza)."""
        ...
