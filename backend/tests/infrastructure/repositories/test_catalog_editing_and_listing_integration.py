"""Edição do catálogo e listagem de tabelas por configuração no PostgreSQL (TASK-044).

Marcador `integration`: precisa do banco em `head` (`uv run alembic upgrade head`; o CI roda antes
do pytest). Cada teste roda numa transação desfeita no fim, então não deixa dados. Dados FICTÍCIOS
(ADR-012).
"""

from collections.abc import Iterator

import pytest
from sqlalchemy import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.application.ports.crane_catalog_listing import CraneCatalogStore
from app.application.ports.crane_catalog_repository import (
    Crane,
    CraneConfiguration,
    Manufacturer,
)
from app.application.ports.load_chart_listing import LoadChartListing, LoadChartSummary
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

OUTRA_CONFIGURACAO_ID = "CFG-FICTICIA-OUTRA"


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
    catalog.add_configuration(configuration_ficticia(build_crane_geometry_ficticia()))
    catalog.add_configuration(configuration_ficticia(configuration_id=OUTRA_CONFIGURACAO_ID))
    return catalog


@pytest.fixture
def charts(session_factory: sessionmaker[Session]) -> SqlAlchemyLoadChartRepository:
    return SqlAlchemyLoadChartRepository(session_factory)


def _chart(
    chart_id: str, version: str, configuration_id: str = CONFIGURATION_FICTICIA_ID
) -> LoadChart:
    return LoadChart(
        id=chart_id,
        version=version,
        configuration_id=configuration_id,
        status=LoadChartStatus.DRAFT,
        points=build_load_chart_ficticio().points,
    )


def test_repositories_satisfy_the_new_ports(
    catalog: SqlAlchemyCraneCatalogRepository, charts: SqlAlchemyLoadChartRepository
) -> None:
    store: CraneCatalogStore = catalog
    listing: LoadChartListing = charts
    assert store is not None and listing is not None


# --- edição do catálogo -------------------------------------------------------------------------


def test_update_manufacturer_and_crane(catalog: SqlAlchemyCraneCatalogRepository) -> None:
    renamed_manufacturer = Manufacturer(id=MANUFACTURER_FICTICIO.id, name="Fabricante editado")
    # O fabricante do registro é ignorado: o vínculo do guindaste não muda.
    renamed_crane = Crane(
        id=CRANE_FICTICIO.id, manufacturer_id="FAB-QUALQUER", model_name="Modelo editado"
    )

    assert catalog.update_manufacturer(renamed_manufacturer) is True
    assert catalog.update_crane(renamed_crane) is True

    assert catalog.get_manufacturer(MANUFACTURER_FICTICIO.id) == renamed_manufacturer
    assert catalog.get_crane(CRANE_FICTICIO.id) == Crane(
        id=CRANE_FICTICIO.id,
        manufacturer_id=MANUFACTURER_FICTICIO.id,
        model_name="Modelo editado",
    )


def test_update_configuration_replaces_the_whole_sheet(
    catalog: SqlAlchemyCraneCatalogRepository,
) -> None:
    with_turret = build_crane_geometry_ficticia(
        turret_rotation_min_deg=-30.0, turret_rotation_max_deg=30.0
    )
    catalog.update_configuration(configuration_ficticia(with_turret))
    new_geometry = build_crane_geometry_ficticia(boom_pivot_offset_m=-1.56, cable_length_max_m=None)
    edited = configuration_ficticia(new_geometry)

    assert catalog.update_configuration(edited) is True

    stored = catalog.get_configuration(CONFIGURATION_FICTICIA_ID)
    assert stored == edited
    assert stored is not None and stored.geometry is not None
    assert stored.geometry.turret_rotation_min is None
    assert catalog.get_crane_geometry(CONFIGURATION_FICTICIA_ID) == new_geometry


