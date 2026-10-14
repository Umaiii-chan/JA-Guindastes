"""Composição do assistente de IA (TASK-076; ADR-039).

Parte da raiz de composição (`app.main`): fica fora das camadas do import-linter e nenhum módulo das
camadas deve importá-la.

Variáveis (ver `.env.example`; nenhuma tem valor no repositório):
- `GEMINI_API_KEY`: chave do Google AI Studio. Ausente ou vazia, a IA fica **desligada**
  (`GET /ai/status` responde `enabled: false`) e a API sobe normalmente. A chave nunca é registrada
  em log nem aparece em mensagem de erro;
- `GEMINI_MODEL`: modelo padrão (`gemini-3.7-flash`);
- `GEMINI_FALLBACK_MODELS`: reservas, separadas por vírgula (`gemini-3-flash-preview,
  gemini-flash-lite-latest`), usadas quando o padrão fica sobrecarregado;
- `AI_RATE_LIMIT_PER_HOUR`: usos por hora por usuário (padrão 20; valor inválido volta ao padrão).
"""

import logging
import os
from collections.abc import Mapping

from app.application.use_cases.ai_assistant import AiAssistant
from app.infrastructure.ai.gemini_provider import (
    DEFAULT_FALLBACK_MODELS,
    DEFAULT_MODEL,
    GeminiProvider,
    parse_model_list,
)
from app.infrastructure.ai.in_memory_usage_limiter import (
    DEFAULT_LIMIT_PER_HOUR,
    InMemoryAiUsageLimiter,
)

logger = logging.getLogger(__name__)

API_KEY_ENV_VAR = "GEMINI_API_KEY"
MODEL_ENV_VAR = "GEMINI_MODEL"
FALLBACK_MODELS_ENV_VAR = "GEMINI_FALLBACK_MODELS"
RATE_LIMIT_ENV_VAR = "AI_RATE_LIMIT_PER_HOUR"


def build_ai_assistant(environ: Mapping[str, str] | None = None) -> AiAssistant | None:
    """O assistente de IA, ou `None` se `GEMINI_API_KEY` não está definida."""
    source = os.environ if environ is None else environ
    api_key = source.get(API_KEY_ENV_VAR, "").strip()
    if not api_key:
        logger.info("%s não definida: o assistente de IA fica desligado", API_KEY_ENV_VAR)
        return None
    model = source.get(MODEL_ENV_VAR, "").strip() or DEFAULT_MODEL
    fallbacks = parse_model_list(source.get(FALLBACK_MODELS_ENV_VAR), DEFAULT_FALLBACK_MODELS)
    try:
        provider = GeminiProvider(api_key, model, fallbacks)
    except ValueError:
        logger.warning("%s inválido: o assistente de IA fica desligado", MODEL_ENV_VAR)
        return None
    return AiAssistant(provider, InMemoryAiUsageLimiter(limit=_rate_limit(source)))


def _rate_limit(source: Mapping[str, str]) -> int:
    raw = source.get(RATE_LIMIT_ENV_VAR, "").strip()
    if not raw:
        return DEFAULT_LIMIT_PER_HOUR
    try:
        value = int(raw)
    except ValueError:
        value = 0
    if value < 1:
        logger.warning(
            "%s inválida: vale o padrão de %s", RATE_LIMIT_ENV_VAR, DEFAULT_LIMIT_PER_HOUR
        )
        return DEFAULT_LIMIT_PER_HOUR
    return value
