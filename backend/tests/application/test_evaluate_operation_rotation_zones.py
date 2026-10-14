"""`EvaluateOperation` com zonas de giro e peso do gancho (ADR-018; TASK-046 CA-1).

Tabelas, zonas, ficha e pesos FICTÍCIOS (ADR-012). Com a ficha FICTÍCIA (a = 1,5 m), L = 10 m e
θ = 0°, o raio é 11,5 m exatamente, um raio tabelado das duas tabelas abaixo.
"""

import pytest

from app.application.ports.configuration_load_rules_provider import ConfigurationLoadRules
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
from app.domain.services.conservative_tabulated_lookup import ConservativeTabulatedLookup
from app.domain.value_objects.capacity_result import CapacityUnsupportedReason
from app.domain.value_objects.crane_geometry import CraneGeometry
from app.domain.value_objects.length import Length
from app.domain.value_objects.load_dimensions import LoadDimensions
from app.domain.value_objects.mass import Mass
from app.domain.value_objects.rotation_zone import ROTATION_ZONE_BOUNDARY_TOLERANCE_DEG
from tests.fixtures.crane_geometry_ficticia import build_crane_geometry_ficticia, state_ficticio
from tests.fixtures.load_chart_ficticio import point_ficticio
from tests.fixtures.rotation_zones_ficticias import (
    GANCHO_FICTICIO_KG,
    ZONA_FRONTAL_FICTICIA,
    ZONA_LATERAL_TRASEIRA_FICTICIA,
    zonas_ficticias,
)

CONFIGURACAO_ZONAS_FICTICIA = "CFG-FICTICIA-ZONAS"
CARGA_FICTICIA_KG = 1000.0
EPS = ROTATION_ZONE_BOUNDARY_TOLERANCE_DEG


def chart_ficticio(
    chart_id: str,
    zone: str | None,
    capacity_kg: float,
    *,
    boom_length_m: float = 10.0,
    status: LoadChartStatus = LoadChartStatus.ACTIVE,
    configuration_id: str = CONFIGURACAO_ZONAS_FICTICIA,
) -> LoadChart:
    """Tabela FICTÍCIA com dois raios no comprimento `boom_length_m`."""
    return LoadChart(
        id=chart_id,
        version=f"{chart_id}-v1",
        configuration_id=configuration_id,
        status=status,
        points=(
            point_ficticio(boom_length_m, 5.0, capacity_kg * 2),
            point_ficticio(boom_length_m, 11.5, capacity_kg),
        ),
        rotation_zone_code=zone,
    )


FRONTAL = chart_ficticio("LC-FICTICIO-FRONTAL", ZONA_FRONTAL_FICTICIA, 4000.0)
LATERAL = chart_ficticio("LC-FICTICIO-LATERAL", ZONA_LATERAL_TRASEIRA_FICTICIA, 3000.0)


class FakeProviders:
    """Ficha, regras de carga e tabelas ativas por (configuração, zona), FICTÍCIAS."""

    def __init__(
        self,
        charts: tuple[LoadChart, ...] = (FRONTAL, LATERAL),
        rules: ConfigurationLoadRules | None = None,
        geometry: CraneGeometry | None = None,
    ) -> None:
        self.charts = charts
        self.rules = (
            ConfigurationLoadRules(
                rotation_zones=zonas_ficticias(), hook_block_weight=Mass(GANCHO_FICTICIO_KG)
            )
            if rules is None
            else rules
        )
        self.geometry = geometry
        self.requested: list[tuple[str, str | None]] = []

    def get_crane_geometry(self, configuration_id: str) -> CraneGeometry | None:
        return self.geometry if self.geometry is not None else build_crane_geometry_ficticia()

    def get_load_rules(self, configuration_id: str) -> ConfigurationLoadRules | None:
        return self.rules

    def get_active_load_chart(
        self, configuration_id: str, rotation_zone_code: str | None = None
    ) -> LoadChart | None:
        self.requested.append((configuration_id, rotation_zone_code))
        return next(
            (
                chart
                for chart in self.charts
                if chart.configuration_id == configuration_id
                and chart.rotation_zone_code == rotation_zone_code
            ),
            None,
        )


class NoGeometry(FakeProviders):
    def get_crane_geometry(self, configuration_id: str) -> CraneGeometry | None:
        return None


def evaluate(
    providers: FakeProviders, *, psi: float, boom_length_m: float = 10.0
) -> OperationEvaluation:
    use_case = EvaluateOperation(
        crane_geometry_provider=providers,
        active_load_chart_provider=providers,
        load_chart_interpolator=ConservativeTabulatedLookup(),
        configuration_load_rules_provider=providers,
    )
    return use_case.execute(
        configuration_id=CONFIGURACAO_ZONAS_FICTICIA,
        state=state_ficticio(
            boom_length_m=boom_length_m, boom_angle_deg=0.0, turret_rotation_deg=psi
        ),
        load_weight=Mass(CARGA_FICTICIA_KG),
    )


