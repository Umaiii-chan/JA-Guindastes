"""`RecommendLiftPlan`: zonas de giro, rumo, tandem e busca cortada (TASK-089). Dados FICTÍCIOS.

Regressão das provas da auditoria AUD-01: F-06 (pior ponto na fronteira de zona), F-18 (rumo e
sentido escolhidos antes da validade), F-04 (pares de tandem impossíveis), F-03 (pontos de içamento
a 1/4 e 3/4 e o CG) e F-28 (busca cortada por tempo sem aviso).
"""

import math
from dataclasses import replace

import pytest

from app.application.use_cases.recommend_lift_plan import (
    TANDEM_BODIES,
    TANDEM_SENSES,
    PlanningRequest,
    _impossible_pair,
)
from app.domain.entities.scenario import CranePlacementSpec, ScenarioSpec
from app.domain.services.planning.crane_body import crane_bodies_overlap
from app.domain.services.planning.models import CranePlan, CraneStateValues, PlanLoad, PlanPoint
from app.domain.services.planning.planner import plan_crane
from app.domain.services.planning.tandem import HOIST_POINT_FRACTION
from tests.fixtures.planejamento_ficticio import caso_de_uso_planejamento, container_ficticio
from tests.fixtures.planejamento_zonas_ficticio import (
    CONFIGURACAO_ZONAS_ID,
    avaliador_zonas,
    caso_de_uso_zonas,
    guindaste_zonas,
)

BEAM = PlanLoad(4000.0, 16.0, 1.0, 1.0)
"""Viga FICTÍCIA de 16 m: os pontos de içamento ficam 8 m um do outro, e dá para pôr os dois
guindastes em linha, girando no mesmo sentido."""
BEAM_PICK = PlanPoint(0.0, 0.0)
BEAM_DELIVERY = PlanPoint(4.0, 0.0)


def polar(radius: float, psi_deg: float) -> PlanPoint:
    return PlanPoint(
        radius * math.sin(math.radians(psi_deg)), radius * math.cos(math.radians(psi_deg))
    )


def replay_max_utilization(rec, weight_kg: float, per_segment: int = 200) -> float:  # type: ignore[no-untyped-def]
    """Maior utilização da trajetória como a cena a executa (L, θ, ψ e c em linha reta entre os
    quadros-chave), com a carga no gancho (de levantar até baixar)."""
    evaluate = avaliador_zonas()
    points = [point for point in rec.trajectory if point.crane_index == 0]
    worst = 0.0
    loaded = False
    for a, b in zip(points, points[1:], strict=False):
        if b.phase.value == "levantar":
            loaded = True
        if not loaded or b.phase.value == "soltar":
            continue
        for i in range(per_segment + 1):
            f = i / per_segment
            state = CraneStateValues(
                *(
                    u + (v - u) * f
                    for u, v in (
                        (a.state.boom_length_m, b.state.boom_length_m),
                        (a.state.boom_angle_deg, b.state.boom_angle_deg),
                        (a.state.turret_rotation_deg, b.state.turret_rotation_deg),
                        (a.state.cable_length_m, b.state.cable_length_m),
                    )
                )
            )
            result = evaluate(
                configuration_id=CONFIGURACAO_ZONAS_ID,
                state=state,
                load_weight_kg=weight_kg,
                ground_slope_deg=None,
                soil_kinds=(),
                wind_speed_ms=None,
                obstacle_conflicts=(),
            )
            if result.evaluable:
                worst = max(worst, result.utilization_percent)
    return worst


@pytest.mark.parametrize("weight_kg", [700.0, 713.0])
def test_o_pior_ponto_na_fronteira_de_zona_entra_no_plano(weight_kg: float) -> None:
    # F-06 (prova 4): o raio cresce no giro e a frente (40 % da capacidade) termina em ψ = 60°,
    # entre dois quadros-chave. O plano não pode dizer menos que a trajetória executada.
    load = PlanLoad(weight_kg, 2.0, 1.0, 1.0)
    request = PlanningRequest(load, polar(10.5, -75.0), polar(16.0, 75.0), ScenarioSpec())

    result = caso_de_uso_zonas().execute(request)

    assert result.recommendations
    for rec in result.recommendations:
        assert rec.max_limit_utilization_percent >= replay_max_utilization(rec, weight_kg) - 0.05


def test_rumo_e_sentido_sao_escolhidos_pela_validade_antes_do_tempo() -> None:
    # F-18 (provas 3 e 3b): o rumo e o sentido mais rápidos levam a carga pela frente fraca
    # (189,7 %); o rumo oposto ou o outro sentido atendem (75,9 %).
    request = PlanningRequest(
        PlanLoad(2000.0, 2.0, 1.0, 1.0), PlanPoint(-13.0, 0.0), PlanPoint(13.0, 0.0), ScenarioSpec()
    )

    result = caso_de_uso_zonas().execute(request)

    best = result.recommendations[0]
    assert best.valid
    assert best.max_limit_utilization_percent < 100.0
    assert not any("Nenhuma opção atende" in note for note in result.notes)


def test_plan_crane_com_zonas_fica_com_o_rumo_valido() -> None:
    # Mesma prova, só no planejador de domínio (uma posição, quatro rumos, dois sentidos).
    search = plan_crane(
        crane=guindaste_zonas(),
        scenario=ScenarioSpec(),
        load=PlanLoad(2000.0, 2.0, 1.0, 1.0),
        pick=PlanPoint(-13.0, 0.0),
        delivery=PlanPoint(13.0, 0.0),
        evaluator=avaliador_zonas(),
        max_positions=1,
    )

    assert search.plans[0].valid


