"""Limites de recurso do XLSX antes do openpyxl (TASK-031; P-008, limites PROVISÓRIOS).

Planilhas FICTÍCIAS geradas em memória (ADR-012); nenhum binário commitado.
"""

import io
import zipfile

import pytest
from openpyxl import Workbook

from app.application.ports.load_chart_file_limits import LoadChartFileLimitExceededError
from app.application.ports.load_chart_parser import ImportIssueCode, LoadChartParseResult
from app.infrastructure.importers.csv_load_chart_parser import CsvLoadChartParser
from app.infrastructure.importers.xlsx_resource_limits import (
    DEFAULT_MAX_XLSX_ROWS,
    DEFAULT_MAX_XLSX_UNCOMPRESSED_BYTES,
    LimitedXlsxLoadChartParser,
    XlsxLimits,
    ensure_xlsx_within_limits,
    select_limited_load_chart_parser,
)

HEADER = ("boom_length_m", "working_radius_m", "max_capacity_kg")


def xlsx_ficticio(data_rows: int, *, sheets: int = 1) -> bytes:
    """XLSX FICTÍCIO com cabeçalho e `data_rows` linhas em cada uma das `sheets` planilhas."""
    workbook = Workbook()
    first = workbook.active
    assert first is not None
    targets = [first, *(workbook.create_sheet(f"Extra{i}") for i in range(1, sheets))]
    for sheet in targets:
        sheet.append(HEADER)
        for index in range(data_rows):
            sheet.append((10.0, 3.0 + index, 9000.0))
    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def zip_bomb_ficticio(uncompressed_bytes: int) -> bytes:
    """ZIP pequeno que descompacta para `uncompressed_bytes` (zeros), com cara de XLSX."""
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("xl/sharedStrings.xml", b"\0" * uncompressed_bytes)
    return buffer.getvalue()


class SpyParser:
    def __init__(self) -> None:
        self.calls = 0

    def parse(self, content: bytes) -> LoadChartParseResult:
        self.calls += 1
        return LoadChartParseResult(points=(), issues=())


def test_default_limits_are_the_provisional_values() -> None:
    limits = XlsxLimits()
    assert limits.max_uncompressed_bytes == DEFAULT_MAX_XLSX_UNCOMPRESSED_BYTES == 10 * 1024 * 1024
    assert limits.max_rows == DEFAULT_MAX_XLSX_ROWS == 10_000


@pytest.mark.parametrize("field", ["max_uncompressed_bytes", "max_rows"])
@pytest.mark.parametrize("value", [0, -1, True, 1.5])
def test_limits_must_be_positive_integers(field: str, value: object) -> None:
    with pytest.raises(ValueError, match=field):
        XlsxLimits(**{field: value})  # type: ignore[arg-type]


def test_xlsx_within_limits_passes() -> None:
    ensure_xlsx_within_limits(xlsx_ficticio(5), XlsxLimits())


def test_zip_bomb_is_refused_by_the_declared_uncompressed_size() -> None:
    content = zip_bomb_ficticio(2 * 1024 * 1024)
    assert len(content) < 16 * 1024  # pequeno compactado

    with pytest.raises(LoadChartFileLimitExceededError, match="descompactado"):
        ensure_xlsx_within_limits(content, XlsxLimits(max_uncompressed_bytes=1024 * 1024))


def test_rows_above_the_limit_are_refused() -> None:
    content = xlsx_ficticio(10)  # 11 linhas com o cabeçalho
    ensure_xlsx_within_limits(content, XlsxLimits(max_rows=11))
    with pytest.raises(LoadChartFileLimitExceededError, match="linhas"):
        ensure_xlsx_within_limits(content, XlsxLimits(max_rows=10))


def test_rows_of_every_worksheet_count_towards_the_limit() -> None:
    content = xlsx_ficticio(4, sheets=2)  # 5 + 5 linhas
    ensure_xlsx_within_limits(content, XlsxLimits(max_rows=10))
    with pytest.raises(LoadChartFileLimitExceededError):
        ensure_xlsx_within_limits(content, XlsxLimits(max_rows=9))


@pytest.mark.parametrize("content", [b"", b"nao e zip FICTICIO", b"PK\x03\x04quebrado"])
def test_non_zip_content_is_left_for_the_parser(content: bytes) -> None:
    ensure_xlsx_within_limits(content, XlsxLimits(max_rows=1, max_uncompressed_bytes=1))


def test_unreadable_worksheet_xml_is_left_for_the_parser() -> None:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("xl/worksheets/sheet1.xml", b"<worksheet><row>")
    ensure_xlsx_within_limits(buffer.getvalue(), XlsxLimits(max_rows=1))


def test_limited_parser_does_not_open_the_file_above_the_limit() -> None:
    spy = SpyParser()
    parser = LimitedXlsxLoadChartParser(XlsxLimits(max_rows=2), spy)

    with pytest.raises(LoadChartFileLimitExceededError):
        parser.parse(xlsx_ficticio(5))
    assert spy.calls == 0

    parser.parse(xlsx_ficticio(1))
    assert spy.calls == 1


def test_limited_parser_reads_a_valid_xlsx_with_the_real_parser() -> None:
    result = LimitedXlsxLoadChartParser(XlsxLimits()).parse(xlsx_ficticio(3))
    assert len(result.points) == 3
    assert result.issues == ()


def test_limited_parser_keeps_reporting_malformed_files() -> None:
    result = LimitedXlsxLoadChartParser(XlsxLimits()).parse(b"nao e xlsx FICTICIO")
    assert [issue.code for issue in result.issues] == [ImportIssueCode.MALFORMED_FILE]


def test_selector_wraps_only_the_xlsx_parser() -> None:
    limits = XlsxLimits()
    assert isinstance(
        select_limited_load_chart_parser("tabela.xlsx", None, limits=limits),
        LimitedXlsxLoadChartParser,
    )
    assert isinstance(
        select_limited_load_chart_parser("tabela.csv", None, limits=limits), CsvLoadChartParser
    )
    assert select_limited_load_chart_parser("tabela.pdf", "application/pdf", limits=limits) is None
