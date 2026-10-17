"""Planejador de um guindaste, com avaliador FICTÍCIO (TASK-075). Dados inventados (ADR-012).

O avaliador devolve a utilização como `peso ÷ capacidade(R)`, com a capacidade caindo com o raio,
sem tabela nem banco: o que se testa aqui é a escolha de posição, lança, sentido e altura.
"""

import math
from collections.abc import Sequence
from dataclasses import replace

import pytest

from app.domain.entities.scenario import ObstacleKind, ObstacleSpec, ScenarioSpec, TerrainSpec
from app.domain.services.environment_factors import SoilKind
from app.domain.services.planning.crane_body import (
    crane_body_overlaps_obstacle,
    distance_to_crane_body_m,
)
from app.domain.services.planning.models import (
    CraneStateValues,
    PlanLoad,
    PlannerCrane,
    PlanPoint,
    StateAssessment,
)
from app.domain.services.planning.planner import plan_crane
from app.domain.services.safety_assessment import TippingRisk
from app.domain.value_objects.angle import Angle
from app.domain.value_objects.crane_geometry import CraneGeometry
from app.domain.value_objects.length import Length
from app.domain.value_objects.safety_profile import SafetyProfile

GEOMETRY = CraneGeometry(
    boom_pivot_offset_m=0.5,
    boom_pivot_height=Length(3.0),
    boom_length_min=Length(12.0),
    boom_length_max=Length(24.0),
    boom_angle_min=Angle(0.0),
    boom_angle_max=Angle(80.0),
    cable_length_min=Length(1.0),
    cable_length_max=Length(20.0),
)
CRANE = PlannerCrane(
    configuration_id="CFG-FICTICIA",
    label="Guindaste FICTÍCIO",
    geometry=GEOMETRY,
    profile=SafetyProfile(),
    hook_block_weight_kg=0.0,
    max_radius_m=20.0,
    boom_lengths_m=(12.0, 18.0, 24.0),
)
LOAD = PlanLoad(weight_kg=1000.0, length_m=2.0, width_m=1.0, height_m=1.0)
PICK = PlanPoint(-7.5, 0.0)
DELIVERY = PlanPoint(7.5, 0.0)


class FakeEvaluator:
    """Capacidade = 10 000 kg − 400 kg por metro de raio (sempre avaliável); guarda as chamadas."""

    def __init__(self) -> None:
        self.calls: list[CraneStateValues] = []

    def __call__(
        self,
        *,
        configuration_id: str,
        state: CraneStateValues,
        load_weight_kg: float,
        ground_slope_deg: float | None,
        soil_kinds: Sequence[SoilKind],
        wind_speed_ms: float | None,
        obstacle_conflicts: Sequence[str],
    ) -> StateAssessment:
        self.calls.append(state)
        radius = 0.5 + state.boom_length_m * math.cos(math.radians(state.boom_angle_deg))
        capacity = 10000.0 - 400.0 * radius
        return StateAssessment(
            evaluable=True,
            utilization_percent=load_weight_kg / capacity * 100,
            risk=TippingRisk.LOW,
        )


def box(identifier: str, x: float, z: float, height: float) -> ObstacleSpec:
    return ObstacleSpec(identifier, identifier, ObstacleKind.BOX, x, z, 6.0, 3.0, height, 0.0)


def plan(scenario: ScenarioSpec | None = None, **kwargs: object):  # type: ignore[no-untyped-def]
    return plan_crane(
        crane=CRANE,
        scenario=scenario or ScenarioSpec(),
        load=LOAD,
        pick=PICK,
        delivery=DELIVERY,
        evaluator=FakeEvaluator(),
        **kwargs,  # type: ignore[arg-type]
    )


def test_acha_plano_valido_em_terreno_livre() -> None:
    search = plan()

    best = search.plans[0]
    assert best.valid
    assert best.max_utilization_percent < 100
    assert best.pick_radius_m == pytest.approx(
        math.hypot(PICK.x - best.placement.x, PICK.z - best.placement.z)
    )
    assert best.delivery_radius_m == pytest.approx(
        math.hypot(DELIVERY.x - best.placement.x, DELIVERY.z - best.placement.z)
    )


def test_o_estado_na_coleta_tem_o_raio_da_coleta() -> None:
    best = plan().plans[0]

    reach = 0.5 + best.boom_length_m * math.cos(math.radians(best.pick_state.boom_angle_deg))
    assert reach == pytest.approx(best.pick_radius_m)
    reach = 0.5 + best.boom_length_m * math.cos(math.radians(best.delivery_state.boom_angle_deg))
    assert reach == pytest.approx(best.delivery_radius_m)


