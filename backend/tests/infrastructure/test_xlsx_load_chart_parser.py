"""`XlsxLoadChartParser` no formato canônico PROVISÓRIO (TASK-023; doc-fonte § 13.1; RNF-006).

As planilhas são geradas em memória com o próprio openpyxl (nenhum binário no repositório). Todos
os valores são FICTÍCIOS: servem só para testar o mecanismo, não são capacidade real (ADR-012).
"""

import csv
import datetime
import io
import zipfile
from collections.abc import Sequence

import pytest
from openpyxl import Workbook

from app.application.ports.load_chart_parser import (
    ImportIssueCode,
    LoadChartParser,
    LoadChartParseResult,
)
from app.application.use_cases.validate_load_chart_import import (
    InvalidLoadChartImport,
    ValidateLoadChartImport,
    ValidLoadChartImport,
)
from app.domain.entities.load_chart import LoadChartStatus
from app.domain.value_objects.length import Length
from app.domain.value_objects.mass import Mass
from app.infrastructure.importers.csv_load_chart_parser import CsvLoadChartParser
from app.infrastructure.importers.xlsx_load_chart_parser import XlsxLoadChartParser
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
)

HEADER = ["boom_length_m", "working_radius_m", "max_capacity_kg"]

type Row = Sequence[object]
type IssueSummary = tuple[int | None, str | None, ImportIssueCode]


def xlsx_ficticio(*rows: Row, extra_sheets: Sequence[Sequence[Row]] = ()) -> bytes:
    """Planilha FICTÍCIA em memória: `rows` na primeira planilha, `extra_sheets` nas seguintes."""
    workbook = Workbook()
    first = workbook.active
    assert first is not None
    first.title = "FICTICIO"
    for row in rows:
        first.append(list(row))
    for number, sheet_rows in enumerate(extra_sheets, start=2):
        sheet = workbook.create_sheet(f"FICTICIO-{number}")
        for row in sheet_rows:
            sheet.append(list(row))
    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def xlsx_from_csv(content: bytes) -> bytes:
    """A mesma tabela do CSV numa planilha, cada campo como célula de texto."""
    rows = list(csv.reader(io.StringIO(content.decode("utf-8-sig"), newline="")))
    return xlsx_ficticio(*rows)


def parse(content: bytes) -> LoadChartParseResult:
    parser: LoadChartParser = XlsxLoadChartParser()
    return parser.parse(content)


def as_numbers(result: LoadChartParseResult) -> list[tuple[int, float, float, float]]:
    return [
        (
            parsed.line,
            parsed.point.boom_length.meters,
            parsed.point.working_radius.meters,
            parsed.point.max_capacity.kilograms,
        )
        for parsed in result.points
    ]


def summary(result: LoadChartParseResult) -> list[IssueSummary]:
    return [(issue.line, issue.column, issue.code) for issue in result.issues]


# --- Planilha válida ---------------------------------------------------------------------------


def test_ficticio_valid_xlsx_returns_every_point_with_its_line_and_no_issue() -> None:
    result = parse(xlsx_ficticio(HEADER, *POINTS_FICTICIOS))

    assert result.issues == ()
    assert as_numbers(result) == [
        (line, *values) for line, values in enumerate(POINTS_FICTICIOS, start=2)
    ]


def test_ficticio_points_are_domain_quantities_in_internal_units() -> None:
    point = parse(xlsx_ficticio(HEADER, [10, 3, 9000])).points[0].point

    assert point.boom_length == Length(10.0)
    assert point.working_radius == Length(3.0)
    assert point.max_capacity == Mass(9000.0)


def test_ficticio_numbers_stored_as_text_follow_the_csv_number_rule() -> None:
    result = parse(xlsx_ficticio(HEADER, [" 10.5 ", "3", "+9000.0"]))

    assert result.issues == ()
    assert as_numbers(result) == [(2, 10.5, 3.0, 9000.0)]


def test_ficticio_header_is_the_first_non_blank_row_and_columns_may_come_in_any_order() -> None:
    result = parse(
        xlsx_ficticio(
            [],
            [None, "  "],
            [" max_capacity_kg ", "boom_length_m", "working_radius_m", None],
            [9000.0, 10.0, 3.0],
            [],
            [6000.0, 10.0, 5.0],
        )
    )

    assert result.issues == ()
    assert as_numbers(result) == [(4, 10.0, 3.0, 9000.0), (6, 10.0, 5.0, 6000.0)]


def test_ficticio_only_the_first_worksheet_is_read() -> None:
    # Decisão provisória (TASK-023): as outras planilhas são ignoradas, mesmo com erro.
    result = parse(
        xlsx_ficticio(
            HEADER,
            [10.0, 3.0, 9000.0],
            extra_sheets=[[HEADER, [20.0, 5.0, 5000.0]], [["qualquer", "coisa"], ["abc"]]],
        )
    )

    assert result.issues == ()
    assert as_numbers(result) == [(2, 10.0, 3.0, 9000.0)]


