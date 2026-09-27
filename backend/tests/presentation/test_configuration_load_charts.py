"""Rota `GET /configurations/{id}/load-charts` com fakes em memória (TASK-044, CA-1).

A autorização (qualquer perfil autenticado) está em `test_route_authorization.py`. Dados FICTÍCIOS.
"""

import pytest
from fastapi.testclient import TestClient

from app.domain.entities.load_chart import LoadChart, LoadChartStatus
from app.presentation.api.load_chart_persistence_schemas import LoadChartResponse
from app.presentation.api.main import create_app
from tests.fixtures.crane_catalog_ficticio import InMemoryCraneCatalog
from tests.fixtures.load_chart_ficticio import CONFIGURATION_FICTICIA_ID, build_load_chart_ficticio
from tests.fixtures.load_chart_persistence_fakes import InMemoryLoadChartStore
from tests.infrastructure.repositories.catalog_ficticio import (
    CRANE_FICTICIO,
    MANUFACTURER_FICTICIO,
    SOURCE_FICTICIA,
    configuration_ficticia,
)

PATH = f"/api/v1/configurations/{CONFIGURATION_FICTICIA_ID}/load-charts"
POINT_COUNT = len(build_load_chart_ficticio().points)


def chart(chart_id: str, version: str, status: LoadChartStatus) -> LoadChart:
    return LoadChart(
        id=chart_id,
        version=version,
        configuration_id=CONFIGURATION_FICTICIA_ID,
        status=status,
        points=build_load_chart_ficticio().points,
    )


@pytest.fixture
def store() -> InMemoryLoadChartStore:
    return InMemoryLoadChartStore({CONFIGURATION_FICTICIA_ID})


@pytest.fixture
def client(store: InMemoryLoadChartStore) -> TestClient:
    catalog = InMemoryCraneCatalog()
    catalog.add_manufacturer(MANUFACTURER_FICTICIO)
    catalog.add_crane(CRANE_FICTICIO)
    catalog.add_configuration(configuration_ficticia())
    return TestClient(create_app(catalog_repository=catalog, load_chart_listing=store))


def test_lists_the_versions_without_points_and_the_active_one(
    client: TestClient, store: InMemoryLoadChartStore
) -> None:
    store.add(chart("LC-V1", "v1", LoadChartStatus.SUPERSEDED), SOURCE_FICTICIA)
    store.add(chart("LC-V2", "v2", LoadChartStatus.ACTIVE), SOURCE_FICTICIA)

    response = client.get(PATH)

    assert response.status_code == 200
    source = {
        "file_name": SOURCE_FICTICIA.file_name,
        "file_type": SOURCE_FICTICIA.file_type,
        "sha256": SOURCE_FICTICIA.sha256,
        "uri": SOURCE_FICTICIA.uri,
    }
    assert response.json() == {
        "items": [
            {
                "chart_id": "LC-V2",
                "version": "v2",
                "configuration_id": CONFIGURATION_FICTICIA_ID,
                "status": "ACTIVE",
                "point_count": POINT_COUNT,
                "source": source,
            },
            {
                "chart_id": "LC-V1",
                "version": "v1",
                "configuration_id": CONFIGURATION_FICTICIA_ID,
                "status": "SUPERSEDED",
                "point_count": POINT_COUNT,
                "source": source,
            },
        ],
        "active_chart_id": "LC-V2",
    }


def test_items_match_the_single_chart_route_without_points(
    store: InMemoryLoadChartStore, client: TestClient
) -> None:
    # A consulta por id não está registrada neste app; compara com o schema dela diretamente.
    store.add(chart("LC-V1", "v1", LoadChartStatus.DRAFT), SOURCE_FICTICIA)
    single = LoadChartResponse.from_stored(store.charts["LC-V1"]).model_dump(mode="json")
    del single["points"]

    assert client.get(PATH).json()["items"] == [single]


def test_configuration_without_charts_returns_empty_items_and_null_active(
    client: TestClient,
) -> None:
    response = client.get(PATH)

    assert response.status_code == 200
    assert response.json() == {"items": [], "active_chart_id": None}


def test_missing_configuration_returns_404(client: TestClient) -> None:
    response = client.get("/api/v1/configurations/CFG-FICTICIA-INEXISTENTE/load-charts")

    assert response.status_code == 404
    assert "configuração" in response.json()["detail"]


def test_order_is_by_natural_version_descending(
    client: TestClient, store: InMemoryLoadChartStore
) -> None:
    for chart_id, version in [("LC-A", "v2"), ("LC-B", "v10"), ("LC-C", "v9")]:
        store.add(chart(chart_id, version, LoadChartStatus.DRAFT), SOURCE_FICTICIA)

    versions = [item["version"] for item in client.get(PATH).json()["items"]]

    assert versions == ["v10", "v9", "v2"]


def test_route_is_only_registered_with_catalog_and_listing() -> None:
    store = InMemoryLoadChartStore({CONFIGURATION_FICTICIA_ID})
    only_catalog = TestClient(create_app(catalog_repository=InMemoryCraneCatalog()))
    only_listing = TestClient(create_app(load_chart_listing=store))

    assert only_catalog.get(PATH).status_code == 404
    assert only_listing.get(PATH).status_code == 404
    paths = only_catalog.get("/openapi.json").json()["paths"]
    assert "/api/v1/configurations/{configuration_id}/load-charts" not in paths


def test_openapi_documents_the_route(client: TestClient) -> None:
    operation = client.get("/openapi.json").json()["paths"][
        "/api/v1/configurations/{configuration_id}/load-charts"
    ]["get"]

    assert {"200", "404"} <= set(operation["responses"])
