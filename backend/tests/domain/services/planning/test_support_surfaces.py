"""Superfícies de apoio dos objetos da biblioteca: caminhão plataforma, carreta prancha e
contêineres (TASK-108; ADR-052). Dados FICTÍCIOS (ADR-012); as medidas dos contêineres são as da
ISO 668."""

import json
from dataclasses import replace
from pathlib import Path

import pytest

from app.application.use_cases.ai_prompts import LIBRARY_MODELS
from app.domain.entities.scenario import ObstacleKind, ObstacleSpec, ScenarioSpec
from app.domain.services.planning import library_boxes
from app.domain.services.planning.library_boxes import (
    LOAD_SUPPORTS,
    NO_CAPACITY_SOURCE,
    bed_contains,
    is_load_support,
    support_higher_parts,
    support_of,
    support_top_ratio,
)
from app.domain.services.planning.models import PlanLoad, PlanPoint
from app.domain.services.planning.sweep import (
    delivery_cover,
    delivery_surface,
    over_capacity,
    overloaded_supports,
    pick_surface,
    support_top_y,
)
from app.domain.services.scenario_layout import is_platform_vehicle

GOLDEN = json.loads(
    (Path(__file__).parents[3] / "fixtures" / "support_surfaces.golden.json").read_text(
        encoding="utf-8"
    )
)["supports"]
LOAD = PlanLoad(1500.0, 3.0, 1.5, 1.2)
TERRAIN = ScenarioSpec().terrain


def model(
    model_id: str,
    width: float,
    depth: float,
    height: float,
    *,
    x: float = 0.0,
    z: float = 0.0,
    rotation: float = 0.0,
    identifier: str = "APOIO",
) -> ObstacleSpec:
    return ObstacleSpec(
        identifier, identifier, ObstacleKind.MODEL, x, z, width, depth, height, rotation, model_id
    )


def container_20() -> ObstacleSpec:
    # ISO 668: 6,058 x 2,438 x 2,591 m (o GLB de 2,72 x 6 x 2,54 m esticado até a medida).
    return model("conteiner-20", 2.438, 6.058, 2.591)


def container_40hc(**kw: float) -> ObstacleSpec:
    return model("conteiner-40hc", 2.438, 12.192, 2.896, **kw)


def flatbed(**kw: float) -> ObstacleSpec:
    return model("carreta-prancha", 2.6, 13.0, 1.5, **kw)


# --- paridade com o frontend --------------------------------------------------------------------


def test_o_registro_do_backend_e_o_dourado_que_o_frontend_tambem_confere() -> None:
    assert sorted(LOAD_SUPPORTS) == sorted(GOLDEN)
    for model_id, spec in LOAD_SUPPORTS.items():
        expected = GOLDEN[model_id]
        assert list(spec.base_size) == expected["baseSize"], model_id
        assert [list(box) for box in spec.boxes] == expected["collision"], model_id
        assert list(spec.bed) == expected["loadBed"], model_id
        assert spec.capacity_kg == expected["capacityKg"], model_id


def test_a_ia_conhece_todos_os_apoios_da_biblioteca() -> None:
    assert set(LOAD_SUPPORTS) <= set(LIBRARY_MODELS)


def test_so_a_biblioteca_declara_apoio_e_a_caixa_carreta_nao() -> None:
    trailer_box = ObstacleSpec("CARRETA", "Carreta", ObstacleKind.BOX, 0, 0, 2.5, 9.0, 1.3, 0.0)
    assert not is_load_support(trailer_box)
    assert not is_load_support(model("caminhao-bau", 3.6, 7.8, 3.96))
    assert not bed_contains(trailer_box, 0.0, 0.0)
    assert support_top_ratio(trailer_box) == 0.0
    assert support_of(trailer_box) is None
    assert all(is_load_support(item) for item in (container_20(), flatbed()))


# --- altura e critério do centro ----------------------------------------------------------------


@pytest.mark.parametrize(
    ("obstacle", "top"),
    [
        (container_20(), 2.591),
        (container_40hc(), 2.896),
        (flatbed(), 1.5),
        (model("caminhao-plataforma", 4.05, 7.41, 3.51), 1.86),
    ],
)
def test_a_altura_de_apoio_e_o_topo_da_superficie(obstacle: ObstacleSpec, top: float) -> None:
    assert support_top_y(TERRAIN, obstacle) == pytest.approx(top, abs=1e-6)


def test_contêiner_alto_na_escala_do_obstaculo() -> None:
    # Escalado a 2x na altura, o teto sobe junto (a escala por eixo é obstáculo ÷ baseSize).
    tall = model("conteiner", 2.72, 6.0, 5.08)
    assert support_top_y(TERRAIN, tall) == pytest.approx(5.08)


def test_o_centro_da_pegada_decide_no_conteiner_e_na_prancha() -> None:
    box = container_20()  # z de -3,029 a 3,029
    assert bed_contains(box, 0.0, 3.0)
    assert not bed_contains(box, 0.0, 3.05)
    assert bed_contains(flatbed(), 0.0, 6.4)
    assert not bed_contains(flatbed(), 1.31, 0.0)
    turned = container_40hc(rotation=90.0)  # o comprimento passa para X
    assert bed_contains(turned, 5.0, 0.0)
    assert not bed_contains(turned, 0.0, 5.0)


