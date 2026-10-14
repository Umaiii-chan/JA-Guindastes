"""Porta do limite de uso da IA por usuário (TASK-076; ADR-039)."""

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True, slots=True)
class UsageDecision:
    allowed: bool
    remaining: int
    retry_after_seconds: int
    """Quando `allowed` é falso, quanto falta para voltar a poder chamar."""


class AiUsageLimiter(Protocol):
    @property
    def limit(self) -> int: ...

    def acquire(self, key: str) -> UsageDecision:
        """Conta uma chamada para `key` e diz se ela passa; recusada não consome."""
        ...
