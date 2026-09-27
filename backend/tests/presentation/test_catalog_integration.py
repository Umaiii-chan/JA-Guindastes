"""Cadastros REST do catálogo contra um PostgreSQL real (TASK-030; marcador `integration`).

Monta a API com o `SqlAlchemyCraneCatalogRepository` (TASK-022) e grava fabricante → guindaste →
configuração com ficha técnica, lendo tudo de volta pelas rotas. Precisa do banco em `head`
(`uv run alembic upgrade head`; o CI roda antes do pytest). Cada teste roda numa transação desfeita
no fim, então não deixa dados; como o banco pode ter outros registros, as listagens sem filtro só
conferem a presença e a ordem relativa dos registros do teste. Dados FICTÍCIOS (ADR-012).

TASK-044: edição (`PATCH`) e listagem das tabelas de uma configuração, também contra o banco.
"""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.domain.entities.load_chart import LoadChart, LoadChartStatus
from app.infrastructure.repositories.sqlalchemy_crane_catalog_repository import (
    SqlAlchemyCraneCatalogRepository,
)
from app.infrastructure.repositories.sqlalchemy_load_chart_repository import (
    SqlAlchemyLoadChartRepository,
)
from app.presentation.api.main import create_app
from tests.fixtures.crane_catalog_ficticio import (
    CONFIGURACAO_FICTICIA_NOME,
    geometry_payload_ficticio,
)
from tests.fixtures.load_chart_ficticio import build_load_chart_ficticio
from tests.infrastructure.database.postgres_integration_support import (
    integration_engine,
    rolled_back_session_factory,
)
from tests.infrastructure.repositories.catalog_ficticio import SOURCE_FICTICIA

pytestmark = pytest.mark.integration

MANUFACTURERS = "/api/v1/manufacturers"
CRANES = "/api/v1/cranes"
CONFIGURATIONS = "/api/v1/configurations"


@pytest.fixture
def engine() -> Iterator[Engine]:
    yield from integration_engine()


@pytest.fixture
def session_factory(engine: Engine) -> Iterator[sessionmaker[Session]]:
    yield from rolled_back_session_factory(engine)


@pytest.fixture
def charts(session_factory: sessionmaker[Session]) -> SqlAlchemyLoadChartRepository:
    return SqlAlchemyLoadChartRepository(session_factory)


@pytest.fixture
def client(
    session_factory: sessionmaker[Session], charts: SqlAlchemyLoadChartRepository
) -> TestClient:
    repository = SqlAlchemyCraneCatalogRepository(session_factory)
    return TestClient(create_app(catalog_repository=repository, load_chart_listing=charts))


def test_manufacturer_crane_and_configuration_round_trip_through_the_database(
    client: TestClient,
) -> None:
    manufacturer = client.post(MANUFACTURERS, json={"name": "Fabricante FICTÍCIO integração"})
    assert manufacturer.status_code == 201, manufacturer.text
    manufacturer_id = manufacturer.json()["id"]

    crane = client.post(
        CRANES,
        json={"manufacturer_id": manufacturer_id, "model_name": "Modelo FICTÍCIO integração"},
    )
    assert crane.status_code == 201, crane.text
    crane_id = crane.json()["id"]

    geometry = geometry_payload_ficticio(
        boom_pivot_offset_m=-0.5, turret_rotation_min_deg=-30.0, turret_rotation_max_deg=30.0
    )
    with_geometry = client.post(
        f"{CRANES}/{crane_id}/configurations",
        json={"name": CONFIGURACAO_FICTICIA_NOME, "geometry": geometry},
    )
    without_geometry = client.post(
        f"{CRANES}/{crane_id}/configurations", json={"name": "Configuração FICTÍCIA sem ficha"}
    )
    assert with_geometry.status_code == 201, with_geometry.text
    assert without_geometry.status_code == 201, without_geometry.text

    assert client.get(f"{MANUFACTURERS}/{manufacturer_id}").json() == manufacturer.json()
    assert client.get(f"{CRANES}/{crane_id}").json() == crane.json()
    assert client.get(CRANES, params={"manufacturer_id": manufacturer_id}).json() == [crane.json()]
    stored = client.get(f"{CONFIGURATIONS}/{with_geometry.json()['id']}").json()
    assert stored == with_geometry.json()
    assert stored["geometry"] == geometry
    assert client.get(f"{CRANES}/{crane_id}/configurations").json() == [
        with_geometry.json(),
        without_geometry.json(),
    ]


def test_unfiltered_lists_contain_the_new_records_ordered_by_name(client: TestClient) -> None:
    second = client.post(MANUFACTURERS, json={"name": "zz Fabricante FICTÍCIO B"}).json()
    first = client.post(MANUFACTURERS, json={"name": "zz Fabricante FICTÍCIO A"}).json()

    listed_ids = [item["id"] for item in client.get(MANUFACTURERS).json()]

    assert listed_ids.index(first["id"]) < listed_ids.index(second["id"])


def test_references_to_missing_records_return_404(client: TestClient) -> None:
    crane = client.post(
        CRANES, json={"manufacturer_id": "FAB-FICTICIO-INEXISTENTE", "model_name": "Modelo"}
    )
    configuration = client.post(
        f"{CRANES}/GUI-FICTICIO-INEXISTENTE/configurations", json={"name": "Configuração"}
    )

    assert crane.status_code == 404
    assert configuration.status_code == 404
    assert client.get(f"{CONFIGURATIONS}/CFG-FICTICIA-INEXISTENTE").status_code == 404


