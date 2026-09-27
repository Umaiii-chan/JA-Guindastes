"""`EvaluateOperation` com a `ConservativeTabulatedLookup` injetada (ADR-015; TASK-020).

O caso de uso não muda: só a estratégia injetada pela porta `LoadChartInterpolator`. Dados
FICTÍCIOS (ADR-012): a ficha técnica de `tests/fixtures/crane_geometry_ficticia.py` (a = 1,5 m) e a
tabela de `tests/fixtures/avaliacao_operacional_ficticia.py`, que tem, para L = 20 m, os pontos
(11,5 m; 5000 kg) e (21,5 m; 2000 kg). O raio é R = a + L·cos θ (ADR-013).
"""

import math
from collections.abc import Mapping

import pytest

from app.application.use_cases.evaluate_operation import (
    EvaluatedOperation,
    EvaluateOperation,
    NotEvaluableOperation,
    OperationEvaluation,
)
from app.domain.entities.load_chart import LoadChart
from app.domain.services.conservative_tabulated_lookup import ConservativeTabulatedLookup
from app.domain.value_objects.capacity_result import CapacityUnsupported, CapacityUnsupportedReason
from app.domain.value_objects.conservative_capacity_result import (
    CapacityLookupStrategy,
    ConservativeCapacityFound,
)
from app.domain.value_objects.crane_geometry import CraneGeometry
from app.domain.value_objects.length import Length
from app.domain.value_objects.mass import Mass
from tests.fixtures.avaliacao_operacional_ficticia import (
    CONFIGURATION_AVALIACAO_FICTICIA_ID,
    LOAD_CHART_AVALIACAO_FICTICIO_ID,
    LOAD_CHART_AVALIACAO_FICTICIO_VERSION,
    build_load_chart_avaliacao_ficticio,
)
from tests.fixtures.crane_geometry_ficticia import build_crane_geometry_ficticia, state_ficticio
from tests.fixtures.load_chart_ficticio import point_ficticio

# Tolerância só para conferir o raio calculado com a conta à mão; não é o ε da consulta.
TOLERANCE_M = 1e-9


class FakeCraneGeometryProvider:
    def __init__(self, geometries: Mapping[str, CraneGeometry]) -> None:
        self._geometries = dict(geometries)

    def get_crane_geometry(self, configuration_id: str) -> CraneGeometry | None:
        return self._geometries.get(configuration_id)


class FakeActiveLoadChartProvider:
    def __init__(self, charts: Mapping[str, LoadChart]) -> None:
        self._charts = dict(charts)

    def get_active_load_chart(
        self, configuration_id: str, rotation_zone_code: str | None = None
    ) -> LoadChart | None:
        return self._charts.get(configuration_id)


def evaluate_ficticio(
    *, boom_length_m: float, boom_angle_deg: float, load_kg: float
) -> OperationEvaluation:
    use_case = EvaluateOperation(
        crane_geometry_provider=FakeCraneGeometryProvider(
            {CONFIGURATION_AVALIACAO_FICTICIA_ID: build_crane_geometry_ficticia()}
        ),
        active_load_chart_provider=FakeActiveLoadChartProvider(
            {CONFIGURATION_AVALIACAO_FICTICIA_ID: build_load_chart_avaliacao_ficticio()}
        ),
        load_chart_interpolator=ConservativeTabulatedLookup(),
    )
    return use_case.execute(
        configuration_id=CONFIGURATION_AVALIACAO_FICTICIA_ID,
        state=state_ficticio(
            boom_length_m=boom_length_m, boom_angle_deg=boom_angle_deg, cable_length_m=1.0
        ),
        load_weight=Mass(load_kg),
    )


def test_ficticio_radius_between_chart_points_is_evaluated_with_the_lower_capacity_neighbor() -> (
    None
):
    # L = 20 m, θ = 30° → R = 1,5 + 20·(√3/2) = 1,5 + 10√3 ≈ 18,82 m, entre 11,5 m (5000 kg) e
    # 21,5 m (2000 kg): vale o menor, 2000 kg (ADR-015). Carga FICTÍCIA de 1500 kg → 75 %.
    result = evaluate_ficticio(boom_length_m=20.0, boom_angle_deg=30.0, load_kg=1500.0)

    assert isinstance(result, EvaluatedOperation)
    assert result.geometry.working_radius.meters == pytest.approx(
        1.5 + 10 * math.sqrt(3), abs=TOLERANCE_M
    )
    capacity = result.capacity
    assert isinstance(capacity, ConservativeCapacityFound)
    assert capacity.max_capacity == Mass(2000.0)
    assert capacity.used_point == point_ficticio(20.0, 21.5, 2000.0)
    assert capacity.queried_radius == result.geometry.working_radius
    assert capacity.strategy is CapacityLookupStrategy.CONSERVATIVE_PROVISIONAL
    assert result.utilization_percent == 75.0  # 1500 / 2000 × 100
    assert result.load_chart_id == LOAD_CHART_AVALIACAO_FICTICIO_ID
    assert result.load_chart_version == LOAD_CHART_AVALIACAO_FICTICIO_VERSION
    assert result.reasons == ()


def test_ficticio_radius_with_float_noise_is_evaluated_with_the_tabulated_point() -> None:
    # Limitação da TASK-015 com a busca exata: L = 20 m e θ = 60° dão 11.500000000000002 m em ponto
    # flutuante. Com a consulta conservadora, o ponto (20 m; 11,5 m; 5000 kg) é usado.
    result = evaluate_ficticio(boom_length_m=20.0, boom_angle_deg=60.0, load_kg=2500.0)

    assert isinstance(result, EvaluatedOperation)
    assert result.geometry.working_radius != Length(11.5)
    capacity = result.capacity
    assert isinstance(capacity, ConservativeCapacityFound)
    assert capacity.used_point == point_ficticio(20.0, 11.5, 5000.0)
    assert result.utilization_percent == 50.0  # 2500 / 5000 × 100


@pytest.mark.parametrize(
    ("boom_length_m", "boom_angle_deg", "reason"),
    [
        # L = 10 m, θ = 30° → R = 1,5 + 5√3 ≈ 10,16 m; a coluna de 10 m só tem 11,5 m.
        pytest.param(
            10.0, 30.0, CapacityUnsupportedReason.RADIUS_BELOW_CHART_MIN, id="raio-abaixo"
        ),
        # L = 15 m: a tabela só tem 10, 20 e 30 m (ADR-013 C-6).
        pytest.param(
            15.0, 0.0, CapacityUnsupportedReason.BOOM_LENGTH_NOT_IN_CHART, id="lanca-entre-colunas"
        ),
    ],
)
def test_ficticio_state_outside_the_chart_domain_is_not_evaluable_with_the_strategy_reason(
    boom_length_m: float, boom_angle_deg: float, reason: CapacityUnsupportedReason
) -> None:
    # O caso de uso repassa o motivo da estratégia sem tradução (RN-007) e mantém a geometria.
    result = evaluate_ficticio(
        boom_length_m=boom_length_m, boom_angle_deg=boom_angle_deg, load_kg=1500.0
    )

    assert isinstance(result, NotEvaluableOperation)
    assert result.reasons == (reason,)
    assert result.geometry is not None
    assert isinstance(result.capacity, CapacityUnsupported)
    assert result.load_chart_version == LOAD_CHART_AVALIACAO_FICTICIO_VERSION
