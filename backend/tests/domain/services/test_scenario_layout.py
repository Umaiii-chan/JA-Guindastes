"""Layout seguro dos obstáculos de um cenário gerado por IA (TASK-081). Dados fictícios."""

from dataclasses import replace

import pytest

from app.domain.entities.scenario import (
    CargoPlacementSpec,
    CranePlacementSpec,
    DeliveryPointSpec,
    ObstacleKind,
    ObstacleSpec,
    ScenarioSpec,
)
from app.domain.services.planning.crane_body import (
    BODY_MAX_X_M,
    BODY_MAX_Z_M,
    BODY_MIN_Z_M,
    crane_body_overlaps_obstacle,
)
from app.domain.services.scenario_layout import CRANE_MARGIN_M, make_scenario_layout_safe


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
    # fora do corpo do guindaste (crane_body.py) mais a folga
    assert (
        abs(moved.center_x) - 2.25 >= BODY_MAX_X_M + CRANE_MARGIN_M - 1e-6
        or moved.center_z + 0.95 <= BODY_MIN_Z_M - CRANE_MARGIN_M + 1e-6
        or moved.center_z - 0.95 >= BODY_MAX_Z_M + CRANE_MARGIN_M - 1e-6
    )


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


def test_a_box_called_trailer_is_moved_off_the_delivery_point() -> None:
    # ADR-049: só o caminhão plataforma da biblioteca recebe a carga; uma caixa "carreta" é
    # obstáculo comum e sai do ponto de entrega.
    layout = run(scenario(car(0, 25, "Carreta")))

    assert len(layout.moves) == 1
    assert "o ponto de entrega" in layout.moves[0].describe()


def test_a_support_may_sit_under_the_cargo_pickup_but_a_car_may_not() -> None:
    # ADR-052: a carga repousa no apoio, então ele não é afastado da coleta; o carro é.
    for model_id in ("caminhao-plataforma", "carreta-prancha", "conteiner-20"):
        support = replace(car(0, -20, "Apoio"), model_id=model_id, width_m=2.6, depth_m=6.0)
        assert run(scenario(support)).moves == (), model_id
    assert len(run(scenario(car(0, -20, "Carro"))).moves) == 1


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


# --- TASK-094 (F-14): zonas iguais às da cena e do planejamento --------------------------------


def box(x: float, z: float, width_m: float = 2.0, depth_m: float = 2.0) -> ObstacleSpec:
    return ObstacleSpec(
        id="Caixa",
        label="Caixa",
        kind=ObstacleKind.BOX,
        center_x=x,
        center_z=z,
        width_m=width_m,
        depth_m=depth_m,
        height_m=2.0,
        rotation_y_deg=0.0,
    )


def beam_pickup(*obstacles: ObstacleSpec, rotation_y_deg: float = 0.0) -> ScenarioSpec:
    """Viga FICTÍCIA de 12 m x 1 m na origem; o guindaste fica longe, para só a carga contar."""
    return ScenarioSpec(
        obstacles=obstacles,
        crane=CranePlacementSpec(x=-40, z=0, heading_deg=0),
        cargo=CargoPlacementSpec(x=0, z=0, rotation_y_deg=rotation_y_deg),
    )


def run_beam(spec: ScenarioSpec):  # type: ignore[no-untyped-def]
    return make_scenario_layout_safe(spec, load_length_m=12, load_width_m=1)


def test_the_cargo_length_runs_along_local_z_like_the_scene() -> None:
    # A cena desenha o comprimento da carga em Z local: a viga vai de z = -6 a 6 m.
    layout = run_beam(beam_pickup(box(0, 4.5)))

    assert len(layout.moves) == 1
    assert layout.moves[0].describe().endswith("para não ficar sobre a carga na coleta.")
    moved = layout.spec.obstacles[0]
    assert abs(moved.center_z) - 1 >= 6 + 1.5 - 1e-6 or abs(moved.center_x) - 1 >= 0.5 + 1.5 - 1e-6


def test_beside_the_cargo_width_there_is_room() -> None:
    # Em X local, a viga tem só 1 m: uma caixa a 4,5 m do eixo dela fica livre.
    layout = run_beam(beam_pickup(box(4.5, 0)))

    assert layout.moves == ()


def test_the_cargo_zone_turns_with_the_cargo() -> None:
    # Girada 90°, a viga fica ao longo de X: agora é a caixa em (4,5; 0) que sai.
    turned = run_beam(beam_pickup(box(4.5, 0), rotation_y_deg=90))
    free = run_beam(beam_pickup(box(0, 4.5), rotation_y_deg=90))

    assert len(turned.moves) == 1
    assert free.moves == ()


def small_car(x: float, z: float) -> ObstacleSpec:
    """Carro FICTÍCIO de 2 m (X) x 1,2 m (Z), como no cenário da auditoria."""
    return replace(car(x, z), width_m=2.0, depth_m=1.2)


@pytest.mark.parametrize(
    ("heading_deg", "x", "z"),
    [(0.0, 0.0, 8.3), (90.0, 8.3, 0.0), (180.0, 0.0, -8.3)],
)
def test_a_car_in_front_of_the_cab_is_moved(heading_deg: float, x: float, z: float) -> None:
    # O chassi vai até 9,22 m à frente do eixo de giro (crane_body.py), não só até 7 m.
    placement = CranePlacementSpec(x=0, z=0, heading_deg=heading_deg)
    spec = ScenarioSpec(obstacles=(small_car(x, z),), crane=placement)
    assert crane_body_overlaps_obstacle(placement, spec.obstacles[0])

    layout = make_scenario_layout_safe(spec, load_length_m=2, load_width_m=1)

    assert len(layout.moves) == 1
    assert layout.moves[0].describe().endswith("para não ficar sobre o guindaste.")
    assert not crane_body_overlaps_obstacle(placement, layout.spec.obstacles[0])


def test_a_car_just_beyond_the_margin_in_front_of_the_cab_stays() -> None:
    edge = BODY_MAX_Z_M + CRANE_MARGIN_M + 0.6 + 0.05
    spec = ScenarioSpec(
        obstacles=(small_car(0, edge),), crane=CranePlacementSpec(x=0, z=0, heading_deg=0)
    )

    layout = make_scenario_layout_safe(spec, load_length_m=2, load_width_m=1)

    assert layout.moves == ()
