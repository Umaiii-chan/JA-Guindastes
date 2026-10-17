"""Ambiente no risco de operação (RN-017, que substitui a RN-015; TASK-106). Valores FICTÍCIOS."""

import pytest

from app.domain.services.capacity_limit import CapacityLimitLevel, evaluate_capacity_limit
from app.domain.services.environment_factors import (
    SoilKind,
    pad_pressures_kpa,
    slope_blocks,
    wind_blocks,
    wind_near_limit,
)
from app.domain.services.safety_assessment import (
    LimitLevel,
    SafetyAssessmentResult,
    TippingRisk,
    assess_safety,
    limit_level,
)
from app.domain.services.stability import StabilityResult
from app.domain.value_objects.mass import Mass
from app.domain.value_objects.safety_profile import SafetyProfile

PROFILE = SafetyProfile()
FRONT_KG, REAR_KG = 14_575.2, 5_424.8  # reações do caso de `test_stability` (carga de 4 000 kg)
FRONT_KPA = 285.868  # 14 575,2 kgf · 9,80665 ÷ 0,5 m² ÷ 1 000
REAR_KPA = 106.398  # 5 424,8 kgf · 9,80665 ÷ 0,5 m² ÷ 1 000


def stability(
    ratio: float = 0.39, *, tipped: bool = False, reactions: tuple[float, ...] | None = None
) -> StabilityResult:
    return StabilityResult(
        tipping_ratio=ratio,
        critical_edge="dianteira",
        reactions_kg=reactions or (FRONT_KG, FRONT_KG, REAR_KG, REAR_KG),  # type: ignore[arg-type]
        tipped=tipped,
        total_weight_kg=40_000.0,
        deflection_m=0.0256,
        pad_half_span_m=3.8,
        wind_force_n=0.0,
        wind_limit_ms=9.0,
    )


def _assess(**environment: object) -> SafetyAssessmentResult:
    return assess_safety(
        profile=PROFILE,
        load_weight_kg=1000.0,
        level=LimitLevel.OK,
        outside_chart=False,
        outriggers=None,
        ground_slope_deg=None,
        **environment,  # type: ignore[arg-type]
    )


def codes(result: SafetyAssessmentResult) -> list[str]:
    return [alert.code for alert in result.alerts]


def test_slope_no_longer_derates_and_only_blocks_above_the_model_maximum() -> None:
    assert not slope_blocks(None, PROFILE)
    assert not slope_blocks(1.0, PROFILE)
    assert slope_blocks(1.1, PROFILE)


def test_wind_blocks_above_the_limit_and_warns_from_ninety_percent() -> None:
    assert not wind_blocks(None, 9.0)
    assert not wind_blocks(9.0, 9.0)
    assert wind_blocks(9.1, 9.0)
    assert not wind_near_limit(8.1, 9.0)  # 90 % de 9,0 = 8,1: ainda abaixo da faixa
    assert wind_near_limit(8.2, 9.0)
    assert wind_near_limit(9.0, 9.0)
    assert not wind_near_limit(9.1, 9.0)


def test_effective_capacity_keeps_the_extra_factor_and_blocked_is_over() -> None:
    limit = evaluate_capacity_limit(Mass(10_000.0), Mass(1_000.0), extra_factor=0.5)
    assert limit is not None
    assert limit.effective_capacity_kg == pytest.approx(5_000.0)
    assert (limit.slope_factor, limit.wind_factor) == (1.0, 1.0)
    assert limit.level is CapacityLimitLevel.OK

    blocked = evaluate_capacity_limit(Mass(10_000.0), Mass(1_000.0), blocked=True)
    assert blocked is not None and blocked.level is CapacityLimitLevel.OVER


def test_limit_level_uses_the_environment_factor() -> None:
    assert limit_level(6_000.0, 10_000.0, PROFILE) is LimitLevel.OK
    assert limit_level(6_000.0, 10_000.0, PROFILE, 0.5) is LimitLevel.OVER


