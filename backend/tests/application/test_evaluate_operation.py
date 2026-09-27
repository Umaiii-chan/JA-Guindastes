"""Caso de uso `EvaluateOperation` com fakes das portas (doc-fonte § 14; RF-015..RF-018, RF-020).

Dados FICTÍCIOS (ADR-012): a ficha técnica vem de `tests/fixtures/crane_geometry_ficticia.py`
(a = 1,5 m, h = 2,5 m, L em [10, 30] m, θ em [0°, 90°], c em [0, 40] m, giro contínuo) e a tabela
de `tests/fixtures/avaliacao_operacional_ficticia.py`. Com θ = 0°, o raio é R = 1,5 + L, exato em
ponto flutuante; é assim que os testes chegam a um ponto da tabela com a busca exata.
"""

import math
from collections.abc import Mapping
from dataclasses import dataclass

import pytest

from app.application.use_cases.evaluate_operation import (
    EvaluatedOperation,
    EvaluateOperation,
    InconsistentActiveLoadChartError,
    NotEvaluableOperation,
    NotEvaluableReason,
    OperationEvaluation,
)
from app.domain.entities.load import Load
from app.domain.entities.load_chart import LoadChart, LoadChartStatus
from app.domain.exceptions.geometry_errors import OperationalLimitViolation
from app.domain.services.compared_load_weight import weight_compared_with_capacity
from app.domain.services.exact_point_lookup import ExactPointLookup
from app.domain.services.geometry_service import calculate_operational_geometry
from app.domain.services.load_chart_interpolator import LoadChartInterpolator
from app.domain.value_objects.capacity_query import CapacityQuery
from app.domain.value_objects.capacity_result import (
    CapacityFound,
    CapacityResult,
    CapacityUnsupported,
    CapacityUnsupportedReason,
)
from app.domain.value_objects.crane_geometry import CraneGeometry
from app.domain.value_objects.length import Length
from app.domain.value_objects.load_center_of_gravity import LoadCenterOfGravity
from app.domain.value_objects.load_dimensions import LoadDimensions
from app.domain.value_objects.mass import Mass
from app.domain.value_objects.operational_geometry import OperationalGeometry
from tests.fixtures.avaliacao_operacional_ficticia import (
    CONFIGURATION_AVALIACAO_FICTICIA_ID,
    LOAD_CHART_AVALIACAO_FICTICIO_ID,
    LOAD_CHART_AVALIACAO_FICTICIO_VERSION,
    build_load_chart_avaliacao_ficticio,
)
from tests.fixtures.crane_geometry_ficticia import build_crane_geometry_ficticia, state_ficticio

# Tolerância só para erro de ponto flutuante ao conferir o raio calculado com a conta à mão. Não é
# a tolerância da busca na tabela, que o ADR-013 C-6 deixa sem valor.
TOLERANCE_M = 1e-9

LOAD_FICTICIA_KG = 3000.0

# Estado FICTÍCIO sobre o ponto (L = 10 m, R = 11,5 m, 4000 kg) da tabela: θ = 0° → R = 1,5 + 10.
ON_CHART_POINT = {"boom_length_m": 10.0, "boom_angle_deg": 0.0, "cable_length_m": 1.0}
ON_CHART_POINT_RADIUS_M = 11.5
ON_CHART_POINT_CAPACITY_KG = 4000.0


class FakeCraneGeometryProvider:
    """Ficha técnica em memória, por configuração; guarda as configurações pedidas."""

    def __init__(self, geometries: Mapping[str, CraneGeometry]) -> None:
        self._geometries = dict(geometries)
        self.requested: list[str] = []

    def get_crane_geometry(self, configuration_id: str) -> CraneGeometry | None:
        self.requested.append(configuration_id)
        return self._geometries.get(configuration_id)


