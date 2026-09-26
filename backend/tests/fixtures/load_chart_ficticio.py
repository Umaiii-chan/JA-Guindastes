# FICTÍCIO — dados inventados só para testar o mecanismo; não representam capacidade real.
#
# Nenhum número deste arquivo vem de tabela de fabricante nem da doc-fonte. Não use estes valores
# fora dos testes, em demonstração ou como referência de capacidade (ADR-012; known-gaps P-007).
"""Tabela de carga FICTÍCIA para os testes de domínio."""

from app.domain.entities.load_chart import LoadChart, LoadChartStatus
from app.domain.entities.load_chart_point import LoadChartPoint
from app.domain.value_objects.length import Length
from app.domain.value_objects.mass import Mass

LOAD_CHART_FICTICIO_ID = "LC-FICTICIO-001"
LOAD_CHART_FICTICIO_VERSION = "FICTICIO-v1"
CONFIGURATION_FICTICIA_ID = "CFG-FICTICIA-A"

# (boom_length_m, working_radius_m, max_capacity_kg) — FICTÍCIO.
POINTS_FICTICIOS: tuple[tuple[float, float, float], ...] = (
    (10.0, 3.0, 9000.0),
    (10.0, 5.0, 6000.0),
    (10.0, 8.0, 3500.0),
    (20.0, 5.0, 5000.0),
    (20.0, 10.0, 3000.0),
    (20.0, 15.0, 1500.0),
)


def point_ficticio(
    boom_length_m: float, working_radius_m: float, capacity_kg: float
) -> LoadChartPoint:
    """Monta um `LoadChartPoint` FICTÍCIO a partir de números em unidades internas."""
    return LoadChartPoint(
        boom_length=Length(boom_length_m),
        working_radius=Length(working_radius_m),
        max_capacity=Mass(capacity_kg),
    )


def build_load_chart_ficticio(
    points: tuple[LoadChartPoint, ...] | None = None,
    status: LoadChartStatus = LoadChartStatus.ACTIVE,
) -> LoadChart:
    """Monta a `LoadChart` FICTÍCIA; `points` substitui os pontos padrão quando informado."""
    if points is None:
        points = tuple(point_ficticio(*values) for values in POINTS_FICTICIOS)
    return LoadChart(
        id=LOAD_CHART_FICTICIO_ID,
        version=LOAD_CHART_FICTICIO_VERSION,
        configuration_id=CONFIGURATION_FICTICIA_ID,
        status=status,
        points=points,
    )
