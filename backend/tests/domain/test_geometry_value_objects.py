"""Value objects da geometria: `CraneGeometry` e `OperationalState` (ADR-013 C-2 e C-4).

`CraneGeometry` é a ficha técnica geométrica; `OperationalState`, as entradas L, θ, ψ e c. Os
parâmetros são FICTÍCIOS (`tests/fixtures/crane_geometry_ficticia.py`).
"""

import dataclasses
import math
from typing import Any

import pytest

from app.domain.exceptions.domain_errors import InvalidQuantityError
from app.domain.exceptions.geometry_errors import (
    InvalidCraneGeometryError,
    InvalidOperationalStateError,
)
from app.domain.value_objects.angle import Angle
from app.domain.value_objects.crane_geometry import CraneGeometry
from app.domain.value_objects.length import Length
from app.domain.value_objects.operational_state import OperationalState
from tests.fixtures.crane_geometry_ficticia import build_crane_geometry_ficticia, state_ficticio

# --- CraneGeometry ------------------------------------------------------------------------------


def test_ficticia_crane_geometry_keeps_its_parameters_in_meters_and_degrees() -> None:
    geometry = build_crane_geometry_ficticia(
        turret_rotation_min_deg=-30.0, turret_rotation_max_deg=30.0
    )

    assert geometry.boom_pivot_offset_m == 1.5
    assert geometry.boom_pivot_height == Length(2.5)
    assert (geometry.boom_length_min, geometry.boom_length_max) == (Length(10.0), Length(30.0))
    assert (geometry.boom_angle_min, geometry.boom_angle_max) == (Angle(0.0), Angle(90.0))
    assert (geometry.cable_length_min, geometry.cable_length_max) == (Length(0.0), Length(40.0))
    assert (geometry.turret_rotation_min, geometry.turret_rotation_max) == (
        Angle(-30.0),
        Angle(30.0),
    )


@pytest.mark.parametrize("offset_m", [pytest.param(-2.0, id="atras-do-eixo"), 0.0, 1.5])
def test_ficticia_boom_pivot_offset_has_sign_and_accepts_zero(offset_m: float) -> None:
    # ADR-013 C-4: a é positivo do lado da ponta, negativo atrás do eixo de giro; 0 é válido.
    geometry = build_crane_geometry_ficticia(boom_pivot_offset_m=offset_m)

    assert geometry.boom_pivot_offset_m == offset_m


@pytest.mark.parametrize("offset", [math.nan, math.inf, -math.inf, True, "1.5"])
def test_boom_pivot_offset_must_be_a_finite_number(offset: Any) -> None:
    with pytest.raises(InvalidQuantityError):
        build_crane_geometry_ficticia(boom_pivot_offset_m=offset)


def test_boom_pivot_height_cannot_be_negative() -> None:
    # ADR-013 C-4: h é a altura do pino ACIMA do plano de apoio.
    with pytest.raises(InvalidQuantityError):
        build_crane_geometry_ficticia(boom_pivot_height_m=-0.1)


def test_ficticia_fixed_boom_has_equal_min_and_max_length() -> None:
    # ADR-013 C-4: L_min e L_max iguais se a lança for fixa.
    geometry = build_crane_geometry_ficticia(boom_length_min_m=12.0, boom_length_max_m=12.0)

    assert geometry.boom_length_min == geometry.boom_length_max


def test_ficticia_vertical_boom_angle_is_a_valid_maximum() -> None:
    # ADR-013 C-2: as fórmulas valem para −90° < θ ≤ 90°.
    geometry = build_crane_geometry_ficticia(boom_angle_max_deg=90.0)

    assert geometry.boom_angle_max == Angle(90.0)


def test_ficticia_boom_angle_range_can_go_below_horizontal() -> None:
    # Se a lança opera abaixo da horizontal é A VALIDAR (G-8); a fórmula aceita θ > −90°.
    geometry = build_crane_geometry_ficticia(boom_angle_min_deg=-89.9)

    assert geometry.boom_angle_min == Angle(-89.9)


def test_ficticia_optional_limits_default_to_none() -> None:
    geometry = build_crane_geometry_ficticia(cable_length_max_m=None)

    assert geometry.cable_length_max is None
    assert geometry.turret_rotation_min is None
    assert geometry.turret_rotation_max is None


@pytest.mark.parametrize(
    "turret_limits_deg",
    [
        pytest.param((0.0, 0.0), id="giro-travado"),
        pytest.param((-30.0, 30.0), id="setor-da-frente-com-negativo"),
        pytest.param((90.0, 270.0), id="setor-de-tras"),
        pytest.param((0.0, 359.9), id="quase-uma-volta"),
    ],
)
def test_ficticia_turret_rotation_limits_are_accepted(
    turret_limits_deg: tuple[float, float],
) -> None:
    minimum, maximum = turret_limits_deg

    geometry = build_crane_geometry_ficticia(
        turret_rotation_min_deg=minimum, turret_rotation_max_deg=maximum
    )

    assert geometry.turret_rotation_min == Angle(minimum)
    assert geometry.turret_rotation_max == Angle(maximum)


