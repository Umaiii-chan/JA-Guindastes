"""Carga e entrega no cenário (contrato da leva F; TASK-076). Dados FICTÍCIOS, sem banco."""

import pytest
from fastapi.testclient import TestClient

from app.domain.entities.scenario import (
    CargoSpec,
    DeliverySpec,
    ScenarioSpec,
    scenario_spec_from_dict,
    scenario_spec_to_dict,
)
from app.domain.exceptions.scenario_errors import InvalidScenarioError
from app.presentation.api.main import create_app
from app.presentation.api.scenarios import SCENARIOS_PATH
from tests.fixtures.auth_api_ficticia import (
    CSRF_HEADERS,
    auth_client,
    auth_dependencies,
    login_as_operator,
)
from tests.fixtures.auth_ficticia import AuthFicticia
from tests.fixtures.scenario_ficticio import InMemoryScenarioRepository, spec_json_ficticio

CARGO = {"x": 12.0, "z": -1.0, "rotation_y_deg": 15.0}
DELIVERY = {"x": -8.0, "z": 2.0, "rotation_y_deg": 90.0, "radius_m": 3.0}


@pytest.fixture
def client() -> TestClient:
    app = create_app(
        auth=auth_dependencies(AuthFicticia()), scenario_repository=InMemoryScenarioRepository()
    )
    client = auth_client(app)
    login_as_operator(client)
    return client


def test_cargo_and_delivery_round_trip_through_the_api(client: TestClient) -> None:
    spec = {**spec_json_ficticio(), "cargo": CARGO, "delivery": DELIVERY}

    created = client.post(
        SCENARIOS_PATH, json={"name": "Com carga", "spec": spec}, headers=CSRF_HEADERS
    )

    assert created.status_code == 201, created.text
    opened = client.get(f"{SCENARIOS_PATH}/{created.json()['id']}").json()
    assert opened["spec"]["cargo"] == CARGO
    assert opened["spec"]["delivery"] == DELIVERY


def test_scenarios_without_cargo_and_delivery_stay_as_before(client: TestClient) -> None:
    created = client.post(
        SCENARIOS_PATH, json={"name": "Antigo", "spec": spec_json_ficticio()}, headers=CSRF_HEADERS
    )

    assert "cargo" not in created.json()["spec"]
    assert "delivery" not in created.json()["spec"]


def test_delivery_needs_a_positive_radius(client: TestClient) -> None:
    spec = {**spec_json_ficticio(), "delivery": {**DELIVERY, "radius_m": 0.0}}

    response = client.post(
        SCENARIOS_PATH, json={"name": "Raio zero", "spec": spec}, headers=CSRF_HEADERS
    )

    assert response.status_code == 422


def test_domain_serialization_round_trip_and_validation() -> None:
    spec = ScenarioSpec(cargo=CargoSpec(1.0, 2.0, 3.0), delivery=DeliverySpec(4.0, 5.0, 6.0, 2.0))

    data = scenario_spec_to_dict(spec)

    assert data["cargo"] == {"x": 1.0, "z": 2.0, "rotation_y_deg": 3.0}
    assert scenario_spec_from_dict(data) == spec
    assert "cargo" not in scenario_spec_to_dict(ScenarioSpec())
    with pytest.raises(InvalidScenarioError):
        ScenarioSpec(cargo=CargoSpec(float("nan"), 0.0))
