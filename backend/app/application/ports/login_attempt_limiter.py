"""Porta do limite de tentativas de login (ADR-016 § 3: 5 falhas por `username` em 15 min)."""

from typing import Protocol


class LoginAttemptLimiter(Protocol):
    def is_blocked(self, key: str) -> bool:
        """`True` se a chave (o `username` em minúsculas) atingiu o limite de falhas na janela."""
        ...

    def register_failure(self, key: str) -> None: ...

    def reset(self, key: str) -> None:
        """Esquece as falhas da chave (login bem-sucedido)."""
        ...
