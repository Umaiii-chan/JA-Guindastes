"""Composição do assistente de IA (TASK-076; ADR-039). Sem rede: só monta os objetos."""

from fastapi.testclient import TestClient

from app.ai_composition import build_ai_assistant
from app.infrastructure.ai.fallback_provider import FallbackLlmProvider
from app.main import create_app_without_database
from tests.fixtures.ai_fakes import CHAVE_FICTICIA


def test_without_a_key_the_assistant_is_off() -> None:
    assert build_ai_assistant({}) is None
    assert build_ai_assistant({"GEMINI_API_KEY": "   "}) is None


def test_defaults_to_the_documented_models_and_limit() -> None:
    assistant = build_ai_assistant({"GEMINI_API_KEY": CHAVE_FICTICIA})

    assert assistant is not None
    assert assistant.model == "gemini-3.7-flash"
    assert assistant.fallback_models == ("gemini-3-flash-preview", "gemini-flash-lite-latest")
    assert assistant.usage_limit_per_hour == 20


def test_models_and_limit_come_from_the_environment() -> None:
    assistant = build_ai_assistant(
        {
            "GEMINI_API_KEY": CHAVE_FICTICIA,
            "GEMINI_MODEL": "modelo-a",
            "GEMINI_FALLBACK_MODELS": "modelo-b, modelo-c",
            "AI_RATE_LIMIT_PER_HOUR": "5",
        }
    )

    assert assistant is not None
    assert (assistant.model, assistant.fallback_models) == ("modelo-a", ("modelo-b", "modelo-c"))
    assert assistant.usage_limit_per_hour == 5


def test_invalid_values_fall_back_to_the_defaults() -> None:
    assistant = build_ai_assistant(
        {"GEMINI_API_KEY": CHAVE_FICTICIA, "AI_RATE_LIMIT_PER_HOUR": "muitos"}
    )

    assert assistant is not None and assistant.usage_limit_per_hour == 20
    assert build_ai_assistant({"GEMINI_API_KEY": CHAVE_FICTICIA, "GEMINI_MODEL": "a/../b"}) is None


OPENAI_ENV = {"OPENAI_API_KEY": CHAVE_FICTICIA}
GEMINI_ENV = {"GEMINI_API_KEY": CHAVE_FICTICIA}


def test_auto_prefers_openai_when_it_has_a_key() -> None:
    assistant = build_ai_assistant({**OPENAI_ENV, "OPENAI_MODEL": "gpt-x"})

    assert assistant is not None
    assert (assistant.model, assistant.fallback_models) == ("gpt-x", ())
    default = build_ai_assistant(OPENAI_ENV)
    assert default is not None and default.model == "gpt-5-mini"


def test_auto_with_both_keys_uses_openai_first_and_gemini_as_backup() -> None:
    assistant = build_ai_assistant({**OPENAI_ENV, **GEMINI_ENV})

    assert assistant is not None
    assert assistant.model == "gpt-5-mini"
    assert assistant.fallback_models[0] == "gemini-3.7-flash"
    assert isinstance(assistant._provider, FallbackLlmProvider)


def test_auto_without_openai_uses_gemini() -> None:
    assistant = build_ai_assistant({**GEMINI_ENV, "AI_PROVIDER": "auto"})

    assert assistant is not None and assistant.model == "gemini-3.7-flash"


def test_ai_provider_forces_one_provider_and_needs_its_key() -> None:
    both = {**OPENAI_ENV, **GEMINI_ENV}
    forced_gemini = build_ai_assistant({**both, "AI_PROVIDER": "gemini"})
    forced_openai = build_ai_assistant({**both, "AI_PROVIDER": "openai"})

    assert forced_gemini is not None and forced_gemini.model == "gemini-3.7-flash"
    assert forced_gemini.fallback_models == ("gemini-3-flash-preview", "gemini-flash-lite-latest")
    assert forced_openai is not None and forced_openai.model == "gpt-5-mini"
    assert forced_openai.fallback_models == ()
    assert build_ai_assistant({**OPENAI_ENV, "AI_PROVIDER": "gemini"}) is None
    assert build_ai_assistant({**GEMINI_ENV, "AI_PROVIDER": "openai"}) is None


def test_an_invalid_ai_provider_value_behaves_like_auto() -> None:
    assistant = build_ai_assistant({**OPENAI_ENV, "AI_PROVIDER": "outro"})

    assert assistant is not None and assistant.model == "gpt-5-mini"


def test_the_app_without_a_database_answers_the_ai_status(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    client = TestClient(create_app_without_database())

    assert client.get("/api/v1/ai/status").json()["enabled"] is False
