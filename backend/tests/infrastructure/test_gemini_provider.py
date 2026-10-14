"""`GeminiProvider` e o limite de uso da IA (TASK-076; ADR-039). Transporte falso: sem rede."""

import json
import logging
from collections.abc import Mapping
from typing import Any

import pytest

from app.application.ports.llm_provider import LlmError, LlmErrorKind, LlmRequest
from app.infrastructure.ai.gemini_provider import (
    DEFAULT_FALLBACK_MODELS,
    GeminiProvider,
    parse_model_list,
)
from app.infrastructure.ai.in_memory_usage_limiter import InMemoryAiUsageLimiter
from tests.fixtures.ai_fakes import CHAVE_FICTICIA

OVERLOAD = (
    503,
    json.dumps(
        {"error": {"code": 503, "message": "high demand", "status": "UNAVAILABLE"}}
    ).encode(),
)


def ok(text: str, *, finish: str = "STOP") -> tuple[int, bytes]:
    body = {"candidates": [{"content": {"parts": [{"text": text}]}, "finishReason": finish}]}
    return 200, json.dumps(body).encode()


class FakeTransport:
    """Devolve, na ordem, as respostas enfileiradas (ou levanta a exceção enfileirada)."""

    def __init__(self, replies: list[tuple[int, bytes] | Exception]) -> None:
        self.replies = replies
        self.calls: list[tuple[str, Mapping[str, str], dict[str, Any], float]] = []

    def __call__(
        self, url: str, headers: Mapping[str, str], body: bytes, timeout: float
    ) -> tuple[int, bytes]:
        self.calls.append((url, headers, json.loads(body), timeout))
        reply = self.replies.pop(0)
        if isinstance(reply, Exception):
            raise reply
        return reply

    @property
    def models(self) -> list[str]:
        return [call[0].split("/models/")[1].split(":")[0] for call in self.calls]


class Clock:
    def __init__(self) -> None:
        self.now = 0.0
        self.sleeps: list[float] = []

    def __call__(self) -> float:
        return self.now

    def sleep(self, seconds: float) -> None:
        self.sleeps.append(seconds)
        self.now += seconds


def provider(transport: FakeTransport, clock: Clock | None = None, **kwargs: Any) -> GeminiProvider:
    clock = clock or Clock()
    return GeminiProvider(
        CHAVE_FICTICIA,
        "padrao",
        ("reserva-1", "reserva-2"),
        transport=transport,
        sleep=clock.sleep,
        clock=clock,
        **kwargs,
    )


REQUEST = LlmRequest(system="sistema", user="pedido")


def test_success_sends_the_key_in_the_header_and_never_in_the_url() -> None:
    transport = FakeTransport([ok("Olá")])

    completion = provider(transport).generate(REQUEST)

    assert (completion.text, completion.model, completion.fallback_used) == ("Olá", "padrao", False)
    url, headers, body, _ = transport.calls[0]
    assert url == "https://generativelanguage.googleapis.com/v1beta/models/padrao:generateContent"
    assert headers["x-goog-api-key"] == CHAVE_FICTICIA
    assert CHAVE_FICTICIA not in url
    assert body["systemInstruction"]["parts"][0]["text"] == "sistema"
    assert body["contents"][0]["parts"][0]["text"] == "pedido"
    assert body["generationConfig"]["thinkingConfig"] == {"thinkingLevel": "low"}
    assert "responseSchema" not in body["generationConfig"]


def test_structured_output_sends_mime_type_and_schema() -> None:
    transport = FakeTransport([ok("{}")])
    schema = {"type": "OBJECT", "properties": {}}

    provider(transport).generate(LlmRequest(system="s", user="u", json_schema=schema))

    config = transport.calls[0][2]["generationConfig"]
    assert config["responseMimeType"] == "application/json"
    assert config["responseSchema"] == schema


def test_thought_parts_are_not_part_of_the_answer() -> None:
    body = {
        "candidates": [
            {
                "content": {"parts": [{"text": "pensando", "thought": True}, {"text": "Resposta"}]},
                "finishReason": "STOP",
            }
        ]
    }

    completion = provider(FakeTransport([(200, json.dumps(body).encode())])).generate(REQUEST)

    assert completion.text == "Resposta"