def test_ficticio_empty_first_worksheet_is_an_empty_file_even_with_data_in_the_second() -> None:
    result = parse(xlsx_ficticio(extra_sheets=[[HEADER, [10.0, 3.0, 9000.0]]]))

    assert result.points == ()
    assert summary(result) == [(None, None, ImportIssueCode.EMPTY_FILE)]


# --- Inconsistências nas células ---------------------------------------------------------------


def test_ficticio_empty_cell_is_reported_with_line_column_and_cell_reference() -> None:
    result = parse(xlsx_ficticio(HEADER, [10.0, None, 9000.0], [10.0, 5.0]))

    assert result.points == ()
    assert summary(result) == [
        (2, "working_radius_m", ImportIssueCode.EMPTY_VALUE),
        (3, "max_capacity_kg", ImportIssueCode.EMPTY_VALUE),
    ]
    assert "(B2)" in result.issues[0].message
    assert "(C3)" in result.issues[1].message


@pytest.mark.parametrize(
    ("value", "code"),
    [
        ("abc", ImportIssueCode.INVALID_NUMBER),
        ("1,5", ImportIssueCode.INVALID_NUMBER),
        ("1e3", ImportIssueCode.INVALID_NUMBER),
        ("NaN", ImportIssueCode.NON_FINITE_NUMBER),
        (True, ImportIssueCode.INVALID_NUMBER),
        (datetime.date(2026, 9, 26), ImportIssueCode.INVALID_NUMBER),
        (datetime.datetime(2026, 9, 26, 12, 0), ImportIssueCode.INVALID_NUMBER),
        ("#DIV/0!", ImportIssueCode.INVALID_NUMBER),
        (-5000.0, ImportIssueCode.NEGATIVE_VALUE),
        ("-5000", ImportIssueCode.NEGATIVE_VALUE),
    ],
)
def test_ficticio_non_numeric_or_invalid_cell_is_reported(
    value: object, code: ImportIssueCode
) -> None:
    result = parse(xlsx_ficticio(HEADER, [10.0, 3.0, value]))

    assert result.points == ()
    assert summary(result) == [(2, "max_capacity_kg", code)]
    assert "(C2)" in result.issues[0].message


def test_ficticio_formula_without_calculated_value_is_reported_and_not_evaluated() -> None:
    # O openpyxl grava a fórmula sem o valor calculado; a importação não a avalia.
    result = parse(xlsx_ficticio(HEADER, [10.0, 3.0, "=4500*2"], [10.0, 5.0, None]))

    assert result.points == ()
    assert summary(result) == [
        (2, "max_capacity_kg", ImportIssueCode.EMPTY_VALUE),
        (3, "max_capacity_kg", ImportIssueCode.EMPTY_VALUE),
    ]
    assert "fórmula sem valor calculado" in result.issues[0].message
    assert "(C2)" in result.issues[0].message
    assert "fórmula" not in result.issues[1].message


def test_ficticio_value_outside_the_header_columns_is_a_wrong_field_count() -> None:
    result = parse(xlsx_ficticio(HEADER, [10.0, 3.0, 9000.0, None, "sobra"]))

    assert result.points == ()
    assert summary(result) == [(2, None, ImportIssueCode.WRONG_FIELD_COUNT)]
    assert "E2" in result.issues[0].message


def test_ficticio_every_inconsistency_is_reported_in_one_pass_and_valid_rows_are_kept() -> None:
    result = parse(
        xlsx_ficticio(
            HEADER,
            [10.0, 3.0, 9000.0],
            ["abc", None, -1.0],
            [20.0, 5.0, 5000.0],
            [20.0, 10.0, True],
        )
    )

    assert as_numbers(result) == [(2, 10.0, 3.0, 9000.0), (4, 20.0, 5.0, 5000.0)]
    assert summary(result) == [
        (3, "boom_length_m", ImportIssueCode.INVALID_NUMBER),
        (3, "working_radius_m", ImportIssueCode.EMPTY_VALUE),
        (3, "max_capacity_kg", ImportIssueCode.NEGATIVE_VALUE),
        (5, "max_capacity_kg", ImportIssueCode.INVALID_NUMBER),
    ]


# --- Cabeçalho (mesmas regras do CSV) ----------------------------------------------------------


def test_ficticio_invalid_header_reports_only_the_header_with_the_csv_codes() -> None:
    result = parse(
        xlsx_ficticio(
            ["boom_length_ft", "working_radius", None, "counterweight_kg"],
            [10.0, 3.0, 9000.0, 1.0],
        )
    )

    assert result.points == ()
    assert summary(result) == [
        (1, "boom_length_ft", ImportIssueCode.UNRECOGNIZED_UNIT),
        (1, "working_radius", ImportIssueCode.MISSING_UNIT),
        (1, "", ImportIssueCode.UNKNOWN_COLUMN),
        (1, "counterweight_kg", ImportIssueCode.UNKNOWN_COLUMN),
        (1, "max_capacity_kg", ImportIssueCode.MISSING_COLUMN),
    ]


