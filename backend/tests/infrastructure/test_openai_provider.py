"""`OpenAiProvider` e o provedor com reserva (TASK-079; ADR-040). Transporte falso: sem rede."""

import json
import logging
from collections.abc import Mapping
from typing import Any

import pytest

from app.application.ports.llm_provider import LlmError, LlmErrorKind, LlmRequest
from app.infrastructure.ai.fallback_provider import FallbackLlmProvider
from app.infrastructure.ai.gemini_provider import GeminiProvider
from app.infrastructure.ai.openai_provider import OpenAiProvider, to_openai_schema
from tests.fixtures.ai_fakes import CHAVE_FICTICIA

REQUEST = LlmRequest(system="sistema", user="pedido")


def ok(text: str, *, finish: str = "stop") -> tuple[int, bytes]:
    body = {"choices": [{"message": {"content": text}, "finish_reason": finish}]}
    return 200, json.dumps(body).encode()


def error(
    status: int, message: str, *, code: str | None = None, param: str | None = None
) -> tuple[int, bytes]:
    body = {"error": {"message": message, "code": code, "param": param}}
    return status, json.dumps(body).encode()


class FakeTransport:
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


class Clock:
    def __init__(self) -> None:
        self.now = 0.0

    def __call__(self) -> float:
        return self.now

    def sleep(self, seconds: float) -> None:
        self.now += seconds


def openai(transport: FakeTransport, model: str = "gpt-5-mini", **kwargs: Any) -> OpenAiProvider:
    clock = Clock()
    return OpenAiProvider(
        CHAVE_FICTICIA, model, transport=transport, sleep=clock.sleep, clock=clock, **kwargs
    )


def test_builds_the_request_with_bearer_key_and_the_model_in_the_body() -> None:
    transport = FakeTransport([ok("Olá")])

    completion = openai(transport).generate(REQUEST)

    assert (completion.text, completion.model, completion.fallback_used) == (
        "Olá",
        "gpt-5-mini",
        False,
    )
    url, headers, body, _ = transport.calls[0]
    assert url == "https://api.openai.com/v1/chat/completions"
    assert headers["Authorization"] == f"Bearer {CHAVE_FICTICIA}"
    assert CHAVE_FICTICIA not in url
    assert body["model"] == "gpt-5-mini"
    assert body["messages"] == [
        {"role": "system", "content": "sistema"},
        {"role": "user", "content": "pedido"},
    ]
    assert body["max_completion_tokens"] == 4096
    assert body["reasoning_effort"] == "low"
    assert "temperature" not in body  # modelo de raciocínio não aceita
    assert "response_format" not in body


def test_a_regular_model_gets_temperature_and_no_reasoning_effort() -> None:
    transport = FakeTransport([ok("x")])

    openai(transport, "gpt-4.1-mini").generate(REQUEST)

    body = transport.calls[0][2]
    assert body["temperature"] == 0.2
    assert "reasoning_effort" not in body


def test_structured_output_sends_a_converted_json_schema_with_strict_false() -> None:
    transport = FakeTransport([ok("{}")])
    schema = {
        "type": "OBJECT",
        "properties": {"a": {"type": "NUMBER", "nullable": True}, "b": {"type": "STRING"}},
        "required": ["a", "b"],
    }

    openai(transport).generate(LlmRequest(system="s", user="u", json_schema=schema))

    fmt = transport.calls[0][2]["response_format"]
    assert fmt["type"] == "json_schema"
    assert fmt["json_schema"]["strict"] is False
    assert fmt["json_schema"]["schema"] == {
        "type": "object",
        "properties": {"a": {"type": ["number", "null"]}, "b": {"type": "string"}},
        "required": ["a", "b"],
        "additionalProperties": False,
    }


def test_schema_conversion_keeps_enums_and_adds_null_to_nullable_ones() -> None:
    converted = to_openai_schema({"type": "STRING", "enum": ["a", "b"], "nullable": True})

    assert converted == {"type": ["string", "null"], "enum": ["a", "b", None]}


def test_a_parameter_the_model_refuses_is_dropped_and_remembered() -> None:
    transport = FakeTransport(
        [error(400, "Unsupported value: 'temperature'", param="temperature"), ok("ok")]
    )
    provider = openai(transport, "modelo-novo")

    assert provider.generate(REQUEST).text == "ok"
    assert "temperature" in transport.calls[0][2]
    assert "temperature" not in transport.calls[1][2]

    transport.replies.append(ok("de novo"))
    provider.generate(REQUEST)
    assert "temperature" not in transport.calls[2][2]


def test_a_refused_response_format_falls_back_to_json_object() -> None:
    transport = FakeTransport(
        [error(400, "response_format", param="response_format.json_schema"), ok("{}")]
    )
    schema = {"type": "OBJECT", "properties": {"a": {"type": "NUMBER"}}}

    openai(transport).generate(LlmRequest(system="s", user="u", json_schema=schema))

    body = transport.calls[1][2]
    assert body["response_format"] == {"type": "json_object"}
    assert "JSON" in body["messages"][0]["content"]


