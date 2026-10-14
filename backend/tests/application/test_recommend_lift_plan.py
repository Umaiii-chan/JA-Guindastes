"""`RecommendLiftPlan` (TASK-075; ADR-038). Dados FICTÍCIOS (ADR-012).

Coleta em (-7,5; 0) e entrega em (7,5; 0), 15 m uma da outra, com um container de 6 × 3 × 3 m
no meio.
"""

import time

import pytest

from app.application.use_cases.recommend_lift_plan import (
    PlanningInvalidInputError,
    PlanningRequest,
)
from app.domain.entities.scenario import CranePlacementSpec, ScenarioSpec, TerrainSpec
from app.domain.services.planning.crane_body import crane_body_overlaps_obstacle
from app.domain.services.planning.models import PlanLoad, PlanPhase, PlanPoint
from tests.fixtures.planejamento_ficticio import (
    CONFIGURACAO_GRANDE_ID,
    CONFIGURACAO_PLANEJAMENTO_ID,
    caso_de_uso_planejamento,
    container_ficticio,
)

PICK = PlanPoint(-7.5, 0.0)
DELIVERY = PlanPoint(7.5, 0.0)


def request(weight_kg: float, scenario: ScenarioSpec | None = None) -> PlanningRequest:
    return PlanningRequest(
        load=PlanLoad(weight_kg, 3.0, 1.5, 1.2),
        pick=PICK,
        delivery=DELIVERY,
        scenario=scenario or ScenarioSpec(obstacles=(container_ficticio(),)),
    )


def test_carga_leve_recomenda_um_guindaste_com_posicao_e_trajetoria() -> None:
    result = caso_de_uso_planejamento().execute(request(2000.0))

    best = result.recommendations[0]
    assert best.kind == "single"
    assert best.valid
    assert best.configuration_ids == (CONFIGURACAO_PLANEJAMENTO_ID,)
    assert 0 < best.max_limit_utilization_percent <= 100
    detail = best.details[0]
    assert detail.pick_radius_m > 0 and detail.delivery_radius_m > 0
    # A carga passa 1 m acima do container (3 m): base a 4 m do chão.
    assert detail.transport_height_m == pytest.approx(4.0)
    assert detail.crossed_obstacle_ids == ("OBS-1",)


def test_trajetoria_tem_as_seis_fases_em_ordem_e_tempo_crescente() -> None:
    best = caso_de_uso_planejamento().execute(request(2000.0)).recommendations[0]

    phases: list[PlanPhase] = []
    for point in best.trajectory:
        if not phases or phases[-1] is not point.phase:
            phases.append(point.phase)
    assert phases == [
        PlanPhase.APPROACH,
        PlanPhase.HOOK,
        PlanPhase.LIFT,
        PlanPhase.SWING,
        PlanPhase.LOWER,
        PlanPhase.RELEASE,
    ]
    times = [point.t_s for point in best.trajectory]
    assert times == sorted(times)
    assert times[0] == 0.0


def test_a_trajetoria_termina_com_a_carga_na_entrega_e_o_gancho_baixo() -> None:
    best = caso_de_uso_planejamento().execute(request(2000.0)).recommendations[0]

    first_swing = next(p for p in best.trajectory if p.phase is PlanPhase.SWING)
    after_lift = [p for p in best.trajectory if p.phase is PlanPhase.LIFT][-1]
    lowered = [p for p in best.trajectory if p.phase is PlanPhase.LOWER][-1]
    # Levantar encurta o cabo (gancho sobe); baixar o alonga de novo.
    pick = [p for p in best.trajectory if p.phase is PlanPhase.HOOK][0]
    assert after_lift.state.cable_length_m < pick.state.cable_length_m
    assert lowered.state.cable_length_m > after_lift.state.cable_length_m
    assert first_swing.state.turret_rotation_deg != after_lift.state.turret_rotation_deg


def test_posicao_recomendada_fica_fora_do_obstaculo() -> None:
    best = caso_de_uso_planejamento().execute(request(2000.0)).recommendations[0]

    x, z, heading = best.placements[0]
    assert not crane_body_overlaps_obstacle(CranePlacementSpec(x, z, heading), container_ficticio())


