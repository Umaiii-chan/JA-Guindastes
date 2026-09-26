"""Schemas Pydantic da validação de importação de tabela de carga (TASK-019; ADR-006).

Ficam na apresentação (ADR-006): o domínio e a aplicação não conhecem Pydantic. Os nomes dos campos
com unidade levam o sufixo da unidade interna (`_m`, `_kg`; RN-006; docs/development-guide.md § 5).
"""

from typing import Literal

from pydantic import BaseModel, Field

from app.application.ports.load_chart_parser import ImportIssue, ImportIssueCode
from app.application.use_cases.validate_load_chart_import import (
    InvalidLoadChartImport,
    LoadChartImportResult,
    ValidLoadChartImport,
)
from app.domain.entities.load_chart_point import LoadChartPoint


class LoadChartPointResponse(BaseModel):
    """Ponto da tabela de carga, em unidades internas (RN-006)."""

    boom_length_m: float = Field(description="Comprimento de lança, em metros.")
    working_radius_m: float = Field(description="Raio de trabalho, em metros.")
    max_capacity_kg: float = Field(description="Capacidade máxima do ponto, em quilogramas.")

    @classmethod
    def from_point(cls, point: LoadChartPoint) -> LoadChartPointResponse:
        return cls(
            boom_length_m=point.boom_length.meters,
            working_radius_m=point.working_radius.meters,
            max_capacity_kg=point.max_capacity.kilograms,
        )


class LoadChartImportIssueResponse(BaseModel):
    """Uma inconsistência do relatório de importação (RNF-006; doc-fonte § 13.1)."""

    code: ImportIssueCode = Field(description="Motivo da inconsistência, legível por máquina.")
    message: str = Field(description="Descrição da inconsistência, legível por pessoa.")
    line: int | None = Field(
        description="Linha física do arquivo, a partir de 1; `null` quando o problema é do arquivo "
        "ou da tabela como um todo."
    )
    column: str | None = Field(
        description="Coluna como está no arquivo (ou o nome esperado, quando ela falta); `null` "
        "quando o problema não é de uma coluna."
    )

    @classmethod
    def from_issue(cls, issue: ImportIssue) -> LoadChartImportIssueResponse:
        return cls(code=issue.code, message=issue.message, line=issue.line, column=issue.column)


class LoadChartValidationResponse(BaseModel):
    """Resultado da validação de uma tabela de carga enviada; nada é gravado nem ativado."""

    chart_id: str = Field(description="Id da tabela de carga, como enviado.")
    version: str = Field(description="Versão da tabela de carga, como enviada (RN-005).")
    configuration_id: str = Field(
        description="Configuração do guindaste à qual a tabela pertence, como enviada (RN-001). "
        "Não se verifica se ela existe: ainda não há persistência."
    )
    status: Literal["DRAFT", "INVALID"] = Field(
        description="`DRAFT` quando não há nenhuma inconsistência; `INVALID` quando há "
        "(doc-fonte § 13.2). Nunca `VALIDATED` nem `ACTIVE`: esta rota não ativa a tabela."
    )
    point_count: int = Field(description="Quantidade de pontos em `points`.")
    points: list[LoadChartPointResponse] = Field(
        description="Pontos da tabela em `DRAFT`, na ordem do arquivo. Sempre vazio quando o "
        "status é `INVALID`: uma importação inválida não produz tabela, nem parcial."
    )
    issues: list[LoadChartImportIssueResponse] = Field(
        description="Relatório de inconsistências, com os problemas do arquivo ou da tabela "
        "primeiro e depois pela linha. Vazio quando o status é `DRAFT`."
    )

    @classmethod
    def from_result(cls, result: LoadChartImportResult) -> LoadChartValidationResponse:
        match result:
            case ValidLoadChartImport(chart=chart):
                points = [LoadChartPointResponse.from_point(point) for point in chart.points]
                return cls(
                    chart_id=chart.id,
                    version=chart.version,
                    configuration_id=chart.configuration_id,
                    status="DRAFT",
                    point_count=len(points),
                    points=points,
                    issues=[],
                )
            case InvalidLoadChartImport():
                return cls(
                    chart_id=result.load_chart_id,
                    version=result.version,
                    configuration_id=result.configuration_id,
                    status="INVALID",
                    point_count=0,
                    points=[],
                    issues=[LoadChartImportIssueResponse.from_issue(i) for i in result.issues],
                )
