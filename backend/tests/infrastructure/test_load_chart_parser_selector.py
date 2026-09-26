"""`select_load_chart_parser`: escolha do adapter CSV ou XLSX pelo arquivo (TASK-023)."""

import pytest

from app.infrastructure.importers.csv_load_chart_parser import CsvLoadChartParser
from app.infrastructure.importers.load_chart_parser_selector import (
    CSV_CONTENT_TYPE,
    XLSX_CONTENT_TYPE,
    select_load_chart_parser,
)
from app.infrastructure.importers.xlsx_load_chart_parser import XlsxLoadChartParser


@pytest.mark.parametrize(
    ("filename", "content_type", "expected"),
    [
        ("tabela_ficticia.csv", None, CsvLoadChartParser),
        ("TABELA_FICTICIA.CSV", "", CsvLoadChartParser),
        ("tabela_ficticia.xlsx", None, XlsxLoadChartParser),
        ("Tabela Ficticia.XLSX ", None, XlsxLoadChartParser),
        # A extensão vence o tipo de conteúdo (o navegador manda vnd.ms-excel para .csv).
        ("tabela_ficticia.csv", "application/vnd.ms-excel", CsvLoadChartParser),
        ("tabela_ficticia.csv", XLSX_CONTENT_TYPE, CsvLoadChartParser),
        ("tabela_ficticia.xlsx", CSV_CONTENT_TYPE, XlsxLoadChartParser),
        # Sem extensão reconhecida, decide o tipo de conteúdo.
        (None, "text/csv; charset=utf-8", CsvLoadChartParser),
        ("upload", "TEXT/CSV", CsvLoadChartParser),
        ("", XLSX_CONTENT_TYPE, XlsxLoadChartParser),
    ],
)
def test_selects_the_parser_by_extension_then_by_content_type(
    filename: str | None, content_type: str | None, expected: type
) -> None:
    assert isinstance(select_load_chart_parser(filename, content_type), expected)


@pytest.mark.parametrize(
    ("filename", "content_type"),
    [
        (None, None),
        ("tabela_ficticia.xls", "application/vnd.ms-excel"),
        ("tabela_ficticia.xlsm", None),
        ("tabela_ficticia.txt", "text/plain"),
        ("tabela_ficticia", "application/octet-stream"),
    ],
)
def test_unsupported_format_returns_none(filename: str | None, content_type: str | None) -> None:
    assert select_load_chart_parser(filename, content_type) is None