def test_overload_is_retried_with_a_short_backoff_on_the_same_model() -> None:
    transport = FakeTransport([OVERLOAD, ok("Voltou")])
    clock = Clock()

    completion = provider(transport, clock, backoff_seconds=1.5).generate(REQUEST)

    assert (completion.model, completion.fallback_used, completion.calls) == ("padrao", False, 2)
    assert transport.models == ["padrao", "padrao"]
    assert clock.sleeps == [1.5]


def test_falls_back_to_the_next_model_after_the_retries() -> None:
    transport = FakeTransport([OVERLOAD, OVERLOAD, OVERLOAD, OVERLOAD, ok("Da segunda reserva")])

    completion = provider(transport).generate(REQUEST)

    assert transport.models == ["padrao", "padrao", "reserva-1", "reserva-1", "reserva-2"]
    assert (completion.model, completion.fallback_used, completion.calls) == (
        "reserva-2",
        True,
        5,
    )


def test_quota_error_and_unknown_model_go_straight_to_the_next_model() -> None:
    transport = FakeTransport([(429, b"{}"), (404, b"{}"), ok("Reserva 2")])

    completion = provider(transport).generate(REQUEST)

    assert transport.models == ["padrao", "reserva-1", "reserva-2"]
    assert completion.model == "reserva-2"


def test_timeout_moves_to_the_next_model_without_repeating() -> None:
    transport = FakeTransport([TimeoutError(), ok("Reserva")])

    completion = provider(transport).generate(REQUEST)

    assert transport.models == ["padrao", "reserva-1"]
    assert completion.fallback_used is True


def test_network_failure_is_retried() -> None:
    transport = FakeTransport([ConnectionResetError(), ok("Voltou")])

    assert provider(transport).generate(REQUEST).model == "padrao"


def test_all_models_overloaded_gives_a_friendly_error_without_the_key() -> None:
    transport = FakeTransport([OVERLOAD] * 6)

    with pytest.raises(LlmError) as raised:
        provider(transport).generate(REQUEST)

    assert raised.value.kind is LlmErrorKind.UNAVAILABLE
    assert "sobrecarregado" in raised.value.message
    assert CHAVE_FICTICIA not in raised.value.message
    assert len(transport.calls) == 6


def test_rejected_request_stops_at_once_after_trying_without_thinking() -> None:
    transport = FakeTransport([(400, b"{}"), (400, b"{}")])

    with pytest.raises(LlmError) as raised:
        provider(transport).generate(REQUEST)

    assert raised.value.kind is LlmErrorKind.REJECTED
    assert len(transport.calls) == 2
    assert "thinkingConfig" in transport.calls[0][2]["generationConfig"]
    assert "thinkingConfig" not in transport.calls[1][2]["generationConfig"]


def test_a_model_that_refuses_the_thinking_level_works_without_it() -> None:
    transport = FakeTransport([(400, b"{}"), ok("Sem raciocínio")])

    completion = provider(transport).generate(REQUEST)

    assert completion.text == "Sem raciocínio"
    assert completion.model == "padrao"


def test_forbidden_key_is_rejected_without_leaking() -> None:
    transport = FakeTransport([(403, CHAVE_FICTICIA.encode())])

    with pytest.raises(LlmError) as raised:
        provider(transport).generate(LlmRequest(system="s", user="u", thinking_level=None))

    assert raised.value.kind is LlmErrorKind.REJECTED
    assert CHAVE_FICTICIA not in raised.value.message


@pytest.mark.parametrize(
    "reply",
    [
        (200, b"nao e json"),
        (200, b"[]"),
        (200, b'{"candidates": []}'),
        ok("   "),
        ok("cortada", finish="MAX_TOKENS"),
    ],
)
def test_unusable_answers_fall_to_the_next_model_and_then_fail(reply: tuple[int, bytes]) -> None:
    transport = FakeTransport([reply, reply, reply])

    with pytest.raises(LlmError) as raised:
        provider(transport).generate(REQUEST)

    assert raised.value.kind is LlmErrorKind.BAD_RESPONSE
    assert len(transport.calls) == 3


