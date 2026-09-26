"""Caso de uso `ImportLoadChart` com fakes (TASK-031; RF-006..RF-009, RNF-005, RNF-006).

CSVs e metadados FICTÍCIOS (ADR-012).
"""

import hashlib

import pytest

from app.application.ports.file_storage import StoredFile
from app.application.ports.load_chart_repository import (
    DuplicateLoadChartVersionError,
    LoadChartConfigurationNotFoundError,
)
from app.application.use_cases.import_load_chart import (
    ImportedLoadChart,
    ImportLoadChart,
    StoredSourceMismatchError,
)
from app.application.use_cases.validate_load_chart_import import InvalidLoadChartImport
from app.domain.entities.load_chart import LoadChartStatus
from app.infrastructure.importers.csv_load_chart_parser import CsvLoadChartParser
from tests.fixtures.load_chart_csv_ficticio import (
    CSV_FICTICIO_INCONSISTENCIAS,
    CSV_FICTICIO_VALIDO,
    read_csv_ficticio,
)
from tests.fixtures.load_chart_ficticio import (
    CONFIGURATION_FICTICIA_ID,
    LOAD_CHART_FICTICIO_ID,
    LOAD_CHART_FICTICIO_VERSION,
    POINTS_FICTICIOS,
    build_load_chart_ficticio,
)
from tests.fixtures.load_chart_persistence_fakes import InMemoryFileStorage, InMemoryLoadChartStore
from tests.infrastructure.repositories.catalog_ficticio import SOURCE_FICTICIA

VALID_CSV = read_csv_ficticio(CSV_FICTICIO_VALIDO)


@pytest.fixture
def store() -> InMemoryLoadChartStore:
    return InMemoryLoadChartStore({CONFIGURATION_FICTICIA_ID})


@pytest.fixture
def storage() -> InMemoryFileStorage:
    return InMemoryFileStorage()


def run(
    store: InMemoryLoadChartStore,
    storage: InMemoryFileStorage,
    content: bytes = VALID_CSV,
    **overrides: str,
) -> ImportedLoadChart | InvalidLoadChartImport:
    arguments = {
        "file_name": "tabela_ficticia.csv",
        "file_type": "text/csv",
        "load_chart_id": LOAD_CHART_FICTICIO_ID,
        "version": LOAD_CHART_FICTICIO_VERSION,
        "configuration_id": CONFIGURATION_FICTICIA_ID,
    } | overrides
    return ImportLoadChart(store, storage).execute(
        content, parser=CsvLoadChartParser(), **arguments
    )


def test_valid_import_preserves_the_file_and_saves_a_draft_with_the_source(
    store: InMemoryLoadChartStore, storage: InMemoryFileStorage
) -> None:
    result = run(store, storage)

    assert isinstance(result, ImportedLoadChart)
    assert result.status is LoadChartStatus.DRAFT
    sha256 = hashlib.sha256(VALID_CSV).hexdigest()
    assert storage.files == {f"memory://{sha256}": VALID_CSV}

    saved = store.get_by_id(LOAD_CHART_FICTICIO_ID)
    assert saved == result.stored
    assert saved is not None
    assert saved.chart.status is LoadChartStatus.DRAFT
    assert saved.chart.points == build_load_chart_ficticio().points
    assert len(saved.chart.points) == len(POINTS_FICTICIOS)
    assert saved.source.file_name == "tabela_ficticia.csv"
    assert saved.source.file_type == "text/csv"
    assert saved.source.sha256 == sha256
    assert saved.source.uri == f"memory://{sha256}"


def test_invalid_import_returns_the_report_and_writes_nothing(
    store: InMemoryLoadChartStore, storage: InMemoryFileStorage
) -> None:
    result = run(store, storage, read_csv_ficticio(CSV_FICTICIO_INCONSISTENCIAS))

    assert isinstance(result, InvalidLoadChartImport)
    assert result.status is LoadChartStatus.INVALID
    assert result.issues
    assert storage.saves == 0
    assert store.charts == {}


def test_invalid_import_does_not_touch_existing_charts(
    store: InMemoryLoadChartStore, storage: InMemoryFileStorage
) -> None:
    existing = build_load_chart_ficticio(status=LoadChartStatus.ACTIVE)
    store.add(existing, SOURCE_FICTICIA)
    before = dict(store.charts)

    result = run(
        store,
        storage,
        read_csv_ficticio(CSV_FICTICIO_INCONSISTENCIAS),
        load_chart_id="LC-FICTICIO-002",
        version="FICTICIO-v2",
    )

    assert isinstance(result, InvalidLoadChartImport)
    assert store.charts == before


def test_duplicate_version_in_the_same_configuration_is_an_explicit_conflict(
    store: InMemoryLoadChartStore, storage: InMemoryFileStorage
) -> None:
    run(store, storage)

    with pytest.raises(DuplicateLoadChartVersionError):
        run(store, storage, load_chart_id="LC-FICTICIO-OUTRO")

    assert set(store.charts) == {LOAD_CHART_FICTICIO_ID}


def test_unknown_configuration_propagates_the_repository_error(
    store: InMemoryLoadChartStore, storage: InMemoryFileStorage
) -> None:
    with pytest.raises(LoadChartConfigurationNotFoundError):
        run(store, storage, configuration_id="CFG-FICTICIA-INEXISTENTE")
    assert store.charts == {}


@pytest.mark.parametrize("field", ["file_name", "file_type"])
def test_blank_file_metadata_is_refused_before_reading_or_storing(
    store: InMemoryLoadChartStore, storage: InMemoryFileStorage, field: str
) -> None:
    with pytest.raises(ValueError, match=field):
        run(store, storage, **{field: "  "})
    assert storage.saves == 0
    assert store.charts == {}


def test_storage_returning_another_hash_stops_before_saving_the_chart(
    store: InMemoryLoadChartStore,
) -> None:
    class LyingStorage(InMemoryFileStorage):
        def save(self, content: bytes) -> StoredFile:
            return StoredFile(uri="memory://x", sha256="0" * 64, size_bytes=len(content))

    with pytest.raises(StoredSourceMismatchError):
        run(store, LyingStorage())
    assert store.charts == {}
