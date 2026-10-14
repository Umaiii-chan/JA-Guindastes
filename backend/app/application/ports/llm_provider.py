"""Porta do provedor de modelo de linguagem (TASK-076; ADR-039).

A IA só redige e organiza: nunca decide capacidade, utilização nem segurança (RN-004, RN-008). Quem
usa esta porta entrega números já calculados pelo cálculo determinístico e valida tudo o que volta.
O adaptador (`app.infrastructure.ai.gemini_provider`) cuida de timeout, repetição e modelo reserva.
"""

from collections.abc import Mapping
from dataclasses import dataclass
from enum import StrEnum
from typing import Any, Protocol


class LlmErrorKind(StrEnum):
    UNAVAILABLE = "UNAVAILABLE"
    """Provedor sobrecarregado ou fora do ar, mesmo depois das repetições e do modelo reserva."""
    RATE_LIMITED = "RATE_LIMITED"
    """Cota do provedor esgotada."""
    TIMEOUT = "TIMEOUT"
    """Sem resposta dentro do prazo."""
    REJECTED = "REJECTED"
    """O provedor recusou o pedido (conteúdo bloqueado, pedido inválido, chave sem permissão)."""
    BAD_RESPONSE = "BAD_RESPONSE"
    """Resposta vazia ou fora do formato esperado."""


class LlmError(Exception):
    """Falha ao falar com o modelo. A mensagem é para a pessoa e nunca leva a chave."""

    def __init__(self, kind: LlmErrorKind, message: str) -> None:
        self.kind = kind
        self.message = message
        super().__init__(message)


@dataclass(frozen=True, slots=True)
class LlmRequest:
    system: str
    """Instruções fixas (papel e limites do assistente)."""
    user: str
    """Conteúdo do pedido, com os dados já calculados."""
    json_schema: Mapping[str, Any] | None = None
    """Com um esquema, a resposta é JSON estruturado (`application/json`)."""
    temperature: float = 0.2
    max_output_tokens: int = 4096
    thinking_level: str | None = "low"
    """Nível de raciocínio do modelo (`low`); `None` deixa o padrão do provedor, bem mais lento."""


@dataclass(frozen=True, slots=True)
class LlmCompletion:
    text: str
    model: str
    """Modelo que respondeu de fato (pode ser um modelo reserva)."""
    fallback_used: bool = False
    calls: int = 1
    """Quantas chamadas ao provedor foram feitas até esta resposta."""


class LlmProvider(Protocol):
    @property
    def model(self) -> str:
        """Modelo padrão."""
        ...

    @property
    def fallback_models(self) -> tuple[str, ...]: ...

    def generate(self, request: LlmRequest) -> LlmCompletion:
        """Gera a resposta; levanta `LlmError` se não conseguir."""
        ...
