"""Leitura de tabela de carga em CSV no formato canônico interno PROVISÓRIO (TASK-010).

PROVISÓRIO: o formato real das tabelas da empresa não é conhecido (PEND-008) e o formato canônico
interno de importação continua em aberto (known-gaps P-006). Este formato foi definido pela pessoa
responsável só para a PoC da TASK-010 e pode mudar quando a tabela oficial chegar.

Formato definido pela pessoa responsável:
- UTF-8, separador vírgula, decimal ponto;
- cabeçalho obrigatório com as colunas `boom_length_m`, `working_radius_m` e `max_capacity_kg`;
- a unidade vem do sufixo do nome da coluna; coluna com sufixo desconhecido, sem sufixo ou
  ausente é inconsistência. Só as unidades internas são reconhecidas (`m` e `kg`, RN-006): não há
  conversão de unidade (doc-fonte § 26, pergunta 10).

Detalhes escolhidos na TASK-010 (registrados em `handoffs/TASK-010.md` § 5):
- o BOM de UTF-8 no início é aceito e ignorado (o Excel costuma gravá-lo);
- o cabeçalho é a primeira linha não vazia; as colunas podem vir em qualquer ordem; espaços em
  volta dos nomes são ignorados; maiúsculas e minúsculas contam;
- coluna repetida ou desconhecida é inconsistência (não é ignorada em silêncio);
- se alguma coluna obrigatória não pode ser usada, só o cabeçalho é reportado;
- linhas sem nenhum valor (vazias, só espaços ou só vírgulas) são ignoradas; linha com número de
  campos diferente do cabeçalho é inconsistência;
- número: dígitos ASCII, sinal opcional e parte decimal opcional após o ponto (`12`, `12.5`,
  `-3.0`); sem expoente, sem separador de milhar, sem vírgula decimal; espaços em volta são
  ignorados;
- o número da linha é o da linha física do arquivo (o cabeçalho costuma ser a linha 1).
"""

import csv
import io
import math
import re
from collections.abc import Callable, Iterator

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

DELIMITER = ","

# Grandeza (nome da coluna sem o sufixo) → única unidade aceita, a interna (RN-006).
EXPECTED_UNITS: dict[str, str] = {
    "boom_length": "m",
    "working_radius": "m",
    "max_capacity": "kg",
}
EXPECTED_HEADER = DELIMITER.join(f"{quantity}_{unit}" for quantity, unit in EXPECTED_UNITS.items())

_NUMBER = re.compile(r"[+-]?[0-9]+(?:\.[0-9]+)?")
_NON_FINITE_WORDS = frozenset({"nan", "inf", "infinity"})
_OTHER_DELIMITERS = (";", "\t")


class CsvLoadChartParser(LoadChartParser):
    """Adapter de `LoadChartParser` para CSV, só com a biblioteca padrão (`csv`).

    Nunca levanta exceção por problema no conteúdo: devolve os pontos válidos e todas as
    inconsistências encontradas. Um CSV malformado (ex.: aspas não fechadas) interrompe a leitura
    no ponto do erro, e o que foi lido até ali continua no resultado.
    """

    def parse(self, content: bytes) -> LoadChartParseResult:
        try:
            text = content.decode("utf-8-sig")
        except UnicodeDecodeError as error:
            line = content[: error.start].count(b"\n") + 1
            return _only(
                ImportIssue(
                    code=ImportIssueCode.INVALID_ENCODING,
                    message=f"o arquivo deve estar em UTF-8 (byte inválido na linha {line})",
                    line=line,
                )
            )

        reader = csv.reader(io.StringIO(text, newline=""), delimiter=DELIMITER, strict=True)
        points: list[ParsedLoadChartPoint] = []
        issues: list[ImportIssue] = []
        try:
            header = _first_non_blank_row(reader)
            if header is None:
                return _only(
                    ImportIssue(
                        code=ImportIssueCode.EMPTY_FILE,
                        message=f"o arquivo está vazio: falta o cabeçalho {EXPECTED_HEADER}",
                    )
                )
            header_line = reader.line_num
            names = [name.strip() for name in header]
            columns = _read_header(names, header_line, issues)
            if columns is None:
                return LoadChartParseResult(points=(), issues=tuple(issues))

            for row in reader:
                if _is_blank(row):
                    continue
                point = _read_row(row, reader.line_num, names, columns, issues)
                if point is not None:
                    points.append(point)
        except csv.Error as error:
            issues.append(
                ImportIssue(
                    code=ImportIssueCode.MALFORMED_FILE,
                    message=f"CSV malformado, leitura interrompida: {error}",
                    line=reader.line_num,
                )
            )
        return LoadChartParseResult(points=tuple(points), issues=tuple(issues))


def _only(issue: ImportIssue) -> LoadChartParseResult:
    return LoadChartParseResult(points=(), issues=(issue,))


def _is_blank(row: list[str]) -> bool:
    """Linha sem nenhum valor: vazia, só espaços ou só vírgulas (o Excel grava `,,`)."""
    return all(not field.strip() for field in row)


def _first_non_blank_row(rows: Iterator[list[str]]) -> list[str] | None:
    for row in rows:
        if not _is_blank(row):
            return row
    return None


