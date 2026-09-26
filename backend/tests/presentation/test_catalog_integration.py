"""Cadastros REST do catálogo contra um PostgreSQL real (TASK-030; marcador `integration`).

Monta a API com o `SqlAlchemyCraneCatalogRepository` (TASK-022) e grava fabricante → guindaste →
configuração com ficha técnica, lendo tudo de volta pelas rotas. Precisa do banco em `head`
(`uv run alembic upgrade head`; o CI roda antes do pytest). Cada teste roda numa transação desfeita
no fim, então não deixa dados; como o banco pode ter outros registros, as listagens sem filtro só
conferem a presença e a ordem relativa dos registros do teste. Dados FICTÍCIOS (ADR-012).
"""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.infrastructure.repositories.sqlalchemy_crane_catalog_repository import (
    SqlAlchemyCraneCatalogRepository,
)
from app.presentation.api.main import create_app
from tests.fixtures.crane_catalog_ficticio import (
    CONFIGURACAO_FICTICIA_NOME,
    geometry_payload_ficticio,
)
from tests.infrastructure.database.postgres_integration_support import (
    integration_engine,
    rolled_back_session_factory,
)

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
def client(session_factory: sessionmaker[Session]) -> TestClient:
    repository = SqlAlchemyCraneCatalogRepository(session_factory)
    return TestClient(create_app(catalog_repository=repository))


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
