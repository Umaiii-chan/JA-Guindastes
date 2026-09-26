"""Leitura de tabela de carga em XLSX no formato canônico interno PROVISÓRIO (TASK-023).

PROVISÓRIO: o formato real das tabelas da empresa não é conhecido (PEND-008) e o formato canônico
interno de importação continua em aberto (known-gaps P-006). O formato é o MESMO do CSV da TASK-010
(`csv_load_chart_parser`), levado para a planilha:

- só a **primeira planilha** (primeira worksheet na ordem do arquivo, visível ou não) é lida; as
  demais são ignoradas (decisão provisória da TASK-023, ver `handoffs/TASK-023.md`);
- o cabeçalho é a primeira linha não vazia, com as colunas `boom_length_m`, `working_radius_m` e
  `max_capacity_kg`, e segue exatamente as regras do CSV (as mesmas funções de validação): colunas
  em qualquer ordem, espaços em volta ignorados, maiúsculas contam, coluna repetida, desconhecida
  ou sem nome é inconsistência, só as unidades internas (`m`, `kg`; RN-006);
- como no CSV, a tabela começa na coluna A: célula de cabeçalho vazia antes da última coluna
  preenchida é "coluna sem nome"; células vazias depois da última são ignoradas;
- linhas sem nenhum valor são ignoradas; valor numa coluna além do cabeçalho é
  `WRONG_FIELD_COUNT` (o equivalente, na planilha, a um campo a mais no CSV);
- célula numérica é usada como está; célula de texto segue a regra de número do CSV (`12`, `12.5`;
  sem expoente, sem separador de milhar, sem vírgula decimal); data/hora, booleano, erro de
  fórmula (`#DIV/0!`) ou texto não numérico é `INVALID_NUMBER`; célula vazia ou com fórmula sem
  valor calculado é `EMPTY_VALUE`;
- a linha do relatório é a linha da planilha (a mesma que o Excel mostra) e a coluna é o nome no
  cabeçalho; a mensagem traz também a referência da célula (ex.: `C5`).

Segurança (P-008 continua aberta): o arquivo é aberto só para leitura (`read_only=True`), sem
avaliar fórmulas (o openpyxl nunca as avalia; `data_only=True` lê o último valor calculado que o
Excel gravou), sem macros (`keep_vba=False`) e sem vínculos externos (`keep_links=False`).
Fórmula COM valor calculado é aceita pelo valor gravado (decisão provisória, ver o handoff).
"""

import datetime
import io
import math
from collections.abc import Callable, Iterator, Sequence
from dataclasses import dataclass, replace

from openpyxl import load_workbook
from openpyxl.utils.cell import get_column_letter
from openpyxl.workbook.workbook import Workbook
from openpyxl.worksheet._read_only import ReadOnlyWorksheet

from app.application.ports.load_chart_parser import (
    ImportIssue,
    ImportIssueCode,
    LoadChartParser,
    LoadChartParseResult,
    ParsedLoadChartPoint,
)
from app.domain.entities.load_chart_point import LoadChartPoint
from app.domain.exceptions.domain_errors import InvalidQuantityError
from app.domain.value_objects.length import Length
from app.domain.value_objects.mass import Mass

# Mesmas regras de cabeçalho e de número em texto do CSV, para os dois formatos não divergirem.
# São funções privadas do módulo CSV: movê-las para um módulo comum fica para uma tarefa que possa
# alterar `csv_load_chart_parser.py` (fora do escopo da TASK-023).
from app.infrastructure.importers.csv_load_chart_parser import (
    EXPECTED_HEADER,
    _read_cell,
    _read_header,
)

type CellValue = object


@dataclass(frozen=True)
class _Cell:
    """Valor e tipo (`data_type` do openpyxl: `n`, `s`, `b`, `d`, `e`, `f`) de uma célula."""

    value: CellValue
    data_type: str


@dataclass(frozen=True)
class _EmptyCellIssue:
    """`EMPTY_VALUE` já reportado, cuja mensagem muda se a célula tiver fórmula sem valor."""

    index: int
    row: int
    column: int


class XlsxLoadChartParser(LoadChartParser):
    """Adapter de `LoadChartParser` para XLSX, com o openpyxl.

    Nunca levanta exceção por problema no conteúdo: devolve os pontos válidos e todas as
    inconsistências encontradas. Arquivo que não é XLSX válido vira `MALFORMED_FILE`; uma falha no
    meio da leitura interrompe a leitura, e o que foi lido até ali continua no resultado.
    """

    def parse(self, content: bytes) -> LoadChartParseResult:
        points: list[ParsedLoadChartPoint] = []
        issues: list[ImportIssue] = []
        empty_cells: list[_EmptyCellIssue] = []

        try:
            workbook = _open(content, data_only=True)
        except Exception as error:  # o openpyxl levanta tipos variados para arquivo inválido
            message = f"o arquivo não é uma planilha XLSX válida ({_describe(error)})"
            return _only(_malformed(message))

        try:
            sheet = _first_worksheet(workbook)
            if sheet is None:
                return _only(_empty_file())
            _read_sheet(sheet, points, issues, empty_cells)
        except Exception as error:  # conteúdo malformado só aparece durante a leitura (streaming)
            issues.append(_malformed(f"XLSX malformado, leitura interrompida ({_describe(error)})"))
        finally:
            workbook.close()

        if empty_cells:
            _explain_formulas_without_value(content, issues, empty_cells)
        return LoadChartParseResult(points=tuple(points), issues=tuple(issues))


