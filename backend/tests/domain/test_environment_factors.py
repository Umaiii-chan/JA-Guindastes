"""Fatores do ambiente (RN-015; TASK-067). Valores FICTÍCIOS."""

import pytest

from app.domain.services.capacity_limit import CapacityLimitLevel, evaluate_capacity_limit
from app.domain.services.environment_factors import (
    SoilKind,
    pad_pressure_kpa,
    slope_blocks,
    slope_factor,
    wind_blocks,
    wind_factor,
)
from app.domain.services.safety_assessment import (
    LimitLevel,
    SafetyAssessmentResult,
    TippingRisk,
    assess_safety,
    limit_level,
)
from app.domain.value_objects.mass import Mass
from app.domain.value_objects.safety_profile import SafetyProfile

PROFILE = SafetyProfile()


def _assess(**environment: object) -> SafetyAssessmentResult:
    return assess_safety(
        profile=PROFILE,
        load_weight_kg=1000.0,
        level=LimitLevel.OK,
        outside_chart=False,
        outriggers=None,
        ground_slope_deg=None,
        compared_weight_kg=1000.0,
        **environment,  # type: ignore[arg-type]
    )


def test_slope_derates_ten_percent_per_degree_and_blocks_above_the_maximum() -> None:
    assert slope_factor(None, PROFILE) == 1.0
    assert slope_factor(0.5, PROFILE) == pytest.approx(0.95)
    assert not slope_blocks(1.0, PROFILE)
    assert slope_blocks(1.1, PROFILE)


@pytest.mark.parametrize(
    ("wind", "factor"), [(None, 1.0), (9.8, 1.0), (11.8, 0.75), (13.8, 0.5), (20.0, 0.5)]
)
def test_wind_factor_falls_linearly_to_half(wind: float | None, factor: float) -> None:
    assert wind_factor(wind) == pytest.approx(factor)


def test_wind_blocks_only_above_the_operation_limit() -> None:
    assert not wind_blocks(13.8)
    assert wind_blocks(13.9)


def test_effective_capacity_uses_the_factors_and_blocked_is_over() -> None:
    limit = evaluate_capacity_limit(
        Mass(10_000.0), Mass(1_000.0), slope_factor=0.9, wind_factor=0.5
    )
    assert limit is not None
    assert limit.effective_capacity_kg == pytest.approx(4_500.0)
    assert (limit.slope_factor, limit.wind_factor) == (0.9, 0.5)
    assert limit.level is CapacityLimitLevel.OK

    blocked = evaluate_capacity_limit(Mass(10_000.0), Mass(1_000.0), blocked=True)
    assert blocked is not None and blocked.level is CapacityLimitLevel.OVER


def test_limit_level_uses_the_environment_factor() -> None:
    assert limit_level(6_000.0, 10_000.0, PROFILE) is LimitLevel.OK
    assert limit_level(6_000.0, 10_000.0, PROFILE, 0.5) is LimitLevel.OVER


def test_pad_pressure_uses_the_worst_pad_factor() -> None:
    # (36 000 + 4 000) kg × 9,80665 × 0,5 ÷ 0,5 m² = 392,3 kPa
    assert pad_pressure_kpa(4_000.0, PROFILE) == pytest.approx(392.266)


def test_soil_that_cannot_hold_the_pad_is_high_risk() -> None:
    result = _assess(soil_kinds=(SoilKind.ROCK, SoilKind.COMPACTED, SoilKind.CLAY, SoilKind.ROCK))

    assert result.tipping_risk is TippingRisk.HIGH
    messages = [a.message for a in result.alerts if a.code == "SOIL_BEARING_EXCEEDED"]
    assert len(messages) == 2
    assert "sapata traseira esquerda" in messages[1] or "sapata dianteira direita" in messages[0]


def test_soil_above_eighty_percent_is_attention() -> None:
    # Sapata de 0,218 m²: cerca de 900 kPa, 90 % do suporte da rocha (1 000 kPa).
    result = assess_safety(
        profile=SafetyProfile(outrigger_pad_area_m2=0.218),
        load_weight_kg=1000.0,
        level=LimitLevel.OK,
        outside_chart=False,
        outriggers=None,
        ground_slope_deg=None,
        compared_weight_kg=1000.0,
        soil_kinds=(SoilKind.ROCK,) * 4,
    )

    assert result.tipping_risk is TippingRisk.ATTENTION
    assert [a.code for a in result.alerts[:4]] == ["SOIL_BEARING_NEAR_LIMIT"] * 4


def test_wind_and_obstacles_raise_the_risk() -> None:
    assert _assess(wind_speed_ms=5.0).tipping_risk is TippingRisk.LOW
    assert _assess(wind_speed_ms=12.0).tipping_risk is TippingRisk.ATTENTION
    blocked = _assess(wind_speed_ms=14.0)
    assert blocked.tipping_risk is TippingRisk.HIGH
    assert blocked.alerts[0].message == "Vento acima do limite de operação."

    obstacles = _assess(obstacle_conflicts=("a", "b"))
    assert obstacles.tipping_risk is TippingRisk.ATTENTION
    assert obstacles.alerts[0].message == "Obstáculo no raio de giro: a, b"


def test_absent_environment_inputs_add_no_alert() -> None:
    assert [a.code for a in _assess().alerts] == [
        "OUTRIGGERS_NOT_INFORMED",
        "GROUND_SLOPE_NOT_INFORMED",
    ]
