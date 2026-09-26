"""`CsvLoadChartParser` no formato canônico PROVISÓRIO (TASK-010; doc-fonte § 13.1; RNF-006).

Todos os valores são FICTÍCIOS: servem só para testar o mecanismo, não são capacidade real
(ADR-012).
"""

import pytest

from app.application.ports.load_chart_parser import (
    ImportIssueCode,
    LoadChartParser,
    LoadChartParseResult,
)
from app.domain.value_objects.length import Length
from app.domain.value_objects.mass import Mass
from app.infrastructure.importers.csv_load_chart_parser import CsvLoadChartParser
from tests.fixtures.load_chart_csv_ficticio import (
    CSV_FICTICIO_CABECALHO_INVALIDO,
    CSV_FICTICIO_INCONSISTENCIAS,
    CSV_FICTICIO_VALIDO,
    read_csv_ficticio,
)
from tests.fixtures.load_chart_ficticio import POINTS_FICTICIOS

HEADER = b"boom_length_m,working_radius_m,max_capacity_kg"

type IssueSummary = tuple[int | None, str | None, ImportIssueCode]


def parse(content: bytes) -> LoadChartParseResult:
    parser: LoadChartParser = CsvLoadChartParser()
    return parser.parse(content)


def csv_ficticio(*lines: bytes, newline: bytes = b"\n") -> bytes:
    """Monta um CSV FICTÍCIO a partir das linhas (sem o terminador)."""
    return newline.join(lines) + newline


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


def codes(result: LoadChartParseResult) -> list[ImportIssueCode]:
    return [issue.code for issue in result.issues]


# --- CSV válido (CA-1) -----------------------------------------------------------------------


def test_ficticio_valid_csv_returns_every_point_with_its_line_and_no_issue() -> None:
    result = parse(read_csv_ficticio(CSV_FICTICIO_VALIDO))

    assert result.issues == ()
    assert as_numbers(result) == [
        (line, *values) for line, values in enumerate(POINTS_FICTICIOS, start=2)
    ]


def test_ficticio_points_are_domain_quantities_in_internal_units() -> None:
    # RN-006: comprimentos em metros, capacidade em kg.
    point = parse(csv_ficticio(HEADER, b"10.0,3.0,9000.0")).points[0].point

    assert point.boom_length == Length(10.0)
    assert point.working_radius == Length(3.0)
    assert point.max_capacity == Mass(9000.0)


def test_ficticio_csv_with_crlf_line_endings_is_read_the_same() -> None:
    lf = parse(csv_ficticio(HEADER, b"10.0,3.0,9000.0", b"20.0,5.0,5000.0"))
    crlf = parse(csv_ficticio(HEADER, b"10.0,3.0,9000.0", b"20.0,5.0,5000.0", newline=b"\r\n"))

    assert crlf == lf
    assert crlf.issues == ()


def test_ficticio_csv_with_utf8_bom_is_accepted() -> None:
    result = parse(b"\xef\xbb\xbf" + csv_ficticio(HEADER, b"10.0,3.0,9000.0"))

    assert result.issues == ()
    assert as_numbers(result) == [(2, 10.0, 3.0, 9000.0)]


def test_ficticio_columns_can_come_in_any_order() -> None:
    content = csv_ficticio(b"max_capacity_kg,boom_length_m,working_radius_m", b"9000.0,10.0,3.0")

    assert as_numbers(parse(content)) == [(2, 10.0, 3.0, 9000.0)]


def test_ficticio_spaces_around_names_and_values_are_ignored() -> None:
    content = csv_ficticio(
        b" boom_length_m , working_radius_m ,max_capacity_kg ", b" 10.0 ,3.0 , 9000.0"
    )

    result = parse(content)

    assert result.issues == ()
    assert as_numbers(result) == [(2, 10.0, 3.0, 9000.0)]


def test_ficticio_quoted_values_are_accepted() -> None:
    assert as_numbers(parse(csv_ficticio(HEADER, b'"10.0","3.0","9000.0"'))) == [
        (2, 10.0, 3.0, 9000.0)
    ]