def test_entrega_sobre_o_conteiner_apoia_no_teto_e_sem_cabine() -> None:
    box = container_20()
    scenario = ScenarioSpec(obstacles=(box,))

    surface = delivery_surface(scenario, LOAD, 0.0, 1.0, 0.0)

    assert surface.supports == (box,)
    assert surface.rest_y == pytest.approx(2.591)
    assert surface.blockers == ()  # o contêiner e a prancha não têm cabine: nada acima do teto
    assert support_higher_parts(box, TERRAIN) == ()
    assert support_higher_parts(flatbed(), TERRAIN) == ()
    assert len(support_higher_parts(model("caminhao-plataforma", 4.05, 7.41, 3.51), TERRAIN)) == 2


def test_centro_fora_do_conteiner_vira_obstaculo_comum() -> None:
    box = container_20()
    scenario = ScenarioSpec(obstacles=(box,))

    outside = delivery_surface(scenario, LOAD, 0.0, 3.2, 0.0)

    assert outside.supports == ()
    assert outside.rest_y == pytest.approx(0.0)
    assert outside.blockers == (box,)
    # o centro da entrega fora do contêiner não é «dentro dele» (a pegada é conferida acima)
    assert delivery_cover(scenario, LOAD, PlanPoint(0.0, 3.2)) == ()
    assert delivery_cover(scenario, LOAD, PlanPoint(0.0, 1.0)) == ()


def test_coleta_sobre_a_prancha_tem_o_mesmo_apoio() -> None:
    trailer = flatbed()
    surface = pick_surface(ScenarioSpec(obstacles=(trailer,)), LOAD, PlanPoint(0.0, -4.0))
    assert surface.supports == (trailer,)
    assert surface.rest_y == pytest.approx(1.5)
    assert surface.blockers == ()


# --- capacidade ---------------------------------------------------------------------------------


def test_sem_dado_de_capacidade_o_peso_nao_limita_e_o_apoio_e_ficticio() -> None:
    heavy = PlanLoad(1_000_000.0, 3.0, 1.5, 1.2)
    box = container_20()
    spec = LOAD_SUPPORTS["conteiner-20"]
    assert spec.capacity_kg is None and spec.fictitious
    assert spec.capacity_source == NO_CAPACITY_SOURCE and spec.capacity_source.startswith(
        "FICTÍCIO"
    )
    assert not over_capacity(box, heavy)
    assert delivery_surface(ScenarioSpec(obstacles=(box,)), heavy, 0.0, 0.0, 0.0).supports == (box,)


def _limited(monkeypatch: pytest.MonkeyPatch, model_id: str, capacity_kg: float) -> None:
    patched = dict(LOAD_SUPPORTS)
    patched[model_id] = replace(
        LOAD_SUPPORTS[model_id], capacity_kg=capacity_kg, capacity_source="TESTE (fictício)"
    )
    monkeypatch.setattr(library_boxes, "LOAD_SUPPORTS", patched)


def test_com_capacidade_conhecida_carga_mais_pesada_nao_e_recebida(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _limited(monkeypatch, "conteiner-20", 1000.0)
    box = container_20()
    scenario = ScenarioSpec(obstacles=(box,))
    centre = PlanPoint(0.0, 0.0)

    assert over_capacity(box, LOAD)  # 1.500 kg > 1.000 kg
    assert not over_capacity(box, PlanLoad(900.0, 3.0, 1.5, 1.2))
    assert not over_capacity(box, None)
    refused = delivery_surface(scenario, LOAD, 0.0, 0.0, 0.0)
    assert refused.supports == () and refused.rest_y == pytest.approx(0.0)
    assert refused.blockers == (box,)
    assert delivery_cover(scenario, LOAD, centre) == (box,)
    assert overloaded_supports(scenario, LOAD, centre) == (box,)
    # dentro da capacidade, recebe como antes
    light = PlanLoad(900.0, 3.0, 1.5, 1.2)
    assert delivery_surface(scenario, light, 0.0, 0.0, 0.0).supports == (box,)
    assert overloaded_supports(scenario, light, centre) == ()


def test_na_coleta_a_capacidade_nao_se_confere(monkeypatch: pytest.MonkeyPatch) -> None:
    # A carga já está em cima do apoio: o peso dela não é uma decisão do plano.
    _limited(monkeypatch, "conteiner-20", 1000.0)
    box = container_20()
    surface = pick_surface(ScenarioSpec(obstacles=(box,)), LOAD, PlanPoint(0.0, 0.0))
    assert surface.supports == (box,)


# --- layout seguro da IA ------------------------------------------------------------------------


def test_todo_apoio_da_biblioteca_pode_ficar_no_ponto_de_entrega_do_layout() -> None:
    assert all(is_platform_vehicle(model(model_id, 3.0, 8.0, 2.0)) for model_id in LOAD_SUPPORTS)
    assert not is_platform_vehicle(model("caminhao-bau", 3.6, 7.8, 3.96))