def _open(content: bytes, *, data_only: bool) -> Workbook:
    return load_workbook(
        io.BytesIO(content),
        read_only=True,
        data_only=data_only,
        keep_vba=False,
        keep_links=False,
    )


def _first_worksheet(workbook: Workbook) -> ReadOnlyWorksheet | None:
    """Primeira worksheet na ordem do arquivo (planilhas de gráfico não contam)."""
    for sheet in workbook.worksheets:
        if isinstance(sheet, ReadOnlyWorksheet):
            return sheet
    return None


def _rows(sheet: ReadOnlyWorksheet) -> Iterator[tuple[int, list[_Cell]]]:
    """Linhas da planilha com o número da linha (começa em 1; linhas ausentes vêm vazias)."""
    # `min_row=1` explícito: a numeração das linhas não pode depender da dimensão gravada no
    # arquivo. O stub (types-openpyxl) declara `iter_rows` só para `Worksheet`, daí o ignore.
    rows = sheet.iter_rows(min_row=1)  # type: ignore[misc]
    for line, row in enumerate(rows, start=1):
        yield line, [_Cell(value=cell.value, data_type=cell.data_type) for cell in row]


def _is_blank_value(value: CellValue) -> bool:
    return value is None or (isinstance(value, str) and not value.strip())


def _is_blank(row: Sequence[_Cell]) -> bool:
    return all(_is_blank_value(cell.value) for cell in row)


def _header_names(row: Sequence[_Cell]) -> list[str]:
    """Nomes do cabeçalho até a última célula preenchida (as vazias depois dela não contam)."""
    last = max(index for index, cell in enumerate(row) if not _is_blank_value(cell.value))
    return [_header_name(cell.value) for cell in row[: last + 1]]


def _header_name(value: CellValue) -> str:
    if value is None:
        return ""
    return (value if isinstance(value, str) else str(value)).strip()


def _read_sheet(
    sheet: ReadOnlyWorksheet,
    points: list[ParsedLoadChartPoint],
    issues: list[ImportIssue],
    empty_cells: list[_EmptyCellIssue],
) -> None:
    rows = _rows(sheet)
    header: tuple[int, list[_Cell]] | None = None
    for line, row in rows:
        if not _is_blank(row):
            header = (line, row)
            break
    if header is None:
        issues.append(_empty_file())
        return

    header_line, header_row = header
    names = _header_names(header_row)
    columns = _read_header(names, header_line, issues)
    if columns is None:
        return

    for line, row in rows:
        if _is_blank(row):
            continue
        point = _read_row(row, line, names, columns, issues, empty_cells)
        if point is not None:
            points.append(point)


def _read_row(
    row: list[_Cell],
    line: int,
    names: list[str],
    columns: dict[str, int],
    issues: list[ImportIssue],
    empty_cells: list[_EmptyCellIssue],
) -> ParsedLoadChartPoint | None:
    """Lê uma linha de dados; devolve o ponto, ou `None` e acrescenta as inconsistências."""
    extra = [
        index
        for index, cell in enumerate(row)
        if index >= len(names) and not _is_blank_value(cell.value)
    ]
    if extra:
        cells = ", ".join(f"{get_column_letter(index + 1)}{line}" for index in extra)
        issues.append(
            ImportIssue(
                code=ImportIssueCode.WRONG_FIELD_COUNT,
                message=f"a linha tem valor fora das {len(names)} coluna(s) do cabeçalho "
                f"(célula(s) {cells})",
                line=line,
            )
        )
        return None

    def cell[Q](quantity: str, factory: Callable[[float], Q]) -> Q | None:
        index = columns[quantity]
        value = row[index] if index < len(row) else _Cell(value=None, data_type="n")
        return _read_quantity(value, line, index, names[index], factory, issues, empty_cells)

    boom_length = cell("boom_length", Length)
    working_radius = cell("working_radius", Length)
    max_capacity = cell("max_capacity", Mass)
    if boom_length is None or working_radius is None or max_capacity is None:
        return None
    return ParsedLoadChartPoint(
        line=line,
        point=LoadChartPoint(
            boom_length=boom_length, working_radius=working_radius, max_capacity=max_capacity
        ),
    )


