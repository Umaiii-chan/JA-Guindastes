"""Importar e ativar tabelas contra um PostgreSQL real (TASK-031; marcador `integration`).

Precisa do banco em `head` (`uv run alembic upgrade head`; o CI roda antes do pytest). Cada teste
roda numa transação desfeita no fim; o arquivo-fonte vai para um diretório temporário do pytest.
Dados FICTÍCIOS (ADR-012).
"""

from collections.abc import Iterator
from pathlib import Path

import pytest
from sqlalchemy import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.application.ports.load_chart_activation import (
    LoadChartActivationRepository,
    LoadChartStatusChangedError,
)
from app.application.ports.load_chart_repository import (
    DuplicateLoadChartVersionError,
    LoadChartNotFoundError,
)
from app.application.use_cases.activate_load_chart import (
    ActivateLoadChart,
    LoadChartNotActivatableError,
)
from app.application.use_cases.import_load_chart import ImportedLoadChart, ImportLoadChart
from app.application.use_cases.validate_load_chart_import import InvalidLoadChartImport
from app.domain.entities.load_chart import LoadChartStatus
from app.infrastructure.importers.csv_load_chart_parser import CsvLoadChartParser
from app.infrastructure.repositories.sqlalchemy_crane_catalog_repository import (
    SqlAlchemyCraneCatalogRepository,
)
from app.infrastructure.repositories.sqlalchemy_load_chart_activation_repository import (
    SqlAlchemyLoadChartActivationRepository,
)
from app.infrastructure.repositories.sqlalchemy_load_chart_repository import (
    SqlAlchemyLoadChartRepository,
)
from app.infrastructure.storage.local_file_storage import LocalFileStorage
from tests.fixtures.crane_geometry_ficticia import build_crane_geometry_ficticia
from tests.fixtures.load_chart_csv_ficticio import (
    CSV_FICTICIO_INCONSISTENCIAS,
    CSV_FICTICIO_VALIDO,
    read_csv_ficticio,
)
from tests.fixtures.load_chart_ficticio import CONFIGURATION_FICTICIA_ID
from tests.infrastructure.database.postgres_integration_support import (
    integration_engine,
    rolled_back_session_factory,
)
from tests.infrastructure.repositories.catalog_ficticio import (
    CRANE_FICTICIO,
    MANUFACTURER_FICTICIO,
    configuration_ficticia,
)

pytestmark = pytest.mark.integration

VALID_CSV = read_csv_ficticio(CSV_FICTICIO_VALIDO)


@pytest.fixture
def engine() -> Iterator[Engine]:
    yield from integration_engine()


@pytest.fixture
def session_factory(engine: Engine) -> Iterator[sessionmaker[Session]]:
    yield from rolled_back_session_factory(engine)


@pytest.fixture
def charts(session_factory: sessionmaker[Session]) -> SqlAlchemyLoadChartRepository:
    catalog = SqlAlchemyCraneCatalogRepository(session_factory)
    catalog.add_manufacturer(MANUFACTURER_FICTICIO)
    catalog.add_crane(CRANE_FICTICIO)
    catalog.add_configuration(configuration_ficticia(build_crane_geometry_ficticia()))
    return SqlAlchemyLoadChartRepository(session_factory)


@pytest.fixture
def activation(
    session_factory: sessionmaker[Session],
) -> SqlAlchemyLoadChartActivationRepository:
    return SqlAlchemyLoadChartActivationRepository(session_factory)


@pytest.fixture
def storage(tmp_path: Path) -> LocalFileStorage:
    return LocalFileStorage(tmp_path / "arquivos")


def import_csv(
    charts: SqlAlchemyLoadChartRepository,
    storage: LocalFileStorage,
    chart_id: str,
    version: str,
    content: bytes = VALID_CSV,
) -> ImportedLoadChart | InvalidLoadChartImport:
    return ImportLoadChart(charts, storage).execute(
        content,
        parser=CsvLoadChartParser(),
        file_name=f"{chart_id}.csv",
        file_type="text/csv",
        load_chart_id=chart_id,
        version=version,
        configuration_id=CONFIGURATION_FICTICIA_ID,
    )


def test_activation_repository_satisfies_the_port(
    activation: SqlAlchemyLoadChartActivationRepository,
) -> None:
    port: LoadChartActivationRepository = activation
    assert port is activation


