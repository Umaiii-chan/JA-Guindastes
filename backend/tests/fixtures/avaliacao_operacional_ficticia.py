# FICTÍCIO — tabela de carga inventada só para testar o caso de uso de avaliação (TASK-015).
#
# Nenhum número deste arquivo vem de tabela de fabricante nem da doc-fonte. Não use estes valores
# fora dos testes, em demonstração ou como referência de capacidade (ADR-012; known-gaps P-007).
"""Configuração e tabela de carga FICTÍCIAS para os testes do `EvaluateOperation`.

Os raios da tabela foram escolhidos para serem alcançados pela ficha técnica FICTÍCIA de
`tests/fixtures/crane_geometry_ficticia.py` (a = 1,5 m) com a lança horizontal (θ = 0°): nesse caso
R = a + L·cos 0° = 1,5 + L, e a conta dá o mesmo número em ponto flutuante, porque cos 0° = 1
exatamente. Com qualquer outro ângulo o raio calculado quase nunca coincide com um raio tabelado,
e a busca exata não encontra o ponto (limitação conhecida, ver `handoffs/TASK-015.md`).
"""

from app.domain.entities.load_chart import LoadChart, LoadChartStatus
from tests.fixtures.load_chart_ficticio import point_ficticio

CONFIGURATION_AVALIACAO_FICTICIA_ID = "CFG-FICTICIA-AVALIACAO"
LOAD_CHART_AVALIACAO_FICTICIO_ID = "LC-FICTICIO-AVALIACAO-001"
LOAD_CHART_AVALIACAO_FICTICIO_VERSION = "FICTICIO-AVALIACAO-v1"

# (boom_length_m, working_radius_m, max_capacity_kg) — FICTÍCIO.
POINTS_AVALIACAO_FICTICIOS: tuple[tuple[float, float, float], ...] = (
    (10.0, 11.5, 4000.0),  # L = 10 m e θ = 0° → R = 1,5 + 10 = 11,5 m
    (20.0, 21.5, 2000.0),  # L = 20 m e θ = 0° → R = 1,5 + 20 = 21,5 m
    (20.0, 11.5, 5000.0),  # L = 20 m e θ = 60° → R = 1,5 + 20·(1/2) = 11,5 m, só na conta à mão
    (30.0, 31.5, 0.0),  # capacidade 0 kg FICTÍCIA: significado em aberto (TASK-008, pendência 4)
)


def build_load_chart_avaliacao_ficticio(
    *,
    version: str = LOAD_CHART_AVALIACAO_FICTICIO_VERSION,
    configuration_id: str = CONFIGURATION_AVALIACAO_FICTICIA_ID,
    status: LoadChartStatus = LoadChartStatus.ACTIVE,
) -> LoadChart:
    """Monta a `LoadChart` FICTÍCIA da avaliação; cada argumento substitui um valor padrão."""
    return LoadChart(
        id=LOAD_CHART_AVALIACAO_FICTICIO_ID,
        version=version,
        configuration_id=configuration_id,
        status=status,
        points=tuple(point_ficticio(*values) for values in POINTS_AVALIACAO_FICTICIOS),
    )
