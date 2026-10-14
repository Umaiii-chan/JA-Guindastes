"""Composição do assistente de IA (TASK-076; ADR-039).

Parte da raiz de composição (`app.main`): fica fora das camadas do import-linter e nenhum módulo das
camadas deve importá-la.

Variáveis (ver `.env.example`; nenhuma tem valor no repositório):
- `AI_PROVIDER`: `auto` (padrão), `openai`, `groq` ou `gemini`. Em `auto`, o primário é o primeiro
  com chave na ordem OpenAI, Groq, Gemini, e o segundo com chave vira a reserva: se o primário
  falhar por sobrecarga, cota ou prazo, a reserva tenta o mesmo pedido. `openai`, `groq` e `gemini`
  usam só o provedor escolhido;
- `OPENAI_API_KEY`: chave da OpenAI; `OPENAI_MODEL` (padrão `gpt-5-mini`) e
  `OPENAI_FALLBACK_MODELS` (padrão vazio, separados por vírgula);
- `GROQ_API_KEY`: chave do Groq (API compatível com a da OpenAI, em `api.groq.com/openai/v1`);
  `GROQ_MODEL` (padrão `openai/gpt-oss-120b`) e `GROQ_FALLBACK_MODELS` (padrão vazio);
- `GEMINI_API_KEY`: chave do Google AI Studio; `GEMINI_MODEL` (`gemini-3.7-flash`) e
  `GEMINI_FALLBACK_MODELS` (`gemini-3-flash-preview,gemini-flash-lite-latest`);
- sem a chave do provedor escolhido, a IA fica **desligada** (`GET /ai/status` responde
  `enabled: false`) e a API sobe normalmente. As chaves nunca são registradas em log nem aparecem
  em mensagem de erro;
- `AI_RATE_LIMIT_PER_HOUR`: usos por hora por usuário (padrão 20; valor inválido volta ao padrão).
"""

import logging
import os
from collections.abc import Callable, Mapping

from app.application.ports.llm_provider import LlmProvider
from app.application.use_cases.ai_assistant import AiAssistant
from app.infrastructure.ai import openai_provider
from app.infrastructure.ai.fallback_provider import FallbackLlmProvider
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
OPENAI_API_KEY_ENV_VAR = "OPENAI_API_KEY"
OPENAI_MODEL_ENV_VAR = "OPENAI_MODEL"
OPENAI_FALLBACK_MODELS_ENV_VAR = "OPENAI_FALLBACK_MODELS"
GROQ_API_KEY_ENV_VAR = "GROQ_API_KEY"
GROQ_MODEL_ENV_VAR = "GROQ_MODEL"
GROQ_FALLBACK_MODELS_ENV_VAR = "GROQ_FALLBACK_MODELS"
GROQ_BASE_URL = "https://api.groq.com/openai/v1"
GROQ_DEFAULT_MODEL = "openai/gpt-oss-120b"
PROVIDER_ENV_VAR = "AI_PROVIDER"
RATE_LIMIT_ENV_VAR = "AI_RATE_LIMIT_PER_HOUR"

# Com os dois provedores, o orçamento de ~55 s é dividido entre eles.
_DEFAULT_DEADLINE_SECONDS = 55.0
_PRIMARY_DEADLINE_SECONDS = 35.0
_SECONDARY_DEADLINE_SECONDS = 20.0


def build_ai_assistant(environ: Mapping[str, str] | None = None) -> AiAssistant | None:
    """O assistente de IA, ou `None` se não há chave do provedor escolhido."""
    source = os.environ if environ is None else environ
    provider = _build_provider(source)
    if provider is None:
        return None
    return AiAssistant(provider, InMemoryAiUsageLimiter(limit=_rate_limit(source)))


def _build_provider(source: Mapping[str, str]) -> LlmProvider | None:
    choice = source.get(PROVIDER_ENV_VAR, "").strip().lower() or "auto"
    if choice not in {"auto", *_KEY_ENV_VARS}:
        logger.warning("%s inválido: vale o padrão (auto)", PROVIDER_ENV_VAR)
        choice = "auto"
    available = [
        name
        for name, key_var in _KEY_ENV_VARS.items()
        if source.get(key_var, "").strip() and choice in {"auto", name}
    ]
    if not available:
        logger.info("Nenhuma chave de IA para o provedor escolhido: o assistente fica desligado")
        return None
    try:
        if len(available) >= 2:
            primary = _BUILDERS[available[0]](source, _PRIMARY_DEADLINE_SECONDS)
            secondary = _BUILDERS[available[1]](source, _SECONDARY_DEADLINE_SECONDS)
            return FallbackLlmProvider(primary, secondary)
        return _BUILDERS[available[0]](source, None)
    except ValueError:
        logger.warning("Modelo de IA inválido: o assistente de IA fica desligado")
        return None


def _openai(source: Mapping[str, str], deadline: float | None) -> openai_provider.OpenAiProvider:
    total = _DEFAULT_DEADLINE_SECONDS if deadline is None else deadline
    return openai_provider.OpenAiProvider(
        source.get(OPENAI_API_KEY_ENV_VAR, "").strip(),
        source.get(OPENAI_MODEL_ENV_VAR, "").strip() or openai_provider.DEFAULT_MODEL,
        parse_model_list(
            source.get(OPENAI_FALLBACK_MODELS_ENV_VAR), openai_provider.DEFAULT_FALLBACK_MODELS
        ),
        total_deadline_seconds=total,
    )


def _groq(source: Mapping[str, str], deadline: float | None) -> openai_provider.OpenAiProvider:
    total = _DEFAULT_DEADLINE_SECONDS if deadline is None else deadline
    return openai_provider.OpenAiProvider(
        source.get(GROQ_API_KEY_ENV_VAR, "").strip(),
        source.get(GROQ_MODEL_ENV_VAR, "").strip() or GROQ_DEFAULT_MODEL,
        _split_models(source.get(GROQ_FALLBACK_MODELS_ENV_VAR)),
        total_deadline_seconds=total,
        base_url=GROQ_BASE_URL,
    )


def _split_models(raw: str | None) -> tuple[str, ...]:
    """Modelos separados por vírgula; o provedor descarta os nomes inválidos."""
    return tuple(name.strip() for name in (raw or "").split(",") if name.strip())


def _gemini(source: Mapping[str, str], deadline: float | None) -> GeminiProvider:
    total = _DEFAULT_DEADLINE_SECONDS if deadline is None else deadline
    return GeminiProvider(
        source.get(API_KEY_ENV_VAR, "").strip(),
        source.get(MODEL_ENV_VAR, "").strip() or DEFAULT_MODEL,
        parse_model_list(source.get(FALLBACK_MODELS_ENV_VAR), DEFAULT_FALLBACK_MODELS),
        total_deadline_seconds=total,
    )


# Ordem de preferência em `auto`: o primeiro com chave é o primário; o segundo, a reserva.
_KEY_ENV_VARS: dict[str, str] = {
    "openai": OPENAI_API_KEY_ENV_VAR,
    "groq": GROQ_API_KEY_ENV_VAR,
    "gemini": API_KEY_ENV_VAR,
}
_BUILDERS: dict[str, Callable[[Mapping[str, str], float | None], LlmProvider]] = {
    "openai": _openai,
    "groq": _groq,
    "gemini": _gemini,
}


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