class FakeActiveLoadChartProvider:
    """Tabela ativa em memória, por configuração; guarda as configurações pedidas."""

    def __init__(self, charts: Mapping[str, LoadChart]) -> None:
        self._charts = dict(charts)
        self.requested: list[str] = []

    def get_active_load_chart(
        self, configuration_id: str, rotation_zone_code: str | None = None
    ) -> LoadChart | None:
        self.requested.append(configuration_id)
        return self._charts.get(configuration_id)


class SpyInterpolator:
    """Guarda cada consulta e delega a outra estratégia (por padrão, a `ExactPointLookup`)."""

    def __init__(self, strategy: LoadChartInterpolator | None = None) -> None:
        self._strategy = strategy if strategy is not None else ExactPointLookup()
        self.calls: list[tuple[LoadChart, CapacityQuery]] = []

    def calculate_capacity(self, chart: LoadChart, query: CapacityQuery) -> CapacityResult:
        self.calls.append((chart, query))
        return self._strategy.calculate_capacity(chart, query)


class FixedCapacityInterpolator:
    """Estratégia falsa que responde a mesma capacidade FICTÍCIA para qualquer consulta."""

    def __init__(self, capacity_kg: float) -> None:
        self._capacity = Mass(capacity_kg)

    def calculate_capacity(self, chart: LoadChart, query: CapacityQuery) -> CapacityResult:
        return CapacityFound(
            max_capacity=self._capacity,
            load_chart_id=chart.id,
            load_chart_version=chart.version,
        )


@dataclass
class Harness:
    use_case: EvaluateOperation
    geometry_provider: FakeCraneGeometryProvider
    chart_provider: FakeActiveLoadChartProvider
    interpolator: SpyInterpolator

    def evaluate(
        self, *, load_kg: float = LOAD_FICTICIA_KG, **state_changes: float
    ) -> OperationEvaluation:
        return self.use_case.execute(
            configuration_id=CONFIGURATION_AVALIACAO_FICTICIA_ID,
            state=state_ficticio(**state_changes),
            load_weight=Mass(load_kg),
        )


def make_harness(
    *,
    geometries: Mapping[str, CraneGeometry] | None = None,
    charts: Mapping[str, LoadChart] | None = None,
    strategy: LoadChartInterpolator | None = None,
) -> Harness:
    """Caso de uso com fakes; `{}` em `geometries` ou `charts` deixa a configuração sem o dado."""
    if geometries is None:
        geometries = {CONFIGURATION_AVALIACAO_FICTICIA_ID: build_crane_geometry_ficticia()}
    if charts is None:
        charts = {CONFIGURATION_AVALIACAO_FICTICIA_ID: build_load_chart_avaliacao_ficticio()}
    geometry_provider = FakeCraneGeometryProvider(geometries)
    chart_provider = FakeActiveLoadChartProvider(charts)
    interpolator = SpyInterpolator(strategy)
    use_case = EvaluateOperation(
        crane_geometry_provider=geometry_provider,
        active_load_chart_provider=chart_provider,
        load_chart_interpolator=interpolator,
    )
    return Harness(use_case, geometry_provider, chart_provider, interpolator)


def assert_evaluated(result: OperationEvaluation) -> EvaluatedOperation:
    assert isinstance(result, EvaluatedOperation)
    return result


def assert_not_evaluable(result: OperationEvaluation) -> NotEvaluableOperation:
    assert isinstance(result, NotEvaluableOperation)
    assert not hasattr(result, "utilization_percent")
    return result


def require_geometry(result: NotEvaluableOperation) -> OperationalGeometry:
    assert result.geometry is not None
    return result.geometry


# --- avaliado: ponto da tabela, capacidade e utilização (CA-2) ---------------------------------


def test_ficticio_state_on_a_chart_point_is_evaluated_with_capacity_and_utilization() -> None:
    result = assert_evaluated(make_harness().evaluate(**ON_CHART_POINT))

    assert result.capacity.max_capacity == Mass(ON_CHART_POINT_CAPACITY_KG)
    assert result.utilization_percent == 75.0  # 3000 / 4000 × 100
    assert result.geometry.working_radius == Length(ON_CHART_POINT_RADIUS_M)
    assert result.reasons == ()


