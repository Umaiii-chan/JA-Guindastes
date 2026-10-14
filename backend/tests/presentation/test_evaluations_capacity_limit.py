"""`capacity_limit` nas respostas REST e WebSocket da avaliação (TASK-051; RN-011; contratos § 3).

Dados FICTÍCIOS (ADR-012): capacidade 4000 kg no ponto (L = 10 m, θ = 0°) da tabela fictícia.
"""

import dataclasses
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.application.use_cases.evaluate_operation import EvaluateOperation
from app.domain.services.exact_point_lookup import ExactPointLookup
from app.domain.value_objects.crane_limits import CraneLimits
from app.presentation.api.evaluations import EvaluationDependencies
from app.presentation.api.main import create_app
from app.presentation.websocket.evaluation import (
    EVALUATION_WEBSOCKET_PATH,
    create_evaluation_websocket_router,
)
from tests.application.test_evaluate_operation_capacity_limit import FakeCraneLimitsProvider
from tests.fixtures.avaliacao_operacional_ficticia import (
    CONFIGURATION_AVALIACAO_FICTICIA_ID,
    build_load_chart_avaliacao_ficticio,
)
from tests.fixtures.crane_geometry_ficticia import build_crane_geometry_ficticia
from tests.presentation.test_evaluations import (
    FakeActiveLoadChartProvider,
    FakeCraneGeometryProvider,
)
from tests.presentation.websocket.test_evaluation_websocket import state_changed_ficticio

EVALUATIONS = "/api/v1/evaluations"
LIMIT_KEYS = {
    "limit_percent",
    "effective_capacity_kg",
    "limit_utilization_percent",
    "warning_band_percent",
    "level",
    "slope_factor",
    "wind_factor",
}


def build_dependencies() -> EvaluationDependencies:
    return EvaluationDependencies(
        crane_geometry_provider=FakeCraneGeometryProvider(
            {CONFIGURATION_AVALIACAO_FICTICIA_ID: build_crane_geometry_ficticia()}
        ),
        active_load_chart_provider=FakeActiveLoadChartProvider(
            {CONFIGURATION_AVALIACAO_FICTICIA_ID: build_load_chart_avaliacao_ficticio()}
        ),
        load_chart_interpolator=ExactPointLookup(),
        crane_limits_provider=FakeCraneLimitsProvider(
            {CONFIGURATION_AVALIACAO_FICTICIA_ID: CraneLimits(capacity_limit_percent=85.0)}
        ),
    )


def rest_body(load_weight_kg: float, **overrides: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "configuration_id": CONFIGURATION_AVALIACAO_FICTICIA_ID,
        "boom_length_m": 10.0,
        "boom_angle_deg": 0.0,
        "turret_rotation_deg": 0.0,
        "cable_length_m": 1.0,
        "load_weight_kg": load_weight_kg,
    }
    body.update(overrides)
    return body


@pytest.fixture
def rest_client() -> TestClient:
    return TestClient(create_app(evaluation=build_dependencies()))


@pytest.mark.parametrize(
    ("load_kg", "level"), [(3_000.0, "OK"), (3_200.0, "WARNING"), (3_500.0, "OVER")]
)
def test_rest_returns_the_capacity_limit_level(
    rest_client: TestClient, load_kg: float, level: str
) -> None:
    response = rest_client.post(EVALUATIONS, json=rest_body(load_kg))

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "EVALUATED"
    assert set(body["capacity_limit"]) == LIMIT_KEYS
    assert body["capacity_limit"]["level"] == level
    assert body["capacity_limit"]["limit_percent"] == 85.0
    assert body["capacity_limit"]["warning_band_percent"] == 90.0
    assert body["capacity_limit"]["effective_capacity_kg"] == pytest.approx(3_400.0)
    assert body["capacity_limit"]["limit_utilization_percent"] == pytest.approx(
        load_kg / 3_400.0 * 100
    )


def test_rest_not_evaluable_has_a_null_capacity_limit(rest_client: TestClient) -> None:
    response = rest_client.post(EVALUATIONS, json=rest_body(1_000.0, boom_length_m=500.0))

    assert response.status_code == 200
    assert response.json()["status"] == "NOT_EVALUABLE"
    assert response.json()["capacity_limit"] is None


def test_rest_without_limits_provider_uses_the_default_limit() -> None:
    dependencies = dataclasses.replace(build_dependencies(), crane_limits_provider=None)
    client = TestClient(create_app(evaluation=dependencies))

    body = client.post(EVALUATIONS, json=rest_body(3_000.0)).json()

    assert body["capacity_limit"]["limit_percent"] == 100.0
    assert body["capacity_limit"]["level"] == "OK"


def build_websocket_app() -> FastAPI:
    dependencies = build_dependencies()
    use_case = EvaluateOperation(
        crane_geometry_provider=dependencies.crane_geometry_provider,
        active_load_chart_provider=dependencies.active_load_chart_provider,
        load_chart_interpolator=dependencies.load_chart_interpolator,
        crane_limits_provider=dependencies.crane_limits_provider,
    )
    app = FastAPI()
    app.include_router(create_evaluation_websocket_router(use_case))
    return app


@pytest.mark.parametrize(
    ("load_kg", "level"), [(3_000.0, "OK"), (3_200.0, "WARNING"), (3_500.0, "OVER")]
)
def test_websocket_returns_the_capacity_limit_level(load_kg: float, level: str) -> None:
    client = TestClient(build_websocket_app())

    with client.websocket_connect(EVALUATION_WEBSOCKET_PATH) as websocket:
        websocket.send_json(
            state_changed_ficticio(
                1, boom_length_m=10.0, boom_angle_deg=0.0, load_weight_kg=load_kg
            )
        )
        payload = websocket.receive_json()["payload"]

    assert payload["result"] == "EVALUATED"
    assert set(payload["capacity_limit"]) == LIMIT_KEYS
    assert payload["capacity_limit"]["level"] == level
    assert payload["capacity_limit"]["effective_capacity_kg"] == pytest.approx(3_400.0)


def test_websocket_not_evaluable_has_no_capacity_limit() -> None:
    client = TestClient(build_websocket_app())

    with client.websocket_connect(EVALUATION_WEBSOCKET_PATH) as websocket:
        websocket.send_json(state_changed_ficticio(1, boom_length_m=500.0))
        payload = websocket.receive_json()["payload"]

    assert payload["result"] == "NOT_EVALUABLE"
    assert "capacity_limit" not in payload