@pytest.mark.parametrize(
    "changes",
    [
        pytest.param({"boom_length_min_m": 30.1, "boom_length_max_m": 30.0}, id="lanca-min>max"),
        pytest.param({"boom_angle_min_deg": 60.0, "boom_angle_max_deg": 50.0}, id="angulo-min>max"),
        pytest.param({"boom_angle_min_deg": -90.0}, id="angulo-min=-90"),
        pytest.param({"boom_angle_min_deg": -120.0}, id="angulo-min<-90"),
        pytest.param({"boom_angle_max_deg": 90.1}, id="angulo-max>90"),
        pytest.param({"cable_length_min_m": 5.0, "cable_length_max_m": 4.0}, id="cabo-min>max"),
        pytest.param({"turret_rotation_min_deg": -30.0}, id="giro-so-minimo"),
        pytest.param({"turret_rotation_max_deg": 30.0}, id="giro-so-maximo"),
        pytest.param(
            {"turret_rotation_min_deg": 30.0, "turret_rotation_max_deg": -30.0},
            id="giro-min>max",
        ),
        pytest.param(
            {"turret_rotation_min_deg": -180.0, "turret_rotation_max_deg": 180.0},
            id="giro-amplitude-360",
        ),
        pytest.param(
            {"turret_rotation_min_deg": 0.0, "turret_rotation_max_deg": 400.0},
            id="giro-amplitude-maior-que-360",
        ),
    ],
)
def test_ficticia_incoherent_ranges_are_rejected(changes: dict[str, float]) -> None:
    with pytest.raises(InvalidCraneGeometryError):
        build_crane_geometry_ficticia(**changes)


@pytest.mark.parametrize(
    "field_name",
    [
        "boom_pivot_height",
        "boom_length_min",
        "boom_length_max",
        "boom_angle_min",
        "boom_angle_max",
        "cable_length_min",
        "cable_length_max",
        "turret_rotation_min",
        "turret_rotation_max",
    ],
)
def test_crane_geometry_rejects_raw_numbers_instead_of_value_objects(field_name: str) -> None:
    valid = build_crane_geometry_ficticia(
        turret_rotation_min_deg=-30.0, turret_rotation_max_deg=30.0
    )

    with pytest.raises(InvalidCraneGeometryError):
        dataclasses.replace(valid, **{field_name: 10.0})


def test_crane_geometry_is_immutable() -> None:
    geometry = build_crane_geometry_ficticia()

    with pytest.raises(dataclasses.FrozenInstanceError):
        geometry.boom_pivot_offset_m = 0.0  # type: ignore[misc]


def test_crane_geometry_normalizes_integer_offset_to_float() -> None:
    geometry = CraneGeometry(
        boom_pivot_offset_m=2,
        boom_pivot_height=Length(2.5),
        boom_length_min=Length(10.0),
        boom_length_max=Length(30.0),
        boom_angle_min=Angle(0.0),
        boom_angle_max=Angle(80.0),
        cable_length_min=Length(0.0),
    )

    assert isinstance(geometry.boom_pivot_offset_m, float)


# --- OperationalState ---------------------------------------------------------------------------


def test_ficticio_operational_state_keeps_its_inputs() -> None:
    state = state_ficticio(
        boom_length_m=18.0, boom_angle_deg=35.0, turret_rotation_deg=120.0, cable_length_m=6.0
    )

    assert state.boom_length == Length(18.0)
    assert state.boom_angle == Angle(35.0)
    assert state.turret_rotation == Angle(120.0)
    assert state.cable_length == Length(6.0)


@pytest.mark.parametrize(
    ("turret_rotation_deg", "expected_deg"),
    [
        pytest.param(0.0, 0.0, id="zero"),
        pytest.param(359.5, 359.5, id="dentro-da-volta"),
        pytest.param(360.0, 0.0, id="uma-volta"),
        pytest.param(370.0, 10.0, id="mais-de-uma-volta"),
        pytest.param(720.0, 0.0, id="duas-voltas"),
        pytest.param(-90.0, 270.0, id="negativo"),
        pytest.param(-30.0, 330.0, id="negativo-pequeno"),
        pytest.param(-1e-20, 0.0, id="negativo-minusculo-nao-vira-360"),
    ],
)
def test_turret_rotation_is_stored_normalized_to_one_turn(
    turret_rotation_deg: float, expected_deg: float
) -> None:
    # ADR-013 C-2: o giro é guardado normalizado em [0°, 360°).
    state = state_ficticio(turret_rotation_deg=turret_rotation_deg)

    assert state.turret_rotation.degrees == pytest.approx(expected_deg, abs=1e-9)
    assert 0.0 <= state.turret_rotation.degrees < 360.0


def test_boom_angle_is_not_normalized() -> None:
    # Só o giro é normalizado; θ fora das faixas é sinalizado pelo GeometryService.
    assert state_ficticio(boom_angle_deg=-10.0).boom_angle == Angle(-10.0)


@pytest.mark.parametrize(
    "field_name", ["boom_length", "boom_angle", "turret_rotation", "cable_length"]
)
def test_operational_state_rejects_raw_numbers_instead_of_value_objects(field_name: str) -> None:
    fields: dict[str, object] = {
        "boom_length": Length(20.0),
        "boom_angle": Angle(30.0),
        "turret_rotation": Angle(0.0),
        "cable_length": Length(5.0),
    }
    fields[field_name] = 10.0

    with pytest.raises(InvalidOperationalStateError):
        OperationalState(**fields)  # type: ignore[arg-type]


def test_operational_state_is_immutable() -> None:
    state = state_ficticio()

    with pytest.raises(dataclasses.FrozenInstanceError):
        state.boom_length = Length(1.0)  # type: ignore[misc]