def test_pad_pressure_comes_from_each_pad_reaction() -> None:
    front, _, rear, _ = pad_pressures_kpa(stability().reactions_kg, PROFILE)

    assert front == pytest.approx(FRONT_KPA, abs=1e-3)
    assert rear == pytest.approx(REAR_KPA, abs=1e-3)


def test_soil_that_cannot_hold_its_own_pad_is_high_risk() -> None:
    # Argila (150 kPa) sob a dianteira esquerda (285,9 kPa); a traseira (106,4 kPa) ainda passa.
    result = _assess(
        stability=stability(),
        soil_kinds=(SoilKind.CLAY, SoilKind.ROCK, SoilKind.CLAY, SoilKind.COMPACTED),
    )

    assert result.tipping_risk is TippingRisk.HIGH
    exceeded = [a.message for a in result.alerts if a.code == "SOIL_BEARING_EXCEEDED"]
    assert len(exceeded) == 1
    assert "sapata dianteira esquerda" in exceeded[0]


def test_soil_above_eighty_percent_of_its_support_is_attention() -> None:
    # Compactado (300 kPa) sob a dianteira direita: 285,9 / 300 = 95 %.
    result = _assess(
        stability=stability(),
        soil_kinds=(SoilKind.ROCK, SoilKind.COMPACTED, SoilKind.ROCK, SoilKind.ROCK),
    )

    assert result.tipping_risk is TippingRisk.ATTENTION
    assert codes(result)[:1] == ["SOIL_BEARING_NEAR_LIMIT"]
    assert "sapata dianteira direita" in result.alerts[0].message


def test_soil_is_not_checked_without_the_stability_result() -> None:
    result = _assess(soil_kinds=(SoilKind.LOOSE_FILL,) * 4)

    assert "SOIL_BEARING_EXCEEDED" not in codes(result)


def test_wind_against_the_gust_limit_raises_the_risk() -> None:
    assert _assess(wind_speed_ms=5.0, wind_limit_ms=9.0).tipping_risk is TippingRisk.LOW

    near = _assess(wind_speed_ms=8.5, wind_limit_ms=9.0)
    assert near.tipping_risk is TippingRisk.ATTENTION
    assert near.alerts[0].code == "WIND_NEAR_LIMIT"

    blocked = _assess(wind_speed_ms=9.5, wind_limit_ms=9.0)
    assert blocked.tipping_risk is TippingRisk.HIGH
    assert blocked.alerts[0].code == "WIND_ABOVE_LIMIT"
    assert "EN 13000" in blocked.alerts[0].message


def test_wind_limit_defaults_to_the_table_speed_of_the_profile() -> None:
    assert _assess(wind_speed_ms=9.5).tipping_risk is TippingRisk.HIGH
    assert _assess(wind_speed_ms=8.0).tipping_risk is TippingRisk.LOW


def test_tipping_margin_exhausted_is_high_and_near_the_limit_is_attention() -> None:
    assert _assess(stability=stability(0.39)).tipping_risk is TippingRisk.LOW

    near = _assess(stability=stability(0.92))
    assert near.tipping_risk is TippingRisk.ATTENTION
    assert near.alerts[0].code == "STABILITY_NEAR_LIMIT"

    over = _assess(stability=stability(1.05))
    assert over.tipping_risk is TippingRisk.HIGH
    assert over.alerts[0].code == "TIPPING_MARGIN_EXCEEDED"


def test_pads_that_lost_support_mean_the_crane_tipped() -> None:
    result = _assess(stability=stability(1.4, tipped=True, reactions=(0.0, 0.0, 0.0, 0.0)))

    assert result.tipping_risk is TippingRisk.HIGH
    assert codes(result)[0] == "OUTRIGGERS_LIFT_OFF"


def test_obstacles_in_the_swing_radius_are_attention() -> None:
    obstacles = _assess(obstacle_conflicts=("a", "b"))

    assert obstacles.tipping_risk is TippingRisk.ATTENTION
    assert obstacles.alerts[0].message == "Obstáculo no raio de giro: a, b"


def test_absent_environment_inputs_add_no_alert() -> None:
    assert codes(_assess()) == ["OUTRIGGERS_NOT_INFORMED", "GROUND_SLOPE_NOT_INFORMED"]