# ---- tandem --------------------------------------------------------------------------------------


def beam_request(load: PlanLoad = BEAM) -> PlanningRequest:
    return PlanningRequest(load, BEAM_PICK, BEAM_DELIVERY, ScenarioSpec())


def test_tandem_valido_tem_os_dois_guindastes_girando_no_mesmo_sentido_sem_se_tocar() -> None:
    result = caso_de_uso_planejamento().execute(beam_request())

    best = result.recommendations[0]
    assert best.kind == "tandem"
    assert best.valid
    first, second = best.details
    assert first.swing_deg * second.swing_deg > 0
    a, b = (CranePlacementSpec(*placement) for placement in best.placements)
    assert not crane_bodies_overlap(a, b)


def test_pontos_de_icamento_a_um_quarto_e_tres_quartos_do_comprimento() -> None:
    # F-03 (b), ADR-041: pontos a 25 % do comprimento para cada lado do centro, como na cena.
    assert HOIST_POINT_FRACTION == 0.25
    best = caso_de_uso_planejamento().execute(beam_request()).recommendations[0]

    offset = HOIST_POINT_FRACTION * BEAM.length_m  # comprimento em Z local (giro 0)
    for (x, z, _), detail, sign in zip(best.placements, best.details, (-1, 1), strict=True):
        assert detail.pick_radius_m == pytest.approx(math.hypot(BEAM_PICK.x - x, sign * offset - z))
        assert detail.delivery_radius_m == pytest.approx(
            math.hypot(BEAM_DELIVERY.x - x, sign * offset - z)
        )


def test_o_centro_de_gravidade_divide_a_carga_do_tandem() -> None:
    # F-03 (a): com o CG a 1 m do centro, o ponto mais perto leva mais (alavanca, RN-016).
    load = replace(BEAM, weight_kg=3000.0, cg_offset_m=1.0)

    best = caso_de_uso_planejamento().execute(beam_request(load)).recommendations[0]

    assert best.kind == "tandem"
    assert [detail.share_kg for detail in best.details] == [1125.0, 1875.0]


def test_par_de_lados_opostos_girando_em_sentidos_opostos_nao_e_recomendado() -> None:
    # F-04 (prova 5): carga curta entre dois guindastes de frente um para o outro; a distância entre
    # os ganchos variava de 0,3 a 4,8 m no giro.
    request = PlanningRequest(
        PlanLoad(6000.0, 3.0, 1.5, 1.2),
        PlanPoint(-7.5, 0.0),
        PlanPoint(7.5, 0.0),
        ScenarioSpec(obstacles=(container_ficticio(),)),
    )

    result = caso_de_uso_planejamento().execute(request)

    for rec in result.recommendations:
        if rec.kind == "tandem":
            first, second = rec.details
            assert first.swing_deg * second.swing_deg >= 0
    assert any("sentidos opostos" in note for note in result.notes)


def plan_at(x: float, z: float, heading: float, swing: float) -> CranePlan:
    state = CraneStateValues(12.0, 45.0, 0.0, 5.0)
    return CranePlan(
        configuration_id="CFG",
        label="FICTÍCIO",
        placement=CranePlacementSpec(x, z, heading),
        boom_length_m=12.0,
        pick_radius_m=9.0,
        delivery_radius_m=9.0,
        swing_deg=swing,
        pick_state=state,
        delivery_state=state,
        path=(state,),
        transport_height_m=1.0,
        crossed_obstacle_ids=(),
        max_utilization_percent=50.0,
        tipping_risk=None,
        valid=True,
        share_kg=1000.0,
        boom_angle_pick_deg=45.0,
        boom_angle_delivery_deg=45.0,
    )


def test_par_com_corpos_sobrepostos_ou_sentidos_opostos_e_recusado() -> None:
    # F-04 (prova 9): eixos a 8,8 m, um de frente para o outro: 61 amostras de um corpo no outro.
    assert _impossible_pair(plan_at(0.0, -4.4, 0.0, 150.0), plan_at(0.0, 4.4, 180.0, 150.0)) == (
        TANDEM_BODIES
    )
    assert _impossible_pair(plan_at(0.0, -10.0, 90.0, 100.0), plan_at(0.0, 10.0, 90.0, -100.0)) == (
        TANDEM_SENSES
    )
    assert _impossible_pair(plan_at(0.0, -16.0, 90.0, 19.0), plan_at(0.0, -8.0, 90.0, 19.0)) is None
    # Giro quase nulo não tem sentido: não recusa.
    assert _impossible_pair(plan_at(0.0, -16.0, 90.0, 0.2), plan_at(0.0, -8.0, 90.0, -19.0)) is None


# ---- busca cortada -------------------------------------------------------------------------------


def test_busca_cortada_pelo_tempo_avisa_na_resposta() -> None:
    # F-28: o `timed_out` da busca não chegava à resposta.
    ticks = iter(range(0, 10_000))
    use_case = caso_de_uso_planejamento(time_budget_s=0.0, clock=lambda: float(next(ticks)))

    result = use_case.execute(beam_request())

    assert result.timed_out


def test_busca_completa_nao_avisa() -> None:
    assert not caso_de_uso_planejamento().execute(beam_request()).timed_out
