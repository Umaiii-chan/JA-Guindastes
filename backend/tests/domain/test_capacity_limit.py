"""Limite de capacidade por modelo (RN-011; TASK-051; ADR-022). Dados FICTÍCIOS (ADR-012)."""

import pytest

from app.domain.exceptions.domain_errors import InvalidQuantityError
from app.domain.services.capacity_limit import CapacityLimitLevel, evaluate_capacity_limit
from app.domain.value_objects.crane_limits import CraneLimits
from app.domain.value_objects.mass import Mass


def test_default_limits_are_100_and_90_with_fictitious_slopes() -> None:
    limits = CraneLimits()

    assert limits.capacity_limit_percent == 100.0
    assert limits.warning_band_percent == 90.0
    assert limits.max_ground_slope_deg == 1.0
    assert limits.max_leveling_deg == 3.0


@pytest.mark.parametrize(
    "changes",
    [
        {"capacity_limit_percent": 0.5},
        {"capacity_limit_percent": 100.1},
        {"warning_band_percent": 0.0},
        {"warning_band_percent": 101.0},
        {"max_ground_slope_deg": -0.1},
        {"max_ground_slope_deg": 45.1},
        {"max_leveling_deg": -1.0},
        {"max_leveling_deg": float("nan")},
    ],
)
def test_limits_outside_the_range_are_rejected(changes: dict[str, float]) -> None:
    with pytest.raises(InvalidQuantityError):
        CraneLimits(**changes)


def test_rn_011_example_85_percent_of_10000_kg() -> None:
    limits = CraneLimits(capacity_limit_percent=85.0)

    attention = evaluate_capacity_limit(Mass(10_000.0), Mass(8_000.0), limits)
    over = evaluate_capacity_limit(Mass(10_000.0), Mass(9_000.0), limits)

    assert attention is not None
    assert over is not None
    assert attention.effective_capacity_kg == pytest.approx(8_500.0)
    assert attention.limit_utilization_percent == pytest.approx(94.1176470588)
    assert attention.level is CapacityLimitLevel.WARNING
    assert over.level is CapacityLimitLevel.OVER


def test_level_is_ok_below_the_warning_band() -> None:
    result = evaluate_capacity_limit(Mass(1_000.0), Mass(899.0), CraneLimits())

    assert result is not None
    assert result.level is CapacityLimitLevel.OK
    assert result.limit_percent == 100.0
    assert result.warning_band_percent == 90.0


def test_warning_starts_at_the_band_and_over_only_above_the_effective_capacity() -> None:
    limits = CraneLimits(capacity_limit_percent=50.0, warning_band_percent=80.0)

    levels = [
        evaluate_capacity_limit(Mass(1_000.0), Mass(weight), limits)
        for weight in (399.0, 400.0, 500.0, 500.1)
    ]

    assert [item.level for item in levels if item is not None] == [
        CapacityLimitLevel.OK,
        CapacityLimitLevel.WARNING,
        CapacityLimitLevel.WARNING,
        CapacityLimitLevel.OVER,
    ]


def test_without_limits_the_defaults_apply() -> None:
    result = evaluate_capacity_limit(Mass(1_000.0), Mass(1_001.0))

    assert result is not None
    assert result.level is CapacityLimitLevel.OVER


def test_zero_effective_capacity_has_no_limit_result() -> None:
    assert evaluate_capacity_limit(Mass(0.0), Mass(10.0)) is None