def zone_code(result: OperationEvaluation) -> str | None:
    return None if result.rotation_zone is None else result.rotation_zone.code


@pytest.mark.parametrize(
    ("psi", "zone", "capacity_kg", "chart_id"),
    [
        (0.0, ZONA_FRONTAL_FICTICIA, 4000.0, FRONTAL.id),
        (330.0, ZONA_FRONTAL_FICTICIA, 4000.0, FRONTAL.id),
        (-10.0, ZONA_FRONTAL_FICTICIA, 4000.0, FRONTAL.id),
        (90.0, ZONA_LATERAL_TRASEIRA_FICTICIA, 3000.0, LATERAL.id),
        (180.0, ZONA_LATERAL_TRASEIRA_FICTICIA, 3000.0, LATERAL.id),
    ],
)
def test_psi_selects_the_active_chart_of_its_zone(
    psi: float, zone: str, capacity_kg: float, chart_id: str
) -> None:
    result = evaluate(FakeProviders(), psi=psi)

    assert isinstance(result, EvaluatedOperation)
    assert zone_code(result) == zone
    assert result.capacity.max_capacity == Mass(capacity_kg)
    assert result.load_chart_id == chart_id


def test_compared_weight_is_load_plus_hook_block_and_drives_utilization() -> None:
    result = evaluate(FakeProviders(), psi=0.0)

    assert isinstance(result, EvaluatedOperation)
    assert result.load_weight == Mass(CARGA_FICTICIA_KG)
    assert result.hook_block_weight == Mass(GANCHO_FICTICIO_KG)
    assert result.compared_weight == Mass(CARGA_FICTICIA_KG + GANCHO_FICTICIO_KG)
    assert result.utilization_percent == pytest.approx(1200.0 / 4000.0 * 100)


@pytest.mark.parametrize("psi", [55.0, 55.0 + EPS / 2, 55.0 - EPS / 2, 305.0, 305.0 + EPS])
def test_on_a_boundary_the_lowest_capacity_of_both_zones_wins(psi: float) -> None:
    providers = FakeProviders()

    result = evaluate(providers, psi=psi)

    assert isinstance(result, EvaluatedOperation)
    assert zone_code(result) == ZONA_LATERAL_TRASEIRA_FICTICIA
    assert result.capacity.max_capacity == Mass(3000.0)
    assert {zone for _, zone in providers.requested} == {
        ZONA_FRONTAL_FICTICIA,
        ZONA_LATERAL_TRASEIRA_FICTICIA,
    }


def test_on_a_boundary_the_lowest_capacity_wins_even_if_it_is_the_front_zone() -> None:
    weaker_front = chart_ficticio("LC-FICTICIO-FRONTAL-FRACA", ZONA_FRONTAL_FICTICIA, 2500.0)

    result = evaluate(FakeProviders(charts=(weaker_front, LATERAL)), psi=55.0)

    assert isinstance(result, EvaluatedOperation)
    assert zone_code(result) == ZONA_FRONTAL_FICTICIA
    assert result.capacity.max_capacity == Mass(2500.0)


def test_on_a_boundary_with_a_tie_the_first_declared_zone_is_reported() -> None:
    same_side = chart_ficticio("LC-FICTICIO-LATERAL-IGUAL", ZONA_LATERAL_TRASEIRA_FICTICIA, 4000.0)

    result = evaluate(FakeProviders(charts=(FRONTAL, same_side)), psi=55.0)

    assert isinstance(result, EvaluatedOperation)
    assert zone_code(result) == ZONA_FRONTAL_FICTICIA


def test_zone_without_active_chart_is_not_evaluable_and_reports_the_zone() -> None:
    result = evaluate(FakeProviders(charts=(FRONTAL,)), psi=180.0)

    assert isinstance(result, NotEvaluableOperation)
    assert result.reasons == (NotEvaluableReason.ACTIVE_LOAD_CHART_NOT_FOUND,)
    assert zone_code(result) == ZONA_LATERAL_TRASEIRA_FICTICIA
    assert result.geometry is not None
    assert result.capacity is None
    assert result.compared_weight == Mass(CARGA_FICTICIA_KG + GANCHO_FICTICIO_KG)


