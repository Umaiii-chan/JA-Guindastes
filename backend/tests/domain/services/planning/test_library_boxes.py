"""Caixas do barracão aberto no planejador (TASK-088; ADR-042). Dados FICTÍCIOS (ADR-012)."""

import pytest

from app.domain.entities.scenario import ObstacleKind, ObstacleSpec, ScenarioSpec
from app.domain.services.planning.library_boxes import (
    expand_obstacles,
    hangar_boxes,
    owner_id,
    platform_truck_bed_ratio,
)
from app.domain.services.planning.models import PlanLoad, PlanPoint
from app.domain.services.planning.sweep import pick_cover

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
