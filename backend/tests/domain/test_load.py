"""Carga da simulação no domínio (`Load`, RF-011; doc-fonte § 10.2; TASK-028).

Todos os valores são FICTÍCIOS (ADR-012): não vêm de nenhuma carga ou tabela real.
"""

import dataclasses
import math

import pytest

from app.domain.entities.load import Load
from app.domain.exceptions.domain_errors import DomainError, InvalidQuantityError
from app.domain.exceptions.load_errors import InvalidLoadError
from app.domain.services.compared_load_weight import weight_compared_with_capacity
from app.domain.value_objects.length import Length
from app.domain.value_objects.load_center_of_gravity import LoadCenterOfGravity
from app.domain.value_objects.load_dimensions import LoadDimensions
from app.domain.value_objects.mass import Mass

# FICTÍCIO: caixa de 4 m x 2 m x 1 m e 5000 kg.
FICTITIOUS_DIMENSIONS = LoadDimensions(length=Length(4.0), width=Length(2.0), height=Length(1.0))
FICTITIOUS_WEIGHT = Mass(5000.0)
FICTITIOUS_DESCRIPTION = "FICTÍCIO — bloco de concreto de teste"


def make_load(**overrides: object) -> Load:
    fields: dict[str, object] = {
        "description": FICTITIOUS_DESCRIPTION,
        "weight": FICTITIOUS_WEIGHT,
        "dimensions": FICTITIOUS_DIMENSIONS,
    }
    fields.update(overrides)
    return Load(**fields)  # type: ignore[arg-type]


# CA-1 — criação válida


def test_load_keeps_the_informed_values() -> None:
    load = make_load()

    assert load.description == FICTITIOUS_DESCRIPTION
    assert load.weight == Mass(5000.0)
    assert load.dimensions.length == Length(4.0)
    assert load.dimensions.width == Length(2.0)
    assert load.dimensions.height == Length(1.0)


def test_id_and_center_of_gravity_are_optional() -> None:
    load = make_load()

    assert load.id is None
    assert load.center_of_gravity is None


def test_load_accepts_an_id_and_a_center_of_gravity() -> None:
    cg = LoadCenterOfGravity(along_length_m=0.5, along_width_m=-0.25, along_height_m=0.0)

    load = make_load(id="carga-ficticia-1", center_of_gravity=cg)

    assert load.id == "carga-ficticia-1"
    assert load.center_of_gravity == cg


def test_dimensions_do_not_need_to_be_ordered() -> None:
    dimensions = LoadDimensions(length=Length(1.0), width=Length(3.0), height=Length(2.0))

    assert make_load(dimensions=dimensions).dimensions == dimensions


# CA-2 — validações


def test_invalid_load_error_is_a_domain_error() -> None:
    assert issubclass(InvalidLoadError, DomainError)


def test_zero_weight_is_rejected_provisionally() -> None:
    with pytest.raises(InvalidLoadError):
        make_load(weight=Mass(0.0))


@pytest.mark.parametrize("zero_field", ["length", "width", "height"])
def test_zero_dimension_is_rejected_provisionally(zero_field: str) -> None:
    values = {"length": Length(4.0), "width": Length(2.0), "height": Length(1.0)}
    values[zero_field] = Length(0.0)

    with pytest.raises(InvalidLoadError):
        LoadDimensions(**values)


@pytest.mark.parametrize("wrong_field", ["length", "width", "height"])
def test_dimension_must_be_a_length(wrong_field: str) -> None:
    values: dict[str, object] = {"length": Length(4.0), "width": Length(2.0), "height": Length(1.0)}
    values[wrong_field] = 1.0

    with pytest.raises(InvalidLoadError):
        LoadDimensions(**values)  # type: ignore[arg-type]


@pytest.mark.parametrize("value", [-1.0, math.nan, math.inf])
def test_negative_or_non_finite_quantities_are_rejected_by_the_value_objects(value: float) -> None:
    with pytest.raises(InvalidQuantityError):
        make_load(weight=Mass(value))
    with pytest.raises(InvalidQuantityError):
        LoadDimensions(length=Length(value), width=Length(2.0), height=Length(1.0))


