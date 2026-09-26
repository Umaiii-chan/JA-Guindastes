from collections.abc import Iterable

from app.domain.entities.load_chart import LoadChart
from app.domain.entities.load_chart_point import LoadChartPoint
from app.domain.services.load_chart_interpolator import LoadChartInterpolator
from app.domain.value_objects.capacity_query import CapacityQuery
from app.domain.value_objects.capacity_result import (
    CapacityResult,
    CapacityUnsupported,
    CapacityUnsupportedReason,
)
from app.domain.value_objects.conservative_capacity_result import ConservativeCapacityFound
from app.domain.value_objects.length import Length

NUMERIC_TOLERANCE_M = 1e-6
"""ε do ADR-015, em metros: só absorve ruído de ponto flutuante.

Não é tolerância de engenharia nem política de arredondamento (PEND-002): valores que diferem mais
que ε são valores diferentes.
"""


class ConservativeTabulatedLookup(LoadChartInterpolator):
    """Consulta conservadora provisória na tabela de carga (ADR-015).

    Vale até a empresa responder PEND-001 (interpolação) e PEND-003 (valor conservador):

    1. **Comprimento de lança:** precisa coincidir (±ε) com um comprimento tabelado; senão,
       `CapacityUnsupported(BOOM_LENGTH_NOT_IN_CHART)`. Não interpola nem arredonda comprimento
       (ADR-013 C-6).
    2. **Raio**, entre os pontos desse comprimento:
       - igual (±ε) a um raio tabelado → capacidade desse ponto;
       - entre dois raios tabelados → a **menor** capacidade dos dois pontos vizinhos, mesmo que a
         tabela seja atípica e o vizinho de raio maior tenha capacidade maior;
       - abaixo do menor raio ou acima do maior, além de ε →
         `CapacityUnsupported(RADIUS_BELOW_CHART_MIN)` ou `(RADIUS_ABOVE_CHART_MAX)` (RN-007).
    3. O resultado é um `ConservativeCapacityFound`, com o raio consultado, o ponto tabelado usado e
       a marca `CONSERVATIVE_PROVISIONAL`. A capacidade é sempre a de um ponto da tabela: nada é
       interpolado, extrapolado ou inventado (RN-004).

    Tabela com valores distintos a menos de ε entre si (não esperado; ver `handoffs/TASK-020.md`
    § 8): todos os pontos que coincidem (±ε) com a consulta contam, e vale o de menor capacidade.
    Nos empates de capacidade, o ponto informado é o de maior raio.

    Como pede a porta, não escolhe a tabela nem olha o status dela.
    """

    def calculate_capacity(self, chart: LoadChart, query: CapacityQuery) -> CapacityResult:
        column = [
            point for point in chart.points if _coincides(point.boom_length, query.boom_length)
        ]
        if not column:
            return _unsupported(chart, CapacityUnsupportedReason.BOOM_LENGTH_NOT_IN_CHART)

        radius = query.working_radius
        same_radius = [point for point in column if _coincides(point.working_radius, radius)]
        if same_radius:
            return _found(chart, query, _lowest_capacity(same_radius))

        # Sem raio igual (±ε), cada raio tabelado fica, além de ε, abaixo ou acima do consultado.
        smaller = [point.working_radius for point in column if point.working_radius < radius]
        larger = [point.working_radius for point in column if point.working_radius > radius]
        if not smaller:
            return _unsupported(chart, CapacityUnsupportedReason.RADIUS_BELOW_CHART_MIN)
        if not larger:
            return _unsupported(chart, CapacityUnsupportedReason.RADIUS_ABOVE_CHART_MAX)

        neighbor_radii = (max(smaller), min(larger))
        neighbors = [point for point in column if point.working_radius in neighbor_radii]
        return _found(chart, query, _lowest_capacity(neighbors))


def _coincides(tabulated: Length, queried: Length) -> bool:
    return abs(tabulated.meters - queried.meters) <= NUMERIC_TOLERANCE_M


def _lowest_capacity(points: Iterable[LoadChartPoint]) -> LoadChartPoint:
    return min(points, key=lambda point: (point.max_capacity, -point.working_radius.meters))


def _found(chart: LoadChart, query: CapacityQuery, point: LoadChartPoint) -> CapacityResult:
    return ConservativeCapacityFound(
        max_capacity=point.max_capacity,
        load_chart_id=chart.id,
        load_chart_version=chart.version,
        query=query,
        used_point=point,
    )


def _unsupported(chart: LoadChart, reason: CapacityUnsupportedReason) -> CapacityResult:
    return CapacityUnsupported(
        reason=reason, load_chart_id=chart.id, load_chart_version=chart.version
    )
