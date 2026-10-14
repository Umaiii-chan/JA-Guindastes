"""Adaptador do modelo de linguagem da OpenAI (TASK-079; ADR-040), por HTTP simples (`urllib`).

Chama `POST https://api.openai.com/v1/chat/completions` com a chave em `Authorization: Bearer`
(nunca na URL). A chave vem da configuração; ela não é registrada em log nem entra em mensagem de
erro (as mensagens para a pessoa são fixas; só `error.message` dos HTTP 4xx vai ao log, cortada).

Saída estruturada: `response_format` `json_schema` com `strict: false`, a partir do mesmo esquema
do Gemini (convertido por `to_openai_schema`). Se o modelo recusar o `response_format`, repete com
`{"type": "json_object"}` e o esquema vai no texto do sistema. A validação do caso de uso continua
valendo nos dois casos.

Parâmetros recusados: modelos de raciocínio (família gpt-5, o1, o3) não aceitam `temperature`, e
modelos comuns não aceitam `reasoning_effort`. Quando o provedor recusa um parâmetro (HTTP 400 com
`error.param`), ele sai do pedido e a recusa fica lembrada para o modelo. O parâmetro
`reasoning_effort` do construtor (low|medium|high) força o envio do esforço de raciocínio a
qualquer modelo; sem ele, só os modelos de raciocínio recebem o nível do pedido.

Resiliência (mesma política do Gemini): erro passageiro (429, 500, 502, 503, 504, rede) é repetido
com espera curta; esgotadas as tentativas, passa ao próximo modelo da lista de reservas. Cota
esgotada (`insufficient_quota`), 404 e prazo vencido passam direto ao próximo; 400 e 401/403 param.
`total_deadline_seconds` limita o tempo somado.
"""

import json
import logging
import re
import time
from collections.abc import Callable, Sequence
from typing import Any

from app.application.ports.llm_provider import (
    LlmCompletion,
    LlmError,
    LlmErrorKind,
    LlmRequest,
)
from app.infrastructure.ai.gemini_provider import HttpPost, urllib_post

logger = logging.getLogger(__name__)

OPENAI_BASE_URL = "https://api.openai.com/v1"
USER_AGENT = "ja-guindastes-simulador/1.0"
DEFAULT_MODEL = "gpt-5-mini"
DEFAULT_FALLBACK_MODELS: tuple[str, ...] = ()

# Aceita o prefixo de organização usado por APIs compatíveis (ex.: Groq `openai/gpt-oss-120b`).
_MODEL_NAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}(/[A-Za-z0-9][A-Za-z0-9._-]{0,63})?$")
_TRANSIENT_STATUSES = frozenset({429, 500, 502, 503, 504})
_DROPPABLE_PARAMS = ("temperature", "reasoning_effort", "max_completion_tokens")


def to_openai_schema(schema: Any) -> Any:
    """Converte o esquema do Gemini (tipos em maiúsculas, `nullable`) para JSON Schema."""
    if isinstance(schema, list):
        return [to_openai_schema(item) for item in schema]
    if not isinstance(schema, dict):
        return schema
    converted = {key: to_openai_schema(value) for key, value in schema.items() if key != "nullable"}
    kind = converted.get("type")
    if isinstance(kind, str):
        converted["type"] = kind.lower()
        if schema.get("nullable"):
            converted["type"] = [kind.lower(), "null"]
            if isinstance(converted.get("enum"), list):
                converted["enum"] = [*converted["enum"], None]
    if converted.get("type") == "object" or (
        isinstance(converted.get("type"), str) and "properties" in converted
    ):
        converted.setdefault("additionalProperties", False)
    return converted


class _BadRequestError(LlmError):
    """HTTP 400 do provedor com o parâmetro recusado, quando ele disse qual foi."""

    def __init__(self, message: str, param: str | None) -> None:
        super().__init__(LlmErrorKind.REJECTED, message)
        self.param = param