@pytest.mark.parametrize(
    ("field_name", "value"),
    [
        ("weight", 5000.0),
        ("dimensions", (4.0, 2.0, 1.0)),
        ("center_of_gravity", (0.0, 0.0, 0.0)),
        ("description", 123),
        ("id", 42),
    ],
)
def test_fields_with_wrong_type_are_rejected(field_name: str, value: object) -> None:
    with pytest.raises(InvalidLoadError):
        make_load(**{field_name: value})


@pytest.mark.parametrize("description", ["", "   "])
def test_blank_description_is_rejected(description: str) -> None:
    with pytest.raises(InvalidLoadError):
        make_load(description=description)


@pytest.mark.parametrize("load_id", ["", "   "])
def test_blank_id_is_rejected(load_id: str) -> None:
    with pytest.raises(InvalidLoadError):
        make_load(id=load_id)


# CA-3 — centro de gravidade opcional


@pytest.mark.parametrize(
    "offsets",
    [
        (0.0, 0.0, 0.0),
        (2.0, 1.0, 0.5),  # no vértice da caixa (faces incluídas)
        (-2.0, -1.0, -0.5),
    ],
)
def test_center_of_gravity_inside_the_box_is_accepted(
    offsets: tuple[float, float, float],
) -> None:
    cg = LoadCenterOfGravity(*offsets)

    assert make_load(center_of_gravity=cg).center_of_gravity == cg


@pytest.mark.parametrize(
    "offsets",
    [
        (2.001, 0.0, 0.0),
        (0.0, -1.001, 0.0),
        (0.0, 0.0, 0.501),
    ],
)
def test_center_of_gravity_outside_the_box_is_rejected(
    offsets: tuple[float, float, float],
) -> None:
    with pytest.raises(InvalidLoadError):
        make_load(center_of_gravity=LoadCenterOfGravity(*offsets))


@pytest.mark.parametrize("value", [math.nan, math.inf, -math.inf, "0", None, True])
def test_center_of_gravity_coordinates_must_be_finite_numbers(value: object) -> None:
    with pytest.raises(InvalidQuantityError):
        LoadCenterOfGravity(value, 0.0, 0.0)  # type: ignore[arg-type]
    with pytest.raises(InvalidQuantityError):
        LoadCenterOfGravity(0.0, value, 0.0)  # type: ignore[arg-type]
    with pytest.raises(InvalidQuantityError):
        LoadCenterOfGravity(0.0, 0.0, value)  # type: ignore[arg-type]


def test_center_of_gravity_normalizes_integers_to_float() -> None:
    cg = LoadCenterOfGravity(1, 0, -0.0)

    assert cg == LoadCenterOfGravity(1.0, 0.0, 0.0)
    assert isinstance(cg.along_length_m, float)


# CA-4 — igualdade e imutabilidade


def test_loads_with_the_same_values_are_equal() -> None:
    cg = LoadCenterOfGravity(0.1, 0.2, 0.3)

    assert make_load(id="x", center_of_gravity=cg) == make_load(
        id="x", center_of_gravity=LoadCenterOfGravity(0.1, 0.2, 0.3)
    )
    assert hash(make_load()) == hash(make_load())


def test_loads_with_different_values_are_not_equal() -> None:
    assert make_load() != make_load(weight=Mass(5000.5))
    assert make_load() != make_load(id="carga-ficticia-1")
    assert make_load() != make_load(center_of_gravity=LoadCenterOfGravity(0.0, 0.0, 0.0))


@pytest.mark.parametrize(
    ("instance", "field_name", "value"),
    [
        (make_load(), "weight", Mass(1.0)),
        (make_load(), "center_of_gravity", None),
        (FICTITIOUS_DIMENSIONS, "length", Length(9.0)),
        (LoadCenterOfGravity(0.0, 0.0, 0.0), "along_height_m", 1.0),
    ],
)
def test_load_and_its_value_objects_are_immutable(
    instance: object, field_name: str, value: object
) -> None:
    with pytest.raises(dataclasses.FrozenInstanceError):
        setattr(instance, field_name, value)


# CA-5 — peso comparado com a capacidade


def test_compared_weight_is_exactly_the_informed_weight() -> None:
    load = make_load(
        weight=Mass(1234.5),
        center_of_gravity=LoadCenterOfGravity(0.5, 0.0, 0.0),
    )

    assert weight_compared_with_capacity(load) == Mass(1234.5)
    assert weight_compared_with_capacity(load) is load.weight