def test_ficticio_blank_lines_are_skipped_and_lines_keep_their_file_number() -> None:
    content = csv_ficticio(b"", HEADER, b"10.0,3.0,9000.0", b"", b",,", b"   ", b"20.0,5.0,5000.0")

    result = parse(content)

    assert result.issues == ()
    assert as_numbers(result) == [(3, 10.0, 3.0, 9000.0), (7, 20.0, 5.0, 5000.0)]


def test_ficticio_integers_and_signed_numbers_are_accepted() -> None:
    assert as_numbers(parse(csv_ficticio(HEADER, b"+20,5,5000"))) == [(2, 20.0, 5.0, 5000.0)]


def test_ficticio_zero_values_are_accepted_as_in_the_domain() -> None:
    # O domínio aceita 0 (TASK-008, pendência 4); o parser não cria regra própria.
    assert as_numbers(parse(csv_ficticio(HEADER, b"0,0,0"))) == [(2, 0.0, 0.0, 0.0)]


def test_ficticio_header_only_has_no_points_and_no_parser_issue() -> None:
    # "Sem pontos" é validado pelo caso de uso, para valer em qualquer formato.
    assert parse(csv_ficticio(HEADER)) == LoadChartParseResult(points=(), issues=())


def test_ficticio_parser_does_not_judge_conflicting_points() -> None:
    # Pontos conflitantes envolvem mais de uma linha: são do caso de uso.
    result = parse(csv_ficticio(HEADER, b"10.0,5.0,6000.0", b"10.0,5.0,5999.0"))

    assert result.issues == ()
    assert len(result.points) == 2


# --- cabeçalho (CA-3) ------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("header", "missing"),
    [
        (b"working_radius_m,max_capacity_kg", "boom_length_m"),
        (b"boom_length_m,max_capacity_kg", "working_radius_m"),
        (b"boom_length_m,working_radius_m", "max_capacity_kg"),
    ],
)
def test_ficticio_missing_required_column_is_reported(header: bytes, missing: str) -> None:
    result = parse(csv_ficticio(header, b"10.0,3.0"))

    assert summary(result) == [(1, missing, ImportIssueCode.MISSING_COLUMN)]
    assert result.points == ()


def test_ficticio_column_without_unit_suffix_is_reported() -> None:
    result = parse(csv_ficticio(b"boom_length,working_radius_m,max_capacity_kg", b"10,3,9000"))

    assert summary(result) == [(1, "boom_length", ImportIssueCode.MISSING_UNIT)]
    assert result.points == ()


def test_ficticio_column_with_empty_unit_suffix_is_reported_as_missing_unit() -> None:
    result = parse(csv_ficticio(b"boom_length_,working_radius_m,max_capacity_kg", b"10,3,9000"))

    assert summary(result) == [(1, "boom_length_", ImportIssueCode.MISSING_UNIT)]


@pytest.mark.parametrize(
    "header",
    [
        b"boom_length_ft,working_radius_m,max_capacity_kg",
        b"boom_length_m,working_radius_cm,max_capacity_kg",
        b"boom_length_m,working_radius_m,max_capacity_t",
        b"boom_length_m,working_radius_m,max_capacity_lb",
        b"boom_length_kg,working_radius_m,max_capacity_kg",
    ],
)
def test_ficticio_unrecognized_unit_is_reported_because_there_is_no_conversion(
    header: bytes,
) -> None:
    # RN-006 e doc-fonte § 26, pergunta 10: só unidades internas, sem conversão.
    result = parse(csv_ficticio(header, b"10,3,9000"))

    assert codes(result) == [ImportIssueCode.UNRECOGNIZED_UNIT]
    assert result.issues[0].line == 1
    assert result.points == ()


def test_ficticio_unknown_column_is_reported_but_rows_are_still_checked() -> None:
    content = csv_ficticio(HEADER + b",counterweight_kg", b"10.0,3.0,9000.0,1000.0")

    result = parse(content)

    assert summary(result) == [(1, "counterweight_kg", ImportIssueCode.UNKNOWN_COLUMN)]
    assert as_numbers(result) == [(2, 10.0, 3.0, 9000.0)]


def test_ficticio_column_without_name_is_reported_as_unknown() -> None:
    result = parse(csv_ficticio(HEADER + b",", b"10.0,3.0,9000.0,"))

    assert summary(result) == [(1, "", ImportIssueCode.UNKNOWN_COLUMN)]
    assert "sem nome" in result.issues[0].message


