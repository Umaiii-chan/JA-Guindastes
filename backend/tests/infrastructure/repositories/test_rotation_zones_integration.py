"""Zonas de giro, peso do gancho e "uma ativa por zona" contra um PostgreSQL real (TASK-046 CA-2).

Marcador `integration`: precisa do banco em `head` (o CI roda `alembic upgrade head` antes do
pytest). Cada teste roda numa transação desfeita no fim. Dados FICTÍCIOS (ADR-012).
"""

import dataclasses
from collections.abc import Iterator

import pytest
from sqlalchemy import Engine, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from app.application.ports.load_chart_repository import ActiveLoadChartConflictError
from app.domain.entities.load_chart import LoadChart, LoadChartStatus
from app.domain.value_objects.mass import Mass
from app.domain.value_objects.rotation_zone import RotationZone, RotationZones
from app.infrastructure.repositories.sqlalchemy_crane_catalog_repository import (
    SqlAlchemyCraneCatalogRepository,
)
from app.infrastructure.repositories.sqlalchemy_load_chart_activation_repository import (
    SqlAlchemyLoadChartActivationRepository,
)
from app.infrastructure.repositories.sqlalchemy_load_chart_repository import (
    SqlAlchemyLoadChartRepository,
)
from tests.fixtures.crane_geometry_ficticia import build_crane_geometry_ficticia
from tests.fixtures.load_chart_ficticio import CONFIGURATION_FICTICIA_ID, build_load_chart_ficticio
from tests.fixtures.rotation_zones_ficticias import (
    GANCHO_FICTICIO_KG,
    ZONA_FRONTAL_FICTICIA,
    ZONA_LATERAL_TRASEIRA_FICTICIA,
    zonas_ficticias,
)
from tests.infrastructure.database.postgres_integration_support import (
    integration_engine,
    rolled_back_session_factory,
)
from tests.infrastructure.repositories.catalog_ficticio import (
    CRANE_FICTICIO,
    MANUFACTURER_FICTICIO,
    SOURCE_FICTICIA,
    configuration_ficticia,
)

pytestmark = pytest.mark.integration


@pytest.fixture
def engine() -> Iterator[Engine]:
    yield from integration_engine()


@pytest.fixture
def session_factory(engine: Engine) -> Iterator[sessionmaker[Session]]:
    yield from rolled_back_session_factory(engine)


@pytest.fixture
def catalog(session_factory: sessionmaker[Session]) -> SqlAlchemyCraneCatalogRepository:
    catalog = SqlAlchemyCraneCatalogRepository(session_factory)
    catalog.add_manufacturer(MANUFACTURER_FICTICIO)
    catalog.add_crane(CRANE_FICTICIO)
    catalog.add_configuration(
        dataclasses.replace(
            configuration_ficticia(build_crane_geometry_ficticia()),
            rotation_zones=zonas_ficticias(),
            hook_block_weight=Mass(GANCHO_FICTICIO_KG),
        )
    )
    return catalog


@pytest.fixture
def charts(
    session_factory: sessionmaker[Session], catalog: SqlAlchemyCraneCatalogRepository
) -> SqlAlchemyLoadChartRepository:
    return SqlAlchemyLoadChartRepository(session_factory)


@pytest.fixture
def activation(session_factory: sessionmaker[Session]) -> SqlAlchemyLoadChartActivationRepository:
    return SqlAlchemyLoadChartActivationRepository(session_factory)


def draft(chart_id: str, zone: str | None) -> LoadChart:
    return LoadChart(
        id=chart_id,
        version=f"{chart_id}-v",
        configuration_id=CONFIGURATION_FICTICIA_ID,
        status=LoadChartStatus.DRAFT,
        points=build_load_chart_ficticio().points,
        rotation_zone_code=zone,
    )


def save_and_validate(charts: SqlAlchemyLoadChartRepository, chart: LoadChart) -> None:
    charts.save_draft(chart, SOURCE_FICTICIA)
    charts.change_status(chart.id, LoadChartStatus.VALIDATED)


# --- configuração ---------------------------------------------------------------------------


def test_configuration_keeps_zones_in_declared_order_and_hook_block(
    catalog: SqlAlchemyCraneCatalogRepository,
) -> None:
    stored = catalog.get_configuration(CONFIGURATION_FICTICIA_ID)

    assert stored is not None
    assert stored.rotation_zones == zonas_ficticias()
    assert stored.hook_block_weight == Mass(GANCHO_FICTICIO_KG)
    rules = catalog.get_load_rules(CONFIGURATION_FICTICIA_ID)
    assert rules is not None
    assert rules.rotation_zones == zonas_ficticias()
    assert rules.hook_block_weight == Mass(GANCHO_FICTICIO_KG)
    assert catalog.get_load_rules("CFG-FICTICIA-INEXISTENTE") is None