def test_obstaculo_muito_alto_inverte_o_sentido_do_giro() -> None:
    # 12 m de altura: subir e descer custa mais que girar por trás; o giro longo passa a valer.
    scenario = ScenarioSpec(obstacles=(container_ficticio(height_m=12.0),))
    baixo = caso_de_uso_planejamento().execute(request(1500.0)).recommendations[0]
    alto = caso_de_uso_planejamento().execute(request(1500.0, scenario)).recommendations[0]

    assert abs(alto.details[0].swing_deg) >= abs(baixo.details[0].swing_deg)


def test_carga_pesada_com_guindaste_maior_escolhe_o_maior() -> None:
    result = caso_de_uso_planejamento(com_grande=True).execute(request(9000.0))

    best = result.recommendations[0]
    assert best.kind == "single"
    assert best.valid
    assert best.configuration_ids == (CONFIGURACAO_GRANDE_ID,)


def test_ordena_validas_primeiro_pela_menor_utilizacao() -> None:
    result = caso_de_uso_planejamento(com_grande=True).execute(request(2500.0))

    assert [item.configuration_ids[0] for item in result.recommendations] == [
        CONFIGURACAO_GRANDE_ID,
        CONFIGURACAO_PLANEJAMENTO_ID,
    ]
    utilizations = [item.max_limit_utilization_percent for item in result.recommendations]
    assert utilizations == sorted(utilizations)
    assert all(item.valid for item in result.recommendations)


def test_sem_guindaste_unico_recomenda_dois_em_tandem_com_75_por_cento() -> None:
    result = caso_de_uso_planejamento().execute(request(6000.0))

    best = result.recommendations[0]
    assert best.kind == "tandem"
    assert best.valid
    assert len(best.configuration_ids) == 2
    assert len(best.placements) == 2
    # Divisão pelo CG no centro: metade para cada um.
    assert [detail.share_kg for detail in best.details] == [3000.0, 3000.0]
    assert {point.crane_index for point in best.trajectory} == {0, 1}
    assert any("tandem" in note for note in result.notes)


def test_tandem_sincroniza_os_instantes_das_duas_trajetorias() -> None:
    best = caso_de_uso_planejamento().execute(request(6000.0)).recommendations[0]

    by_crane = {
        index: [p.t_s for p in best.trajectory if p.crane_index == index] for index in (0, 1)
    }
    assert by_crane[0] == by_crane[1]


def test_nada_atende_devolve_as_melhores_opcoes_marcadas_como_invalidas() -> None:
    result = caso_de_uso_planejamento().execute(request(40000.0))

    assert result.recommendations
    assert not any(item.valid for item in result.recommendations)
    assert any("limite" in note for note in result.notes)


def test_sem_tabela_ativa_devolve_lista_vazia_com_motivo() -> None:
    result = caso_de_uso_planejamento(sem_tabelas=True).execute(request(1000.0))

    assert result.recommendations == ()
    assert result.notes


def test_terreno_inclinado_demais_descarta_todas_as_posicoes() -> None:
    steep = ScenarioSpec(terrain=TerrainSpec(slope_x_percent=40.0, slope_z_percent=40.0))

    result = caso_de_uso_planejamento().execute(request(1000.0, steep))

    assert result.recommendations == ()


def test_acessorio_inexistente_e_rejeitado() -> None:
    bad = PlanningRequest(
        load=PlanLoad(1000.0, 3.0, 1.5, 1.2),
        pick=PICK,
        delivery=DELIVERY,
        scenario=ScenarioSpec(),
        accessory_ids=("NAO-EXISTE",),
    )

    with pytest.raises(PlanningInvalidInputError):
        caso_de_uso_planejamento().execute(bad)


def test_peso_zero_e_rejeitado() -> None:
    with pytest.raises(PlanningInvalidInputError):
        caso_de_uso_planejamento().execute(request(0.0))


def test_cenario_pequeno_responde_em_menos_de_3_segundos() -> None:
    use_case = caso_de_uso_planejamento(com_grande=True)

    start = time.perf_counter()
    use_case.execute(request(6000.0))
    use_case.execute(request(40000.0))

    assert time.perf_counter() - start < 3.0


def test_o_orcamento_de_tempo_limita_a_busca() -> None:
    ticks = iter(range(0, 1000))
    use_case = caso_de_uso_planejamento(time_budget_s=0.0, clock=lambda: float(next(ticks)))

    result = use_case.execute(request(1000.0))

    assert result.recommendations == ()