def test_ficticio_duplicate_column_is_reported() -> None:
    result = parse(csv_ficticio(HEADER + b",max_capacity_kg", b"10.0,3.0,9000.0,9000.0"))

    assert summary(result) == [(1, "max_capacity_kg", ImportIssueCode.DUPLICATE_COLUMN)]


def test_ficticio_column_names_are_case_sensitive() -> None:
    result = parse(csv_ficticio(b"Boom_Length_M,working_radius_m,max_capacity_kg", b"10,3,9000"))

    assert summary(result) == [
        (1, "Boom_Length_M", ImportIssueCode.UNKNOWN_COLUMN),
        (1, "boom_length_m", ImportIssueCode.MISSING_COLUMN),
    ]


@pytest.mark.parametrize("delimiter", [b";", b"\t"])
def test_ficticio_other_delimiter_is_reported_once(delimiter: bytes) -> None:
    header = delimiter.join([b"boom_length_m", b"working_radius_m", b"max_capacity_kg"])

    result = parse(csv_ficticio(header, delimiter.join([b"10.0", b"3.0", b"9000.0"])))

    assert summary(result) == [(1, None, ImportIssueCode.UNSUPPORTED_DELIMITER)]


def test_ficticio_header_issues_use_the_header_line_number() -> None:
    result = parse(csv_ficticio(b"", b"", b"boom_length_ft,working_radius_m,max_capacity_kg"))

    assert [issue.line for issue in result.issues] == [3]


def test_ficticio_invalid_header_fixture_reports_each_column_problem() -> None:
    result = parse(read_csv_ficticio(CSV_FICTICIO_CABECALHO_INVALIDO))

    assert summary(result) == [
        (1, "boom_length_ft", ImportIssueCode.UNRECOGNIZED_UNIT),
        (1, "max_capacity", ImportIssueCode.MISSING_UNIT),
        (1, "counterweight_kg", ImportIssueCode.UNKNOWN_COLUMN),
    ]
    assert result.points == ()


# --- linhas de dados (CA-4) ------------------------------------------------------------------


def test_ficticio_empty_required_value_is_reported() -> None:
    result = parse(csv_ficticio(HEADER, b"10.0,,9000.0"))

    assert summary(result) == [(2, "working_radius_m", ImportIssueCode.EMPTY_VALUE)]
    assert result.points == ()


@pytest.mark.parametrize(
    "value",
    [b"abc", b'"1,5"', b"1e3", b"1_000", b"5.", b".5", b"12 kg", b"0x10", "١٢".encode()],
)
def test_ficticio_non_numeric_value_is_reported(value: bytes) -> None:
    result = parse(csv_ficticio(HEADER, b"10.0,3.0," + value))

    assert summary(result) == [(2, "max_capacity_kg", ImportIssueCode.INVALID_NUMBER)]
    assert result.points == ()


@pytest.mark.parametrize("value", [b"nan", b"NaN", b"inf", b"-inf", b"+Infinity", b"INF"])
def test_ficticio_nan_and_infinity_are_reported(value: bytes) -> None:
    result = parse(csv_ficticio(HEADER, value + b",3.0,9000.0"))

    assert summary(result) == [(2, "boom_length_m", ImportIssueCode.NON_FINITE_NUMBER)]


def test_ficticio_number_too_large_for_float_is_reported_as_non_finite() -> None:
    result = parse(csv_ficticio(HEADER, b"10.0,3.0,1" + b"0" * 400))

    assert summary(result) == [(2, "max_capacity_kg", ImportIssueCode.NON_FINITE_NUMBER)]


@pytest.mark.parametrize(
    ("row", "column"),
    [
        (b"-10.0,3.0,9000.0", "boom_length_m"),
        (b"10.0,-3.0,9000.0", "working_radius_m"),
        (b"10.0,3.0,-9000.0", "max_capacity_kg"),
    ],
)
def test_ficticio_negative_value_is_reported(row: bytes, column: str) -> None:
    # Doc-fonte § 13.1: capacidades não negativas; Length e Mass também recusam negativo.
    result = parse(csv_ficticio(HEADER, row))

    assert summary(result) == [(2, column, ImportIssueCode.NEGATIVE_VALUE)]
    assert result.points == ()