def test_blocked_content_is_rejected() -> None:
    blocked = (200, json.dumps({"promptFeedback": {"blockReason": "SAFETY"}}).encode())

    with pytest.raises(LlmError) as raised:
        provider(FakeTransport([blocked])).generate(REQUEST)

    assert raised.value.kind is LlmErrorKind.REJECTED


def test_total_deadline_stops_the_attempts() -> None:
    transport = FakeTransport([OVERLOAD] * 6)
    clock = Clock()

    with pytest.raises(LlmError):
        provider(transport, clock, backoff_seconds=30.0, total_deadline_seconds=40.0).generate(
            REQUEST
        )

    assert len(transport.calls) < 6


def test_the_timeout_of_each_call_never_exceeds_the_remaining_time() -> None:
    transport = FakeTransport([ok("ok")])

    provider(transport, timeout_seconds=25.0, total_deadline_seconds=10.0).generate(REQUEST)

    assert transport.calls[0][3] == 10.0


def test_repr_and_logs_never_show_the_key(caplog: pytest.LogCaptureFixture) -> None:
    transport = FakeTransport([OVERLOAD, ok("ok")])
    caplog.set_level(logging.DEBUG)

    instance = provider(transport)
    instance.generate(REQUEST)

    assert CHAVE_FICTICIA not in repr(instance)
    assert CHAVE_FICTICIA not in caplog.text


def test_construction_rejects_a_blank_key_and_a_bad_model_name() -> None:
    with pytest.raises(ValueError):
        GeminiProvider("  ")
    with pytest.raises(ValueError):
        GeminiProvider(CHAVE_FICTICIA, "modelo/../../x")


def test_fallbacks_drop_the_default_model_and_invalid_names() -> None:
    instance = GeminiProvider(CHAVE_FICTICIA, "a", ("a", "b", "c d", "../x"))

    assert instance.fallback_models == ("b",)


def test_parse_model_list() -> None:
    assert parse_model_list(None, DEFAULT_FALLBACK_MODELS) == DEFAULT_FALLBACK_MODELS
    assert parse_model_list("  ", DEFAULT_FALLBACK_MODELS) == DEFAULT_FALLBACK_MODELS
    assert parse_model_list("x-1, y.2 ,,inválido!", ()) == ("x-1", "y.2")


# --- limite de uso por usuário ------------------------------------------------------------------


def test_limiter_allows_up_to_the_limit_then_blocks_with_a_wait() -> None:
    now = [0.0]
    limiter = InMemoryAiUsageLimiter(limit=3, window_seconds=3600, clock=lambda: now[0])

    decisions = [limiter.acquire("u1") for _ in range(3)]
    blocked = limiter.acquire("u1")

    assert [d.allowed for d in decisions] == [True, True, True]
    assert [d.remaining for d in decisions] == [2, 1, 0]
    assert blocked.allowed is False and blocked.retry_after_seconds == 3600


def test_limiter_counts_each_user_separately_and_forgets_after_the_window() -> None:
    now = [0.0]
    limiter = InMemoryAiUsageLimiter(limit=1, window_seconds=3600, clock=lambda: now[0])
    assert limiter.acquire("u1").allowed
    assert limiter.acquire("u2").allowed
    assert not limiter.acquire("u1").allowed

    now[0] = 3601.0

    assert limiter.acquire("u1").allowed


def test_limiter_rejected_calls_do_not_consume_the_window() -> None:
    now = [0.0]
    limiter = InMemoryAiUsageLimiter(limit=1, window_seconds=100, clock=lambda: now[0])
    limiter.acquire("u1")
    now[0] = 60.0
    assert not limiter.acquire("u1").allowed

    now[0] = 101.0

    assert limiter.acquire("u1").allowed


def test_limiter_discards_stale_keys_when_it_tracks_too_many() -> None:
    now = [0.0]
    limiter = InMemoryAiUsageLimiter(
        limit=1, window_seconds=10, clock=lambda: now[0], max_tracked_keys=2
    )
    limiter.acquire("a")
    limiter.acquire("b")
    now[0] = 20.0

    limiter.acquire("c")

    assert set(limiter._calls) == {"c"}  # noqa: SLF001 - confere o descarte


def test_limiter_requires_a_positive_limit() -> None:
    with pytest.raises(ValueError):
        InMemoryAiUsageLimiter(limit=0)
