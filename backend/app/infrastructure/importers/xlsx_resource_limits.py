"""Limites de recurso do XLSX, conferidos antes de abrir com o openpyxl (TASK-031; P-008).

A VALIDAR (P-008): os requisitos de segurança dos uploads não foram definidos. Os valores padrão
abaixo são PROVISÓRIOS. O limite do tamanho do upload (1 MiB, `upload_limits` da API) não basta
para o XLSX, que é um ZIP: 1 MiB compactado pode virar centenas de MiB descompactados (zip bomb).

Antes de o `XlsxLoadChartParser` abrir o arquivo, `ensure_xlsx_within_limits`, só com a biblioteca
padrão:

1. soma o tamanho descompactado **declarado** de todas as partes do ZIP e recusa acima de
   `max_uncompressed_bytes`. O `zipfile` (usado também pelo openpyxl) nunca descompacta além do
   tamanho declarado de cada parte, então a soma declarada limita o que será descompactado;
2. conta as linhas (`<row>`) de **todas** as planilhas (`xl/worksheets/*.xml`), lendo o XML em
   fluxo, e recusa acima de `max_rows`. O parser só lê a primeira planilha; contar todas é mais
   restritivo e dispensa descobrir qual é a primeira sem abrir a pasta.

Passar de um limite levanta `LoadChartFileLimitExceededError` (a API responde 413). Um arquivo que
não é ZIP, ou com XML ilegível, **não** é recusado aqui: segue para o parser, que o reporta como
`MALFORMED_FILE` no relatório, como antes.
"""

import io
import re
import zipfile
from dataclasses import dataclass
from typing import IO
from xml.etree.ElementTree import ParseError, iterparse

from app.application.ports.load_chart_file_limits import LoadChartFileLimitExceededError
from app.application.ports.load_chart_parser import LoadChartParser, LoadChartParseResult
from app.infrastructure.importers.load_chart_parser_selector import select_load_chart_parser
from app.infrastructure.importers.xlsx_load_chart_parser import XlsxLoadChartParser

MIB = 1024 * 1024

DEFAULT_MAX_XLSX_UNCOMPRESSED_BYTES = 10 * MIB
"""Tamanho descompactado máximo, somando as partes: 10 MiB. PROVISÓRIO — A VALIDAR (P-008)."""

DEFAULT_MAX_XLSX_ROWS = 10_000
"""Número máximo de linhas somando todas as planilhas: 10 000. PROVISÓRIO — A VALIDAR (P-008)."""

_WORKSHEET_PART = re.compile(r"xl/worksheets/[^/]+\.xml", re.IGNORECASE)


@dataclass(frozen=True, slots=True)
class XlsxLimits:
    """Limites de recurso do XLSX (PROVISÓRIOS — A VALIDAR, P-008)."""

    max_uncompressed_bytes: int = DEFAULT_MAX_XLSX_UNCOMPRESSED_BYTES
    max_rows: int = DEFAULT_MAX_XLSX_ROWS

    def __post_init__(self) -> None:
        for name, value in (
            ("max_uncompressed_bytes", self.max_uncompressed_bytes),
            ("max_rows", self.max_rows),
        ):
            if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
                raise ValueError(f"{name} deve ser um inteiro positivo; recebido {value!r}")


def ensure_xlsx_within_limits(content: bytes, limits: XlsxLimits) -> None:
    """Levanta `LoadChartFileLimitExceededError` se o XLSX passar de um limite; senão nada."""
    try:
        archive = zipfile.ZipFile(io.BytesIO(content))
    except zipfile.BadZipFile, OSError, ValueError:
        return  # não é ZIP: o parser reporta MALFORMED_FILE
    with archive:
        members = archive.infolist()
        uncompressed = sum(member.file_size for member in members)
        if uncompressed > limits.max_uncompressed_bytes:
            raise LoadChartFileLimitExceededError(
                f"o XLSX descompactado teria {uncompressed} bytes, acima do máximo de "
                f"{limits.max_uncompressed_bytes} bytes"
            )
        rows = 0
        for member in members:
            if not _WORKSHEET_PART.fullmatch(member.filename):
                continue
            try:
                with archive.open(member) as sheet:
                    rows += _count_rows(sheet, limit=limits.max_rows - rows)
            except LoadChartFileLimitExceededError:
                raise
            except zipfile.BadZipFile, OSError, ValueError, ParseError, EOFError:
                return  # parte ilegível: o parser reporta MALFORMED_FILE
            if rows > limits.max_rows:
                break
        if rows > limits.max_rows:
            raise LoadChartFileLimitExceededError(
                f"o XLSX tem mais de {limits.max_rows} linhas nas planilhas, acima do máximo"
            )


def _count_rows(sheet: IO[bytes], *, limit: int) -> int:
    """Conta os elementos `row` do XML em fluxo; para assim que passar de `limit`."""
    rows = 0
    for _event, element in iterparse(sheet, events=("end",)):
        if element.tag == "row" or element.tag.endswith("}row"):
            rows += 1
            if rows > limit:
                return rows
        element.clear()
    return rows


class LimitedXlsxLoadChartParser:
    """`LoadChartParser` que confere os limites de recurso antes do `XlsxLoadChartParser`."""

    def __init__(self, limits: XlsxLimits, parser: LoadChartParser | None = None) -> None:
        self._limits = limits
        self._parser = parser if parser is not None else XlsxLoadChartParser()

    def parse(self, content: bytes) -> LoadChartParseResult:
        ensure_xlsx_within_limits(content, self._limits)
        return self._parser.parse(content)


def select_limited_load_chart_parser(
    filename: str | None, content_type: str | None, *, limits: XlsxLimits
) -> LoadChartParser | None:
    """`select_load_chart_parser` (TASK-023), com o XLSX protegido pelos limites de recurso."""
    parser = select_load_chart_parser(filename, content_type)
    if isinstance(parser, XlsxLoadChartParser):
        return LimitedXlsxLoadChartParser(limits, parser)
    return parser