def test_update_replaces_and_removes_zones_and_hook_block(
    catalog: SqlAlchemyCraneCatalogRepository,
) -> None:
    current = catalog.get_configuration(CONFIGURATION_FICTICIA_ID)
    assert current is not None
    three = RotationZones(
        zones=(
            RotationZone("C", "C FICTÍCIA", 240.0, 0.0),
            RotationZone("A", "A FICTÍCIA", 0.0, 120.0),
            RotationZone("B", "B FICTÍCIA", 120.0, 240.0),
        )
    )

    assert catalog.update_configuration(
        dataclasses.replace(current, rotation_zones=three, hook_block_weight=Mass(0.0))
    )
    updated = catalog.get_configuration(CONFIGURATION_FICTICIA_ID)
    assert updated is not None
    assert updated.rotation_zones == three
    assert updated.hook_block_weight == Mass(0.0)

    assert catalog.update_configuration(
        dataclasses.replace(current, rotation_zones=None, hook_block_weight=None)
    )
    removed = catalog.get_configuration(CONFIGURATION_FICTICIA_ID)
    assert removed is not None
    assert removed.rotation_zones is None
    assert removed.hook_block_weight is None


@pytest.mark.parametrize("value", [-1.0, 100_000.5])
def test_database_rejects_hook_block_weight_out_of_range(
    catalog: SqlAlchemyCraneCatalogRepository,
    session_factory: sessionmaker[Session],
    value: float,
) -> None:
    with pytest.raises(IntegrityError), session_factory.begin() as session:
        session.execute(
            text("UPDATE crane_configurations SET hook_block_weight_kg = :value WHERE id = :id"),
            {"value": value, "id": CONFIGURATION_FICTICIA_ID},
        )


# --- tabelas por zona -----------------------------------------------------------------------


def test_chart_keeps_its_zone_in_reads_and_listing(
    charts: SqlAlchemyLoadChartRepository,
) -> None:
    charts.save_draft(draft("LC-FICTICIO-FRONTAL", ZONA_FRONTAL_FICTICIA), SOURCE_FICTICIA)

    stored = charts.get_by_id("LC-FICTICIO-FRONTAL")
    assert stored is not None
    assert stored.chart.rotation_zone_code == ZONA_FRONTAL_FICTICIA
    [summary] = charts.list_by_configuration(CONFIGURATION_FICTICIA_ID)
    assert summary.rotation_zone_code == ZONA_FRONTAL_FICTICIA


def test_one_active_chart_per_zone_and_activation_replaces_only_the_same_zone(
    charts: SqlAlchemyLoadChartRepository,
    activation: SqlAlchemyLoadChartActivationRepository,
) -> None:
    for chart_id, zone in (
        ("LC-F1", ZONA_FRONTAL_FICTICIA),
        ("LC-L1", ZONA_LATERAL_TRASEIRA_FICTICIA),
        ("LC-F2", ZONA_FRONTAL_FICTICIA),
        ("LC-SEM", None),
    ):
        save_and_validate(charts, draft(chart_id, zone))

    for chart_id in ("LC-F1", "LC-L1", "LC-SEM"):
        assert (
            activation.activate_superseding_current(
                chart_id, expected_status=LoadChartStatus.VALIDATED
            )
            is None
        )
    superseded = activation.activate_superseding_current(
        "LC-F2", expected_status=LoadChartStatus.VALIDATED
    )

    assert superseded == "LC-F1"
    statuses = {
        item.load_chart_id: item.status
        for item in charts.list_by_configuration(CONFIGURATION_FICTICIA_ID)
    }
    assert statuses == {
        "LC-F1": LoadChartStatus.SUPERSEDED,
        "LC-F2": LoadChartStatus.ACTIVE,
        "LC-L1": LoadChartStatus.ACTIVE,
        "LC-SEM": LoadChartStatus.ACTIVE,
    }
    front = charts.get_active_load_chart(CONFIGURATION_FICTICIA_ID, ZONA_FRONTAL_FICTICIA)
    side = charts.get_active_load_chart(CONFIGURATION_FICTICIA_ID, ZONA_LATERAL_TRASEIRA_FICTICIA)
    without_zone = charts.get_active_load_chart(CONFIGURATION_FICTICIA_ID)
    assert front is not None and front.id == "LC-F2"
    assert side is not None and side.id == "LC-L1"
    assert without_zone is not None and without_zone.id == "LC-SEM"
    assert charts.get_active_load_chart(CONFIGURATION_FICTICIA_ID, "TRASEIRA") is None


@pytest.mark.parametrize("zone", [ZONA_FRONTAL_FICTICIA, None])
def test_unique_index_rejects_a_second_active_chart_in_the_same_zone(
    charts: SqlAlchemyLoadChartRepository, zone: str | None
) -> None:
    save_and_validate(charts, draft("LC-A", zone))
    save_and_validate(charts, draft("LC-B", zone))
    charts.change_status("LC-A", LoadChartStatus.ACTIVE)

    with pytest.raises(ActiveLoadChartConflictError) as error:
        charts.change_status("LC-B", LoadChartStatus.ACTIVE)

    assert error.value.rotation_zone_code == zone


def test_database_rejects_an_invalid_zone_code(
    charts: SqlAlchemyLoadChartRepository, session_factory: sessionmaker[Session]
) -> None:
    charts.save_draft(draft("LC-FICTICIO-FRONTAL", ZONA_FRONTAL_FICTICIA), SOURCE_FICTICIA)

    with pytest.raises(IntegrityError), session_factory.begin() as session:
        session.execute(
            text("UPDATE load_charts SET rotation_zone_code = 'frontal' WHERE id = :id"),
            {"id": "LC-FICTICIO-FRONTAL"},
        )
