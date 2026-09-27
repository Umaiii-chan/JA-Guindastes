"""Porta de listagem das tabelas de carga de uma configuração (TASK-044; ADR-009; RN-001).

A `LoadChartRepository` (TASK-022) grava e lê uma tabela por id, com todos os pontos. A linha do
tempo de versões e o detalhe do catálogo precisam de todas as tabelas de uma configuração, com o
status, mas sem os pontos: a listagem devolve um resumo (`LoadChartSummary`) e fica numa porta à
parte, para não obrigar os adapters e fakes que só cumprem a `LoadChartRepository` a implementá-la.
"""

from dataclasses import dataclass
from typing import Protocol

from app.application.ports.load_chart_repository import LoadChartSource
from app.domain.entities.load_chart import LoadChartStatus


@dataclass(frozen=True)
class LoadChartSummary:
    """Tabela de carga gravada, sem os pontos: cabeçalho, quantidade de pontos e origem."""

    load_chart_id: str
    version: str
    configuration_id: str
    status: LoadChartStatus
    point_count: int
    source: LoadChartSource

    def __post_init__(self) -> None:
        if not isinstance(self.point_count, int) or self.point_count < 0:
            raise ValueError(f"point_count deve ser inteiro ≥ 0, recebido {self.point_count!r}")


class LoadChartListing(Protocol):
    """Lista as tabelas de carga gravadas de uma configuração.

    Contrato de toda implementação:
    - devolve uma lista nova com todas as tabelas da configuração, em qualquer status;
    - devolve lista vazia quando a configuração não tem tabelas ou não existe, sem levantar
      exceção por isso (quem precisa distinguir consulta o catálogo);
    - a ordem não faz parte do contrato: quem ordena é o caso de uso.
    """

    def list_by_configuration(self, configuration_id: str) -> list[LoadChartSummary]: ...
