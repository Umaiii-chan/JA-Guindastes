"""Composição com PostgreSQL real: avaliação de dados gravados pelos repositórios (TASK-029).

Marcador `integration`: pula sem `DATABASE_URL` ou sem banco, e falha com `REQUIRE_INTEGRATION_DB=1`
(CI). Precisa do banco em `head` (`uv run alembic upgrade head`; o CI roda antes do pytest).

Diferente dos testes dos repositórios, aqui os dados são **gravados de verdade** (a aplicação abre
as próprias conexões e não enxergaria uma transação desfeita do teste). Por isso os ids têm sufixo
único por teste, e a fixture apaga tudo no fim, mesmo com falha; o teste da migration da TASK-022 só
desce com as tabelas vazias.

Dados FICTÍCIOS (ADR-012): a ficha técnica de `tests/fixtures/crane_geometry_ficticia.py` e a tabela
de `tests/fixtures/avaliacao_operacional_ficticia.py` (para L = 20 m: 11,5 m → 5000 kg e 21,5 m →
2000 kg). Nenhum número representa guindaste ou capacidade real.
"""

import uuid
from collections.abc import Iterator
from dataclasses import dataclass
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, inspect, text

from app.application.ports.crane_catalog_repository import (
    Crane,
    CraneConfiguration,
    Manufacturer,
)
from app.domain.entities.load_chart import LoadChart, LoadChartStatus
from app.infrastructure.database.engine import create_session_factory
from app.infrastructure.repositories.sqlalchemy_crane_catalog_repository import (
    SqlAlchemyCraneCatalogRepository,
)
from app.infrastructure.repositories.sqlalchemy_load_chart_repository import (
    SqlAlchemyLoadChartRepository,
)
from app.main import create_database_app
from app.presentation.api.evaluations import EVALUATIONS_PATH
from app.presentation.api.health import HEALTH_PATH
from app.presentation.websocket.evaluation import EVALUATION_WEBSOCKET_PATH
from tests.fixtures.auth_api_ficticia import CSRF_HEADERS
from tests.fixtures.auth_postgres_ficticia import (
    LOCAL_HTTP_ENVIRON,
    log_in,
    stored_user,
    websocket_headers,
)
from tests.fixtures.avaliacao_operacional_ficticia import build_load_chart_avaliacao_ficticio
from tests.fixtures.crane_geometry_ficticia import build_crane_geometry_ficticia
from tests.infrastructure.database.postgres_integration_support import (
    TASK_022_TABLES,
    integration_engine,
    skip_or_fail,
)
from tests.infrastructure.repositories.catalog_ficticio import SOURCE_FICTICIA

pytestmark = pytest.mark.integration


@dataclass(frozen=True)
class StoredFicticio:
    manufacturer_id: str
    crane_id: str
    configuration_id: str
    load_chart_id: str
    load_chart_version: str


@pytest.fixture
def engine() -> Iterator[Engine]:
    yield from integration_engine()


@pytest.fixture
def stored(engine: Engine) -> Iterator[StoredFicticio]:
    """Grava pelos repositórios uma configuração FICTÍCIA com ficha técnica e tabela `ACTIVE`."""
    if not all(inspect(engine).has_table(table) for table in TASK_022_TABLES):
        skip_or_fail("tabelas da TASK-022 ausentes: rode `uv run alembic upgrade head` antes")

    suffix = uuid.uuid4().hex[:12]
    ids = StoredFicticio(
        manufacturer_id=f"FAB-FICTICIO-T029-{suffix}",
        crane_id=f"GUI-FICTICIO-T029-{suffix}",
        configuration_id=f"CFG-FICTICIA-T029-{suffix}",
        load_chart_id=f"LC-FICTICIO-T029-{suffix}",
        load_chart_version="FICTICIO-T029-v1",
    )
    session_factory = create_session_factory(engine)
    catalog = SqlAlchemyCraneCatalogRepository(session_factory)
    charts = SqlAlchemyLoadChartRepository(session_factory)
    try:
        catalog.add_manufacturer(Manufacturer(id=ids.manufacturer_id, name="Fabricante FICTÍCIO"))
        catalog.add_crane(
            Crane(
                id=ids.crane_id,
                manufacturer_id=ids.manufacturer_id,
                model_name="Modelo FICTÍCIO",
            )
        )
        catalog.add_configuration(
            CraneConfiguration(
                id=ids.configuration_id,
                crane_id=ids.crane_id,
                name="Configuração FICTÍCIA",
                geometry=build_crane_geometry_ficticia(),
            )
        )
        base = build_load_chart_avaliacao_ficticio(configuration_id=ids.configuration_id)
        charts.save_draft(
            LoadChart(
                id=ids.load_chart_id,
                version=ids.load_chart_version,
                configuration_id=ids.configuration_id,
                status=LoadChartStatus.DRAFT,
                points=base.points,
            ),
            SOURCE_FICTICIA,
        )
        charts.change_status(ids.load_chart_id, LoadChartStatus.ACTIVE)
        yield ids
    finally:
        with engine.begin() as connection:
            # Os pontos saem em CASCADE com a tabela; a configuração é RESTRICT (TASK-022).
            connection.execute(
                text("DELETE FROM load_charts WHERE configuration_id = :id"),
                {"id": ids.configuration_id},
            )
            connection.execute(
                text("DELETE FROM crane_configurations WHERE id = :id"),
                {"id": ids.configuration_id},
            )
            connection.execute(text("DELETE FROM cranes WHERE id = :id"), {"id": ids.crane_id})
            connection.execute(
                text("DELETE FROM manufacturers WHERE id = :id"), {"id": ids.manufacturer_id}
            )


