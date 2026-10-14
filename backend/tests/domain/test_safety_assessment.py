"""Risco de tombamento e alertas (RN-013; ADR-025). Valores FICTÍCIOS (ADR-012)."""

import pytest

from app.domain.services.safety_assessment import (
    AlertSeverity,
    LimitLevel,
    OutriggerSetting,
    TippingRisk,
    assess_safety,
    limit_level,
)
from app.domain.value_objects.safety_profile import SafetyProfile

READY = OutriggerSetting(extension_percent=100, jacks_set=True)


def assess(**overrides: object):  # noqa: ANN202
    arguments: dict[str, object] = {
        "profile": SafetyProfile(),
        "load_weight_kg": 1000.0,
        "level": LimitLevel.OK,
        "outside_chart": False,
        "outriggers": READY,
        "ground_slope_deg": 0.0,
    }
    arguments.update(overrides)
    return assess_safety(**arguments)  # type: ignore[arg-type]


def codes(result: object) -> list[str]:
    return [alert.code for alert in result.alerts]  # type: ignore[attr-defined]


def test_default_profile_is_the_fictional_one() -> None:
    profile = SafetyProfile()
    assert (
        profile.capacity_limit_percent,
        profile.warning_band_percent,
        profile.max_ground_slope_deg,
    ) == (100.0, 90.0, 1.0)


def test_everything_fine_is_low_risk_without_alerts() -> None:
    result = assess()
    assert result.tipping_risk is TippingRisk.LOW
    assert result.alerts == ()


def test_warning_band_is_attention() -> None:
    result = assess(level=LimitLevel.WARNING)
    assert result.tipping_risk is TippingRisk.ATTENTION
    assert codes(result) == ["CAPACITY_LIMIT_WARNING"]
    assert result.alerts[0].severity is AlertSeverity.ATTENTION


def test_over_limit_is_high() -> None:
    result = assess(level=LimitLevel.OVER)
    assert result.tipping_risk is TippingRisk.HIGH
    assert codes(result) == ["CAPACITY_LIMIT_EXCEEDED"]
    assert result.alerts[0].severity is AlertSeverity.CRITICAL


def test_outriggers_at_50_percent_with_load_is_high() -> None:
    result = assess(outriggers=OutriggerSetting(50, True))
    assert result.tipping_risk is TippingRisk.HIGH
    assert codes(result) == ["OUTRIGGERS_NOT_READY"]
    assert "50 %" in result.alerts[0].message


def test_outriggers_not_set_with_load_is_high() -> None:
    result = assess(outriggers=OutriggerSetting(100, False))
    assert result.tipping_risk is TippingRisk.HIGH


def test_retracted_outriggers_without_load_are_not_a_risk() -> None:
    result = assess(outriggers=OutriggerSetting(0, False), load_weight_kg=0.0)
    assert result.tipping_risk is TippingRisk.LOW


def test_slope_above_model_maximum_is_high() -> None:
    result = assess(ground_slope_deg=1.5)
    assert result.tipping_risk is TippingRisk.HIGH
    assert codes(result) == ["GROUND_SLOPE_EXCEEDED"]


def test_slope_at_the_maximum_is_fine() -> None:
    assert assess(ground_slope_deg=1.0).tipping_risk is TippingRisk.LOW


def test_outside_chart_with_load_is_high_even_without_level() -> None:
    result = assess(level=None, outside_chart=True)
    assert result.tipping_risk is TippingRisk.HIGH
    assert codes(result) == ["OUTSIDE_LOAD_CHART"]


def test_outside_chart_without_load_has_no_risk_verdict() -> None:
    result = assess(level=None, outside_chart=True, load_weight_kg=0.0)
    assert result.tipping_risk is None


def test_missing_inputs_generate_info_alerts_and_stay_out_of_the_risk() -> None:
    result = assess(outriggers=None, ground_slope_deg=None)
    assert result.tipping_risk is TippingRisk.LOW
    assert codes(result) == ["OUTRIGGERS_NOT_INFORMED", "GROUND_SLOPE_NOT_INFORMED"]
    assert {alert.severity for alert in result.alerts} == {AlertSeverity.INFO}


def test_high_comes_before_attention_and_info() -> None:
    result = assess(level=LimitLevel.WARNING, ground_slope_deg=5.0, outriggers=None)
    assert codes(result) == [
        "GROUND_SLOPE_EXCEEDED",
        "CAPACITY_LIMIT_WARNING",
        "OUTRIGGERS_NOT_INFORMED",
    ]


@pytest.mark.parametrize(
    ("compared", "expected"),
    [
        (7000.0, LimitLevel.OK),
        (8000.0, LimitLevel.WARNING),  # 94,1 % do limite (RN-011, exemplo)
        (8500.0, LimitLevel.WARNING),  # exatamente 100 % do limite ainda não é "acima"
        (9000.0, LimitLevel.OVER),
    ],
)
def test_limit_level_uses_the_effective_capacity(compared: float, expected: LimitLevel) -> None:
    profile = SafetyProfile(capacity_limit_percent=85.0)
    assert limit_level(compared, 10_000.0, profile) is expected


def test_limit_level_with_zero_capacity() -> None:
    assert limit_level(1.0, 0.0, SafetyProfile()) is LimitLevel.OVER
    assert limit_level(0.0, 0.0, SafetyProfile()) is LimitLevel.OK


@pytest.mark.parametrize("limit", [0, 101, float("nan")])
def test_profile_rejects_invalid_limit(limit: float) -> None:
    with pytest.raises(ValueError):
        SafetyProfile(capacity_limit_percent=limit)
