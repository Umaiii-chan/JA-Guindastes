"""Caixas do barracão aberto no planejador (TASK-088; ADR-042). Dados FICTÍCIOS (ADR-012)."""

import pytest

from app.domain.entities.scenario import ObstacleKind, ObstacleSpec, ScenarioSpec
from app.domain.services.planning.library_boxes import (
    bed_contains,
    expand_obstacles,
    hangar_boxes,
    owner_id,
    platform_truck_bed,
    platform_truck_bed_ratio,
    platform_truck_boxes,
)
from app.domain.services.planning.models import PlanLoad, PlanPoint
from app.domain.services.planning.sweep import pick_cover, support_top_y

HANGAR = ObstacleSpec(
    "BARRACAO", "Galpão com frente aberta", ObstacleKind.MODEL, 0.0, 0.0, 19.22, 27.44, 8.27, 0.0,
    "barracao-aberto",
)  # fmt: skip


def test_caixas_do_barracao_sao_as_do_frontend() -> None:
    # Saída de `findLibraryObject('barracao-aberto').collision` em
    # frontend/src/domain/environment/objectLibrary.ts (`hangarBoxes`): x, z, y, w, d, h.
    boxes = hangar_boxes()

    assert len(boxes) == 30
    assert boxes[0] == (-0.64, 0.0, 7.8, 1.28, 23.52, 0.37)
    assert boxes[1] == (0.64, 0.0, 7.8, 1.28, 23.52, 0.37)
    assert boxes[2] == (-1.9, 0.0, 7.48, 1.25, 23.52, 0.5)
    assert boxes[18] == (-8.15, 0.0, 0.0, 0.1, 23.52, 0.9)
    assert boxes[19] == (8.15, 0.0, 0.0, 0.1, 23.52, 0.9)
    assert boxes[20] == (-1.26, -11.61, 0.0, 2.53, 0.3, 8.1)
    assert boxes[27] == (7.22, -11.61, 0.0, 1.17, 0.3, 3.9)
    assert boxes[28] == (-8.0, -11.61, 0.0, 0.4, 0.3, 1.8)
    assert boxes[29] == (8.0, -11.61, 0.0, 0.4, 0.3, 1.8)


def test_altura_da_carroceria_do_caminhao_plataforma() -> None:
    # objectLibrary.ts: caminhao-plataforma, primeiro trecho a 0,53 de TRUCK_FLAT.h = 3,51 m.
    assert platform_truck_bed_ratio() == pytest.approx(1.86 / 3.51)


def test_barracao_vira_partes_com_o_id_e_o_nome_dele() -> None:
    parts = expand_obstacles(ScenarioSpec(obstacles=(HANGAR,)))

    assert len(parts) == 30
    assert {owner_id(part) for part in parts} == {"BARRACAO"}
    assert {part.label for part in parts} == {"Galpão com frente aberta"}
    assert all(part.elevation_m is not None for part in parts)
    assert expand_obstacles(ScenarioSpec(obstacles=parts)) == parts


def test_carga_no_meio_do_barracao_nao_fica_coberta_e_na_parede_fica() -> None:
    scenario = ScenarioSpec(obstacles=(HANGAR,))
    load = PlanLoad(1500.0, 3.0, 1.5, 1.2)

    assert pick_cover(scenario, load, PlanPoint(0.0, 4.0)) == ()
    assert pick_cover(scenario, load, PlanPoint(0.0, -11.0)) != ()  # fundo fechado
    assert pick_cover(scenario, load, PlanPoint(8.1, 0.0)) != ()  # encostada na parede lateral


# ---- paridade com a carroceria do frontend (valores dourados) -----------------------------------
# Saída de `findLibraryObject('caminhao-plataforma')` e `scaledLoadBed` de
# frontend/src/domain/environment/objectLibrary.ts (L249-253, `TRUCK_FLAT_COLLISION`, e L359,
# `loadBed`), com os cantos e o topo como `loadBedsOf` de frontend/src/domain/cargo/loadBeds.ts
# (L39-53): canto = centro + rotY(giro)·(bed.x ± w/2, bed.z ± d/2); topo = terreno + bed.y + bed.h.
# Escala 1 em (0, 0): carroceria em (0; -1,85), 4,05 × 3,71, topo a 1,86 m; cantos x de -2,025 a
# 2,025 e z de -3,705 a 0,005. Girado de 90°, esticado 1,5× em x e 2× em z e em y, em (10, 5):
# cantos x de 2,59 a 10,01 e z de 1,9625 a 8,0375, topo a 3,72 m.

GOLDEN_SECTIONS = (
    (0.0, -1.85, 0.0, 4.05, 3.71, 1.86),
    (0.0, 1.11, 0.0, 3.65, 2.22, 3.51),
    (0.0, 2.96, 0.0, 4.05, 1.48, 2.18),
)


def _truck(x: float, z: float, w: float, d: float, h: float, rotation: float) -> ObstacleSpec:
    return ObstacleSpec(
        "C1", "Caminhão", ObstacleKind.MODEL, x, z, w, d, h, rotation, "caminhao-plataforma"
    )


def test_trechos_do_caminhao_plataforma_sao_os_do_frontend() -> None:
    assert platform_truck_boxes() == GOLDEN_SECTIONS
    assert platform_truck_bed() == GOLDEN_SECTIONS[0]


def _inside_rect(
    truck: ObstacleSpec, x_range: tuple[float, float], z_range: tuple[float, float]
) -> None:
    eps = 0.01
    (x0, x1), (z0, z1) = x_range, z_range
    cx, cz = (x0 + x1) / 2, (z0 + z1) / 2
    for x, z in ((x0 + eps, cz), (x1 - eps, cz), (cx, z0 + eps), (cx, z1 - eps), (cx, cz)):
        assert bed_contains(truck, x, z), (x, z)
    for x, z in ((x0 - eps, cz), (x1 + eps, cz), (cx, z0 - eps), (cx, z1 + eps)):
        assert not bed_contains(truck, x, z), (x, z)


def test_carroceria_em_escala_1_igual_a_do_frontend() -> None:
    truck = _truck(0.0, 0.0, 4.05, 7.41, 3.51, 0.0)

    _inside_rect(truck, (-2.025, 2.025), (-3.705, 0.005))
    assert support_top_y(ScenarioSpec().terrain, truck) == pytest.approx(1.86)


def test_carroceria_girada_e_escalada_igual_a_do_frontend() -> None:
    truck = _truck(10.0, 5.0, 6.075, 14.82, 7.02, 90.0)

    _inside_rect(truck, (2.59, 10.01), (1.9625, 8.0375))
    assert support_top_y(ScenarioSpec().terrain, truck) == pytest.approx(3.72)