@pytest.mark.parametrize("row", [b"10.0,3.0", b"10.0,3.0,9000.0,1"])
def test_ficticio_row_with_wrong_field_count_is_reported(row: bytes) -> None:
    result = parse(csv_ficticio(HEADER, row))

    assert summary(result) == [(2, None, ImportIssueCode.WRONG_FIELD_COUNT)]
    assert result.points == ()


def test_ficticio_row_with_several_problems_reports_each_column() -> None:
    result = parse(csv_ficticio(HEADER, b"abc,,-1"))

    assert summary(result) == [
        (2, "boom_length_m", ImportIssueCode.INVALID_NUMBER),
        (2, "working_radius_m", ImportIssueCode.EMPTY_VALUE),
        (2, "max_capacity_kg", ImportIssueCode.NEGATIVE_VALUE),
    ]


def test_ficticio_every_problem_is_reported_in_one_pass_with_valid_points_kept() -> None:
    # RNF-006: relatório completo, sem parar no primeiro erro.
    result = parse(read_csv_ficticio(CSV_FICTICIO_INCONSISTENCIAS))

    assert summary(result) == [
        (3, "max_capacity_kg", ImportIssueCode.EMPTY_VALUE),
        (4, "working_radius_m", ImportIssueCode.INVALID_NUMBER),
        (5, "max_capacity_kg", ImportIssueCode.NEGATIVE_VALUE),
        (6, "max_capacity_kg", ImportIssueCode.NON_FINITE_NUMBER),
        (7, None, ImportIssueCode.WRONG_FIELD_COUNT),
        (9, "max_capacity_kg", ImportIssueCode.INVALID_NUMBER),
    ]
    assert as_numbers(result) == [
        (2, 10.0, 3.0, 9000.0),
        (8, 10.0, 3.0, 8999.0),
        (10, 20.0, 20.0, 1000.0),
    ]


def test_every_issue_has_a_human_readable_message() -> None:
    result = parse(read_csv_ficticio(CSV_FICTICIO_INCONSISTENCIAS))

    assert all(issue.message.strip() for issue in result.issues)


# --- arquivo (CA-5) --------------------------------------------------------------------------


@pytest.mark.parametrize("content", [b"", b"\n\n", b"\r\n  \r\n", b"\xef\xbb\xbf"])
def test_empty_file_is_reported(content: bytes) -> None:
    result = parse(content)

    assert summary(result) == [(None, None, ImportIssueCode.EMPTY_FILE)]
    assert result.points == ()


def test_ficticio_file_not_in_utf8_is_reported_with_the_line() -> None:
    # "máx" em Latin-1 (byte 0xE1) na linha 3.
    content = csv_ficticio(HEADER, b"10.0,3.0,9000.0", "20.0,5.0,máx".encode("latin-1"))

    result = parse(content)

    assert summary(result) == [(3, None, ImportIssueCode.INVALID_ENCODING)]
    assert result.points == ()


def test_ficticio_malformed_csv_is_reported_and_points_before_it_are_kept() -> None:
    content = csv_ficticio(HEADER, b"10.0,3.0,9000.0", b'20.0,"5.0"x,5000.0', b"20.0,10.0,3000.0")

    result = parse(content)

    assert summary(result) == [(3, None, ImportIssueCode.MALFORMED_FILE)]
    assert as_numbers(result) == [(2, 10.0, 3.0, 9000.0)]


def test_ficticio_unterminated_quote_is_reported_as_malformed() -> None:
    result = parse(csv_ficticio(HEADER, b'10.0,"3.0,9000.0'))

    assert codes(result) == [ImportIssueCode.MALFORMED_FILE]


@pytest.mark.parametrize(
    "content",
    [b"\x00\x01\x02", b'"', b",,,\n,,,", b"\xff\xfe", b"a" * 10_000, HEADER + b"\n\x00,\x00,\x00"],
)
def test_parser_never_raises_on_garbage_content(content: bytes) -> None:
    result = parse(content)

    assert isinstance(result, LoadChartParseResult)
    assert result.points == () or result.issues != ()
