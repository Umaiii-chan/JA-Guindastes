# FICTÍCIO — tabelas de carga inventadas só para testar a consulta conservadora (TASK-020).
#
# Nenhum número deste arquivo vem de tabela de fabricante nem da doc-fonte. Não use estes valores
# fora dos testes, em demonstração ou como referência de capacidade (ADR-012; known-gaps P-007).
"""Tabelas de carga FICTÍCIAS para os testes da `ConservativeTabulatedLookup` (ADR-015).

- Tabela **típica**: em cada comprimento de lança, a capacidade cai quando o raio cresce.
- Tabela **atípica**: no comprimento de 20 m, o ponto de 11,5 m tem capacidade **maior** que o de
  8 m. Serve para provar que, entre dois pontos, vale a menor capacidade dos vizinhos, e não sempre
  a do próximo raio maior.
"""

from app.domain.entities.load_chart import LoadChart, LoadChartStatus
from tests.fixtures.load_chart_ficticio import point_ficticio

CONFIGURATION_CONSERVADORA_FICTICIA_ID = "CFG-FICTICIA-CONSERVADORA"
LOAD_CHART_CONSERVADOR_FICTICIO_ID = "LC-FICTICIO-CONSERVADOR-001"
LOAD_CHART_CONSERVADOR_FICTICIO_VERSION = "FICTICIO-CONSERVADOR-v1"

# (boom_length_m, working_radius_m, max_capacity_kg) — FICTÍCIO, tabela típica.
POINTS_TIPICOS_FICTICIOS: tuple[tuple[float, float, float], ...] = (
    (20.0, 5.0, 8000.0),
    (20.0, 8.0, 6000.0),
    (20.0, 11.5, 4500.0),
    (20.0, 15.0, 3000.0),
    (30.0, 8.0, 5000.0),
    (30.0, 12.0, 3500.0),
    (30.0, 20.0, 2000.0),
)

# (boom_length_m, working_radius_m, max_capacity_kg) — FICTÍCIO, tabela atípica: entre 8 m e 11,5 m
# o vizinho de raio maior tem capacidade maior (6500 kg > 5000 kg).
POINTS_ATIPICOS_FICTICIOS: tuple[tuple[float, float, float], ...] = (
    (20.0, 5.0, 8000.0),
    (20.0, 8.0, 5000.0),
    (20.0, 11.5, 6500.0),
    (20.0, 15.0, 3000.0),
)


def build_load_chart_conservador_ficticio(
    points: tuple[tuple[float, float, float], ...] = POINTS_TIPICOS_FICTICIOS,
    *,
    version: str = LOAD_CHART_CONSERVADOR_FICTICIO_VERSION,
) -> LoadChart:
    """Monta uma `LoadChart` FICTÍCIA ativa com `points` (padrão: a tabela típica)."""
    return LoadChart(
        id=LOAD_CHART_CONSERVADOR_FICTICIO_ID,
        version=version,
        configuration_id=CONFIGURATION_CONSERVADORA_FICTICIA_ID,
        status=LoadChartStatus.ACTIVE,
        points=tuple(point_ficticio(*values) for values in points),
    )