def evaluation_body(configuration_id: str) -> dict[str, Any]:
    # L = 20 m, θ = 30° → R = 1,5 + 10√3 ≈ 18,82 m, entre 11,5 m e 21,5 m: vale 2000 kg (ADR-015).
    return {
        "configuration_id": configuration_id,
        "boom_length_m": 20.0,
        "boom_angle_deg": 30.0,
        "turret_rotation_deg": 0.0,
        "cable_length_m": 1.0,
        "load_weight_kg": 1500.0,
    }


@pytest.fixture
def client(engine: Engine) -> Iterator[TestClient]:
    """API com banco e um admin FICTÍCIO logado (desde a TASK-038, as rotas exigem sessão)."""
    with (
        stored_user(engine) as admin,
        TestClient(create_database_app(engine, LOCAL_HTTP_ENVIRON)) as client,
    ):
        log_in(client, admin)
        yield client


def test_rest_evaluates_a_configuration_stored_by_the_repositories(
    client: TestClient, stored: StoredFicticio
) -> None:
    response = client.post(
        EVALUATIONS_PATH, json=evaluation_body(stored.configuration_id), headers=CSRF_HEADERS
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "EVALUATED"
    # ADR-030: R ≈ 18,82 m fica entre 11,5 m (5000 kg) e 21,5 m (2000 kg), interpolado.
    capacity = 5000.0 - 3000.0 * (body["geometry"]["working_radius_m"] - 11.5) / 10.0
    assert body["capacity"]["maximum_capacity_kg"] == pytest.approx(capacity)
    assert body["capacity"]["strategy"] == "LINEAR_INTERPOLATION_PROVISIONAL"
    assert body["utilization_percent"] == pytest.approx(1500.0 / capacity * 100.0)
    assert body["load_chart_id"] == stored.load_chart_id
    assert body["load_chart_version"] == stored.load_chart_version
    assert body["reasons"] == []


def test_websocket_evaluates_a_configuration_stored_by_the_repositories(
    client: TestClient, stored: StoredFicticio
) -> None:
    message = {
        "type": "simulation.state.changed",
        "sequence": 1,
        "payload": evaluation_body(stored.configuration_id),
    }
    with client.websocket_connect(
        EVALUATION_WEBSOCKET_PATH, headers=websocket_headers(client)
    ) as websocket:
        websocket.send_json(message)
        reply = websocket.receive_json()

    assert reply["type"] == "simulation.evaluated"
    assert reply["payload"]["result"] == "EVALUATED"
    assert reply["payload"]["load_chart_id"] == stored.load_chart_id


def test_unknown_configuration_is_not_evaluable_with_the_database(client: TestClient) -> None:
    response = client.post(
        EVALUATIONS_PATH,
        json=evaluation_body("CFG-FICTICIA-T029-INEXISTENTE"),
        headers=CSRF_HEADERS,
    )

    assert response.status_code == 200
    assert response.json()["status"] == "NOT_EVALUABLE"


def test_health_reports_the_database_up(engine: Engine) -> None:
    # A saúde continua pública (ADR-016 § 1): sem login.
    with TestClient(create_database_app(engine)) as client:
        response = client.get(HEALTH_PATH)

    assert response.json() == {"status": "UP", "database": "UP"}