def _split_column_name(name: str) -> tuple[str | None, str | None]:
    """Separa `<grandeza>_<unidade>`; devolve `(None, None)` se a grandeza não é conhecida."""
    for quantity in EXPECTED_UNITS:
        if name == quantity:
            return quantity, None
        if name.startswith(f"{quantity}_"):
            return quantity, name.removeprefix(f"{quantity}_") or None
    return None, None


def _read_header(names: list[str], line: int, issues: list[ImportIssue]) -> dict[str, int] | None:
    """Mapeia cada grandeza ao índice da sua coluna, acrescentando os problemas a `issues`.

    Devolve `None` quando alguma coluna obrigatória não pode ser usada.
    """
    if len(names) == 1 and any(other in names[0] for other in _OTHER_DELIMITERS):
        issues.append(
            ImportIssue(
                code=ImportIssueCode.UNSUPPORTED_DELIMITER,
                message="o separador de campos deve ser vírgula; o cabeçalho parece usar "
                "ponto e vírgula ou tabulação",
                line=line,
            )
        )
        return None

    columns: dict[str, int] = {}
    referenced: set[str] = set()
    seen: set[str] = set()
    for index, name in enumerate(names):
        if name in seen:
            issues.append(
                ImportIssue(
                    code=ImportIssueCode.DUPLICATE_COLUMN,
                    message=f"a coluna '{name}' aparece mais de uma vez no cabeçalho",
                    line=line,
                    column=name,
                )
            )
            continue
        seen.add(name)

        quantity, unit = _split_column_name(name)
        if quantity is None:
            issues.append(
                ImportIssue(
                    code=ImportIssueCode.UNKNOWN_COLUMN,
                    message=(
                        f"coluna desconhecida: '{name}'" if name else "coluna sem nome no cabeçalho"
                    ),
                    line=line,
                    column=name,
                )
            )
            continue

        referenced.add(quantity)
        expected_unit = EXPECTED_UNITS[quantity]
        if unit is None:
            issues.append(
                ImportIssue(
                    code=ImportIssueCode.MISSING_UNIT,
                    message=f"a coluna '{name}' não tem sufixo de unidade; "
                    f"use '{quantity}_{expected_unit}'",
                    line=line,
                    column=name,
                )
            )
        elif unit != expected_unit:
            issues.append(
                ImportIssue(
                    code=ImportIssueCode.UNRECOGNIZED_UNIT,
                    message=f"unidade '{unit}' não reconhecida em '{name}'; o formato provisório "
                    f"aceita só '{expected_unit}' (sem conversão de unidade)",
                    line=line,
                    column=name,
                )
            )
        else:
            columns[quantity] = index

    for quantity, expected_unit in EXPECTED_UNITS.items():
        if quantity not in referenced:
            expected_name = f"{quantity}_{expected_unit}"
            issues.append(
                ImportIssue(
                    code=ImportIssueCode.MISSING_COLUMN,
                    message=f"coluna obrigatória ausente: '{expected_name}'",
                    line=line,
                    column=expected_name,
                )
            )

    return columns if len(columns) == len(EXPECTED_UNITS) else None


def _read_row(
    row: list[str],
    line: int,
    names: list[str],
    columns: dict[str, int],
    issues: list[ImportIssue],
) -> ParsedLoadChartPoint | None:
    """Lê uma linha de dados; devolve o ponto, ou `None` e acrescenta as inconsistências."""
    if len(row) != len(names):
        issues.append(
            ImportIssue(
                code=ImportIssueCode.WRONG_FIELD_COUNT,
                message=f"a linha tem {len(row)} campo(s), mas o cabeçalho tem {len(names)}",
                line=line,
            )
        )
        return None

    def cell[Q](quantity: str, factory: Callable[[float], Q]) -> Q | None:
        index = columns[quantity]
        return _read_cell(row[index], line, names[index], factory, issues)

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


def _read_cell[Q](
    raw: str,
    line: int,
    column: str,
    factory: Callable[[float], Q],
    issues: list[ImportIssue],
) -> Q | None:
    """Converte o texto de uma célula na grandeza do domínio, ou reporta o motivo."""
    text = raw.strip()

    def report(code: ImportIssueCode, message: str) -> None:
        issues.append(ImportIssue(code=code, message=message, line=line, column=column))

    if not text:
        report(ImportIssueCode.EMPTY_VALUE, f"valor obrigatório vazio em '{column}'")
        return None
    if _NUMBER.fullmatch(text) is None:
        if text.lstrip("+-").lower() in _NON_FINITE_WORDS:
            report(
                ImportIssueCode.NON_FINITE_NUMBER,
                f"valor não finito em '{column}': '{text}' (NaN e infinito não são aceitos)",
            )
        else:
            report(
                ImportIssueCode.INVALID_NUMBER,
                f"valor não numérico em '{column}': '{text}' (use ponto como separador "
                "decimal, sem separador de milhar nem expoente)",
            )
        return None

    value = float(text)
    if not math.isfinite(value):
        report(ImportIssueCode.NON_FINITE_NUMBER, f"valor grande demais em '{column}': '{text}'")
        return None
    try:
        return factory(value)
    except InvalidQuantityError as error:
        if value < 0:
            report(
                ImportIssueCode.NEGATIVE_VALUE,
                f"valor negativo em '{column}': '{text}' (comprimentos, raios e capacidades "
                "não podem ser negativos)",
            )
        else:
            report(ImportIssueCode.INVALID_NUMBER, f"valor inválido em '{column}': {error}")
        return None