class OpenAiProvider:
    """Implementa a porta `LlmProvider` sobre a API Chat Completions da OpenAI."""

    def __init__(
        self,
        api_key: str,
        model: str = DEFAULT_MODEL,
        fallback_models: Sequence[str] = DEFAULT_FALLBACK_MODELS,
        *,
        timeout_seconds: float = 20.0,
        attempts_per_model: int = 2,
        backoff_seconds: float = 1.5,
        total_deadline_seconds: float = 55.0,
        transport: HttpPost = urllib_post,
        sleep: Callable[[float], None] = time.sleep,
        clock: Callable[[], float] = time.monotonic,
        base_url: str = OPENAI_BASE_URL,
        reasoning_effort: str | None = None,
    ) -> None:
        if not api_key.strip():
            raise ValueError("a chave da API da OpenAI deve ser informada")
        if not _MODEL_NAME.fullmatch(model):
            raise ValueError("nome de modelo inválido")
        self._api_key = api_key.strip()
        self._model = model
        self._fallbacks = tuple(
            name for name in fallback_models if name != model and _MODEL_NAME.fullmatch(name)
        )
        self._timeout = timeout_seconds
        self._attempts = max(1, attempts_per_model)
        self._backoff = backoff_seconds
        self._deadline = total_deadline_seconds
        self._transport = transport
        self._sleep = sleep
        self._clock = clock
        self._base_url = base_url.rstrip("/")
        self._reasoning_effort = reasoning_effort
        self._dropped: dict[str, set[str]] = {}
        self._json_object_only: set[str] = set()

    @property
    def model(self) -> str:
        return self._model

    @property
    def fallback_models(self) -> tuple[str, ...]:
        return self._fallbacks

    def __repr__(self) -> str:  # nunca expõe a chave
        return f"OpenAiProvider(model={self._model!r}, fallbacks={self._fallbacks!r})"

    # --- geração -----------------------------------------------------------------------------

    def generate(self, request: LlmRequest) -> LlmCompletion:
        started = self._clock()
        calls = 0
        last_error: LlmError | None = None
        for index, model in enumerate((self._model, *self._fallbacks)):
            attempt = 0
            adjustments = 0
            while attempt < self._attempts:
                remaining = self._deadline - (self._clock() - started)
                if remaining <= 0:
                    raise last_error or LlmError(LlmErrorKind.TIMEOUT, _MSG_TIMEOUT)
                calls += 1
                body = self._encode(request, model)
                outcome = self._call(model, body, min(self._timeout, remaining))
                if isinstance(outcome, str):
                    return LlmCompletion(
                        text=outcome, model=model, fallback_used=index > 0, calls=calls
                    )
                error, retry_same_model = outcome
                last_error = error
                if isinstance(error, _BadRequestError) and adjustments < 3:
                    if self._adjust_for(model, error.param, request):
                        adjustments += 1
                        continue
                if error.kind is LlmErrorKind.REJECTED:
                    raise error
                if not retry_same_model:
                    break
                attempt += 1
                if attempt < self._attempts:
                    self._sleep(self._backoff)
        raise last_error or LlmError(LlmErrorKind.UNAVAILABLE, _MSG_UNAVAILABLE)

    def _adjust_for(self, model: str, param: str | None, request: LlmRequest) -> bool:
        """Tira do pedido o parâmetro que o modelo recusou; `False` se não há o que ajustar."""
        if param in _DROPPABLE_PARAMS:
            dropped = self._dropped.setdefault(model, set())
            if param not in dropped:
                dropped.add(param)
                return True
        if (
            param is not None
            and param.startswith("response_format")
            and request.json_schema is not None
            and model not in self._json_object_only
        ):
            self._json_object_only.add(model)
            return True
        return False

    def _encode(self, request: LlmRequest, model: str) -> bytes:
        dropped = self._dropped.get(model, set())
        system = request.system
        payload: dict[str, Any] = {"model": model}
        if request.json_schema is not None:
            schema = to_openai_schema(request.json_schema)
            if model in self._json_object_only:
                payload["response_format"] = {"type": "json_object"}
                system = (
                    f"{system}\n\nResponda somente com um objeto JSON que siga este esquema "
                    f"JSON Schema: {json.dumps(schema, ensure_ascii=False)}"
                )
            else:
                payload["response_format"] = {
                    "type": "json_schema",
                    "json_schema": {"name": "resposta", "strict": False, "schema": schema},
                }
        payload["messages"] = [
            {"role": "system", "content": system},
            {"role": "user", "content": request.user},
        ]
        if "max_completion_tokens" not in dropped:
            payload["max_completion_tokens"] = request.max_output_tokens
        if "temperature" not in dropped and not _is_reasoning_model(model):
            payload["temperature"] = request.temperature
        if "reasoning_effort" not in dropped:
            if self._reasoning_effort is not None:
                # Configurado (ex.: Groq com gpt-oss): vale para qualquer modelo.
                payload["reasoning_effort"] = self._reasoning_effort
            elif request.thinking_level is not None and _is_reasoning_model(model):
                payload["reasoning_effort"] = request.thinking_level
        return json.dumps(payload, ensure_ascii=False).encode("utf-8")

    def _call(self, model: str, body: bytes, timeout: float) -> str | tuple[LlmError, bool]:
        """Texto da resposta, ou `(erro, vale repetir no mesmo modelo)`."""
        url = f"{self._base_url}/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self._api_key}",
            # O Cloudflare do Groq recusa o User-Agent padrão do urllib (HTTP 403, código 1010).
            "User-Agent": USER_AGENT,
        }
        try:
            status, raw = self._transport(url, headers, body, timeout)
        except TimeoutError:
            logger.warning("IA: o modelo %s não respondeu a tempo", model)
            return LlmError(LlmErrorKind.TIMEOUT, _MSG_TIMEOUT), False
        except OSError as error:
            logger.warning("IA: falha de rede com o modelo %s (%s)", model, type(error).__name__)
            return LlmError(LlmErrorKind.UNAVAILABLE, _MSG_UNAVAILABLE), True

        if status == 200:
            return self._read_text(model, raw)
        message, code, param = _error_fields(raw)
        logger.warning("IA: o modelo %s respondeu HTTP %s", model, status)
        if 400 <= status < 500:
            # `error.message` explica o que foi recusado; a chave vai no cabeçalho e não aparece.
            logger.warning("IA: detalhe do HTTP %s de %s: %s", status, model, message)
        if status == 429:
            if code == "insufficient_quota":
                return LlmError(LlmErrorKind.RATE_LIMITED, _MSG_RATE_LIMITED), False
            return LlmError(LlmErrorKind.RATE_LIMITED, _MSG_RATE_LIMITED), True
        if status in _TRANSIENT_STATUSES:
            return LlmError(LlmErrorKind.UNAVAILABLE, _MSG_UNAVAILABLE), True
        if status == 404:
            return LlmError(LlmErrorKind.UNAVAILABLE, _MSG_UNAVAILABLE), False
        if status == 400:
            return _BadRequestError(_MSG_REJECTED, param), False
        return LlmError(LlmErrorKind.REJECTED, _MSG_REJECTED), False

    def _read_text(self, model: str, raw: bytes) -> str | tuple[LlmError, bool]:
        try:
            data: Any = json.loads(raw)
        except ValueError:
            return LlmError(LlmErrorKind.BAD_RESPONSE, _MSG_BAD_RESPONSE), False
        choices = data.get("choices") if isinstance(data, dict) else None
        if not isinstance(choices, list) or not choices or not isinstance(choices[0], dict):
            return LlmError(LlmErrorKind.BAD_RESPONSE, _MSG_BAD_RESPONSE), False
        choice = choices[0]
        finish = choice.get("finish_reason")
        message = choice.get("message")
        if finish == "content_filter":
            return LlmError(LlmErrorKind.REJECTED, _MSG_BLOCKED), False
        if isinstance(message, dict) and message.get("refusal"):
            return LlmError(LlmErrorKind.REJECTED, _MSG_BLOCKED), False
        content = message.get("content") if isinstance(message, dict) else None
        text = content.strip() if isinstance(content, str) else ""
        if not text:
            logger.warning("IA: o modelo %s devolveu resposta vazia (%s)", model, finish)
            return LlmError(LlmErrorKind.BAD_RESPONSE, _MSG_BAD_RESPONSE), False
        if finish == "length":
            logger.warning("IA: a resposta do modelo %s foi cortada por tamanho", model)
            return LlmError(LlmErrorKind.BAD_RESPONSE, _MSG_TOO_LONG), False
        return text


