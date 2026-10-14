"""Entidade `Scenario` e `ScenarioSpec` (TASK-052; ADR-023). Dados FICTÍCIOS."""

import math
from dataclasses import replace
from datetime import timedelta

import pytest

from app.domain.entities.scenario import (
    MAX_OBSTACLES,
    MAX_TERRAIN_FEATURES,
    CargoPlacementSpec,
    CranePlacementSpec,
    DeliveryPointSpec,
    FeatureKind,
    ObstacleKind,
    ObstacleSpec,
    Scenario,
    ScenarioSpec,
    SoilKind,
    SoilZoneSpec,
    TerrainFeatureSpec,
    TerrainSpec,
    WindSpec,
    normalize_scenario_name,
    scenario_spec_from_dict,
    scenario_spec_to_dict,
)
from app.domain.exceptions.scenario_errors import InvalidScenarioError
from tests.fixtures.auth_ficticia import INSTANTE_FICTICIO
from tests.fixtures.scenario_ficticio import scenario_ficticio, spec_ficticio, spec_json_ficticio


def feature(**changes: object) -> TerrainFeatureSpec:
    return replace(TerrainFeatureSpec("f", FeatureKind.MOUND, 0, 0, 3.0, 1.0), **changes)  # type: ignore[arg-type]


def obstacle(**changes: object) -> ObstacleSpec:
    base = ObstacleSpec("o", "Caixa", ObstacleKind.BOX, 0, 0, 1.0, 1.0, 1.0, 0)
    return replace(base, **changes)  # type: ignore[arg-type]


def test_empty_spec_is_valid_and_flat() -> None:
    spec = ScenarioSpec()

    assert spec.terrain == TerrainSpec()
    assert spec.crane == CranePlacementSpec(0.0, 0.0, 0.0)
    assert spec.obstacles == ()


def test_spec_round_trips_through_the_json_form() -> None:
    spec = spec_ficticio()

    assert scenario_spec_to_dict(spec) == spec_json_ficticio()
    assert scenario_spec_from_dict(scenario_spec_to_dict(spec)) == spec


@pytest.mark.parametrize(
    ("terrain", "campo"),
    [
        (TerrainSpec(slope_x_percent=100.5), "spec.terrain.slope_x_percent"),
        (TerrainSpec(slope_z_percent=-101.0), "spec.terrain.slope_z_percent"),
        (TerrainSpec(slope_x_percent=math.nan), "spec.terrain.slope_x_percent"),
        (TerrainSpec(features=(feature(radius_m=0.0),)), "spec.terrain.features[0].radius_m"),
        (TerrainSpec(features=(feature(height_m=-0.1),)), "spec.terrain.features[0].height_m"),
        (TerrainSpec(features=(feature(width_m=0.0),)), "spec.terrain.features[0].width_m"),
        (TerrainSpec(features=(feature(center_x=math.inf),)), "spec.terrain.features[0].center_x"),
        (TerrainSpec(features=(feature(id=" "),)), "spec.terrain.features[0].id"),
        (TerrainSpec(features=(feature(), feature())), "spec.terrain.features"),
        (
            TerrainSpec(
                features=tuple(feature(id=f"f{i}") for i in range(MAX_TERRAIN_FEATURES + 1))
            ),
            "spec.terrain.features",
        ),
    ],
)
def test_invalid_terrain_is_rejected_with_the_field_path(terrain: TerrainSpec, campo: str) -> None:
    with pytest.raises(InvalidScenarioError) as error:
        ScenarioSpec(terrain=terrain)

    assert error.value.field == campo


@pytest.mark.parametrize(
    ("obstacles", "campo"),
    [
        ((obstacle(width_m=0.0),), "spec.obstacles[0].width_m"),
        ((obstacle(depth_m=-1.0),), "spec.obstacles[0].depth_m"),
        ((obstacle(height_m=0.0),), "spec.obstacles[0].height_m"),
        ((obstacle(label=""),), "spec.obstacles[0].label"),
        ((obstacle(), obstacle()), "spec.obstacles"),
        (
            tuple(obstacle(id=f"o{i}") for i in range(MAX_OBSTACLES + 1)),
            "spec.obstacles",
        ),
    ],
)
def test_invalid_obstacles_are_rejected(obstacles: tuple[ObstacleSpec, ...], campo: str) -> None:
    with pytest.raises(InvalidScenarioError) as error:
        ScenarioSpec(obstacles=obstacles)

    assert error.value.field == campo


def test_invalid_crane_placement_is_rejected() -> None:
    with pytest.raises(InvalidScenarioError) as error:
        ScenarioSpec(crane=CranePlacementSpec(x=math.nan))

    assert error.value.field == "spec.crane.x"


