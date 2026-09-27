"""Zonas de giro (ADR-018 § 1; TASK-046 CA-1), com dados FICTÍCIOS (ADR-012)."""

import pytest

from app.domain.entities.load_chart import LoadChart, LoadChartStatus
from app.domain.exceptions.domain_errors import InvalidRotationZonesError
from app.domain.services.compared_load_weight import weight_compared_with_capacity
from app.domain.value_objects.mass import Mass
from app.domain.value_objects.rotation_zone import (
    ROTATION_ZONE_BOUNDARY_TOLERANCE_DEG,
    RotationZone,
    RotationZones,
)
from tests.fixtures.load_chart_ficticio import build_load_chart_ficticio
from tests.fixtures.rotation_zones_ficticias import (
    ZONA_FRONTAL_FICTICIA,
    ZONA_LATERAL_TRASEIRA_FICTICIA,
    zonas_ficticias,
)

EPS = ROTATION_ZONE_BOUNDARY_TOLERANCE_DEG


def _zone(code: str, start: float, end: float, name: str = "Zona FICTÍCIA") -> RotationZone:
    return RotationZone(code=code, name=name, start_deg=start, end_deg=end)


# --- zona isolada ---------------------------------------------------------------------------


def test_zone_crossing_zero_has_the_span_in_the_increasing_direction() -> None:
    frontal = _zone("FRONTAL", 305.0, 55.0)

    assert frontal.span_deg == pytest.approx(110.0)
    assert frontal.contains(0.0)
    assert frontal.contains(305.0)
    assert frontal.contains(54.9)
    assert not frontal.contains(55.0)
    assert not frontal.contains(180.0)


@pytest.mark.parametrize("code", ["", "frontal", "FRONTAL-1", "Á", "A" * 33, 1, None])
def test_zone_code_must_be_1_to_32_uppercase_digits_or_underscore(code: object) -> None:
    with pytest.raises(InvalidRotationZonesError):
        _zone(code, 0.0, 180.0)  # type: ignore[arg-type]


def test_zone_code_accepts_32_characters_of_the_allowed_set() -> None:
    assert _zone("A_1" + "Z" * 29, 0.0, 180.0).code == "A_1" + "Z" * 29


@pytest.mark.parametrize("name", ["", "   ", "N" * 81, 7])
def test_zone_name_must_have_1_to_80_characters(name: object) -> None:
    with pytest.raises(InvalidRotationZonesError):
        _zone("FRONTAL", 0.0, 180.0, name=name)  # type: ignore[arg-type]


def test_zone_name_accepts_80_characters() -> None:
    assert _zone("FRONTAL", 0.0, 180.0, name="N" * 80).name == "N" * 80


@pytest.mark.parametrize(
    ("start", "end"),
    [(-1.0, 90.0), (0.0, 360.0), (float("nan"), 90.0), (0.0, float("inf")), (True, 90.0)],
)
def test_zone_angles_must_be_finite_numbers_in_0_360(start: object, end: object) -> None:
    with pytest.raises(InvalidRotationZonesError):
        _zone("FRONTAL", start, end)  # type: ignore[arg-type]


def test_zone_without_span_is_rejected() -> None:
    with pytest.raises(InvalidRotationZonesError, match="amplitude"):
        _zone("FRONTAL", 90.0, 90.0)


# --- conjunto de zonas ----------------------------------------------------------------------


def test_fictitious_front_and_side_rear_zones_cover_360_degrees() -> None:
    zones = zonas_ficticias()

    assert zones.codes == (ZONA_FRONTAL_FICTICIA, ZONA_LATERAL_TRASEIRA_FICTICIA)
    assert sum(zone.span_deg for zone in zones.zones) == pytest.approx(360.0)
    assert zones.by_code(ZONA_FRONTAL_FICTICIA) is zones.zones[0]
    assert zones.by_code("INEXISTENTE") is None


def test_zones_keep_the_declared_order_even_when_not_sorted() -> None:
    zones = RotationZones(
        zones=(_zone("C", 240.0, 0.0), _zone("A", 0.0, 120.0), _zone("B", 120.0, 240.0))
    )

    assert zones.codes == ("C", "A", "B")


def test_at_least_two_zones_are_required() -> None:
    with pytest.raises(InvalidRotationZonesError, match="pelo menos 2"):
        RotationZones(zones=(_zone("A", 0.0, 359.0),))
    with pytest.raises(InvalidRotationZonesError, match="pelo menos 2"):
        RotationZones(zones=())


def test_repeated_codes_are_rejected() -> None:
    with pytest.raises(InvalidRotationZonesError, match="repetidos"):
        RotationZones(zones=(_zone("A", 0.0, 180.0), _zone("A", 180.0, 0.0)))


