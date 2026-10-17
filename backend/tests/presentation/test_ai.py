"""Rotas `/api/v1/ai*` (TASK-076; ADR-039). Provedor falso e dados FICTÍCIOS, sem rede nem banco."""

from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.application.ports.llm_provider import LlmError, LlmErrorKind
from app.application.use_cases.ai_assistant import AiAssistant
from app.domain.entities.simulation_recording import (
    SimulationRecording,
    SimulationRecordingSummary,
)
from app.domain.services.conservative_tabulated_lookup import ConservativeTabulatedLookup
from app.presentation.api.evaluations import EvaluationDependencies
from app.presentation.api.main import create_app
from tests.fixtures.ai_fakes import FakeLlmProvider, FakeUsageLimiter, scenario_ia_reply
from tests.fixtures.auth_api_ficticia import (
    CSRF_HEADERS,
    auth_client,
    auth_dependencies,
    login_as_operator,
)
from tests.fixtures.auth_ficticia import INSTANTE_FICTICIO, AuthFicticia
from tests.fixtures.avaliacao_operacional_ficticia import (
    CONFIGURATION_AVALIACAO_FICTICIA_ID,
    build_load_chart_avaliacao_ficticio,
)
from tests.fixtures.crane_geometry_ficticia import build_crane_geometry_ficticia
from tests.fixtures.simulation_recording_fakes import (
    InMemorySimulationRecordingRepository,
    frames_ficticios,
)
from tests.presentation.test_evaluations import (
    FakeActiveLoadChartProvider,
    FakeCraneGeometryProvider,
    body_ficticio,
)

STATUS = "/api/v1/ai/status"
SCENARIO = "/api/v1/ai/scenario-from-text"
EXPLAIN = "/api/v1/ai/explain-recommendation"
REPORT = "/api/v1/ai/lift-report"
REVIEW = "/api/v1/ai/review-recording"


class Setup:
    def __init__(self, *, with_ai: bool = True, allowed_calls: int | None = None) -> None:
        self.auth = AuthFicticia()
        self.provider = FakeLlmProvider()
        self.limiter = FakeUsageLimiter(limit=20, allowed_calls=allowed_calls)
        self.recordings = InMemorySimulationRecordingRepository()
        evaluation = EvaluationDependencies(
            crane_geometry_provider=FakeCraneGeometryProvider(
                {CONFIGURATION_AVALIACAO_FICTICIA_ID: build_crane_geometry_ficticia()}
            ),
            active_load_chart_provider=FakeActiveLoadChartProvider(
                {CONFIGURATION_AVALIACAO_FICTICIA_ID: build_load_chart_avaliacao_ficticio()}
            ),
            load_chart_interpolator=ConservativeTabulatedLookup(),
        )
        self.client: TestClient = auth_client(
            create_app(
                auth=auth_dependencies(self.auth),
                evaluation=evaluation,
                simulation_recordings=self.recordings,
                ai_assistant=AiAssistant(self.provider, self.limiter) if with_ai else None,
            )
        )


@pytest.fixture
def setup() -> Setup:
    result = Setup()
    login_as_operator(result.client)
    return result


def post(client: TestClient, path: str, body: dict[str, Any]) -> Any:
    return client.post(path, json=body, headers=CSRF_HEADERS)


def add_recording(setup: Setup) -> str:
    summary = SimulationRecordingSummary(
        id="g1",
        name="Gravação FICTÍCIA",
        author_user_id=setup.auth.operator.id,
        author_display_name="Operador FICTÍCIO",
        created_at=INSTANTE_FICTICIO,
        duration_ms=200,
        configuration_id="CFG-FICTICIA",
        load_chart_refs=(),
        frame_count=3,
    )
    setup.recordings.add(SimulationRecording(summary, None, frames_ficticios(3)))
    return "g1"


# --- status e autorização ----------


def test_status_is_disabled_without_the_assistant() -> None:
    setup = Setup(with_ai=False)
    login_as_operator(setup.client)

    response = setup.client.get(STATUS)

    assert response.status_code == 200
    assert response.json() == {
        "enabled": False,
        "model": None,
        "fallback_models": [],
        "usage_limit_per_hour": None,
    }
    assert post(setup.client, SCENARIO, {"text": "x"}).status_code == 404


def test_status_shows_the_model_and_the_fallbacks(setup: Setup) -> None:
    assert setup.client.get(STATUS).json() == {
        "enabled": True,
        "model": "modelo-ficticio",
        "fallback_models": ["reserva-ficticia"],
        "usage_limit_per_hour": 20,
    }


def test_every_route_requires_a_session_and_the_csrf_header() -> None:
    setup = Setup()

    assert setup.client.get(STATUS).status_code == 401
    for path in (SCENARIO, EXPLAIN, REPORT, REVIEW):
        assert post(setup.client, path, {}).status_code == 401
    login_as_operator(setup.client)
    assert setup.client.post(SCENARIO, json={"text": "x"}).status_code == 403


# --- 1. cenário ----------


def test_scenario_from_text_returns_the_draft_for_review(setup: Setup) -> None:
    setup.provider.replies = [scenario_ia_reply()]

    response = post(setup.client, SCENARIO, {"text": "içar uma viga de 8 t"})

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["model"] == "modelo-ficticio" and data["fallback_used"] is False
    assert data["load"]["weight_kg"] == 8000
    assert data["scenario"]["cargo"] == {"x": 12, "z": 0, "rotation_y_deg": 0}
    assert data["scenario"]["delivery"]["radius_m"] == 3
    assert len(data["scenario"]["obstacles"]) == 2
    # A parede ficava na ponta da viga (comprimento em Z local, como na cena) e sai (TASK-094).
    assert data["assumptions"] == [
        "Largura e altura da viga estimadas.",
        "Parede lateral movido de (12; 4) para (12; 5) para não ficar sobre a carga na coleta.",
    ]
    assert setup.limiter.keys == [setup.auth.operator.id]


