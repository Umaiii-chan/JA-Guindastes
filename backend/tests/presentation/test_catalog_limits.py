"""Limites do modelo nas rotas do catálogo (TASK-051; RN-011, RN-013). Dados FICTÍCIOS (ADR-012)."""

from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.presentation.api.main import create_app
from tests.fixtures.crane_catalog_ficticio import (
    FABRICANTE_FICTICIO_NOME,
    MODELO_FICTICIO_NOME,
    InMemoryCraneCatalog,
)

MANUFACTURERS = "/api/v1/manufacturers"
CRANES = "/api/v1/cranes"

DEFAULT_LIMITS = {
    "capacity_limit_percent": 100.0,
    "warning_band_percent": 90.0,
    "max_ground_slope_deg": 1.0,
    "max_leveling_deg": 3.0,
}


@pytest.fixture
def repository() -> InMemoryCraneCatalog:
    return InMemoryCraneCatalog()


@pytest.fixture
def client(repository: InMemoryCraneCatalog) -> TestClient:
    return TestClient(create_app(catalog_repository=repository))


def create_crane(client: TestClient, **limits: Any) -> dict[str, Any]:
    manufacturer = client.post(MANUFACTURERS, json={"name": FABRICANTE_FICTICIO_NOME}).json()
    response = client.post(
        CRANES,
        json={"manufacturer_id": manufacturer["id"], "model_name": MODELO_FICTICIO_NOME, **limits},
    )
    assert response.status_code == 201, response.text
    body: dict[str, Any] = response.json()
    return body


def test_a_crane_created_without_limits_exposes_the_defaults(client: TestClient) -> None:
    crane = create_crane(client)

    assert {key: crane[key] for key in DEFAULT_LIMITS} == DEFAULT_LIMITS
    assert client.get(f"{CRANES}/{crane['id']}").json() == crane
    assert client.get(CRANES).json() == [crane]


def test_a_crane_can_be_created_with_limits(client: TestClient) -> None:
    crane = create_crane(client, capacity_limit_percent=85, max_leveling_deg=2.5)

    assert crane["capacity_limit_percent"] == 85.0
    assert crane["warning_band_percent"] == 90.0
    assert crane["max_leveling_deg"] == 2.5


def test_patch_changes_only_the_limits_informed(client: TestClient) -> None:
    crane = create_crane(client)

    response = client.patch(
        f"{CRANES}/{crane['id']}", json={"capacity_limit_percent": 80, "warning_band_percent": 70}
    )

    assert response.status_code == 200
    assert response.json() == {
        **crane,
        "capacity_limit_percent": 80.0,
        "warning_band_percent": 70.0,
    }
    assert client.get(f"{CRANES}/{crane['id']}").json() == response.json()


def test_patch_can_change_the_name_and_a_limit_together(client: TestClient) -> None:
    crane = create_crane(client)

    response = client.patch(
        f"{CRANES}/{crane['id']}",
        json={"model_name": "Modelo FICTÍCIO B", "max_ground_slope_deg": 0},
    )

    assert response.status_code == 200
    assert response.json()["model_name"] == "Modelo FICTÍCIO B"
    assert response.json()["max_ground_slope_deg"] == 0.0


@pytest.mark.parametrize(
    "body",
    [
        {"capacity_limit_percent": 0},
        {"capacity_limit_percent": 100.5},
        {"warning_band_percent": 0.5},
        {"warning_band_percent": 101},
        {"max_ground_slope_deg": -1},
        {"max_ground_slope_deg": 46},
        {"max_leveling_deg": -0.1},
        {"max_leveling_deg": "3"},
    ],
)
def test_limits_out_of_range_are_422_on_patch_and_post(
    client: TestClient, repository: InMemoryCraneCatalog, body: dict[str, Any]
) -> None:
    crane = create_crane(client)

    patched = client.patch(f"{CRANES}/{crane['id']}", json=body)
    created = client.post(
        CRANES,
        json={"manufacturer_id": crane["manufacturer_id"], "model_name": "Outro", **body},
    )

    assert patched.status_code == 422
    assert created.status_code == 422
    assert repository.cranes[crane["id"]].limits.capacity_limit_percent == 100.0


def test_patch_of_an_unknown_crane_with_limits_is_404(client: TestClient) -> None:
    response = client.patch(f"{CRANES}/NAO-EXISTE", json={"capacity_limit_percent": 90})

    assert response.status_code == 404
