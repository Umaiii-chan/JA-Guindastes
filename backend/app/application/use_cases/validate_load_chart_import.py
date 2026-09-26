"""Caso de uso `ValidateLoadChartImport` (doc-fonte §§ 11.1 e 13; RF-006, RF-009, RNF-006).

Lê o arquivo com um `LoadChartParser`, junta as inconsistências do formato com as que valem para
qualquer formato e devolve uma `LoadChart` em `DRAFT` ou o relatório com status `INVALID`
(doc-fonte § 13.2). Não persiste nada, não ativa a tabela e não verifica se a configuração existe
(isso depende da persistência).
"""

from collections import defaultdict
from dataclasses import dataclass

from app.application.ports.load_chart_parser import (
    ImportIssue,
    ImportIssueCode,
    LoadChartParser,
    ParsedLoadChartPoint,
)
from app.domain.entities.load_chart import LoadChart, LoadChartStatus
from app.domain.value_objects.length import Length


@dataclass(frozen=True)
class ValidLoadChartImport:
    """Importação sem inconsistências: a tabela montada, sempre em `DRAFT`."""

    chart: LoadChart

    @property
    def status(self) -> LoadChartStatus:
        return self.chart.status


@dataclass(frozen=True)
class InvalidLoadChartImport:
    """Importação com inconsistências: só o relatório, sem tabela (doc-fonte § 13.2, `INVALID`).

    Não há `LoadChart` aqui de propósito: quem recebe este resultado não tem pontos para usar por
    engano. `issues` vem ordenado pela linha, com os problemas do arquivo/tabela primeiro.
    """

    load_chart_id: str
    version: str
    configuration_id: str
    issues: tuple[ImportIssue, ...]

    @property
    def status(self) -> LoadChartStatus:
        return LoadChartStatus.INVALID


type LoadChartImportResult = ValidLoadChartImport | InvalidLoadChartImport


class ValidateLoadChartImport:
    """Valida o conteúdo de uma tabela de carga importada e monta a `LoadChart` em `DRAFT`.

    Status possíveis do resultado: `DRAFT` (sem nenhuma inconsistência) ou `INVALID` (com o
    relatório). Nunca `VALIDATED` nem `ACTIVE`: as transições da doc-fonte § 13.2 não estão
    definidas e ficam para outra tarefa.
    """

    def __init__(self, parser: LoadChartParser) -> None:
        self._parser = parser

    def execute(
        self,
        content: bytes,
        *,
        load_chart_id: str,
        version: str,
        configuration_id: str,
    ) -> LoadChartImportResult:
        parsed = self._parser.parse(content)

        issues = [
            *_metadata_issues(
                load_chart_id=load_chart_id, version=version, configuration_id=configuration_id
            ),
            *parsed.issues,
            *_conflicting_point_issues(parsed.points),
        ]
        if not parsed.points:
            issues.append(
                ImportIssue(
                    code=ImportIssueCode.NO_POINTS,
                    message="a importação não produziu nenhum ponto válido da tabela de carga",
                )
            )

        if issues:
            return InvalidLoadChartImport(
                load_chart_id=load_chart_id,
                version=version,
                configuration_id=configuration_id,
                issues=_sorted_by_line(issues),
            )

        chart = LoadChart(
            id=load_chart_id,
            version=version,
            configuration_id=configuration_id,
            status=LoadChartStatus.DRAFT,
            points=tuple(parsed_point.point for parsed_point in parsed.points),
        )
        return ValidLoadChartImport(chart=chart)


def _metadata_issues(
    *, load_chart_id: str, version: str, configuration_id: str
) -> list[ImportIssue]:
    """Doc-fonte § 13.1 ("versão/origem informadas"); RN-001 (configuração) e RN-005 (versão)."""
    return [
        ImportIssue(code=ImportIssueCode.MISSING_METADATA, message=message)
        for value, message in (
            (load_chart_id, "o id da tabela de carga deve ser informado"),
            (version, "a versão da tabela de carga deve ser informada (RN-005)"),
            (configuration_id, "a configuração da tabela de carga deve ser informada (RN-001)"),
        )
        if not value.strip()
    ]


def _conflicting_point_issues(points: tuple[ParsedLoadChartPoint, ...]) -> list[ImportIssue]:
    """Uma inconsistência por linha de cada grupo de pontos conflitantes (doc-fonte § 13.1).

    Um grupo é conflitante quando o mesmo `boom_length` e `working_radius` aparece com mais de uma
    capacidade. Todas as linhas do grupo são reportadas, inclusive as que repetem uma das
    capacidades, porque não há como saber qual delas é a correta. Pontos repetidos com a mesma
    capacidade, sem conflito, são aceitos, como na `LoadChart` (TASK-008).
    """
    groups: defaultdict[tuple[Length, Length], list[ParsedLoadChartPoint]] = defaultdict(list)
    for parsed_point in points:
        point = parsed_point.point
        groups[(point.boom_length, point.working_radius)].append(parsed_point)

    issues: list[ImportIssue] = []
    for (boom_length, working_radius), group in groups.items():
        if len({parsed_point.point.max_capacity for parsed_point in group}) < 2:
            continue
        lines = ", ".join(str(parsed_point.line) for parsed_point in group)
        message = (
            f"pontos conflitantes: boom_length={boom_length.meters} m e "
            f"working_radius={working_radius.meters} m aparecem com capacidades diferentes "
            f"nas linhas {lines}"
        )
        issues.extend(
            ImportIssue(
                code=ImportIssueCode.CONFLICTING_POINTS, message=message, line=parsed_point.line
            )
            for parsed_point in group
        )
    return issues


def _sorted_by_line(issues: list[ImportIssue]) -> tuple[ImportIssue, ...]:
    """Problemas sem linha (arquivo/tabela) primeiro; depois pela linha, estável."""
    return tuple(sorted(issues, key=lambda issue: (issue.line is not None, issue.line or 0)))