def _is_reasoning_model(model: str) -> bool:
    name = model.lower()
    return name.startswith(("gpt-5", "o1", "o3", "o4")) and not name.startswith("gpt-5-chat")


def _error_fields(raw: bytes) -> tuple[str, str | None, str | None]:
    """`(error.message cortada, error.code, error.param)`; vazios se o corpo for outro."""
    try:
        data = json.loads(raw.decode("utf-8", errors="replace"))
    except ValueError:
        return "", None, None
    error = data.get("error") if isinstance(data, dict) else None
    if not isinstance(error, dict):
        return "", None, None
    code, param = error.get("code"), error.get("param")
    return (
        str(error.get("message", ""))[:500],
        code if isinstance(code, str) else None,
        param if isinstance(param, str) else None,
    )


_MSG_UNAVAILABLE = (
    "O serviço de IA está sobrecarregado no momento. Tente de novo em alguns instantes."
)
_MSG_TIMEOUT = "O serviço de IA demorou demais para responder. Tente de novo."
_MSG_RATE_LIMITED = "O limite de uso do serviço de IA foi atingido. Tente de novo mais tarde."
_MSG_REJECTED = "O serviço de IA recusou o pedido. Reescreva a descrição e tente de novo."
_MSG_BLOCKED = "O serviço de IA não pôde responder a este conteúdo. Reescreva e tente de novo."
_MSG_BAD_RESPONSE = "A IA devolveu uma resposta que não pôde ser usada. Tente de novo."
_MSG_TOO_LONG = "A resposta da IA ficou longa demais e foi cortada. Descreva de forma mais curta."