def test_evaluated_geometry_is_the_domain_geometry_of_the_state() -> None:
    # RN-008 e ADR-013 C-7: a geometria do resultado é a do backend, com a ficha técnica cadastrada.
    result = assert_evaluated(make_harness().evaluate(**ON_CHART_POINT))

    expected = calculate_operational_geometry(
        state_ficticio(**ON_CHART_POINT), build_crane_geometry_ficticia()
    )
    assert result.geometry == expected
    assert result.geometry.hook_height_m == pytest.approx(1.5, abs=TOLERANCE_M)  # 2,5 + 0 − 1


@pytest.mark.parametrize(
    ("load_kg", "utilization_percent"),
    [
        pytest.param(0.0, 0.0, id="sem-carga"),
        pytest.param(3000.0, 75.0, id="abaixo-da-capacidade"),
        pytest.param(4000.0, 100.0, id="igual-a-capacidade"),
        pytest.param(5000.0, 125.0, id="acima-da-capacidade"),
    ],
)
def test_ficticio_utilization_is_load_over_capacity_times_100(
    load_kg: float, utilization_percent: float
) -> None:
    # Doc-fonte § 14.3; sem arredondamento (PEND-002). Capacidade do ponto: 4000 kg FICTÍCIO.
    result = assert_evaluated(make_harness().evaluate(load_kg=load_kg, **ON_CHART_POINT))

    assert result.utilization_percent == utilization_percent


def test_ficticio_load_above_capacity_is_only_evaluated_without_alert_level() -> None:
    # PEND-004 (e known-gaps P-005): não há status, nível de alerta nem limiar.
    result = assert_evaluated(make_harness().evaluate(load_kg=5000.0, **ON_CHART_POINT))

    assert result.utilization_percent == 125.0
    assert not hasattr(result, "status")


@pytest.mark.parametrize(
    "version", [LOAD_CHART_AVALIACAO_FICTICIO_VERSION, "FICTICIO-AVALIACAO-v2"]
)
def test_evaluated_result_carries_the_chart_id_and_version(version: str) -> None:
    # RN-005: cada cálculo registra a versão da tabela usada.
    chart = build_load_chart_avaliacao_ficticio(version=version)
    harness = make_harness(charts={CONFIGURATION_AVALIACAO_FICTICIA_ID: chart})

    result = assert_evaluated(harness.evaluate(**ON_CHART_POINT))

    assert result.load_chart_id == LOAD_CHART_AVALIACAO_FICTICIO_ID
    assert result.load_chart_version == version


# --- consulta à tabela: comprimento do estado e raio calculado (CA-1, CA-6) ---------------------


def test_providers_are_asked_for_the_requested_configuration() -> None:
    harness = make_harness()

    harness.evaluate(**ON_CHART_POINT)

    assert harness.geometry_provider.requested == [CONFIGURATION_AVALIACAO_FICTICIA_ID]
    assert harness.chart_provider.requested == [CONFIGURATION_AVALIACAO_FICTICIA_ID]


def test_capacity_query_uses_the_state_boom_length_and_the_calculated_radius() -> None:
    harness = make_harness()

    result = assert_evaluated(harness.evaluate(**ON_CHART_POINT))

    [(chart, query)] = harness.interpolator.calls
    assert chart == build_load_chart_avaliacao_ficticio()
    assert query == CapacityQuery(
        boom_length=Length(10.0), working_radius=result.geometry.working_radius
    )


def test_capacity_comes_from_the_injected_strategy() -> None:
    # A estratégia fica atrás da porta (doc-fonte § 14.4); o caso de uso não fixa uma estratégia.
    # L = 10 m e θ = 30° não é ponto da tabela, mas a estratégia falsa responde 8000 kg FICTÍCIO.
    harness = make_harness(strategy=FixedCapacityInterpolator(8000.0))

    result = assert_evaluated(harness.evaluate(boom_length_m=10.0, boom_angle_deg=30.0))

    assert result.capacity.max_capacity == Mass(8000.0)
    assert result.utilization_percent == 37.5  # 3000 / 8000 × 100


