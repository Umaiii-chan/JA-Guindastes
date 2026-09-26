from app.domain.entities.load_chart import LoadChart
from app.domain.services.load_chart_interpolator import LoadChartInterpolator
from app.domain.value_objects.capacity_query import CapacityQuery
from app.domain.value_objects.capacity_result import (
    CapacityFound,
    CapacityResult,
    CapacityUnsupported,
    CapacityUnsupportedReason,
)


class ExactPointLookup(LoadChartInterpolator):
    """Estratégia que só responde para pontos que existem exatamente na tabela.

    Devolve a capacidade apenas quando `boom_length` e `working_radius` da consulta são iguais
    (igualdade exata, sem tolerância) aos de um ponto da tabela. Qualquer outra consulta — entre
    pontos, fora da faixa da tabela, ou com comprimento de lança que a tabela não tem — devolve
    `CapacityUnsupported(POINT_NOT_IN_CHART)`.

    De propósito, NÃO interpola, NÃO arredonda e NÃO escolhe o valor mais conservador vizinho:
    essas regras estão pendentes (PEND-001, PEND-002, PEND-003). Esta é a única resposta segura
    enquanto elas não forem decididas, porque não inventa capacidade (RN-004, RN-007).
    """

    def calculate_capacity(self, chart: LoadChart, query: CapacityQuery) -> CapacityResult:
        point = chart.point_at(query.boom_length, query.working_radius)
        if point is None:
            return CapacityUnsupported(
                reason=CapacityUnsupportedReason.POINT_NOT_IN_CHART,
                load_chart_id=chart.id,
                load_chart_version=chart.version,
            )
        return CapacityFound(
            max_capacity=point.max_capacity,
            load_chart_id=chart.id,
            load_chart_version=chart.version,
        )
