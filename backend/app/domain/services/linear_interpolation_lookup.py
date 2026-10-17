from app.domain.entities.load_chart import LoadChart
from app.domain.entities.load_chart_point import LoadChartPoint
from app.domain.services.conservative_tabulated_lookup import NUMERIC_TOLERANCE_M
from app.domain.services.load_chart_interpolator import LoadChartInterpolator
from app.domain.value_objects.capacity_query import CapacityQuery
from app.domain.value_objects.capacity_result import (
    CapacityResult,
    CapacityUnsupported,
    CapacityUnsupportedReason,
)
from app.domain.value_objects.interpolated_capacity_result import InterpolatedCapacityFound
from app.domain.value_objects.mass import Mass


class LinearInterpolationLookup(LoadChartInterpolator):
    """Interpolação linear provisória no raio da tabela de carga (ADR-030 e ADR-043; TASK-059, 096).

    Decisão da pessoa responsável em 2026-10-14, para a simulação variar de forma contínua, como
    no limitador de carga da cabine. Provisória até a empresa responder PEND-001.

    1. **Comprimento de lança** (ADR-043, que substitui o item 2 do ADR-030): igual (±ε) a uma
       coluna → essa coluna; entre duas colunas, ou abaixo da menor → a coluna da **próxima lança
       mais longa**, como manda a nota padrão das tabelas de fabricante (a mesma regra do ADR-029).
       O comprimento não é interpolado. Acima da maior coluna → `BOOM_LENGTH_ABOVE_CHART_MAX`.
    2. **Raio**, dentro da coluna escolhida: igual (±ε) a um raio tabelado → o ponto; entre dois
       raios → interpolação linear entre os dois; abaixo do menor ou acima do maior →
       `RADIUS_BELOW_CHART_MIN` / `RADIUS_ABOVE_CHART_MAX` (RN-007).
    3. Não extrapola: o valor fica sempre entre capacidades tabeladas (RN-004).

    A curva de capacidade costuma ser convexa, então a reta entre dois raios pode ficar um pouco
    acima da capacidade real entre eles. Por isso o resultado vem marcado como interpolado e
    provisório (`LINEAR_INTERPOLATION_PROVISIONAL`).
    """

    def calculate_capacity(self, chart: LoadChart, query: CapacityQuery) -> CapacityResult:
        if not chart.points:
            return _unsupported(chart, CapacityUnsupportedReason.BOOM_LENGTH_NOT_IN_CHART)
        length = query.boom_length.meters
        lengths = sorted({point.boom_length.meters for point in chart.points})
        if length > lengths[-1] + NUMERIC_TOLERANCE_M:
            return _unsupported(chart, CapacityUnsupportedReason.BOOM_LENGTH_ABOVE_CHART_MAX)

        exact = [value for value in lengths if abs(value - length) <= NUMERIC_TOLERANCE_M]
        # ADR-043: entre colunas (ou abaixo da menor), a próxima lança mais longa.
        column = exact[0] if exact else min(value for value in lengths if value > length)

        in_column = _interpolate_radius(chart, column, query.working_radius.meters)
        if isinstance(in_column, CapacityUnsupportedReason):
            return _unsupported(chart, in_column)
        capacity, points = in_column

        return InterpolatedCapacityFound(
            max_capacity=Mass(capacity),
            load_chart_id=chart.id,
            load_chart_version=chart.version,
            query=query,
            points=points,
        )


def _interpolate_radius(
    chart: LoadChart, column: float, radius: float
) -> tuple[float, tuple[LoadChartPoint, ...]] | CapacityUnsupportedReason:
    points = sorted(
        (
            point
            for point in chart.points
            if abs(point.boom_length.meters - column) <= NUMERIC_TOLERANCE_M
        ),
        key=_radius,
    )
    same = [p for p in points if abs(_radius(p) - radius) <= NUMERIC_TOLERANCE_M]
    if same:
        lowest = min(same, key=lambda point: point.max_capacity.kilograms)
        return lowest.max_capacity.kilograms, (lowest,)
    if radius < _radius(points[0]):
        return CapacityUnsupportedReason.RADIUS_BELOW_CHART_MIN
    if radius > _radius(points[-1]):
        return CapacityUnsupportedReason.RADIUS_ABOVE_CHART_MAX
    below = max((p for p in points if _radius(p) < radius), key=_radius)
    above = min((p for p in points if _radius(p) > radius), key=_radius)
    fraction = (radius - _radius(below)) / (_radius(above) - _radius(below))
    low, high = below.max_capacity.kilograms, above.max_capacity.kilograms
    return low + (high - low) * fraction, (below, above)


def _radius(point: LoadChartPoint) -> float:
    return point.working_radius.meters


def _unsupported(chart: LoadChart, reason: CapacityUnsupportedReason) -> CapacityResult:
    return CapacityUnsupported(
        reason=reason, load_chart_id=chart.id, load_chart_version=chart.version
    )