def test_update_configuration_can_clear_the_sheet_and_rename(
    catalog: SqlAlchemyCraneCatalogRepository,
) -> None:
    edited = CraneConfiguration(
        id=CONFIGURATION_FICTICIA_ID, crane_id=CRANE_FICTICIO.id, name="Renomeada", geometry=None
    )

    assert catalog.update_configuration(edited) is True

    assert catalog.get_configuration(CONFIGURATION_FICTICIA_ID) == edited
    assert catalog.get_crane_geometry(CONFIGURATION_FICTICIA_ID) is None


def test_updating_missing_records_returns_false(
    catalog: SqlAlchemyCraneCatalogRepository,
) -> None:
    assert catalog.update_manufacturer(Manufacturer(id="FAB-INEXISTENTE", name="x")) is False
    assert (
        catalog.update_crane(Crane(id="GUI-INEXISTENTE", manufacturer_id="x", model_name="x"))
        is False
    )
    assert (
        catalog.update_configuration(configuration_ficticia(configuration_id="CFG-INEXISTENTE"))
        is False
    )


def test_editing_the_sheet_does_not_touch_the_load_charts(
    catalog: SqlAlchemyCraneCatalogRepository, charts: SqlAlchemyLoadChartRepository
) -> None:
    charts.save_draft(_chart("LC-V1", "v1"), SOURCE_FICTICIA)
    charts.change_status("LC-V1", LoadChartStatus.ACTIVE)
    before = charts.get_by_id("LC-V1")

    catalog.update_configuration(
        configuration_ficticia(build_crane_geometry_ficticia(boom_pivot_height_m=3.0))
    )

    assert charts.get_by_id("LC-V1") == before
    assert charts.get_active_load_chart(CONFIGURATION_FICTICIA_ID) == _with_status(
        _chart("LC-V1", "v1"), LoadChartStatus.ACTIVE
    )


def _with_status(chart: LoadChart, status: LoadChartStatus) -> LoadChart:
    return LoadChart(
        id=chart.id,
        version=chart.version,
        configuration_id=chart.configuration_id,
        status=status,
        points=chart.points,
    )


# --- listagem de tabelas por configuração -------------------------------------------------------


def test_list_by_configuration_returns_summaries_with_point_count(
    catalog: SqlAlchemyCraneCatalogRepository, charts: SqlAlchemyLoadChartRepository
) -> None:
    three_points = LoadChart(
        id="LC-V2",
        version="v2",
        configuration_id=CONFIGURATION_FICTICIA_ID,
        status=LoadChartStatus.DRAFT,
        points=(
            point_ficticio(10.0, 3.0, 9000.0),
            point_ficticio(10.0, 3.0, 9000.0),  # repetido: conta como ponto
            point_ficticio(20.0, 5.0, 4000.0),
        ),
    )
    charts.save_draft(_chart("LC-V1", "v1"), SOURCE_FICTICIA)
    charts.save_draft(three_points, SOURCE_FICTICIA)
    charts.change_status("LC-V2", LoadChartStatus.ACTIVE)
    charts.save_draft(_chart("LC-OUTRA", "v1", OUTRA_CONFIGURACAO_ID), SOURCE_FICTICIA)

    listed = charts.list_by_configuration(CONFIGURATION_FICTICIA_ID)

    assert sorted(listed, key=lambda item: item.load_chart_id) == [
        LoadChartSummary(
            load_chart_id="LC-V1",
            version="v1",
            configuration_id=CONFIGURATION_FICTICIA_ID,
            status=LoadChartStatus.DRAFT,
            point_count=len(build_load_chart_ficticio().points),
            source=SOURCE_FICTICIA,
        ),
        LoadChartSummary(
            load_chart_id="LC-V2",
            version="v2",
            configuration_id=CONFIGURATION_FICTICIA_ID,
            status=LoadChartStatus.ACTIVE,
            point_count=3,
            source=SOURCE_FICTICIA,
        ),
    ]


def test_list_by_configuration_is_empty_without_charts_or_configuration(
    catalog: SqlAlchemyCraneCatalogRepository, charts: SqlAlchemyLoadChartRepository
) -> None:
    assert charts.list_by_configuration(CONFIGURATION_FICTICIA_ID) == []
    assert charts.list_by_configuration("CFG-FICTICIA-INEXISTENTE") == []