# --- não avaliável: fora do domínio da tabela (CA-3) --------------------------------------------


def test_ficticio_calculated_radius_not_in_chart_is_not_evaluable_but_keeps_geometry() -> None:
    # L = 10 m, θ = 30° → R = 1,5 + 10·(√3/2) = 1,5 + 5√3 ≈ 10,16 m, que a tabela não tem (RN-007).
    result = assert_not_evaluable(make_harness().evaluate(boom_length_m=10.0, boom_angle_deg=30.0))

    assert result.reasons == (CapacityUnsupportedReason.POINT_NOT_IN_CHART,)
    assert isinstance(result.capacity, CapacityUnsupported)
    assert require_geometry(result).working_radius.meters == pytest.approx(
        1.5 + 5 * math.sqrt(3), abs=TOLERANCE_M
    )


def test_ficticio_boom_length_between_chart_columns_is_not_evaluable() -> None:
    # ADR-013 C-6: L fora dos comprimentos tabelados não é interpolado nem arredondado.
    # L = 15 m, θ = 0° → R = 16,5 m; a tabela só tem L = 10, 20 e 30 m.
    result = assert_not_evaluable(make_harness().evaluate(boom_length_m=15.0, boom_angle_deg=0.0))

    assert result.reasons == (CapacityUnsupportedReason.POINT_NOT_IN_CHART,)
    assert require_geometry(result).working_radius == Length(16.5)


def test_ficticio_radius_on_chart_point_only_by_hand_is_not_found_by_the_exact_search() -> None:
    # Limitação conhecida (handoffs/TASK-015.md): L = 20 m e θ = 60° dão R = 1,5 + 20·(1/2) = 11,5 m
    # na conta à mão, e a tabela tem (20 m; 11,5 m). Em ponto flutuante, cos 60° não é 0,5 exato, o
    # raio sai 11,500000000000002 m, e a busca exata não acha o ponto. O ADR-013 C-6 não define a
    # tolerância, então nenhuma é inventada aqui.
    result = assert_not_evaluable(make_harness().evaluate(boom_length_m=20.0, boom_angle_deg=60.0))

    radius_m = require_geometry(result).working_radius.meters
    assert radius_m == pytest.approx(11.5, abs=TOLERANCE_M)
    assert radius_m != 11.5
    assert result.reasons == (CapacityUnsupportedReason.POINT_NOT_IN_CHART,)


def test_not_evaluable_off_chart_result_carries_the_chart_id_and_version() -> None:
    # RN-005: a tabela foi consultada, então a versão fica registrada mesmo sem capacidade.
    result = assert_not_evaluable(make_harness().evaluate(boom_length_m=15.0, boom_angle_deg=0.0))

    assert result.load_chart_id == LOAD_CHART_AVALIACAO_FICTICIO_ID
    assert result.load_chart_version == LOAD_CHART_AVALIACAO_FICTICIO_VERSION


def test_ficticio_zero_capacity_point_is_not_evaluable_because_utilization_is_undefined() -> None:
    # L = 30 m, θ = 0° → R = 31,5 m, ponto FICTÍCIO com 0 kg (significado em aberto, TASK-008).
    result = assert_not_evaluable(make_harness().evaluate(boom_length_m=30.0, boom_angle_deg=0.0))

    assert result.reasons == (NotEvaluableReason.UTILIZATION_UNDEFINED,)
    assert result.capacity == CapacityFound(
        max_capacity=Mass(0.0),
        load_chart_id=LOAD_CHART_AVALIACAO_FICTICIO_ID,
        load_chart_version=LOAD_CHART_AVALIACAO_FICTICIO_VERSION,
    )