def test_import_saves_the_draft_with_the_preserved_source(
    charts: SqlAlchemyLoadChartRepository, storage: LocalFileStorage
) -> None:
    result = import_csv(charts, storage, "LC-FICTICIO-A", "FICTICIO-v1")

    assert isinstance(result, ImportedLoadChart)
    stored = charts.get_by_id("LC-FICTICIO-A")
    assert stored == result.stored
    assert stored is not None
    assert stored.chart.status is LoadChartStatus.DRAFT
    assert stored.source.uri is not None
    assert storage.read(stored.source.uri) == VALID_CSV


def test_invalid_import_writes_nothing(
    charts: SqlAlchemyLoadChartRepository, storage: LocalFileStorage
) -> None:
    result = import_csv(
        charts,
        storage,
        "LC-FICTICIO-A",
        "FICTICIO-v1",
        read_csv_ficticio(CSV_FICTICIO_INCONSISTENCIAS),
    )

    assert isinstance(result, InvalidLoadChartImport)
    assert charts.get_by_id("LC-FICTICIO-A") is None
    assert not storage.root.exists()


def test_duplicate_version_is_refused_by_the_database(
    charts: SqlAlchemyLoadChartRepository, storage: LocalFileStorage
) -> None:
    import_csv(charts, storage, "LC-FICTICIO-A", "FICTICIO-v1")
    with pytest.raises(DuplicateLoadChartVersionError):
        import_csv(charts, storage, "LC-FICTICIO-B", "FICTICIO-v1")
    assert charts.get_by_id("LC-FICTICIO-B") is None


def test_import_activate_and_the_old_active_becomes_superseded(
    charts: SqlAlchemyLoadChartRepository,
    activation: SqlAlchemyLoadChartActivationRepository,
    storage: LocalFileStorage,
) -> None:
    activate = ActivateLoadChart(charts, activation)
    import_csv(charts, storage, "LC-FICTICIO-A", "FICTICIO-v1")
    first = activate.execute("LC-FICTICIO-A")
    assert first.stored.chart.status is LoadChartStatus.ACTIVE
    assert first.superseded_load_chart_id is None

    import_csv(charts, storage, "LC-FICTICIO-B", "FICTICIO-v2")
    second = activate.execute("LC-FICTICIO-B")

    assert second.superseded_load_chart_id == "LC-FICTICIO-A"
    old = charts.get_by_id("LC-FICTICIO-A")
    assert old is not None
    assert old.chart.status is LoadChartStatus.SUPERSEDED
    active = charts.get_active_load_chart(CONFIGURATION_FICTICIA_ID)
    assert active is not None
    assert active.id == "LC-FICTICIO-B"


def test_superseded_and_active_are_not_activated_again(
    charts: SqlAlchemyLoadChartRepository,
    activation: SqlAlchemyLoadChartActivationRepository,
    storage: LocalFileStorage,
) -> None:
    activate = ActivateLoadChart(charts, activation)
    import_csv(charts, storage, "LC-FICTICIO-A", "FICTICIO-v1")
    import_csv(charts, storage, "LC-FICTICIO-B", "FICTICIO-v2")
    activate.execute("LC-FICTICIO-A")
    activate.execute("LC-FICTICIO-B")

    for chart_id in ("LC-FICTICIO-A", "LC-FICTICIO-B"):
        with pytest.raises(LoadChartNotActivatableError):
            activate.execute(chart_id)
    active = charts.get_active_load_chart(CONFIGURATION_FICTICIA_ID)
    assert active is not None
    assert active.id == "LC-FICTICIO-B"


def test_activation_with_unexpected_status_changes_nothing(
    charts: SqlAlchemyLoadChartRepository,
    activation: SqlAlchemyLoadChartActivationRepository,
    storage: LocalFileStorage,
) -> None:
    import_csv(charts, storage, "LC-FICTICIO-A", "FICTICIO-v1")

    with pytest.raises(LoadChartStatusChangedError):
        activation.activate_superseding_current(
            "LC-FICTICIO-A", expected_status=LoadChartStatus.VALIDATED
        )

    stored = charts.get_by_id("LC-FICTICIO-A")
    assert stored is not None
    assert stored.chart.status is LoadChartStatus.DRAFT


def test_activation_of_unknown_chart_is_not_found(
    activation: SqlAlchemyLoadChartActivationRepository,
) -> None:
    with pytest.raises(LoadChartNotFoundError):
        activation.activate_superseding_current(
            "NAO-EXISTE", expected_status=LoadChartStatus.VALIDATED
        )