# --- TASK-044: edição e listagem de tabelas da configuração --------------------------------------


def _configuration(client: TestClient) -> dict[str, str]:
    manufacturer_id = client.post(MANUFACTURERS, json={"name": "Fabricante FICTÍCIO"}).json()["id"]
    crane_id = client.post(
        CRANES, json={"manufacturer_id": manufacturer_id, "model_name": "Modelo FICTÍCIO"}
    ).json()["id"]
    configuration = client.post(
        f"{CRANES}/{crane_id}/configurations",
        json={"name": CONFIGURACAO_FICTICIA_NOME, "geometry": geometry_payload_ficticio()},
    )
    assert configuration.status_code == 201, configuration.text
    return {
        "manufacturer_id": manufacturer_id,
        "crane_id": crane_id,
        "configuration_id": configuration.json()["id"],
    }


def _chart(chart_id: str, version: str, configuration_id: str) -> LoadChart:
    return LoadChart(
        id=chart_id,
        version=version,
        configuration_id=configuration_id,
        status=LoadChartStatus.DRAFT,
        points=build_load_chart_ficticio().points,
    )


def test_patch_routes_persist_the_edits(client: TestClient) -> None:
    ids = _configuration(client)
    new_geometry = geometry_payload_ficticio(
        boom_pivot_offset_m=-1.56, turret_rotation_min_deg=-45.0, turret_rotation_max_deg=45.0
    )

    manufacturer = client.patch(
        f"{MANUFACTURERS}/{ids['manufacturer_id']}", json={"name": "Fabricante editado"}
    )
    crane = client.patch(f"{CRANES}/{ids['crane_id']}", json={"model_name": "Modelo editado"})
    configuration = client.patch(
        f"{CONFIGURATIONS}/{ids['configuration_id']}",
        json={"name": "Configuração editada", "geometry": new_geometry},
    )

    assert manufacturer.status_code == 200, manufacturer.text
    assert crane.status_code == 200, crane.text
    assert configuration.status_code == 200, configuration.text
    assert client.get(f"{MANUFACTURERS}/{ids['manufacturer_id']}").json()["name"] == (
        "Fabricante editado"
    )
    assert client.get(f"{CRANES}/{ids['crane_id']}").json() == {
        "id": ids["crane_id"],
        "manufacturer_id": ids["manufacturer_id"],
        "model_name": "Modelo editado",
    }
    assert client.get(f"{CONFIGURATIONS}/{ids['configuration_id']}").json() == {
        "id": ids["configuration_id"],
        "crane_id": ids["crane_id"],
        "name": "Configuração editada",
        "geometry": new_geometry,
    }


def test_patch_missing_records_return_404(client: TestClient) -> None:
    assert client.patch(f"{MANUFACTURERS}/FAB-X", json={"name": "x"}).status_code == 404
    assert client.patch(f"{CRANES}/GUI-X", json={"model_name": "x"}).status_code == 404
    assert client.patch(f"{CONFIGURATIONS}/CFG-X", json={"name": "x"}).status_code == 404


def test_list_configuration_load_charts_through_the_database(
    client: TestClient, charts: SqlAlchemyLoadChartRepository
) -> None:
    configuration_id = _configuration(client)["configuration_id"]
    charts.save_draft(_chart("LC-FICTICIO-TASK044-V1", "v1", configuration_id), SOURCE_FICTICIA)
    charts.save_draft(_chart("LC-FICTICIO-TASK044-V2", "v2", configuration_id), SOURCE_FICTICIA)
    charts.change_status("LC-FICTICIO-TASK044-V2", LoadChartStatus.ACTIVE)

    response = client.get(f"{CONFIGURATIONS}/{configuration_id}/load-charts")

    assert response.status_code == 200, response.text
    body = response.json()
    assert [item["chart_id"] for item in body["items"]] == [
        "LC-FICTICIO-TASK044-V2",
        "LC-FICTICIO-TASK044-V1",
    ]
    assert body["active_chart_id"] == "LC-FICTICIO-TASK044-V2"
    assert body["items"][0]["point_count"] == len(build_load_chart_ficticio().points)
    assert "points" not in body["items"][0]


def test_patching_the_sheet_keeps_the_load_charts(
    client: TestClient, charts: SqlAlchemyLoadChartRepository
) -> None:
    configuration_id = _configuration(client)["configuration_id"]
    charts.save_draft(_chart("LC-FICTICIO-TASK044-V1", "v1", configuration_id), SOURCE_FICTICIA)
    charts.change_status("LC-FICTICIO-TASK044-V1", LoadChartStatus.ACTIVE)
    listing_before = client.get(f"{CONFIGURATIONS}/{configuration_id}/load-charts").json()

    edited = client.patch(
        f"{CONFIGURATIONS}/{configuration_id}",
        json={"geometry": geometry_payload_ficticio(boom_pivot_height_m=3.0)},
    )

    assert edited.status_code == 200, edited.text
    listing_after = client.get(f"{CONFIGURATIONS}/{configuration_id}/load-charts").json()
    assert listing_after == listing_before


def test_list_load_charts_of_missing_configuration_returns_404(client: TestClient) -> None:
    response = client.get(f"{CONFIGURATIONS}/CFG-FICTICIA-INEXISTENTE/load-charts")

    assert response.status_code == 404