def _read_quantity[Q](
    cell: _Cell,
    line: int,
    index: int,
    column: str,
    factory: Callable[[float], Q],
    issues: list[ImportIssue],
    empty_cells: list[_EmptyCellIssue],
) -> Q | None:
    """Converte o valor de uma célula na grandeza do domínio, ou reporta o motivo."""
    reference = f"{get_column_letter(index + 1)}{line}"
    value = cell.value

    def report(code: ImportIssueCode, message: str) -> None:
        issues.append(ImportIssue(code=code, message=message, line=line, column=column))

    if _is_blank_value(value):
        empty_cells.append(_EmptyCellIssue(index=len(issues), row=line, column=index + 1))
        report(ImportIssueCode.EMPTY_VALUE, f"valor obrigatório vazio em '{column}' ({reference})")
        return None
    if isinstance(value, bool):
        report(
            ImportIssueCode.INVALID_NUMBER,
            f"valor booleano em '{column}' ({reference}): {value}; esperado um número",
        )
        return None
    if isinstance(value, datetime.date | datetime.time | datetime.timedelta):
        report(
            ImportIssueCode.INVALID_NUMBER,
            f"data/hora em '{column}' ({reference}): {value}; esperado um número "
            "(confira o formato da célula)",
        )
        return None
    if cell.data_type == "e":
        report(
            ImportIssueCode.INVALID_NUMBER,
            f"erro de fórmula em '{column}' ({reference}): {value}",
        )
        return None
    if isinstance(value, str):
        # Mesma regra de número em texto do CSV; a célula entra na mensagem pela coluna.
        before = len(issues)
        quantity = _read_cell(value, line, column, factory, issues)
        issues[before:] = [
            replace(issue, message=f"{issue.message} ({reference})") for issue in issues[before:]
        ]
        return quantity
    if isinstance(value, int | float):
        return _number_to_quantity(value, reference, column, factory, report)
    report(
        ImportIssueCode.INVALID_NUMBER,
        f"valor não numérico em '{column}' ({reference}): {value!r}",
    )
    return None


def _number_to_quantity[Q](
    value: float,
    reference: str,
    column: str,
    factory: Callable[[float], Q],
    report: Callable[[ImportIssueCode, str], None],
) -> Q | None:
    try:
        number = float(value)
    except OverflowError:
        number = math.inf
    if not math.isfinite(number):
        report(
            ImportIssueCode.NON_FINITE_NUMBER,
            f"valor não finito ou grande demais em '{column}' ({reference}): {value}",
        )
        return None
    try:
        return factory(number)
    except InvalidQuantityError as error:
        if number < 0:
            report(
                ImportIssueCode.NEGATIVE_VALUE,
                f"valor negativo em '{column}' ({reference}): {value} (comprimentos, raios e "
                "capacidades não podem ser negativos)",
            )
        else:
            report(ImportIssueCode.INVALID_NUMBER, f"valor inválido em '{column}': {error}")
        return None


def _explain_formulas_without_value(
    content: bytes, issues: list[ImportIssue], empty_cells: list[_EmptyCellIssue]
) -> None:
    """Troca a mensagem de `EMPTY_VALUE` quando a célula tem fórmula sem valor calculado.

    Com `data_only=True`, uma fórmula que o Excel não calculou (ex.: arquivo gerado por outro
    programa) chega como célula vazia. Uma segunda leitura, sem `data_only`, mostra a fórmula (sem
    avaliá-la). Se essa leitura falhar, as mensagens genéricas ficam como estão.
    """
    wanted = {(item.row, item.column) for item in empty_cells}
    last_row = max(row for row, _ in wanted)
    formulas: set[tuple[int, int]] = set()
    try:
        workbook = _open(content, data_only=False)
    except Exception:  # a primeira leitura funcionou; sem a segunda, só a mensagem é genérica
        return
    try:
        sheet = _first_worksheet(workbook)
        if sheet is None:
            return
        for line, row in _rows(sheet):
            if line > last_row:
                break
            formulas.update(
                (line, index + 1)
                for index, cell in enumerate(row)
                if cell.data_type == "f" and (line, index + 1) in wanted
            )
    except Exception:  # idem
        return
    finally:
        workbook.close()

    for item in empty_cells:
        if (item.row, item.column) not in formulas:
            continue
        issue = issues[item.index]
        reference = f"{get_column_letter(item.column)}{item.row}"
        issues[item.index] = replace(
            issue,
            message=f"fórmula sem valor calculado em '{issue.column}' ({reference}): o arquivo "
            "não traz o resultado da fórmula e as fórmulas não são avaliadas na importação",
        )


def _only(issue: ImportIssue) -> LoadChartParseResult:
    return LoadChartParseResult(points=(), issues=(issue,))


def _malformed(message: str) -> ImportIssue:
    return ImportIssue(code=ImportIssueCode.MALFORMED_FILE, message=message)


def _empty_file() -> ImportIssue:
    return ImportIssue(
        code=ImportIssueCode.EMPTY_FILE,
        message=f"a primeira planilha está vazia: falta o cabeçalho {EXPECTED_HEADER}",
    )


def _describe(error: Exception) -> str:
    detail = str(error).strip()
    return f"{type(error).__name__}: {detail}" if detail else type(error).__name__
