"""Caso de uso `ValidateLoadChartImport` com um parser falso (doc-fonte §§ 13.1 e 13.2; RNF-006).

Os pontos vêm da tabela FICTÍCIA de `tests/fixtures/load_chart_ficticio.py`: servem só para testar o
mecanismo, não são capacidade real (ADR-012).
"""

import pytest

from app.application.ports.load_chart_parser import (
    ImportIssue,
    ImportIssueCode,
    LoadChartParseResult,
    ParsedLoadChartPoint,
)
from app.application.use_cases.validate_load_chart_import import (
    InvalidLoadChartImport,
    LoadChartImportResult,
    ValidateLoadChartImport,
    ValidLoadChartImport,
)
from app.domain.entities.load_chart import LoadChartStatus
from tests.fixtures.load_chart_ficticio import (
    CONFIGURATION_FICTICIA_ID,
    LOAD_CHART_FICTICIO_ID,
    LOAD_CHART_FICTICIO_VERSION,
    POINTS_FICTICIOS,
    point_ficticio,
)

CONTENT_FICTICIO = b"conteudo FICTICIO; o parser falso nao le"


class StubParser:
    """Parser falso: devolve um resultado pronto e guarda o conteúdo recebido."""

    def __init__(self, result: LoadChartParseResult) -> None:
        self.result = result
        self.received: list[bytes] = []

    def parse(self, content: bytes) -> LoadChartParseResult:
        self.received.append(content)
        return self.result


def parsed_ficticio(
    *rows: tuple[float, float, float], first_line: int = 2
) -> tuple[ParsedLoadChartPoint, ...]:
    """Pontos FICTÍCIOS como se tivessem sido lidos a partir da linha `first_line`."""
    return tuple(
        ParsedLoadChartPoint(line=first_line + offset, point=point_ficticio(*row))
        for offset, row in enumerate(rows)
    )


def run_import(
    points: tuple[ParsedLoadChartPoint, ...] = (),
    issues: tuple[ImportIssue, ...] = (),
    /,
    *,
    load_chart_id: str = LOAD_CHART_FICTICIO_ID,
    version: str = LOAD_CHART_FICTICIO_VERSION,
    configuration_id: str = CONFIGURATION_FICTICIA_ID,
) -> LoadChartImportResult:
    parser = StubParser(LoadChartParseResult(points=points, issues=issues))
    return ValidateLoadChartImport(parser).execute(
        CONTENT_FICTICIO,
        load_chart_id=load_chart_id,
        version=version,
        configuration_id=configuration_id,
    )


def assert_invalid(result: LoadChartImportResult) -> InvalidLoadChartImport:
    assert isinstance(result, InvalidLoadChartImport)
    assert result.status is LoadChartStatus.INVALID
    return result


# --- importação sem inconsistências → DRAFT (CA-7) -------------------------------------------


def test_ficticio_import_without_issues_returns_draft_chart_with_metadata_and_points() -> None:
    parsed = parsed_ficticio(*POINTS_FICTICIOS)

    result = run_import(parsed)

    assert isinstance(result, ValidLoadChartImport)
    assert result.status is LoadChartStatus.DRAFT
    assert result.chart.status is LoadChartStatus.DRAFT
    assert result.chart.id == LOAD_CHART_FICTICIO_ID
    assert result.chart.version == LOAD_CHART_FICTICIO_VERSION  # RN-005
    assert result.chart.configuration_id == CONFIGURATION_FICTICIA_ID  # RN-001
    assert result.chart.points == tuple(parsed_point.point for parsed_point in parsed)


def test_ficticio_import_never_activates_the_chart() -> None:
    # Doc-fonte § 13.2: ativação é outra etapa, fora desta tarefa.
    result = run_import(parsed_ficticio(*POINTS_FICTICIOS))

    assert result.status is not LoadChartStatus.ACTIVE
    assert result.status is not LoadChartStatus.VALIDATED


def test_use_case_passes_the_content_to_the_parser_unchanged() -> None:
    parser = StubParser(LoadChartParseResult(points=parsed_ficticio(*POINTS_FICTICIOS), issues=()))

    ValidateLoadChartImport(parser).execute(
        CONTENT_FICTICIO,
        load_chart_id=LOAD_CHART_FICTICIO_ID,
        version=LOAD_CHART_FICTICIO_VERSION,
        configuration_id=CONFIGURATION_FICTICIA_ID,
    )

    assert parser.received == [CONTENT_FICTICIO]


def test_ficticio_import_accepts_repeated_points_with_same_capacity() -> None:
    # Sem conflito, como na LoadChart da TASK-008 (repetidos iguais são mantidos).
    parsed = parsed_ficticio((10.0, 5.0, 6000.0), (10.0, 5.0, 6000.0))

    result = run_import(parsed)

    assert isinstance(result, ValidLoadChartImport)
    assert len(result.chart.points) == 2


def test_ficticio_import_accepts_same_radius_on_different_boom_lengths() -> None:
    result = run_import(parsed_ficticio((10.0, 5.0, 6000.0), (20.0, 5.0, 5000.0)))

    assert isinstance(result, ValidLoadChartImport)


