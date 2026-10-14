"""Adaptador do modelo de linguagem Gemini (TASK-076; ADR-039), por HTTP simples (`urllib`).

Chama `POST https://generativelanguage.googleapis.com/v1beta/models/{modelo}:generateContent` com a
chave no cabeçalho `x-goog-api-key` (nunca na URL). A chave vem da configuração; ela não é
registrada em log e não entra em mensagem de erro (as mensagens são fixas: nenhum texto do
provedor é repassado).

Resiliência (o modelo padrão às vezes responde "high demand", 503):
- cada modelo é tentado até `attempts_per_model` vezes, com espera curta (`backoff_seconds`)
  entre as tentativas, quando o erro é passageiro (500, 502, 503, 504, falha de rede);
- esgotadas as tentativas, passa para o próximo modelo da lista de reservas; 429 (cota), 404
  (modelo inexistente) e prazo vencido passam direto ao próximo, sem repetir;
- 400 e 403 (pedido recusado, chave sem permissão) param na hora: repetir não adianta;
- `total_deadline_seconds` limita o tempo somado de todas as tentativas.

O transporte e o relógio são injetáveis para os testes não chamarem a rede.
"""

import json
import logging
import re
import time
import urllib.error
import urllib.request
from collections.abc import Callable, Mapping, Sequence
from typing import Any

from app.application.ports.llm_provider import (
    LlmCompletion,
    LlmError,
    LlmErrorKind,
    LlmRequest,
)

logger = logging.getLogger(__name__)

GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"
DEFAULT_MODEL = "gemini-3.7-flash"
DEFAULT_FALLBACK_MODELS = ("gemini-3-flash-preview", "gemini-flash-lite-latest")

_MODEL_NAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")
_TRANSIENT_STATUSES = frozenset({500, 502, 503, 504})

type HttpPost = Callable[[str, Mapping[str, str], bytes, float], tuple[int, bytes]]
"""`(url, cabeçalhos, corpo, prazo em segundos) -> (status HTTP, corpo)`. Falha de rede levanta
`TimeoutError` (prazo) ou `OSError`."""


def urllib_post(
    url: str, headers: Mapping[str, str], body: bytes, timeout: float
) -> tuple[int, bytes]:
    request = urllib.request.Request(url, data=body, headers=dict(headers), method="POST")
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.status, response.read()
    except urllib.error.HTTPError as error:
        return error.code, error.read()
    except urllib.error.URLError as error:
        if isinstance(error.reason, TimeoutError):
            raise TimeoutError from None
        raise OSError(type(error.reason).__name__) from None


def parse_model_list(raw: str | None, default: Sequence[str]) -> tuple[str, ...]:
    """Modelos separados por vírgula; vazio, usa `default`. Nomes inválidos são ignorados."""
    if raw is None or not raw.strip():
        return tuple(default)
    names = [part.strip() for part in raw.split(",")]
    return tuple(name for name in names if _MODEL_NAME.fullmatch(name))


class _BadRequestError(LlmError):
    """HTTP 400 ou 403 do provedor (o pedido ou a chave foram recusados)."""


