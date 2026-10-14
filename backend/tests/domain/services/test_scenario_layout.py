"""Layout seguro dos obstáculos de um cenário gerado por IA (TASK-081). Dados fictícios."""

from dataclasses import replace

from app.domain.entities.scenario import (
    CargoPlacementSpec,
    CranePlacementSpec,
    DeliveryPointSpec,
    ObstacleKind,
    ObstacleSpec,
    ScenarioSpec,
)
from app.domain.services.scenario_layout import make_scenario_layout_safe


def car(x: float, z: float, label: str = "Carro") -> ObstacleSpec:
    return ObstacleSpec(
        id=label,
        label=label,
        kind=ObstacleKind.MODEL,
        model_id="sedan",
        center_x=x,
        center_z=z,
        width_m=4.5,
        depth_m=1.9,
        height_m=1.5,
        rotation_y_deg=0.0,
    )


def scenario(*obstacles: ObstacleSpec) -> ScenarioSpec:
    return ScenarioSpec(
        obstacles=obstacles,
        crane=CranePlacementSpec(x=0, z=0, heading_deg=0),
        cargo=CargoPlacementSpec(x=0, z=-20, rotation_y_deg=0),
        delivery=DeliveryPointSpec(x=0, z=25, rotation_y_deg=0, radius_m=2),
    )


def run(spec: ScenarioSpec):  # type: ignore[no-untyped-def]
    return make_scenario_layout_safe(spec, load_length_m=4, load_width_m=2)


def test_a_car_on_top_of_the_crane_is_moved_out_and_explained() -> None:
    layout = run(scenario(car(1, 1)))

    moved = layout.spec.obstacles[0]
    assert (moved.center_x, moved.center_z) != (1, 1)
    assert len(layout.moves) == 1
    assert "Carro movido de (1; 1)" in layout.moves[0].describe()
    assert layout.moves[0].describe().endswith("para não ficar sobre o guindaste.")
    # fora do retângulo 14 x 8 do guindaste
    assert abs(moved.center_x) - 2.25 >= 4 - 1e-6 or abs(moved.center_z) - 0.95 >= 7 - 1e-6


def test_a_car_on_the_delivery_point_is_moved_away_from_it() -> None:
    layout = run(scenario(car(0, 25)))

    moved = layout.spec.obstacles[0]
    assert ((moved.center_x) ** 2 + (moved.center_z - 25) ** 2) ** 0.5 >= 3.0
    assert "o ponto de entrega" in layout.moves[0].describe()


def test_a_flatbed_trailer_stays_on_the_delivery_point() -> None:
    trailer = replace(
        car(0, 25, "Carreta"), model_id="caminhao-plataforma", width_m=12, depth_m=2.6
    )

    layout = run(scenario(trailer))

    assert layout.moves == ()
    assert layout.spec.obstacles[0].center_z == 25


def test_a_flatbed_trailer_cannot_sit_on_the_crane() -> None:
    trailer = replace(car(0, 0, "Carreta"), model_id="caminhao-plataforma", width_m=12, depth_m=2.6)

    layout = run(scenario(trailer))

    assert len(layout.moves) == 1


def test_a_car_on_the_cargo_pickup_is_moved_and_obstacles_do_not_stack() -> None:
    layout = run(scenario(car(0, -20, "Carro 1"), car(0, -20, "Carro 2")))

    first, second = layout.spec.obstacles
    assert len(layout.moves) == 2
    assert (first.center_x, first.center_z) != (second.center_x, second.center_z)


def test_an_obstacle_in_a_free_place_does_not_change_the_scenario() -> None:
    spec = scenario(car(30, 5))

    layout = run(spec)

    assert layout.spec is spec
    assert layout.moves == ()
