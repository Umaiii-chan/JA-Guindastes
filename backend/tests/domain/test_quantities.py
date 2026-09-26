"""Value objects de grandeza física em unidades internas (RN-006, RNF-004; doc-fonte § 20.1)."""

import dataclasses
import math
from collections.abc import Callable

import pytest

from app.domain.exceptions.domain_errors import InvalidQuantityError
from app.domain.value_objects.angle import Angle
from app.domain.value_objects.length import Length
from app.domain.value_objects.mass import Mass

type QuantityFactory = Callable[[float], object]

ALL_QUANTITIES: list[QuantityFactory] = [Length, Angle, Mass]
NON_NEGATIVE_QUANTITIES: list[QuantityFactory] = [Length, Mass]


def test_length_stores_meters() -> None:
    assert Length(12.5).meters == 12.5


def test_angle_stores_degrees() -> None:
    assert Angle(42.0).degrees == 42.0


def test_mass_stores_kilograms() -> None:
    assert Mass(1500.0).kilograms == 1500.0


@pytest.mark.parametrize("factory", ALL_QUANTITIES)
@pytest.mark.parametrize("value", [math.nan, math.inf, -math.inf])
def test_quantities_reject_nan_and_infinity(factory: QuantityFactory, value: float) -> None:
    with pytest.raises(InvalidQuantityError):
        factory(value)


@pytest.mark.parametrize("factory", ALL_QUANTITIES)
@pytest.mark.parametrize("value", ["10", None, True])
def test_quantities_reject_non_numeric_values(factory: QuantityFactory, value: object) -> None:
    with pytest.raises(InvalidQuantityError):
        factory(value)  # type: ignore[arg-type]


@pytest.mark.parametrize("factory", NON_NEGATIVE_QUANTITIES)
def test_length_and_mass_reject_negative_values(factory: QuantityFactory) -> None:
    with pytest.raises(InvalidQuantityError):
        factory(-0.1)


@pytest.mark.parametrize("factory", NON_NEGATIVE_QUANTITIES)
def test_length_and_mass_accept_zero(factory: QuantityFactory) -> None:
    factory(0.0)


def test_angle_accepts_negative_values_because_sign_convention_is_pending() -> None:
    # P-001 (known-gaps): zero e sentido dos ângulos não definidos; o domínio não restringe o sinal.
    assert Angle(-15.0).degrees == -15.0


def test_integer_input_is_normalized_to_float() -> None:
    length = Length(10)

    assert isinstance(length.meters, float)
    assert length == Length(10.0)


def test_negative_zero_is_normalized_to_zero() -> None:
    assert math.copysign(1.0, Mass(-0.0).kilograms) == 1.0


def test_equal_quantities_are_equal_and_hash_equal() -> None:
    assert Length(8.0) == Length(8.0)
    assert hash(Length(8.0)) == hash(Length(8.0))


def test_quantities_of_same_type_are_ordered() -> None:
    assert sorted([Length(9.0), Length(3.0)]) == [Length(3.0), Length(9.0)]


def test_quantities_are_immutable() -> None:
    length = Length(5.0)

    with pytest.raises(dataclasses.FrozenInstanceError):
        length.meters = 6.0  # type: ignore[misc]