def test_on_a_boundary_a_zone_without_active_chart_makes_it_not_evaluable() -> None:
    result = evaluate(FakeProviders(charts=(FRONTAL,)), psi=305.0)

    assert isinstance(result, NotEvaluableOperation)
    assert result.reasons == (NotEvaluableReason.ACTIVE_LOAD_CHART_NOT_FOUND,)
    assert zone_code(result) == ZONA_LATERAL_TRASEIRA_FICTICIA


def test_on_a_boundary_a_query_outside_one_chart_makes_it_not_evaluable() -> None:
    # Só a coluna de 5 m: a lança de 10 m passa da maior coluna (ADR-029).
    lateral_without_10m = chart_ficticio(
        "LC-FICTICIO-LATERAL-SO-5", ZONA_LATERAL_TRASEIRA_FICTICIA, 3000.0, boom_length_m=5.0
    )

    result = evaluate(FakeProviders(charts=(FRONTAL, lateral_without_10m)), psi=55.0)

    assert isinstance(result, NotEvaluableOperation)
    assert result.reasons == (CapacityUnsupportedReason.BOOM_LENGTH_ABOVE_CHART_MAX,)
    assert zone_code(result) == ZONA_LATERAL_TRASEIRA_FICTICIA
    assert result.load_chart_id == lateral_without_10m.id


def test_without_geometry_the_zone_of_psi_is_still_reported() -> None:
    result = evaluate(NoGeometry(), psi=180.0)

    assert isinstance(result, NotEvaluableOperation)
    assert result.reasons == (NotEvaluableReason.CRANE_GEOMETRY_NOT_FOUND,)
    assert zone_code(result) == ZONA_LATERAL_TRASEIRA_FICTICIA
    assert result.hook_block_weight == Mass(GANCHO_FICTICIO_KG)


def test_configuration_without_zones_uses_the_chart_without_zone_and_the_hook() -> None:
    no_zone = chart_ficticio("LC-FICTICIO-SEM-ZONA", None, 4000.0)
    providers = FakeProviders(
        charts=(no_zone,),
        rules=ConfigurationLoadRules(hook_block_weight=Mass(GANCHO_FICTICIO_KG)),
    )

    result = evaluate(providers, psi=180.0)

    assert isinstance(result, EvaluatedOperation)
    assert result.rotation_zone is None
    assert result.load_chart_id == no_zone.id
    assert result.utilization_percent == pytest.approx(30.0)
    assert providers.requested == [(CONFIGURACAO_ZONAS_FICTICIA, None)]


def test_without_rules_provider_nothing_is_added_to_the_load() -> None:
    no_zone = chart_ficticio("LC-FICTICIO-SEM-ZONA", None, 4000.0)
    providers = FakeProviders(charts=(no_zone,))
    use_case = EvaluateOperation(
        crane_geometry_provider=providers,
        active_load_chart_provider=providers,
        load_chart_interpolator=ConservativeTabulatedLookup(),
    )

    result = use_case.execute(
        configuration_id=CONFIGURACAO_ZONAS_FICTICIA,
        state=state_ficticio(boom_length_m=10.0, boom_angle_deg=0.0, turret_rotation_deg=90.0),
        load_weight=Mass(CARGA_FICTICIA_KG),
    )

    assert isinstance(result, EvaluatedOperation)
    assert result.hook_block_weight == Mass(0.0)
    assert result.compared_weight == Mass(CARGA_FICTICIA_KG)
    assert result.utilization_percent == pytest.approx(25.0)


def test_execute_for_load_adds_the_hook_block_once() -> None:
    providers = FakeProviders()
    use_case = EvaluateOperation(
        crane_geometry_provider=providers,
        active_load_chart_provider=providers,
        load_chart_interpolator=ConservativeTabulatedLookup(),
        configuration_load_rules_provider=providers,
    )
    load = Load(
        description="Carga FICTÍCIA",
        weight=Mass(CARGA_FICTICIA_KG),
        dimensions=LoadDimensions(Length(1.0), Length(1.0), Length(1.0)),
    )

    result = use_case.execute_for_load(
        configuration_id=CONFIGURACAO_ZONAS_FICTICIA,
        state=state_ficticio(boom_length_m=10.0, boom_angle_deg=0.0, turret_rotation_deg=0.0),
        load=load,
    )

    assert isinstance(result, EvaluatedOperation)
    assert result.compared_weight == Mass(1200.0)


def test_provider_returning_a_chart_of_another_zone_breaks_the_contract() -> None:
    class WrongZone(FakeProviders):
        def get_active_load_chart(
            self, configuration_id: str, rotation_zone_code: str | None = None
        ) -> LoadChart | None:
            return LATERAL

    with pytest.raises(InconsistentActiveLoadChartError, match="zona"):
        evaluate(WrongZone(), psi=0.0)