def test_escolhe_o_comprimento_de_lanca_que_minimiza_a_utilizacao() -> None:
    best = plan().plans[0]

    # Com a lança de 12 m o ângulo vai até a faixa mínima do raio; a utilização é a menor possível
    # entre os comprimentos que alcançam os dois pontos.
    worst_by_length = {}
    for length in CRANE.boom_lengths_m:
        search = plan_crane(
            crane=replace(CRANE, boom_lengths_m=(length,)),
            scenario=ScenarioSpec(),
            load=LOAD,
            pick=PICK,
            delivery=DELIVERY,
            evaluator=FakeEvaluator(),
        )
        if search.plans:
            worst_by_length[length] = search.plans[0].max_utilization_percent
    assert len(worst_by_length) >= 2
    assert best.max_utilization_percent == pytest.approx(min(worst_by_length.values()))


def test_descarta_posicoes_sobre_obstaculos() -> None:
    scenario = ScenarioSpec(obstacles=(box("O1", 0.0, 0.0, 3.0),))

    search = plan(scenario, keep=5)

    assert search.rejections.get("obstaculo", 0) > 0
    for item in search.plans:
        assert not crane_body_overlaps_obstacle(item.placement, scenario.obstacles[0])


def test_altura_de_transporte_e_o_topo_do_obstaculo_mais_alto_mais_1_m() -> None:
    scenario = ScenarioSpec(obstacles=(box("BAIXO", 0.0, 0.0, 2.0), box("ALTO", 3.0, 0.0, 5.0)))

    best = plan(scenario).plans[0]

    assert best.transport_height_m == pytest.approx(6.0)
    assert set(best.crossed_obstacle_ids) <= {"BAIXO", "ALTO"}
    assert best.crossed_obstacle_ids


def test_sem_obstaculo_a_carga_viaja_a_1_m_do_chao() -> None:
    best = plan().plans[0]

    assert best.transport_height_m == pytest.approx(1.0)
    assert best.crossed_obstacle_ids == ()


def test_o_gancho_acompanha_a_altura_de_transporte_no_giro() -> None:
    scenario = ScenarioSpec(obstacles=(box("O1", 0.0, 0.0, 4.0),))

    best = plan(scenario).plans[0]

    # A base da carga fica a `transport_height_m` do chão em todo o giro: o gancho está a
    # `altura da carga + lingas + amarração` acima dela. Altura da ponta − cabo = altura do gancho.
    sling = min(3.0, max(0.6, max(LOAD.length_m, LOAD.width_m) / 2))
    expected_hook = best.transport_height_m + 1.05 + sling + LOAD.height_m
    for state in best.path:
        tip = 3.0 + state.boom_length_m * math.sin(math.radians(state.boom_angle_deg))
        assert tip - state.cable_length_m == pytest.approx(expected_hook, abs=1e-6)


def test_giro_pelo_sentido_mais_curto() -> None:
    best = plan().plans[0]

    assert abs(best.swing_deg) <= 180.0
    assert best.path[0].turret_rotation_deg == pytest.approx(best.pick_state.turret_rotation_deg)
    assert best.path[-1].turret_rotation_deg - best.path[0].turret_rotation_deg == pytest.approx(
        best.swing_deg
    )


def test_obstaculo_alto_demais_faz_o_giro_ir_pelo_outro_lado() -> None:
    wall = ScenarioSpec(obstacles=(box("MURO", 0.0, 0.0, 30.0),))

    best = plan(wall, keep=3).plans[0]

    assert "MURO" not in best.crossed_obstacle_ids


def test_terreno_inclinado_alem_do_limite_descarta_todas_as_posicoes() -> None:
    steep = ScenarioSpec(terrain=TerrainSpec(slope_x_percent=30.0))

    search = plan(steep)

    assert search.plans == ()
    assert search.rejections["inclinacao"] > 0


def test_carga_pesada_demais_deixa_planos_invalidos() -> None:
    heavy = PlanLoad(weight_kg=9000.0, length_m=2.0, width_m=1.0, height_m=1.0)

    search = plan_crane(
        crane=CRANE,
        scenario=ScenarioSpec(),
        load=heavy,
        pick=PICK,
        delivery=DELIVERY,
        evaluator=FakeEvaluator(),
    )

    assert search.plans
    assert not any(item.valid for item in search.plans)


def test_resultado_ordenado_valido_primeiro_depois_menor_utilizacao() -> None:
    search = plan(keep=5)

    utilizations = [item.max_utilization_percent for item in search.plans]
    assert utilizations == sorted(utilizations)


def test_limite_de_posicoes_restringe_o_trabalho() -> None:
    evaluator = FakeEvaluator()
    plan_crane(
        crane=CRANE,
        scenario=ScenarioSpec(),
        load=LOAD,
        pick=PICK,
        delivery=DELIVERY,
        evaluator=evaluator,
        max_positions=3,
    )
    few = len(evaluator.calls)
    evaluator = FakeEvaluator()
    plan_crane(
        crane=CRANE,
        scenario=ScenarioSpec(),
        load=LOAD,
        pick=PICK,
        delivery=DELIVERY,
        evaluator=evaluator,
        max_positions=30,
    )

    assert few < len(evaluator.calls)


