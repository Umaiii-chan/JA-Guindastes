"""Caso de uso `EvaluateTandem` isolado (TASK-090; RN-014..016). Dados FICTÍCIOS (ADR-012).

Um `EvaluateOperation` falso guarda o que recebeu e devolve uma operação avaliada com o gancho a
R = 10 m à frente do eixo de giro (ψ = 0), dentro do limite.
"""

from typing import Any

import pytest

from app.application.use_cases.evaluate_operation import EvaluatedOperation, OperationEvaluation
from app.application.use_cases.evaluate_tandem import EvaluateTandem, TandemCraneInput
from app.domain.entities.scenario import CranePlacementSpec
from app.domain.services.capacity_limit import CapacityLimit, CapacityLimitLevel
from app.domain.services.environment_factors import SoilKind
from app.domain.services.safety_assessment import OutriggerSetting, TippingRisk
from app.domain.value_objects.capacity_result import CapacityFound
from app.domain.value_objects.length import Length
from app.domain.value_objects.mass import Mass
from app.domain.value_objects.operational_geometry import OperationalGeometry, Point3D
from tests.fixtures.crane_geometry_ficticia import state_ficticio

RADIUS_M = 10.0


class _SpyOperation:
    """Faz o papel do `EvaluateOperation`: guarda os argumentos de cada chamada."""

    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []

    def execute(self, **kwargs: Any) -> OperationEvaluation:
        self.calls.append(kwargs)
        return EvaluatedOperation(
            geometry=OperationalGeometry(
                working_radius=Length(RADIUS_M),
                boom_pivot=Point3D(0.0, 2.0, 1.0),
                boom_tip=Point3D(0.0, 8.0, RADIUS_M),
                hook=Point3D(0.0, 5.0, RADIUS_M),
            ),
            capacity=CapacityFound(
                max_capacity=Mass(10_000.0),
                load_chart_id="LC-FICTICIO",
                load_chart_version="FICTICIO-v1",
            ),
            utilization_percent=10.0,
            load_weight=kwargs["load_weight"],
            capacity_limit=CapacityLimit(
                limit_percent=100.0,
                effective_capacity_kg=7_500.0,
                limit_utilization_percent=10.0,
                warning_band_percent=90.0,
                level=CapacityLimitLevel.OK,
            ),
            tipping_risk=TippingRisk.LOW,
        )


def crane(
    hook_x: float, *, placement_x: float | None = None, **environment: Any
) -> TandemCraneInput:
    x = hook_x if placement_x is None else placement_x
    return TandemCraneInput(
        configuration_id="CFG-FICTICIA",
        state=state_ficticio(turret_rotation_deg=0.0),
        hook_point=(hook_x, 0.0),
        placement=CranePlacementSpec(x=x, z=-RADIUS_M, heading_deg=0.0),
        **environment,
    )


def run(spy: _SpyOperation, *cranes: TandemCraneInput, **kwargs: Any) -> Any:
    use_case = EvaluateTandem(spy)  # type: ignore[arg-type]
    return use_case.execute(load_weight_kg=4_000.0, load_cg=(0.0, 0.0), cranes=cranes, **kwargs)


def test_repassa_o_ambiente_de_cada_guindaste_e_o_vento_comum() -> None:
    spy = _SpyOperation()
    outriggers = OutriggerSetting(extension_percent=50.0, jacks_set=False)
    soil = (SoilKind.CLAY, SoilKind.CLAY, SoilKind.ROCK, SoilKind.ROCK)

    run(
        spy,
        crane(
            -3.0,
            outriggers=outriggers,
            ground_slope_deg=0.8,
            accessory_ids=("ACC-1", "ACC-2"),
            soil_kinds=soil,
            obstacle_conflicts=("Poste",),
        ),
        crane(3.0),
        wind_speed_ms=11.0,
    )

    first, second = spy.calls
    assert first["outriggers"] == outriggers
    assert first["ground_slope_deg"] == 0.8
    assert first["accessory_ids"] == ("ACC-1", "ACC-2")
    assert first["soil_kinds"] == soil
    assert first["obstacle_conflicts"] == ("Poste",)
    assert first["wind_speed_ms"] == second["wind_speed_ms"] == 11.0
    assert first["capacity_factor"] == second["capacity_factor"] == 0.75
    assert first["load_weight"] == second["load_weight"] == Mass(2_000.0)


def test_sem_ambiente_repassa_os_padroes() -> None:
    spy = _SpyOperation()

    result = run(spy, crane(-3.0), crane(3.0))

    for call in spy.calls:
        assert call["outriggers"] is None
        assert call["ground_slope_deg"] is None
        assert call["accessory_ids"] == ()
        assert call["soil_kinds"] == ()
        assert call["obstacle_conflicts"] == ()
        assert call["wind_speed_ms"] is None
    assert result.tandem_ok is True


@pytest.mark.parametrize(("offset_m", "ok"), [(0.5, True), (0.51, False)])
def test_gancho_fora_do_ponto_alem_da_tolerancia(offset_m: float, ok: bool) -> None:
    result = run(_SpyOperation(), crane(-3.0), crane(3.0, placement_x=3.0 + offset_m))

    assert result.tandem_ok is ok
    assert ("TANDEM_HOOK_OFF_POINT" in [alert.code for alert in result.alerts]) is not ok