def test_rate_limit_is_retried_then_goes_to_the_next_model() -> None:
    transport = FakeTransport([error(429, "slow down"), error(429, "slow down"), ok("reserva")])

    completion = openai(transport, fallback_models=("gpt-5-nano",)).generate(REQUEST)

    assert (completion.model, completion.fallback_used, completion.calls) == ("gpt-5-nano", True, 3)


def test_exhausted_quota_is_not_retried() -> None:
    transport = FakeTransport([error(429, "quota", code="insufficient_quota")])

    with pytest.raises(LlmError) as caught:
        openai(transport).generate(REQUEST)

    assert caught.value.kind is LlmErrorKind.RATE_LIMITED
    assert len(transport.calls) == 1


def test_4xx_message_is_logged_but_never_the_key(caplog: pytest.LogCaptureFixture) -> None:
    transport = FakeTransport([error(401, "Incorrect API key provided")])

    with caplog.at_level(logging.WARNING), pytest.raises(LlmError) as caught:
        openai(transport).generate(REQUEST)

    assert caught.value.kind is LlmErrorKind.REJECTED
    assert "Incorrect API key provided" in caplog.text
    assert CHAVE_FICTICIA not in caplog.text
    assert CHAVE_FICTICIA not in str(caught.value)
    assert CHAVE_FICTICIA not in repr(openai(FakeTransport([])))


def test_bad_responses_are_rejected_without_leaking_provider_text() -> None:
    for reply in (
        (200, b"nao-json"),
        (200, json.dumps({"choices": []}).encode()),
        ok("", finish="stop"),
        ok("cortado", finish="length"),
    ):
        with pytest.raises(LlmError) as caught:
            openai(FakeTransport([reply])).generate(REQUEST)
        assert caught.value.kind is LlmErrorKind.BAD_RESPONSE


def test_timeout_raises_a_timeout_error() -> None:
    with pytest.raises(LlmError) as caught:
        openai(FakeTransport([TimeoutError()])).generate(REQUEST)

    assert caught.value.kind is LlmErrorKind.TIMEOUT


# --- reserva entre provedores -----------------------------------------------------------------


def gemini_ok(text: str) -> tuple[int, bytes]:
    body = {"candidates": [{"content": {"parts": [{"text": text}]}, "finishReason": "STOP"}]}
    return 200, json.dumps(body).encode()


def both(
    openai_replies: list[Any], gemini_replies: list[Any]
) -> tuple[FallbackLlmProvider, FakeTransport, FakeTransport]:
    clock = Clock()
    t_openai, t_gemini = FakeTransport(openai_replies), FakeTransport(gemini_replies)
    primary = OpenAiProvider(
        CHAVE_FICTICIA, "gpt-5-mini", transport=t_openai, sleep=clock.sleep, clock=clock
    )
    secondary = GeminiProvider(
        CHAVE_FICTICIA, "gemini-a", (), transport=t_gemini, sleep=clock.sleep, clock=clock
    )
    return FallbackLlmProvider(primary, secondary), t_openai, t_gemini


def test_a_429_on_openai_falls_back_to_gemini() -> None:
    provider, t_openai, t_gemini = both(
        [error(429, "x", code="insufficient_quota")], [gemini_ok("do gemini")]
    )

    completion = provider.generate(REQUEST)

    assert (completion.text, completion.model, completion.fallback_used) == (
        "do gemini",
        "gemini-a",
        True,
    )
    assert len(t_openai.calls) == 1 and len(t_gemini.calls) == 1


def test_a_5xx_or_timeout_also_falls_back() -> None:
    provider, _, _ = both([error(503, "x"), error(503, "x")], [gemini_ok("g")])
    assert provider.generate(REQUEST).model == "gemini-a"

    provider, _, _ = both([TimeoutError()], [gemini_ok("g")])
    assert provider.generate(REQUEST).model == "gemini-a"


def test_a_rejection_does_not_switch_provider() -> None:
    provider, _, t_gemini = both([error(401, "chave")], [gemini_ok("g")])

    with pytest.raises(LlmError) as caught:
        provider.generate(REQUEST)

    assert caught.value.kind is LlmErrorKind.REJECTED
    assert t_gemini.calls == []


def test_the_primary_answers_when_it_works() -> None:
    provider, _, t_gemini = both([ok("da openai")], [])

    completion = provider.generate(REQUEST)

    assert (completion.model, completion.fallback_used) == ("gpt-5-mini", False)
    assert t_gemini.calls == []
    assert provider.model == "gpt-5-mini"
    assert provider.fallback_models == ("gemini-a",)
