"""Cálculo de utilização: carga / capacidade × 100 (doc-fonte § 14.3).

Os números são FICTÍCIOS e só exercitam a conta. Não há status nem alerta (PEND-004) nem
arredondamento (PEND-002).
"""

import pytest

from app.domain.exceptions.domain_errors import UndefinedUtilizationError
from app.domain.services.utilization import calculate_utilization_percent
from app.domain.value_objects.mass import Mass


@pytest.mark.parametrize(
    ("load_kg", "capacity_kg", "expected_percent"),
    [
        pytest.param(0.0, 4000.0, 0.0, id="sem-carga"),
        pytest.param(1000.0, 4000.0, 25.0, id="abaixo"),
        pytest.param(4000.0, 4000.0, 100.0, id="igual"),
        pytest.param(6000.0, 4000.0, 150.0, id="acima"),
    ],
)
def test_ficticio_utilization_is_load_over_capacity_times_100(
    load_kg: float, capacity_kg: float, expected_percent: float
) -> None:
    assert calculate_utilization_percent(Mass(load_kg), Mass(capacity_kg)) == pytest.approx(
        expected_percent
    )


def test_ficticio_utilization_is_not_rounded_because_rounding_policy_is_pending() -> None:
    # PEND-002: 1000 / 3000 × 100 fica 33.333..., não 33.33.
    result = calculate_utilization_percent(Mass(1000.0), Mass(3000.0))

    assert result == pytest.approx(100 / 3, rel=1e-12)
    assert result != round(result, 2)


def test_utilization_with_zero_capacity_is_undefined() -> None:
    with pytest.raises(UndefinedUtilizationError):
        calculate_utilization_percent(Mass(1000.0), Mass(0.0))


def test_utilization_that_overflows_to_infinity_is_undefined() -> None:
    with pytest.raises(UndefinedUtilizationError):
        calculate_utilization_percent(Mass(1e308), Mass(1e-10))
