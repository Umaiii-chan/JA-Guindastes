"""`RecommendLiftPlan` entrega sobre contêiner e carreta prancha e fala do
apoio (TASK-108; ADR-052).
Dados FICTÍCIOS (ADR-012): a ficha do guindaste vem da fixture `planejamento_ficticio`."""

from dataclasses import replace

import pytest

from app.application.use_cases.recommend_lift_plan import PlanningRequest
from app.domain.entities.scenario import ObstacleKind, ObstacleSpec, ScenarioSpec
from app.domain.services.planning import library_boxes
from app.domain.services.planning.library_boxes import LOAD_SUPPORTS
from app.domain.services.planning.models import PlanLoad, PlanPoint
from tests.fixtures.planejamento_ficticio import caso_de_uso_planejamento

LOAD = PlanLoad(1500.0, 3.0, 1.5, 1.2)


def plan(scenario: ScenarioSpec, pick: PlanPoint, delivery: PlanPoint, load: PlanLoad = LOAD):  # type: ignore[no-untyped-def]
    return caso_de_uso_planejamento().execute(PlanningRequest(load, pick, delivery, scenario))


def support(model_id: str, x: float, size: tuple[float, float, float], label: str) -> ObstacleSpec:
    width, depth, height = size
    return ObstacleSpec(
        "APOIO", label, ObstacleKind.MODEL, x, 0.0, width, depth, height, 90.0, model_id
    )


CONTAINER = (2.438, 6.058, 2.591)
FLATBED = (2.6, 13.0, 1.5)


@pytest.mark.parametrize(
    ("model_id", "size", "label"),
    [
        ("conteiner-20", CONTAINER, "Contêiner 20"),
        ("carreta-prancha", FLATBED, "Prancha"),
    ],
)
def test_entrega_sobre_o_apoio_tem_plano_e_o_diz_ficticio(
    model_id: str, size: tuple[float, float, float], label: str
) -> None:
    # Girado 90°, o comprimento do apoio fica ao longo de X: a entrega no centro dele.
    box = support(model_id, 7.5, size, label)

    result = plan(ScenarioSpec(obstacles=(box,)), PlanPoint(-7.5, 0.0), PlanPoint(7.5, 0.0))

    assert result.recommendations, result.notes
    assert result.recommendations[0].valid
    assert not any("sob ou dentro de" in note for note in result.notes)
    assert any(
        note.startswith(f"Entrega sobre «{label}»") and "apoio FICTÍCIO" in note
        for note in result.notes
    ), result.notes


def test_coleta_sobre_o_conteiner_tambem_e_rotulada() -> None:
    box = support("conteiner-20", -7.5, CONTAINER, "Contêiner 20")

    result = plan(ScenarioSpec(obstacles=(box,)), PlanPoint(-7.5, 0.0), PlanPoint(7.5, 0.0))

    assert result.recommendations, result.notes
    assert any(note.startswith("Coleta sobre «Contêiner 20»") for note in result.notes)


def test_caixa_comum_na_entrega_e_recusada_listando_os_apoios_aceitos() -> None:
    # Uma caixa chamada "carreta" não é apoio (ADR-049): a recusa diz quais objetos são.
    trailer = ObstacleSpec("CARRETA", "Carreta", ObstacleKind.BOX, 7.5, 0.0, 2.5, 9.0, 1.3, 0.0)

    result = plan(ScenarioSpec(obstacles=(trailer,)), PlanPoint(-7.5, 0.0), PlanPoint(7.5, 0.0))

    assert result.recommendations == ()
    assert "só os objetos da biblioteca com superfície de apoio" in result.notes[0]
    assert "contêiner" in result.notes[0]


def test_apoio_com_capacidade_menor_que_a_carga_e_recusado_dizendo_os_numeros(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    patched = dict(LOAD_SUPPORTS)
    patched["conteiner-20"] = replace(
        LOAD_SUPPORTS["conteiner-20"], capacity_kg=1000.0, capacity_source="TESTE (fictício)"
    )
    monkeypatch.setattr(library_boxes, "LOAD_SUPPORTS", patched)
    box = support("conteiner-20", 7.5, CONTAINER, "Contêiner 20")

    result = plan(ScenarioSpec(obstacles=(box,)), PlanPoint(-7.5, 0.0), PlanPoint(7.5, 0.0))

    assert result.recommendations == ()
    assert "«Contêiner 20» suporta no máximo 1000 kg" in result.notes[0]
    assert "a carga pesa 1500 kg" in result.notes[0]


def test_apoio_com_capacidade_suficiente_diz_a_capacidade_e_a_fonte(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    patched = dict(LOAD_SUPPORTS)
    patched["conteiner-20"] = replace(
        LOAD_SUPPORTS["conteiner-20"], capacity_kg=5000.0, capacity_source="TESTE (fictício)"
    )
    monkeypatch.setattr(library_boxes, "LOAD_SUPPORTS", patched)
    box = support("conteiner-20", 7.5, CONTAINER, "Contêiner 20")

    result = plan(ScenarioSpec(obstacles=(box,)), PlanPoint(-7.5, 0.0), PlanPoint(7.5, 0.0))

    assert result.recommendations, result.notes
    assert any(
        "carga de 1500 kg dentro da capacidade de 5000 kg (TESTE (fictício))" in note
        for note in result.notes
    ), result.notes