def test_ficticio_duplicate_column_is_reported() -> None:
    result = parse(xlsx_ficticio([*HEADER, "max_capacity_kg"], [10.0, 3.0, 9000.0, 9000.0]))

    assert summary(result) == [(1, "max_capacity_kg", ImportIssueCode.DUPLICATE_COLUMN)]
    # Como no CSV: a coluna repetida é reportada, e as linhas usam a primeira ocorrência.
    assert as_numbers(result) == [(2, 10.0, 3.0, 9000.0)]


def test_ficticio_header_only_has_no_points_and_no_issues() -> None:
    result = parse(xlsx_ficticio(HEADER))

    assert result == LoadChartParseResult(points=(), issues=())


def test_ficticio_blank_worksheet_is_an_empty_file() -> None:
    result = parse(xlsx_ficticio([], [None, " "]))

    assert summary(result) == [(None, None, ImportIssueCode.EMPTY_FILE)]


# --- Arquivo que não é XLSX válido -------------------------------------------------------------


def truncated_xlsx() -> bytes:
    content = xlsx_ficticio(HEADER, *POINTS_FICTICIOS)
    return content[: len(content) // 2]


def xlsx_with_corrupted_sheet() -> bytes:
    source = zipfile.ZipFile(io.BytesIO(xlsx_ficticio(HEADER, *POINTS_FICTICIOS)))
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as target:
        for name in source.namelist():
            data = source.read(name)
            if name == "xl/worksheets/sheet1.xml":
                data = data[: len(data) // 2]
            target.writestr(name, data)
    return buffer.getvalue()


@pytest.mark.parametrize(
    "content",
    [
        b"",
        b"isto nao e uma planilha",
        b"boom_length_m,working_radius_m,max_capacity_kg\n10.0,3.0,9000.0\n",
        b"PK\x03\x04lixo",
        truncated_xlsx(),
        xlsx_with_corrupted_sheet(),
    ],
    ids=["vazio", "texto", "csv", "zip-invalido", "xlsx-truncado", "planilha-corrompida"],
)
def test_ficticio_invalid_xlsx_is_a_malformed_file_issue_and_never_raises(content: bytes) -> None:
    result = parse(content)

    assert result.points == ()
    assert summary(result) == [(None, None, ImportIssueCode.MALFORMED_FILE)]


# --- Paridade com o CSV ------------------------------------------------------------------------


def test_ficticio_same_table_in_csv_and_xlsx_gives_the_same_points() -> None:
    csv_content = read_csv_ficticio(CSV_FICTICIO_VALIDO)

    from_csv = CsvLoadChartParser().parse(csv_content)
    from_xlsx_text = parse(xlsx_from_csv(csv_content))
    from_xlsx_numbers = parse(xlsx_ficticio(HEADER, *POINTS_FICTICIOS))

    assert from_csv.issues == from_xlsx_text.issues == from_xlsx_numbers.issues == ()
    assert from_csv.points == from_xlsx_text.points == from_xlsx_numbers.points


def test_ficticio_same_inconsistent_table_gives_the_same_report_as_csv() -> None:
    csv_content = read_csv_ficticio(CSV_FICTICIO_INCONSISTENCIAS)

    from_csv = CsvLoadChartParser().parse(csv_content)
    from_xlsx = parse(xlsx_from_csv(csv_content))

    assert from_xlsx.points == from_csv.points
    # Única diferença esperada: a linha 7 tem só 2 campos. No CSV isso é número de campos
    # errado; na planilha é a célula da terceira coluna vazia.
    expected = [
        (7, "max_capacity_kg", ImportIssueCode.EMPTY_VALUE)
        if code is ImportIssueCode.WRONG_FIELD_COUNT
        else (line, column, code)
        for line, column, code in summary(from_csv)
    ]
    assert summary(from_xlsx) == expected


def test_ficticio_valid_xlsx_becomes_the_same_draft_chart_as_the_csv() -> None:
    def execute(parser: LoadChartParser, content: bytes) -> object:
        return ValidateLoadChartImport(parser).execute(
            content,
            load_chart_id=LOAD_CHART_FICTICIO_ID,
            version=LOAD_CHART_FICTICIO_VERSION,
            configuration_id=CONFIGURATION_FICTICIA_ID,
        )

    from_xlsx = execute(XlsxLoadChartParser(), xlsx_ficticio(HEADER, *POINTS_FICTICIOS))
    from_csv = execute(CsvLoadChartParser(), read_csv_ficticio(CSV_FICTICIO_VALIDO))

    assert isinstance(from_xlsx, ValidLoadChartImport)
    assert from_xlsx.status is LoadChartStatus.DRAFT
    assert from_xlsx == from_csv


def test_ficticio_invalid_xlsx_through_the_use_case_is_invalid() -> None:
    result = ValidateLoadChartImport(XlsxLoadChartParser()).execute(
        b"isto nao e uma planilha",
        load_chart_id=LOAD_CHART_FICTICIO_ID,
        version=LOAD_CHART_FICTICIO_VERSION,
        configuration_id=CONFIGURATION_FICTICIA_ID,
    )

    assert isinstance(result, InvalidLoadChartImport)
    assert [issue.code for issue in result.issues] == [
        ImportIssueCode.MALFORMED_FILE,
        ImportIssueCode.NO_POINTS,
    ]