# --- inconsistências → INVALID com relatório, sem tabela (CA-8) ------------------------------


def test_ficticio_parser_issues_make_the_import_invalid_even_with_valid_points() -> None:
    issue = ImportIssue(
        code=ImportIssueCode.INVALID_NUMBER,
        message="valor não numérico",
        line=3,
        column="max_capacity_kg",
    )

    result = assert_invalid(run_import(parsed_ficticio((10.0, 3.0, 9000.0)), (issue,)))

    assert result.issues == (issue,)


def test_invalid_import_has_no_chart_to_use_by_mistake() -> None:
    issue = ImportIssue(code=ImportIssueCode.EMPTY_VALUE, message="vazio", line=2)

    result = assert_invalid(run_import(parsed_ficticio((10.0, 3.0, 9000.0)), (issue,)))

    assert not hasattr(result, "chart")


def test_invalid_import_echoes_the_chart_metadata() -> None:
    issue = ImportIssue(code=ImportIssueCode.EMPTY_FILE, message="vazio")

    result = assert_invalid(run_import((), (issue,)))

    assert result.load_chart_id == LOAD_CHART_FICTICIO_ID
    assert result.version == LOAD_CHART_FICTICIO_VERSION
    assert result.configuration_id == CONFIGURATION_FICTICIA_ID


@pytest.mark.parametrize("field_name", ["load_chart_id", "version", "configuration_id"])
@pytest.mark.parametrize("blank", ["", "   "])
def test_ficticio_import_with_blank_metadata_is_invalid(field_name: str, blank: str) -> None:
    # Doc-fonte § 13.1 ("versão/origem informadas"); RN-001; RN-005.
    metadata = {
        "load_chart_id": LOAD_CHART_FICTICIO_ID,
        "version": LOAD_CHART_FICTICIO_VERSION,
        "configuration_id": CONFIGURATION_FICTICIA_ID,
    }
    metadata[field_name] = blank

    result = assert_invalid(run_import(parsed_ficticio(*POINTS_FICTICIOS), **metadata))

    assert [issue.code for issue in result.issues] == [ImportIssueCode.MISSING_METADATA]
    assert result.issues[0].line is None


def test_import_without_any_point_is_invalid() -> None:
    # Ex.: arquivo só com cabeçalho; o parser não vê problema, mas a tabela fica sem pontos.
    result = assert_invalid(run_import((), ()))

    assert [issue.code for issue in result.issues] == [ImportIssueCode.NO_POINTS]
    assert result.issues[0].line is None


# --- pontos conflitantes (CA-6) --------------------------------------------------------------


def test_ficticio_conflicting_points_report_every_line_involved() -> None:
    parsed = (
        ParsedLoadChartPoint(line=2, point=point_ficticio(10.0, 5.0, 6000.0)),
        ParsedLoadChartPoint(line=3, point=point_ficticio(20.0, 5.0, 5000.0)),
        ParsedLoadChartPoint(line=7, point=point_ficticio(10.0, 5.0, 5999.0)),
    )

    result = assert_invalid(run_import(parsed))

    assert [(issue.code, issue.line) for issue in result.issues] == [
        (ImportIssueCode.CONFLICTING_POINTS, 2),
        (ImportIssueCode.CONFLICTING_POINTS, 7),
    ]
    assert "linhas 2, 7" in result.issues[0].message


def test_ficticio_conflict_flags_lines_that_repeat_one_of_the_capacities() -> None:
    # Não há como saber qual capacidade é a certa: todas as linhas do grupo são reportadas.
    parsed = parsed_ficticio((10.0, 5.0, 6000.0), (10.0, 5.0, 6000.0), (10.0, 5.0, 5999.0))

    result = assert_invalid(run_import(parsed))

    assert [issue.line for issue in result.issues] == [2, 3, 4]
    assert {issue.code for issue in result.issues} == {ImportIssueCode.CONFLICTING_POINTS}


# --- ordem do relatório ----------------------------------------------------------------------


def test_report_lists_file_level_issues_first_then_by_line() -> None:
    parser_issues = (
        ImportIssue(code=ImportIssueCode.INVALID_NUMBER, message="x", line=5, column="a"),
        ImportIssue(code=ImportIssueCode.UNKNOWN_COLUMN, message="y", line=1, column="b"),
    )
    parsed = parsed_ficticio((10.0, 5.0, 6000.0), (10.0, 5.0, 5999.0), first_line=3)

    result = assert_invalid(run_import(parsed, parser_issues, version=""))

    assert [(issue.line, issue.code) for issue in result.issues] == [
        (None, ImportIssueCode.MISSING_METADATA),
        (1, ImportIssueCode.UNKNOWN_COLUMN),
        (3, ImportIssueCode.CONFLICTING_POINTS),
        (4, ImportIssueCode.CONFLICTING_POINTS),
        (5, ImportIssueCode.INVALID_NUMBER),
    ]