@pytest.mark.parametrize(
    "zones",
    [
        pytest.param((_zone("A", 0.0, 170.0), _zone("B", 180.0, 0.0)), id="buraco"),
        pytest.param((_zone("A", 0.0, 190.0), _zone("B", 180.0, 0.0)), id="sobreposição"),
        pytest.param((_zone("A", 0.0, 90.0), _zone("B", 0.0, 180.0)), id="mesmo início"),
        pytest.param(
            (_zone("A", 0.0, 270.0), _zone("B", 270.0, 180.0), _zone("C", 180.0, 0.0)),
            id="volta dupla",
        ),
    ],
)
def test_zones_must_cover_360_degrees_without_overlap(zones: tuple[RotationZone, ...]) -> None:
    with pytest.raises(InvalidRotationZonesError, match="360"):
        RotationZones(zones=zones)


def test_boundary_difference_within_epsilon_is_accepted() -> None:
    zones = RotationZones(zones=(_zone("A", 0.0, 180.0), _zone("B", 180.0 + EPS / 2, 0.0)))

    assert zones.codes == ("A", "B")


def test_rejects_something_that_is_not_a_zone() -> None:
    with pytest.raises(InvalidRotationZonesError):
        RotationZones(zones=(_zone("A", 0.0, 180.0), "B"))  # type: ignore[arg-type]


# --- ψ → zona -------------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("psi", "expected"),
    [
        (0.0, ZONA_FRONTAL_FICTICIA),
        (30.0, ZONA_FRONTAL_FICTICIA),
        (320.0, ZONA_FRONTAL_FICTICIA),
        (359.999, ZONA_FRONTAL_FICTICIA),
        (90.0, ZONA_LATERAL_TRASEIRA_FICTICIA),
        (180.0, ZONA_LATERAL_TRASEIRA_FICTICIA),
        (300.0, ZONA_LATERAL_TRASEIRA_FICTICIA),
        (55.0 + 2 * EPS, ZONA_LATERAL_TRASEIRA_FICTICIA),
        (55.0 - 2 * EPS, ZONA_FRONTAL_FICTICIA),
        (-60.0, ZONA_LATERAL_TRASEIRA_FICTICIA),
        (720.0, ZONA_FRONTAL_FICTICIA),
    ],
)
def test_psi_inside_a_sector_selects_that_zone(psi: float, expected: str) -> None:
    assert [zone.code for zone in zonas_ficticias().zones_at(psi)] == [expected]


@pytest.mark.parametrize(
    "psi", [55.0, 55.0 + EPS / 2, 55.0 - EPS, 305.0, 305.0 - EPS / 2, 305.0 + EPS]
)
def test_psi_on_a_boundary_within_epsilon_selects_both_neighbours(psi: float) -> None:
    codes = [zone.code for zone in zonas_ficticias().zones_at(psi)]

    assert codes == [ZONA_FRONTAL_FICTICIA, ZONA_LATERAL_TRASEIRA_FICTICIA]


def test_boundary_at_zero_is_found_across_the_turn() -> None:
    zones = RotationZones(zones=(_zone("A", 0.0, 180.0), _zone("B", 180.0, 0.0)))

    assert [zone.code for zone in zones.zones_at(360.0 - EPS / 2)] == ["A", "B"]
    assert [zone.code for zone in zones.zones_at(EPS / 2)] == ["A", "B"]
    assert [zone.code for zone in zones.zones_at(90.0)] == ["A"]


# --- tabela com zona e peso comparado ------------------------------------------------------


def test_load_chart_keeps_a_valid_rotation_zone_code() -> None:
    chart = build_load_chart_ficticio()

    assert chart.rotation_zone_code is None
    with_zone = LoadChart(
        id=chart.id,
        version=chart.version,
        configuration_id=chart.configuration_id,
        status=LoadChartStatus.DRAFT,
        points=chart.points,
        rotation_zone_code=ZONA_FRONTAL_FICTICIA,
    )
    assert with_zone.rotation_zone_code == ZONA_FRONTAL_FICTICIA


def test_load_chart_rejects_an_invalid_rotation_zone_code() -> None:
    chart = build_load_chart_ficticio()

    with pytest.raises(InvalidRotationZonesError):
        LoadChart(
            id=chart.id,
            version=chart.version,
            configuration_id=chart.configuration_id,
            status=LoadChartStatus.DRAFT,
            points=chart.points,
            rotation_zone_code="frontal",
        )


def test_compared_weight_is_load_plus_hook_block() -> None:
    assert weight_compared_with_capacity(Mass(3000.0), Mass(200.0)) == Mass(3200.0)


def test_compared_weight_without_hook_block_is_the_load_weight() -> None:
    weight = Mass(3000.0)

    assert weight_compared_with_capacity(weight) is weight
    assert weight_compared_with_capacity(weight, Mass(0.0)) is weight