def test_scenario_name_is_trimmed_and_limited() -> None:
    assert normalize_scenario_name("  Pátio  ") == "Pátio"
    for invalid in ("", "   ", "x" * 121):
        with pytest.raises(InvalidScenarioError):
            normalize_scenario_name(invalid)


def test_scenario_validates_its_fields() -> None:
    scenario = scenario_ficticio("autor-1")
    assert scenario.author_user_id == "autor-1"

    with pytest.raises(InvalidScenarioError):
        replace(scenario, name=" nome com espaço ")
    with pytest.raises(ValueError, match="id do cenário"):
        replace(scenario, id=" ")
    with pytest.raises(ValueError, match="autor"):
        replace(scenario, author_user_id="")
    with pytest.raises(ValueError, match="fuso"):
        Scenario(
            "i", "n", "a", INSTANTE_FICTICIO.replace(tzinfo=None), INSTANTE_FICTICIO, ScenarioSpec()
        )
    with pytest.raises(ValueError, match="anterior"):
        replace(scenario, updated_at=INSTANTE_FICTICIO - timedelta(seconds=1))


def test_soil_zones_and_wind_round_trip_and_stay_out_of_old_json() -> None:
    old = spec_ficticio()
    assert "soil_zones" not in scenario_spec_to_dict(old)
    assert "wind" not in scenario_spec_to_dict(old)

    spec = replace(
        old,
        soil_zones=(SoilZoneSpec("s1", SoilKind.CLAY, 2.0, 3.0, 4.0),),
        wind=WindSpec(speed_ms=8.5, direction_deg=45.0),
    )

    assert scenario_spec_from_dict(scenario_spec_to_dict(spec)) == spec


def test_flatten_accepts_a_negative_level_but_mound_does_not() -> None:
    flatten = feature(kind=FeatureKind.FLATTEN, height_m=-1.5)
    ScenarioSpec(terrain=TerrainSpec(features=(flatten,)))

    with pytest.raises(InvalidScenarioError):
        ScenarioSpec(terrain=TerrainSpec(features=(feature(height_m=-1.0),)))


@pytest.mark.parametrize(
    ("changes", "campo"),
    [
        ({"soil_zones": (SoilZoneSpec("s", SoilKind.ROCK, 0, 0, 0.0),)}, "soil_zones[0].radius_m"),
        (
            {
                "soil_zones": (
                    SoilZoneSpec("s", SoilKind.ROCK, 0, 0, 1.0),
                    SoilZoneSpec("s", SoilKind.CLAY, 1, 1, 1.0),
                )
            },
            "soil_zones",
        ),
        ({"wind": WindSpec(speed_ms=-1.0, direction_deg=0.0)}, "wind.speed_ms"),
        ({"wind": WindSpec(speed_ms=math.nan, direction_deg=0.0)}, "wind.speed_ms"),
    ],
)
def test_invalid_soil_and_wind_are_rejected(changes: dict[str, object], campo: str) -> None:
    with pytest.raises(InvalidScenarioError) as raised:
        ScenarioSpec(**changes)  # type: ignore[arg-type]

    assert campo in raised.value.field


def test_cargo_and_delivery_round_trip_and_stay_out_of_old_json() -> None:
    old = spec_ficticio()
    assert "cargo" not in scenario_spec_to_dict(old)
    assert "delivery" not in scenario_spec_to_dict(old)

    spec = replace(
        old,
        cargo=CargoPlacementSpec(x=-6.0, z=4.0, rotation_y_deg=30.0),
        delivery=DeliveryPointSpec(x=8.0, z=-3.0, rotation_y_deg=0.0, radius_m=2.0),
    )

    assert scenario_spec_from_dict(scenario_spec_to_dict(spec)) == spec


@pytest.mark.parametrize(
    ("changes", "campo"),
    [
        ({"cargo": CargoPlacementSpec(x=math.nan, z=0.0, rotation_y_deg=0.0)}, "cargo.x"),
        ({"cargo": CargoPlacementSpec(x=0.0, z=0.0, rotation_y_deg=math.inf)}, "cargo"),
        (
            {"delivery": DeliveryPointSpec(x=0.0, z=0.0, rotation_y_deg=0.0, radius_m=0.1)},
            "delivery.radius_m",
        ),
        (
            {"delivery": DeliveryPointSpec(x=0.0, z=0.0, rotation_y_deg=0.0, radius_m=31.0)},
            "delivery.radius_m",
        ),
    ],
)
def test_invalid_cargo_and_delivery_are_rejected(changes: dict[str, object], campo: str) -> None:
    with pytest.raises(InvalidScenarioError) as raised:
        ScenarioSpec(**changes)  # type: ignore[arg-type]

    assert campo in raised.value.field
