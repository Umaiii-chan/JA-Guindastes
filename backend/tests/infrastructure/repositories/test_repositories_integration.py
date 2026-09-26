"""Repositórios da TASK-022 contra um PostgreSQL real (marcador `integration`).

Precisa do banco em `head` (`uv run alembic upgrade head`; o CI roda antes do pytest). Cada teste
roda numa transação desfeita no fim, então não deixa dados. Dados FICTÍCIOS (ADR-012).
"""

from collections.abc import Iterator

import pytest
from sqlalchemy import Engine, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from app.application.ports.active_load_chart_provider import ActiveLoadChartProvider
from app.application.ports.crane_catalog_repository import (
    CatalogEntryAlreadyExistsError,
    CatalogReferenceNotFoundError,
    CraneCatalogRepository,
    CraneConfiguration,
)
from app.application.ports.crane_geometry_provider import CraneGeometryProvider
from app.application.ports.load_chart_repository import (
    ActiveLoadChartConflictError,
    DuplicateLoadChartVersionError,
    LoadChartAlreadyExistsError,
    LoadChartConfigurationNotFoundError,
    LoadChartNotFoundError,
    LoadChartRepository,
    StoredLoadChart,
)
from app.domain.entities.load_chart import LoadChart, LoadChartStatus
from app.infrastructure.repositories.sqlalchemy_crane_catalog_repository import (
    SqlAlchemyCraneCatalogRepository,
)
from app.infrastructure.repositories.sqlalchemy_load_chart_repository import (
    SqlAlchemyLoadChartRepository,
)
from tests.fixtures.crane_geometry_ficticia import build_crane_geometry_ficticia
from tests.fixtures.load_chart_ficticio import (
    CONFIGURATION_FICTICIA_ID,
    POINTS_FICTICIOS,
    build_load_chart_ficticio,
    point_ficticio,
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
    return SqlAlchemyCraneCatalogRepository(session_factory)


@pytest.fixture
def charts(session_factory: sessionmaker[Session]) -> SqlAlchemyLoadChartRepository:
    return SqlAlchemyLoadChartRepository(session_factory)


@pytest.fixture
def configured_catalog(
    catalog: SqlAlchemyCraneCatalogRepository,
) -> SqlAlchemyCraneCatalogRepository:
    catalog.add_manufacturer(MANUFACTURER_FICTICIO)
    catalog.add_crane(CRANE_FICTICIO)
    catalog.add_configuration(configuration_ficticia(build_crane_geometry_ficticia()))
    return catalog


def _draft(version: str, chart_id: str | None = None) -> LoadChart:
    base = build_load_chart_ficticio(status=LoadChartStatus.DRAFT)
    return LoadChart(
        id=chart_id or f"LC-FICTICIO-{version}",
        version=version,
        configuration_id=base.configuration_id,
        status=LoadChartStatus.DRAFT,
        points=base.points,
    )


# --- as classes cumprem as portas -----------------------------------------------------------


def test_repositories_satisfy_the_ports(
    catalog: SqlAlchemyCraneCatalogRepository, charts: SqlAlchemyLoadChartRepository
) -> None:
    catalog_port: CraneCatalogRepository = catalog
    geometry_port: CraneGeometryProvider = catalog
    charts_port: LoadChartRepository = charts
    active_port: ActiveLoadChartProvider = charts
    assert all(port is not None for port in (catalog_port, geometry_port, charts_port, active_port))


# --- catálogo -------------------------------------------------------------------------------


def test_catalog_round_trip(configured_catalog: SqlAlchemyCraneCatalogRepository) -> None:
    assert configured_catalog.get_manufacturer(MANUFACTURER_FICTICIO.id) == MANUFACTURER_FICTICIO
    assert configured_catalog.get_crane(CRANE_FICTICIO.id) == CRANE_FICTICIO
    assert configured_catalog.get_configuration(CONFIGURATION_FICTICIA_ID) == (
        configuration_ficticia(build_crane_geometry_ficticia())
    )


def test_geometry_provider_round_trip_with_turret_limits(
    catalog: SqlAlchemyCraneCatalogRepository,
) -> None:
    geometry = build_crane_geometry_ficticia(
        boom_pivot_offset_m=-0.75, turret_rotation_min_deg=-30.0, turret_rotation_max_deg=30.0
    )
    catalog.add_manufacturer(MANUFACTURER_FICTICIO)
    catalog.add_crane(CRANE_FICTICIO)
    catalog.add_configuration(configuration_ficticia(geometry))

    assert catalog.get_crane_geometry(CONFIGURATION_FICTICIA_ID) == geometry


def test_providers_return_none_when_there_is_no_data(
    catalog: SqlAlchemyCraneCatalogRepository, charts: SqlAlchemyLoadChartRepository
) -> None:
    assert catalog.get_manufacturer("FAB-FICTICIO-INEXISTENTE") is None
    assert catalog.get_crane("GUI-FICTICIO-INEXISTENTE") is None
    assert catalog.get_configuration("CFG-FICTICIA-INEXISTENTE") is None
    assert catalog.get_crane_geometry("CFG-FICTICIA-INEXISTENTE") is None
    assert charts.get_active_load_chart("CFG-FICTICIA-INEXISTENTE") is None
    assert charts.get_by_id("LC-FICTICIO-INEXISTENTE") is None


def test_configuration_without_geometry_gives_no_geometry(
    catalog: SqlAlchemyCraneCatalogRepository,
) -> None:
    catalog.add_manufacturer(MANUFACTURER_FICTICIO)
    catalog.add_crane(CRANE_FICTICIO)
    catalog.add_configuration(configuration_ficticia(geometry=None))

    assert catalog.get_crane_geometry(CONFIGURATION_FICTICIA_ID) is None


def test_catalog_duplicates_and_missing_references_are_reported(
    configured_catalog: SqlAlchemyCraneCatalogRepository,
) -> None:
    with pytest.raises(CatalogEntryAlreadyExistsError):
        configured_catalog.add_manufacturer(MANUFACTURER_FICTICIO)
    with pytest.raises(CatalogReferenceNotFoundError):
        configured_catalog.add_configuration(
            CraneConfiguration(
                id="CFG-FICTICIA-B", crane_id="GUI-FICTICIO-INEXISTENTE", name="FICTÍCIA"
            )
        )


def test_half_filled_geometry_is_rejected_by_the_database(
    configured_catalog: SqlAlchemyCraneCatalogRepository,
    session_factory: sessionmaker[Session],
) -> None:
    with pytest.raises(IntegrityError), session_factory.begin() as session:
        session.execute(
            text("UPDATE crane_configurations SET boom_pivot_height_m = NULL WHERE id = :id"),
            {"id": CONFIGURATION_FICTICIA_ID},
        )


# --- tabelas de carga -----------------------------------------------------------------------


def test_load_chart_round_trip(
    configured_catalog: SqlAlchemyCraneCatalogRepository, charts: SqlAlchemyLoadChartRepository
) -> None:
    points = (
        *(point_ficticio(*values) for values in POINTS_FICTICIOS),
        point_ficticio(10.0, 3.0, 9000.0),  # repetido com a mesma capacidade
        point_ficticio(30.0, 0.1 + 0.2, 1234.5),  # float sem representação curta
    )
    chart = build_load_chart_ficticio(points=points, status=LoadChartStatus.DRAFT)

    charts.save_draft(chart, SOURCE_FICTICIA)

    assert charts.get_by_id(chart.id) == StoredLoadChart(chart=chart, source=SOURCE_FICTICIA)


def test_save_draft_reports_duplicates_and_unknown_configuration(
    configured_catalog: SqlAlchemyCraneCatalogRepository, charts: SqlAlchemyLoadChartRepository
) -> None:
    charts.save_draft(_draft("FICTICIO-v1"), SOURCE_FICTICIA)

    with pytest.raises(LoadChartAlreadyExistsError):
        charts.save_draft(
            _draft("FICTICIO-v2", chart_id="LC-FICTICIO-FICTICIO-v1"), SOURCE_FICTICIA
        )
    with pytest.raises(DuplicateLoadChartVersionError):
        charts.save_draft(_draft("FICTICIO-v1", chart_id="LC-FICTICIO-OUTRO"), SOURCE_FICTICIA)

    orphan = LoadChart(
        id="LC-FICTICIO-ORFA",
        version="FICTICIO-v1",
        configuration_id="CFG-FICTICIA-INEXISTENTE",
        status=LoadChartStatus.DRAFT,
        points=_draft("x").points,
    )
    with pytest.raises(LoadChartConfigurationNotFoundError):
        charts.save_draft(orphan, SOURCE_FICTICIA)


def test_at_most_one_active_chart_per_configuration(
    configured_catalog: SqlAlchemyCraneCatalogRepository, charts: SqlAlchemyLoadChartRepository
) -> None:
    first, second = _draft("FICTICIO-v1"), _draft("FICTICIO-v2")
    charts.save_draft(first, SOURCE_FICTICIA)
    charts.save_draft(second, SOURCE_FICTICIA)
    assert charts.get_active_load_chart(CONFIGURATION_FICTICIA_ID) is None

    charts.change_status(first.id, LoadChartStatus.ACTIVE)
    with pytest.raises(ActiveLoadChartConflictError):
        charts.change_status(second.id, LoadChartStatus.ACTIVE)

    active = charts.get_active_load_chart(CONFIGURATION_FICTICIA_ID)
    assert active is not None
    assert (active.id, active.status) == (first.id, LoadChartStatus.ACTIVE)
    stored_second = charts.get_by_id(second.id)
    assert stored_second is not None
    assert stored_second.chart.status is LoadChartStatus.DRAFT

    charts.change_status(first.id, LoadChartStatus.SUPERSEDED)
    charts.change_status(second.id, LoadChartStatus.ACTIVE)
    active = charts.get_active_load_chart(CONFIGURATION_FICTICIA_ID)
    assert active is not None
    assert active.id == second.id


def test_change_status_of_unknown_chart_raises(charts: SqlAlchemyLoadChartRepository) -> None:
    with pytest.raises(LoadChartNotFoundError):
        charts.change_status("LC-FICTICIO-INEXISTENTE", LoadChartStatus.ACTIVE)


def test_deleting_a_chart_deletes_its_points_but_configuration_is_restricted(
    configured_catalog: SqlAlchemyCraneCatalogRepository,
    charts: SqlAlchemyLoadChartRepository,
    session_factory: sessionmaker[Session],
) -> None:
    chart = _draft("FICTICIO-v1")
    charts.save_draft(chart, SOURCE_FICTICIA)

    with pytest.raises(IntegrityError), session_factory.begin() as session:
        session.execute(
            text("DELETE FROM crane_configurations WHERE id = :id"),
            {"id": CONFIGURATION_FICTICIA_ID},
        )

    with session_factory.begin() as session:
        session.execute(text("DELETE FROM load_charts WHERE id = :id"), {"id": chart.id})
    with session_factory() as session:
        remaining: int = session.execute(
            text("SELECT count(*) FROM load_chart_points WHERE load_chart_id = :id"),
            {"id": chart.id},
        ).scalar_one()
    assert remaining == 0
