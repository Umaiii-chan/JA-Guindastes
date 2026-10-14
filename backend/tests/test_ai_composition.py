"""Composição do assistente de IA (TASK-076; ADR-039). Sem rede: só monta os objetos."""

from fastapi.testclient import TestClient

from app.ai_composition import build_ai_assistant
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


def test_the_app_without_a_database_answers_the_ai_status(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)

    client = TestClient(create_app_without_database())

    assert client.get("/api/v1/ai/status").json()["enabled"] is False
