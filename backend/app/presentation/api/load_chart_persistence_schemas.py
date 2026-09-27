"""Schemas Pydantic da importação com gravação, da ativação (TASK-031) e da listagem por
configuração (TASK-044) de tabelas de carga.

Ficam na apresentação (ADR-006). Os pontos reusam `LoadChartPointResponse` (TASK-019), com o sufixo
da unidade interna nos nomes (RN-006).
"""

from pydantic import BaseModel, Field

from app.application.ports.load_chart_listing import LoadChartSummary
from app.application.ports.load_chart_repository import LoadChartSource, StoredLoadChart
from app.application.use_cases.activate_load_chart import LoadChartActivation
from app.application.use_cases.list_configuration_load_charts import ConfigurationLoadCharts
from app.domain.entities.load_chart import LoadChartStatus
from app.presentation.api.load_chart_schemas import LoadChartPointResponse


class LoadChartSourceResponse(BaseModel):
    """Metadados do arquivo-fonte guardado (RF-008, RNF-005; doc-fonte § 19.2)."""

    file_name: str = Field(description="Nome do arquivo como foi enviado.")
    file_type: str = Field(
        description="Tipo de conteúdo enviado com o arquivo, sem parâmetros; "
        "`application/octet-stream` quando não informado."
    )
    sha256: str = Field(description="SHA-256 do conteúdo, em 64 dígitos hexadecimais minúsculos.")
    uri: str | None = Field(
        description="Onde o arquivo original foi guardado (ex.: `local://<sha256>`)."
    )

    @classmethod
    def from_source(cls, source: LoadChartSource) -> LoadChartSourceResponse:
        return cls(
            file_name=source.file_name,
            file_type=source.file_type,
            sha256=source.sha256,
            uri=source.uri,
        )


class LoadChartResponse(BaseModel):
    """Tabela de carga gravada, com os pontos e os metadados de origem."""

    chart_id: str = Field(description="Id da tabela de carga.")
    version: str = Field(description="Versão da tabela de carga (RN-005).")
    configuration_id: str = Field(description="Configuração do guindaste (RN-001).")
    status: LoadChartStatus = Field(description="Status da tabela (doc-fonte § 13.2).")
    point_count: int = Field(description="Quantidade de pontos em `points`.")
    points: list[LoadChartPointResponse] = Field(
        description="Pontos da tabela, na ordem em que foram importados."
    )
    source: LoadChartSourceResponse = Field(description="Arquivo-fonte da tabela.")

    @classmethod
    def from_stored(cls, stored: StoredLoadChart) -> LoadChartResponse:
        chart = stored.chart
        points = [LoadChartPointResponse.from_point(point) for point in chart.points]
        return cls(
            chart_id=chart.id,
            version=chart.version,
            configuration_id=chart.configuration_id,
            status=chart.status,
            point_count=len(points),
            points=points,
            source=LoadChartSourceResponse.from_source(stored.source),
        )


class LoadChartSummaryResponse(BaseModel):
    """Tabela na listagem da configuração (TASK-044): o `LoadChartResponse` sem `points`."""

    chart_id: str = Field(description="Id da tabela de carga.")
    version: str = Field(description="Versão da tabela de carga (RN-005).")
    configuration_id: str = Field(description="Configuração do guindaste (RN-001).")
    status: LoadChartStatus = Field(description="Status da tabela (doc-fonte § 13.2).")
    point_count: int = Field(description="Quantidade de pontos da tabela.")
    source: LoadChartSourceResponse = Field(description="Arquivo-fonte da tabela.")

    @classmethod
    def from_summary(cls, summary: LoadChartSummary) -> LoadChartSummaryResponse:
        return cls(
            chart_id=summary.load_chart_id,
            version=summary.version,
            configuration_id=summary.configuration_id,
            status=summary.status,
            point_count=summary.point_count,
            source=LoadChartSourceResponse.from_source(summary.source),
        )


class ConfigurationLoadChartsResponse(BaseModel):
    """Tabelas de carga de uma configuração, com a ativa (TASK-044)."""

    items: list[LoadChartSummaryResponse] = Field(
        description="Todas as tabelas da configuração, em qualquer status. Ordem: pela versão, da "
        "maior para a menor, em ordem natural (trechos numéricos comparados como números; `v10` "
        "antes de `v9`), e, na mesma versão, pelo `chart_id` decrescente. Não há data de "
        "importação gravada, então a ordem não é a da importação."
    )
    active_chart_id: str | None = Field(
        description="Id da tabela `ACTIVE` da configuração, ou `null` se nenhuma está ativa."
    )

    @classmethod
    def from_result(cls, result: ConfigurationLoadCharts) -> ConfigurationLoadChartsResponse:
        return cls(
            items=[LoadChartSummaryResponse.from_summary(item) for item in result.items],
            active_chart_id=result.active_load_chart_id,
        )


class LoadChartActivationResponse(LoadChartResponse):
    """Tabela ativada, com o id da tabela que deixou de ser a `ACTIVE` da configuração."""

    superseded_chart_id: str | None = Field(
        description="Id da tabela que era `ACTIVE` na configuração e passou a `SUPERSEDED` na "
        "mesma transação; `null` se não havia tabela ativa."
    )

    @classmethod
    def from_activation(cls, activation: LoadChartActivation) -> LoadChartActivationResponse:
        base = LoadChartResponse.from_stored(activation.stored)
        return cls(**base.model_dump(), superseded_chart_id=activation.superseded_load_chart_id)