# --- não avaliável: estado fora das faixas ou R < 0, sem exceção (CA-4) -------------------------


@pytest.mark.parametrize(
    ("state_changes", "violations"),
    [
        pytest.param(
            {"boom_length_m": 35.0},
            (OperationalLimitViolation.BOOM_LENGTH_ABOVE_MAX,),
            id="lanca-acima-do-maximo",
        ),
        pytest.param(
            {"boom_length_m": 5.0},
            (OperationalLimitViolation.BOOM_LENGTH_BELOW_MIN,),
            id="lanca-abaixo-do-minimo",
        ),
        pytest.param(
            {"boom_length_m": 35.0, "boom_angle_deg": 95.0, "cable_length_m": 50.0},
            (
                OperationalLimitViolation.BOOM_LENGTH_ABOVE_MAX,
                OperationalLimitViolation.BOOM_ANGLE_ABOVE_MAX,
                OperationalLimitViolation.CABLE_LENGTH_ABOVE_MAX,
            ),
            id="varias-faixas",
        ),
    ],
)
def test_ficticio_state_out_of_limits_is_not_evaluable_with_every_violation(
    state_changes: dict[str, float], violations: tuple[OperationalLimitViolation, ...]
) -> None:
    # ADR-013 C-5: sinaliza, e não corrige; o erro de domínio não é propagado.
    harness = make_harness()

    result = assert_not_evaluable(harness.evaluate(**state_changes))

    assert result.reasons == violations
    assert result.geometry is None
    assert result.capacity is None
    assert result.load_chart_version is None
    assert harness.interpolator.calls == []


def test_ficticio_tip_behind_slewing_axis_is_not_evaluable() -> None:
    # ADR-013 C-5: com a = −12 m, L = 10 m e θ = 0°, R = −12 + 10 = −2 m; o raio não vira |R|.
    geometry = build_crane_geometry_ficticia(boom_pivot_offset_m=-12.0)
    harness = make_harness(geometries={CONFIGURATION_AVALIACAO_FICTICIA_ID: geometry})

    result = assert_not_evaluable(harness.evaluate(boom_length_m=10.0, boom_angle_deg=0.0))

    assert result.reasons == (NotEvaluableReason.OUTSIDE_GEOMETRIC_DOMAIN,)
    assert result.geometry is None
    assert result.capacity is None
    assert harness.interpolator.calls == []


# --- não avaliável: sem tabela ativa ou sem ficha técnica (CA-5) --------------------------------


def test_configuration_without_active_chart_is_not_evaluable_but_keeps_geometry() -> None:
    # ADR-013 C-6: a geometria continua aparecendo; a capacidade, não.
    harness = make_harness(charts={})

    result = assert_not_evaluable(harness.evaluate(**ON_CHART_POINT))

    assert result.reasons == (NotEvaluableReason.ACTIVE_LOAD_CHART_NOT_FOUND,)
    assert require_geometry(result).working_radius == Length(ON_CHART_POINT_RADIUS_M)
    assert result.capacity is None
    assert result.load_chart_id is None
    assert result.load_chart_version is None
    assert harness.interpolator.calls == []


def test_configuration_without_crane_geometry_is_not_evaluable() -> None:
    harness = make_harness(geometries={})

    result = assert_not_evaluable(harness.evaluate(**ON_CHART_POINT))

    assert result.reasons == (NotEvaluableReason.CRANE_GEOMETRY_NOT_FOUND,)
    assert result.geometry is None
    assert harness.interpolator.calls == []


def test_ficticio_out_of_limits_without_active_chart_lists_both_reasons_in_stage_order() -> None:
    harness = make_harness(charts={})

    result = assert_not_evaluable(harness.evaluate(boom_length_m=35.0))

    assert result.reasons == (
        OperationalLimitViolation.BOOM_LENGTH_ABOVE_MAX,
        NotEvaluableReason.ACTIVE_LOAD_CHART_NOT_FOUND,
    )


