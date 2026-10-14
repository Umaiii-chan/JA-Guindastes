"""Provedor com reserva entre fornecedores (TASK-079; ADR-040).

Com as duas chaves configuradas, o primário responde; se ele falhar por sobrecarga, cota ou prazo
(`UNAVAILABLE`, `RATE_LIMITED`, `TIMEOUT`), o secundário tenta o mesmo pedido. Recusas
(`REJECTED`) e respostas inutilizáveis (`BAD_RESPONSE`) não trocam de provedor: repetir o mesmo
pedido em outro modelo não as resolve, e o conteúdo bloqueado não deve ser reenviado.
"""

import logging

from app.application.ports.llm_provider import (
    LlmCompletion,
    LlmError,
    LlmErrorKind,
    LlmProvider,
    LlmRequest,
)

logger = logging.getLogger(__name__)

_SWITCH_ON = frozenset({LlmErrorKind.UNAVAILABLE, LlmErrorKind.RATE_LIMITED, LlmErrorKind.TIMEOUT})


class FallbackLlmProvider:
    """Implementa `LlmProvider` sobre dois provedores, em ordem de preferência."""

    def __init__(self, primary: LlmProvider, secondary: LlmProvider) -> None:
        self._primary = primary
        self._secondary = secondary

    @property
    def model(self) -> str:
        return self._primary.model

    @property
    def fallback_models(self) -> tuple[str, ...]:
        return (
            *self._primary.fallback_models,
            self._secondary.model,
            *self._secondary.fallback_models,
        )

    def generate(self, request: LlmRequest) -> LlmCompletion:
        try:
            return self._primary.generate(request)
        except LlmError as error:
            if error.kind not in _SWITCH_ON:
                raise
            logger.warning("IA: provedor principal falhou (%s); tentando o outro", error.kind)
        completion = self._secondary.generate(request)
        return LlmCompletion(
            text=completion.text,
            model=completion.model,
            fallback_used=True,
            calls=completion.calls,
        )
