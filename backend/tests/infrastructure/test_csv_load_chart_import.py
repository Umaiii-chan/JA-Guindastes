"""`ValidateLoadChartImport` com o `CsvLoadChartParser` real e os CSVs FICTÍCIOS (doc-fonte § 13).

Integração do adapter com o caso de uso (doc-fonte § 20.2, "importação CSV/XLSX"), sem banco. Os
dados são FICTÍCIOS: não representam capacidade real (ADR-012).
"""

from app.application.ports.load_chart_parser import ImportIssueCode
from app.application.use_cases.validate_load_chart_import import (
    InvalidLoadChartImport,
    LoadChartImportResult,
    ValidateLoadChartImport,
    ValidLoadChartImport,
)
from app.domain.entities.load_chart import LoadChartStatus
from app.infrastructure.importers.csv_load_chart_parser import CsvLoadChartParser
from tests.fixtures.load_chart_csv_ficticio import (
    CSV_FICTICIO_CABECALHO_INVALIDO,
    CSV_FICTICIO_INCONSISTENCIAS,
    CSV_FICTICIO_VALIDO,
    read_csv_ficticio,
)
from tests.fixtures.load_chart_ficticio import (
    CONFIGURATION_FICTICIA_ID,
    LOAD_CHART_FICTICIO_ID,
    LOAD_CHART_FICTICIO_VERSION,
    POINTS_FICTICIOS,
    point_ficticio,
)


def import_csv(content: bytes) -> LoadChartImportResult:
    return ValidateLoadChartImport(CsvLoadChartParser()).execute(
        content,
        load_chart_id=LOAD_CHART_FICTICIO_ID,
        version=LOAD_CHART_FICTICIO_VERSION,
        configuration_id=CONFIGURATION_FICTICIA_ID,
    )


def test_ficticio_valid_csv_becomes_a_draft_load_chart() -> None:
    result = import_csv(read_csv_ficticio(CSV_FICTICIO_VALIDO))

    assert isinstance(result, ValidLoadChartImport)
    assert result.status is LoadChartStatus.DRAFT
    assert result.chart.id == LOAD_CHART_FICTICIO_ID
    assert result.chart.version == LOAD_CHART_FICTICIO_VERSION
    assert result.chart.configuration_id == CONFIGURATION_FICTICIA_ID
    assert result.chart.points == tuple(point_ficticio(*values) for values in POINTS_FICTICIOS)


def test_ficticio_csv_with_inconsistencies_is_invalid_with_the_full_report() -> None:
    result = import_csv(read_csv_ficticio(CSV_FICTICIO_INCONSISTENCIAS))

    assert isinstance(result, InvalidLoadChartImport)
    assert result.status is LoadChartStatus.INVALID
    assert [(issue.line, issue.column, issue.code) for issue in result.issues] == [
        (2, None, ImportIssueCode.CONFLICTING_POINTS),
        (3, "max_capacity_kg", ImportIssueCode.EMPTY_VALUE),
        (4, "working_radius_m", ImportIssueCode.INVALID_NUMBER),
        (5, "max_capacity_kg", ImportIssueCode.NEGATIVE_VALUE),
        (6, "max_capacity_kg", ImportIssueCode.NON_FINITE_NUMBER),
        (7, None, ImportIssueCode.WRONG_FIELD_COUNT),
        (8, None, ImportIssueCode.CONFLICTING_POINTS),
        (9, "max_capacity_kg", ImportIssueCode.INVALID_NUMBER),
    ]


def test_ficticio_csv_with_invalid_header_is_invalid_without_points() -> None:
    result = import_csv(read_csv_ficticio(CSV_FICTICIO_CABECALHO_INVALIDO))

    assert isinstance(result, InvalidLoadChartImport)
    assert [issue.code for issue in result.issues] == [
        ImportIssueCode.NO_POINTS,
        ImportIssueCode.UNRECOGNIZED_UNIT,
        ImportIssueCode.MISSING_UNIT,
        ImportIssueCode.UNKNOWN_COLUMN,
    ]


def test_empty_csv_is_invalid() -> None:
    result = import_csv(b"")

    assert isinstance(result, InvalidLoadChartImport)
    assert [issue.code for issue in result.issues] == [
        ImportIssueCode.EMPTY_FILE,
        ImportIssueCode.NO_POINTS,
    ]


def test_ficticio_csv_with_header_only_is_invalid_for_having_no_points() -> None:
    result = import_csv(b"boom_length_m,working_radius_m,max_capacity_kg\n")

    assert isinstance(result, InvalidLoadChartImport)
    assert [issue.code for issue in result.issues] == [ImportIssueCode.NO_POINTS]