def test_reasons_are_machine_readable_codes() -> None:
    result = assert_not_evaluable(make_harness(charts={}).evaluate(boom_length_m=35.0))

    assert [reason.value for reason in result.reasons] == [
        "BOOM_LENGTH_ABOVE_MAX",
        "ACTIVE_LOAD_CHART_NOT_FOUND",
    ]


# --- contrato da porta da tabela ativa (RN-001, RN-004) -----------------------------------------


def test_provider_returning_a_chart_of_another_configuration_breaks_the_contract() -> None:
    chart = build_load_chart_avaliacao_ficticio(configuration_id="CFG-FICTICIA-OUTRA")
    harness = make_harness(charts={CONFIGURATION_AVALIACAO_FICTICIA_ID: chart})

    with pytest.raises(InconsistentActiveLoadChartError):
        harness.evaluate(**ON_CHART_POINT)

    assert harness.interpolator.calls == []


@pytest.mark.parametrize(
    "status", [status for status in LoadChartStatus if status is not LoadChartStatus.ACTIVE]
)
def test_provider_returning_a_non_active_chart_breaks_the_contract(
    status: LoadChartStatus,
) -> None:
    chart = build_load_chart_avaliacao_ficticio(status=status)
    harness = make_harness(charts={CONFIGURATION_AVALIACAO_FICTICIA_ID: chart})

    with pytest.raises(InconsistentActiveLoadChartError):
        harness.evaluate(**ON_CHART_POINT)

    assert harness.interpolator.calls == []


# --- tipos do resultado -------------------------------------------------------------------------


def test_not_evaluable_result_requires_at_least_one_reason() -> None:
    # RN-007: "não avaliável" é sempre identificado explicitamente.
    with pytest.raises(ValueError):
        NotEvaluableOperation(reasons=())


# --- carga da TASK-028 (`execute_for_load`, TASK-029) -------------------------------------------


def load_ficticia(weight_kg: float = LOAD_FICTICIA_KG) -> Load:
    return Load(
        description="FICTÍCIO — carga de teste da avaliação",
        weight=Mass(weight_kg),
        dimensions=LoadDimensions(length=Length(4.0), width=Length(2.0), height=Length(1.0)),
        center_of_gravity=LoadCenterOfGravity(
            along_length_m=0.0, along_width_m=0.0, along_height_m=0.0
        ),
    )


def evaluate_load(harness: Harness, load: Load) -> OperationEvaluation:
    return harness.use_case.execute_for_load(
        configuration_id=CONFIGURATION_AVALIACAO_FICTICIA_ID,
        state=state_ficticio(**ON_CHART_POINT),
        load=load,
    )


def test_ficticio_load_is_evaluated_with_only_the_informed_weight() -> None:
    result = assert_evaluated(evaluate_load(make_harness(), load_ficticia()))

    assert result.utilization_percent == 75.0  # 3000 / 4000 × 100: nada somado (PEND-006)


def test_evaluating_a_load_equals_evaluating_its_compared_weight() -> None:
    harness = make_harness()
    load = load_ficticia(weight_kg=1234.5)

    by_load = evaluate_load(harness, load)
    by_weight = harness.use_case.execute(
        configuration_id=CONFIGURATION_AVALIACAO_FICTICIA_ID,
        state=state_ficticio(**ON_CHART_POINT),
        load_weight=weight_compared_with_capacity(load),
    )

    assert by_load == by_weight
    assert weight_compared_with_capacity(load) == Mass(1234.5)


def test_ficticio_load_on_a_configuration_without_data_is_not_evaluable() -> None:
    result = assert_not_evaluable(
        evaluate_load(make_harness(geometries={}, charts={}), load_ficticia())
    )

    assert result.reasons == (
        NotEvaluableReason.CRANE_GEOMETRY_NOT_FOUND,
        NotEvaluableReason.ACTIVE_LOAD_CHART_NOT_FOUND,
    )