class GeminiProvider:
    """Implementa a porta `LlmProvider` sobre a API REST do Gemini."""

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
        base_url: str = GEMINI_BASE_URL,
    ) -> None:
        if not api_key.strip():
            raise ValueError("a chave da API do Gemini deve ser informada")
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

    @property
    def model(self) -> str:
        return self._model

    @property
    def fallback_models(self) -> tuple[str, ...]:
        return self._fallbacks

    def __repr__(self) -> str:  # nunca expõe a chave
        return f"GeminiProvider(model={self._model!r}, fallbacks={self._fallbacks!r})"

    # --- geração -----------------------------------------------------------------------------

    def generate(self, request: LlmRequest) -> LlmCompletion:
        thinking = request.thinking_level is not None
        body = _encode(request, thinking=thinking)
        started = self._clock()
        calls = 0
        last_error: LlmError | None = None
        for index, model in enumerate((self._model, *self._fallbacks)):
            attempt = 0
            while attempt < self._attempts:
                remaining = self._deadline - (self._clock() - started)
                if remaining <= 0:
                    raise last_error or LlmError(LlmErrorKind.TIMEOUT, _MSG_TIMEOUT)
                calls += 1
                outcome = self._call(model, body, min(self._timeout, remaining))
                if isinstance(outcome, str):
                    return LlmCompletion(
                        text=outcome, model=model, fallback_used=index > 0, calls=calls
                    )
                error, retry_same_model = outcome
                last_error = error
                if error.kind is LlmErrorKind.REJECTED:
                    if thinking and isinstance(error, _BadRequestError):
                        # Talvez o modelo não aceite o nível de raciocínio: tenta sem ele.
                        thinking = False
                        body = _encode(request, thinking=False)
                        continue
                    raise error
                if not retry_same_model:
                    break
                attempt += 1
                if attempt < self._attempts:
                    self._sleep(self._backoff)
        raise last_error or LlmError(LlmErrorKind.UNAVAILABLE, _MSG_UNAVAILABLE)

    def _call(self, model: str, body: bytes, timeout: float) -> str | tuple[LlmError, bool]:
        """Texto da resposta, ou `(erro, vale repetir no mesmo modelo)`."""
        url = f"{self._base_url}/models/{model}:generateContent"
        headers = {"Content-Type": "application/json", "x-goog-api-key": self._api_key}
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
        logger.warning("IA: o modelo %s respondeu HTTP %s", model, status)
        if status in _TRANSIENT_STATUSES:
            return LlmError(LlmErrorKind.UNAVAILABLE, _MSG_UNAVAILABLE), True
        if status == 429:
            return LlmError(LlmErrorKind.RATE_LIMITED, _MSG_RATE_LIMITED), False
        if status == 404:
            return LlmError(LlmErrorKind.UNAVAILABLE, _MSG_UNAVAILABLE), False
        return _BadRequestError(LlmErrorKind.REJECTED, _MSG_REJECTED), False

    def _read_text(self, model: str, raw: bytes) -> str | tuple[LlmError, bool]:
        try:
            data: Any = json.loads(raw)
        except ValueError:
            return LlmError(LlmErrorKind.BAD_RESPONSE, _MSG_BAD_RESPONSE), False
        if not isinstance(data, dict):
            return LlmError(LlmErrorKind.BAD_RESPONSE, _MSG_BAD_RESPONSE), False
        feedback = data.get("promptFeedback")
        if isinstance(feedback, dict) and feedback.get("blockReason"):
            return LlmError(LlmErrorKind.REJECTED, _MSG_BLOCKED), False
        candidates = data.get("candidates")
        if (
            not isinstance(candidates, list)
            or not candidates
            or not isinstance(candidates[0], dict)
        ):
            return LlmError(LlmErrorKind.BAD_RESPONSE, _MSG_BAD_RESPONSE), False
        candidate = candidates[0]
        finish = candidate.get("finishReason")
        if finish in {"SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "RECITATION"}:
            return LlmError(LlmErrorKind.REJECTED, _MSG_BLOCKED), False
        content = candidate.get("content")
        parts = content.get("parts") if isinstance(content, dict) else None
        texts = [
            part["text"]
            for part in (parts if isinstance(parts, list) else [])
            if isinstance(part, dict)
            and isinstance(part.get("text"), str)
            and not part.get("thought")
        ]
        text = "".join(texts).strip()
        if not text:
            logger.warning("IA: o modelo %s devolveu resposta vazia (%s)", model, finish)
            return LlmError(LlmErrorKind.BAD_RESPONSE, _MSG_BAD_RESPONSE), False
        if finish == "MAX_TOKENS":
            logger.warning("IA: a resposta do modelo %s foi cortada por tamanho", model)
            return LlmError(LlmErrorKind.BAD_RESPONSE, _MSG_TOO_LONG), False
        return text


def _encode(request: LlmRequest, *, thinking: bool) -> bytes:
    generation: dict[str, Any] = {
        "temperature": request.temperature,
        "maxOutputTokens": request.max_output_tokens,
    }
    if thinking and request.thinking_level is not None:
        # Sem limitar o raciocínio, uma resposta estruturada leva até 45 s (medido em 2026-10-14).
        generation["thinkingConfig"] = {"thinkingLevel": request.thinking_level}
    if request.json_schema is not None:
        generation["responseMimeType"] = "application/json"
        generation["responseSchema"] = request.json_schema
    payload = {
        "systemInstruction": {"parts": [{"text": request.system}]},
        "contents": [{"role": "user", "parts": [{"text": request.user}]}],
        "generationConfig": generation,
    }
    return json.dumps(payload, ensure_ascii=False).encode("utf-8")


_MSG_UNAVAILABLE = (
    "O serviço de IA está sobrecarregado no momento. Tente de novo em alguns instantes."
)
_MSG_TIMEOUT = "O serviço de IA demorou demais para responder. Tente de novo."
_MSG_RATE_LIMITED = "O limite de uso do serviço de IA foi atingido. Tente de novo mais tarde."
_MSG_REJECTED = "O serviço de IA recusou o pedido. Reescreva a descrição e tente de novo."
_MSG_BLOCKED = "O serviço de IA não pôde responder a este conteúdo. Reescreva e tente de novo."
_MSG_BAD_RESPONSE = "A IA devolveu uma resposta que não pôde ser usada. Tente de novo."
_MSG_TOO_LONG = "A resposta da IA ficou longa demais e foi cortada. Descreva de forma mais curta."