def test_blank_and_oversized_text_are_422_with_a_friendly_code(setup: Setup) -> None:
    blank = post(setup.client, SCENARIO, {"text": "   "})
    long = post(setup.client, SCENARIO, {"text": "a" * 2000})

    for response in (blank, long):
        assert response.status_code == 422
        assert response.json()["code"] == "AI_INPUT_INVALID"
    assert setup.provider.requests == []


def test_unusable_model_output_is_502(setup: Setup) -> None:
    setup.provider.replies = ["isto não é json"]

    response = post(setup.client, SCENARIO, {"text": "içar"})

    assert response.status_code == 502
    assert response.json()["code"] == "AI_BAD_OUTPUT"


@pytest.mark.parametrize(
    ("kind", "status_code", "code"),
    [
        (LlmErrorKind.UNAVAILABLE, 503, "AI_UNAVAILABLE"),
        (LlmErrorKind.RATE_LIMITED, 503, "AI_UNAVAILABLE"),
        (LlmErrorKind.TIMEOUT, 504, "AI_TIMEOUT"),
        (LlmErrorKind.REJECTED, 422, "AI_REJECTED"),
        (LlmErrorKind.BAD_RESPONSE, 502, "AI_BAD_OUTPUT"),
    ],
)
def test_provider_failures_become_friendly_http_errors(
    setup: Setup, kind: LlmErrorKind, status_code: int, code: str
) -> None:
    setup.provider.replies = [LlmError(kind, "Mensagem amigável.")]

    response = post(setup.client, SCENARIO, {"text": "içar"})

    assert response.status_code == status_code
    assert response.json() == {"detail": "Mensagem amigável.", "code": code}


def test_usage_limit_per_user_is_429() -> None:
    setup = Setup(allowed_calls=1)
    login_as_operator(setup.client)
    setup.provider.replies = [scenario_ia_reply(), scenario_ia_reply()]
    assert post(setup.client, SCENARIO, {"text": "primeira"}).status_code == 200

    response = post(setup.client, SCENARIO, {"text": "segunda"})

    assert response.status_code == 429
    assert response.json()["code"] == "AI_RATE_LIMITED"
    assert "limite de 20 usos" in response.json()["detail"]


# --- 2. explicar ----------


def test_explain_recommendation_returns_the_text(setup: Setup) -> None:
    setup.provider.replies = ["### Por que esta opção\nPorque sim."]

    response = post(
        setup.client,
        EXPLAIN,
        {"recommendation": {"kind": "single", "max_limit_utilization_percent": 55.5}},
    )

    assert response.status_code == 200, response.text
    assert response.json()["text"].startswith("### Por que esta opção")
    assert "55.5" in setup.provider.requests[0].user


# --- 3. relatório ----------


def report_body(**changes: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "evaluation": body_ficticio(),
        "load": {
            "description": "Viga FICTÍCIA",
            "length_m": 6.0,
            "width_m": 0.4,
            "height_m": 0.6,
        },
        "crane_label": "Guindaste FICTÍCIO",
    }
    body.update(changes)
    return body


def test_lift_report_is_built_from_the_backend_evaluation(setup: Setup) -> None:
    setup.provider.replies = ["### Resumo da operação\nResumo FICTÍCIO."]

    response = post(setup.client, REPORT, report_body())

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["evaluation"]["status"] == "EVALUATED"
    assert data["evaluation"]["utilization_percent"] == pytest.approx(75.0)
    assert "| Utilização da capacidade da tabela | 75,0 % |" in data["markdown"]
    assert "| Capacidade na tabela | 2.000 kg |" in data["markdown"]
    assert "Resumo FICTÍCIO." in data["markdown"]


def test_lift_report_ignores_numbers_the_client_claims(setup: Setup) -> None:
    # O cliente só manda o estado; capacidade e utilização são sempre as do backend (RN-008).
    body = report_body()
    body["evaluation"]["load_weight_kg"] = 1000.0

    data = post(setup.client, REPORT, body).json()

    assert data["evaluation"]["utilization_percent"] == pytest.approx(50.0)


def test_lift_report_for_an_unknown_configuration_still_reports_not_evaluable(
    setup: Setup,
) -> None:
    body = report_body()
    body["evaluation"]["configuration_id"] = "CFG-NAO-EXISTE"

    response = post(setup.client, REPORT, body)

    assert response.status_code == 200
    assert response.json()["evaluation"]["status"] == "NOT_EVALUABLE"
    assert "não avaliável" in response.json()["markdown"]


def test_lift_report_validates_the_body(setup: Setup) -> None:
    response = post(setup.client, REPORT, report_body(load={"description": "x"}))

    assert response.status_code == 422


# --- 4. revisão ----------


def test_review_recording_returns_indicators_and_the_ai_text(setup: Setup) -> None:
    recording_id = add_recording(setup)
    setup.provider.replies = ["### Visão geral\nRevisão FICTÍCIA."]

    response = post(setup.client, REVIEW, {"recording_id": recording_id})

    assert response.status_code == 200, response.text
    markdown = response.json()["markdown"]
    assert markdown.startswith("# Revisão da gravação: Gravação FICTÍCIA")
    assert "Revisão FICTÍCIA." in markdown


def test_review_of_an_unknown_recording_is_404_and_does_not_use_the_quota(setup: Setup) -> None:
    response = post(setup.client, REVIEW, {"recording_id": "nao-existe"})

    assert response.status_code == 404
    assert response.json()["code"] == "RECORDING_NOT_FOUND"
    assert setup.limiter.keys == []