def test_estado_nao_avaliavel_descarta_o_candidato_com_o_motivo() -> None:
    def never(**kwargs: object) -> StateAssessment:
        return StateAssessment(evaluable=False, reason="OUTSIDE_LOAD_CHART_DOMAIN")

    search = plan_crane(
        crane=CRANE,
        scenario=ScenarioSpec(),
        load=LOAD,
        pick=PICK,
        delivery=DELIVERY,
        evaluator=never,  # type: ignore[arg-type]
    )

    assert search.plans == ()
    assert search.rejections["OUTSIDE_LOAD_CHART_DOMAIN"] > 0


def test_a_carga_nunca_assenta_dentro_do_corpo_do_guindaste() -> None:
    search = plan(keep=5)

    radius_load = math.hypot(LOAD.length_m, LOAD.width_m) / 2
    for item in search.plans:
        for point in (PICK, DELIVERY):
            assert distance_to_crane_body_m(item.placement, point.x, point.z) >= radius_load


def test_passar_sobre_o_corpo_do_guindaste_sobe_a_carga_acima_dele() -> None:
    search = plan(keep=5)

    body_top = 4.6
    for item in search.plans:
        if item.crosses_body:
            assert item.transport_height_m >= body_top + 1.0 - 1e-6


def test_lanca_que_bate_em_poste_alto_descarta_a_opcao_com_o_motivo() -> None:
    # TASK-088 (F-02): na única posição avaliada (a origem, rumo de 90°), os dois sentidos do giro
    # passam a lança sobre um poste de 30 m a 8 m do eixo, a menos de 17 m de altura.
    poles = tuple(
        ObstacleSpec(f"P{i}", "Poste", ObstacleKind.CYLINDER, 0.0, z, 0.4, 0.4, 30.0, 0.0)
        for i, z in enumerate((8.0, -8.0))
    )
    pick, delivery = PlanPoint(-12.0, 0.0), PlanPoint(12.0, 0.0)

    def search(scenario: ScenarioSpec):  # type: ignore[no-untyped-def]
        return plan_crane(
            crane=CRANE,
            scenario=scenario,
            load=LOAD,
            pick=pick,
            delivery=delivery,
            evaluator=FakeEvaluator(),
            max_positions=1,
        )

    free = search(ScenarioSpec())
    blocked = search(ScenarioSpec(obstacles=poles))

    assert free.plans and free.plans[0].placement.x == 0.0 and free.plans[0].placement.z == 0.0
    assert blocked.plans == ()
    assert blocked.rejections["colisao_lanca"] > 0


def test_coleta_coberta_nao_gera_plano() -> None:
    shed = box("GALPAO", PICK.x, PICK.z, 4.0)

    search = plan(ScenarioSpec(obstacles=(shed,)))

    assert search.plans == ()
    assert search.rejections == {"coleta": 1}


def test_carga_dentro_do_barracao_aberto_passa_por_baixo_do_arco() -> None:
    # Lacuna da revisão do PR #48: o barracão aberto é oco (as caixas de `hangarBoxes`, `_parts` em
    # `library_boxes.py`) e o plano com a carga DENTRO dele fecha quando a lança discreta cabe sob o
    # arco. Guindaste FICTÍCIO de uma só lança de 14,0 m (a 14,7° a ponta fica a 6,9 m; 14,3 m já
    # bate no teto do tamanho padrão) em z = 24, voltado para o barracão (porta em +Z, z = 13,72).
    # O barracão tem 12 m de altura (o tamanho do objeto é do usuário; a 8,27 m a aproximação do
    # gancho, que desce da pose de partida, ainda atravessa o teto). A altura de transporte por
    # cima do arco (`_swings`) não teria cabo; vale a que passa por baixo dele.
    geometry = replace(GEOMETRY, boom_pivot_offset_m=0.46, boom_pivot_height=Length(3.3))
    crane = replace(
        CRANE,
        geometry=replace(geometry, cable_length_max=Length(15.0), boom_length_max=Length(22.0)),
        max_radius_m=20.0,
        boom_lengths_m=(14.0,),
    )
    barn = ObstacleSpec(
        "BARRACAO",
        "Galpão com frente aberta",
        ObstacleKind.MODEL,
        0.0,
        0.0,
        19.22,
        27.44,
        12.0,
        0.0,
        "barracao-aberto",
    )

    search = plan_crane(
        crane=crane,
        scenario=ScenarioSpec(obstacles=(barn,)),
        load=PlanLoad(1500.0, 3.0, 0.6, 0.6),
        pick=PlanPoint(0.0, 10.0),
        delivery=PlanPoint(3.0, 10.5),
        evaluator=FakeEvaluator(),
        max_positions=3000,
    )

    best = search.plans[0]
    assert best.valid
    assert best.boom_length_m == 14.0
    assert best.placement.z > 20.0  # fora do barracão, de frente para a porta
    assert best.crossed_obstacle_ids == ("BARRACAO",)
    assert best.transport_height_m < 2.0  # sob o arco, não por cima dele
