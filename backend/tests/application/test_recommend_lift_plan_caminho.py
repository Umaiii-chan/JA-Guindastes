"""`RecommendLiftPlan` confere o caminho inteiro (TASK-088). Dados FICTÍCIOS (ADR-012).

Regressão das provas da auditoria AUD-01: a trajetória recomendada é reproduzida como a cena a
executa (`trajectoryPlayback.ts`: L, θ, ψ e c interpolados em linha reta entre os quadros-chave) e
conferida quadro a quadro contra os obstáculos.
"""

import math
import time
from collections.abc import Iterator

import pytest

from app.application.use_cases.recommend_lift_plan import (
    TIME_BUDGET_S,
    PlanningRequest,
    Recommendation,
    _rejection_note,
)
from app.domain.entities.scenario import (
    FeatureKind,
    ObstacleKind,
    ObstacleSpec,
    ScenarioSpec,
    TerrainFeatureSpec,
    TerrainSpec,
)
from app.domain.services.planning.models import CraneStateValues, PlanLoad, PlanPhase, PlanPoint
from app.domain.services.planning.planner import HOOK_ATTACH_M, sling_drop_m
from app.domain.services.planning.scene import direction, distance_to_obstacle_m
from app.domain.services.planning.sweep import (
    COLLISION_APPROACH,
    COLLISION_BOOM,
    footprint_overlaps_obstacle,
    segment_hits_solid,
    solids_of,
)
from tests.fixtures.planejamento_ficticio import caso_de_uso_planejamento, container_ficticio

PIVOT_OFFSET_M = 0.46  # ficha FICTÍCIA da fixture (`geometria_planejamento`)
PIVOT_HEIGHT_M = 3.3
LOAD = PlanLoad(1000.0, 2.0, 1.0, 1.0)
FAR_PICK = PlanPoint(-14.0, 0.0)
FAR_DELIVERY = PlanPoint(14.0, 0.0)


def plan(
    scenario: ScenarioSpec,
    load: PlanLoad = LOAD,
    pick: PlanPoint = FAR_PICK,
    delivery: PlanPoint = FAR_DELIVERY,
):  # type: ignore[no-untyped-def]
    return caso_de_uso_planejamento().execute(PlanningRequest(load, pick, delivery, scenario))


def frames(
    rec: Recommendation, per_segment: int = 80
) -> Iterator[tuple[PlanPhase, CraneStateValues]]:
    """Estados do guindaste 1 como a cena os anima, com a fase do trecho."""
    points = [point for point in rec.trajectory if point.crane_index == 0]
    for a, b in zip(points, points[1:], strict=False):
        for i in range(per_segment + 1):
            f = i / per_segment
            yield (
                b.phase,
                CraneStateValues(
                    *(
                        u + (v - u) * f
                        for u, v in (
                            (a.state.boom_length_m, b.state.boom_length_m),
                            (a.state.boom_angle_deg, b.state.boom_angle_deg),
                            (a.state.turret_rotation_deg, b.state.turret_rotation_deg),
                            (a.state.cable_length_m, b.state.cable_length_m),
                        )
                    )
                ),
            )


def boom(rec: Recommendation, state: CraneStateValues):  # type: ignore[no-untyped-def]
    """Pino e ponta da lança (x, y, z) no mundo, com o terreno plano."""
    x0, z0, heading = rec.placements[0]
    ux, uz = direction(heading + state.turret_rotation_deg)
    theta = math.radians(state.boom_angle_deg)
    reach = PIVOT_OFFSET_M + state.boom_length_m * math.cos(theta)
    tip_y = PIVOT_HEIGHT_M + state.boom_length_m * math.sin(theta)
    pivot = (x0 + PIVOT_OFFSET_M * ux, PIVOT_HEIGHT_M, z0 + PIVOT_OFFSET_M * uz)
    return pivot, (x0 + reach * ux, tip_y, z0 + reach * uz)


def load_inside(rec: Recommendation, obstacle: ObstacleSpec, load: PlanLoad = LOAD) -> int:
    """Quadros do giro com o círculo da carga dentro do obstáculo e abaixo do topo dele."""
    radius = math.hypot(load.length_m, load.width_m) / 2
    below_hook = HOOK_ATTACH_M + sling_drop_m(load) + load.height_m
    count = 0
    for phase, state in frames(rec):
        if phase is not PlanPhase.SWING:
            continue
        _, (tx, ty, tz) = boom(rec, state)
        bottom = ty - state.cable_length_m - below_hook
        if distance_to_obstacle_m(obstacle, tx, tz) < radius and bottom < obstacle.height_m:
            count += 1
    return count


def boom_inside(rec: Recommendation, obstacle: ObstacleSpec) -> int:
    """Quadros (de todas as fases) com o eixo da lança dentro do obstáculo."""
    (solid,) = solids_of(ScenarioSpec(obstacles=(obstacle,)))
    return sum(1 for _, state in frames(rec) if segment_hits_solid(solid, *boom(rec, state), 0.0))


def _footprint_axes(rotation_y_deg: float):  # type: ignore[no-untyped-def]
    angle = math.radians(rotation_y_deg)
    return (math.cos(angle), -math.sin(angle)), (math.sin(angle), math.cos(angle))


def bed_truck(x: float, z: float, bed_top_m: float, identifier: str = "CARRETA") -> ObstacleSpec:
    """Caminhão plataforma da biblioteca (4,05 × 7,41 m, sem giro) com o CENTRO da carroceria em
    (x, z) e o topo dela a `bed_top_m`: a carroceria fica 1,85 m atrás do centro do caminhão e tem
    0,53 da altura do objeto (`loadBed` de objectLibrary.ts)."""
    height = bed_top_m / (1.86 / 3.51)
    return ObstacleSpec(
        identifier,
        "Caminhão plataforma",
        ObstacleKind.MODEL,
        x,
        z + 1.85,
        4.05,
        7.41,
        height,
        0.0,
        "caminhao-plataforma",
    )


def pole(identifier: str, x: float, z: float) -> ObstacleSpec:
    return ObstacleSpec(
        identifier, "Poste FICTÍCIO", ObstacleKind.CYLINDER, x, z, 0.3, 0.3, 8.0, 0.0
    )


def test_poste_fino_entre_as_amostras_nao_e_atravessado_pela_carga() -> None:
    # F-01 (prova 1): guindaste na origem, giro de 180° a 14 m; sem a correção, a carga passava 230
    # quadros dentro de um poste a meio caminho entre duas amostras. Um poste de cada lado: qualquer
    # sentido do giro passa por um deles.
    base = plan(ScenarioSpec()).recommendations[0]
    assert base.placements[0][:2] == (0.0, 0.0)
    swing = [p.state for p in base.trajectory if p.phase is PlanPhase.SWING]
    psi_mid = (swing[4].turret_rotation_deg + swing[5].turret_rotation_deg) / 2
    radius = PIVOT_OFFSET_M + swing[4].boom_length_m * math.cos(
        math.radians(swing[4].boom_angle_deg)
    )
    ux, uz = direction(base.placements[0][2] + psi_mid)
    poles = (pole("P1", radius * ux, radius * uz), pole("P2", -radius * ux, -radius * uz))

    result = plan(ScenarioSpec(obstacles=poles))

    assert result.recommendations
    for rec in result.recommendations:
        for item in poles:
            assert load_inside(rec, item) == 0


def test_lanca_nao_atravessa_o_predio_no_caminho() -> None:
    # F-02 (prova 2): prédio de 12 m a 7 m do eixo; sem a correção, o plano saía "Atende" com a
    # lança passando por dentro dele a 8,3 m de altura.
    building = ObstacleSpec(
        "PREDIO", "Prédio FICTÍCIO", ObstacleKind.BOX, 0.0, 7.0, 3.0, 3.0, 12.0, 0.0
    )

    result = plan(ScenarioSpec(obstacles=(building,)))

    assert result.recommendations
    for rec in result.recommendations:
        assert boom_inside(rec, building) == 0
        assert load_inside(rec, building) == 0


def test_carga_no_galpao_e_recusada_com_o_nome_do_obstaculo() -> None:
    # F-13 (prova 8): coleta dentro do galpão de 6 m; sem a correção, o gancho descia por dentro
    # dele.
    shed = ObstacleSpec(
        "GALPAO", "Galpão com frente aberta", ObstacleKind.BOX, -7.5, 0.0, 8.0, 12.0, 6.0, 0.0
    )

    result = plan(
        ScenarioSpec(obstacles=(shed,)),
        load=PlanLoad(1500.0, 3.0, 1.5, 1.2),
        pick=PlanPoint(-7.5, 0.0),
        delivery=PlanPoint(7.5, 0.0),
    )

    assert result.recommendations == ()
    assert len(result.notes) == 1
    assert "coleta" in result.notes[0]
    assert "«Galpão com frente aberta»" in result.notes[0]


def test_entrega_dentro_de_obstaculo_que_nao_e_carreta_e_recusada() -> None:
    result = plan(
        ScenarioSpec(obstacles=(container_ficticio(x=7.5),)),
        load=PlanLoad(1500.0, 3.0, 1.5, 1.2),
        pick=PlanPoint(-7.5, 0.0),
        delivery=PlanPoint(7.5, 0.0),
    )

    assert result.recommendations == ()
    assert "entrega" in result.notes[0]
    assert "«Container FICTÍCIO»" in result.notes[0]


def test_entrega_sobre_a_carreta_pousa_a_carga_no_topo_dela() -> None:
    # F-13 (prova 8): carreta de 1,3 m na entrega; sem a correção, a carga descia até o chão, por
    # dentro dela.
    truck = bed_truck(7.5, 0.0, 1.3)
    load = PlanLoad(1500.0, 3.0, 1.5, 1.2)

    result = plan(
        ScenarioSpec(obstacles=(truck,)),
        load=load,
        pick=PlanPoint(-7.5, 0.0),
        delivery=PlanPoint(7.5, 0.0),
    )

    rec = result.recommendations[0]
    assert rec.valid
    lowered = [p.state for p in rec.trajectory if p.phase is PlanPhase.LOWER][-1]
    _, (_, tip_y, _) = boom(rec, lowered)
    bottom = tip_y - lowered.cable_length_m - (HOOK_ATTACH_M + sling_drop_m(load) + load.height_m)
    assert bottom == pytest.approx(1.3 + 0.03)
    # A carga desce sobre a carreta, sem entrar nela, e passa por cima dela no giro.
    assert "CARRETA" in rec.details[0].crossed_obstacle_ids
    assert load_inside(rec, truck, load) == 0


@pytest.mark.parametrize("height_m", [1.2, 0.5, 0.3, 0.2, 0.1])
def test_carga_baixa_sobre_a_carreta_nao_e_recusada_pelo_cabo(height_m: float) -> None:
    # IMPORTANTE-3 da revisão do PR #48: com h <= 0,2 m a linha do cabo terminava abaixo do topo da
    # carreta + meia-largura do gancho, e a própria carreta recusava a entrega ("colisao_cabo").
    truck = bed_truck(7.5, 0.0, 1.3)

    result = plan(
        ScenarioSpec(obstacles=(truck,)),
        load=PlanLoad(1500.0, 3.0, 1.5, height_m),
        pick=PlanPoint(-7.5, 0.0),
        delivery=PlanPoint(7.5, 0.0),
    )

    assert result.recommendations, result.notes


@pytest.mark.parametrize("side", [1, -1])
def test_giro_da_carga_na_entrega_respeita_o_sentido_do_giro(side: int) -> None:
    # MENOR-4 da revisão do PR #48: na entrega a carga está girada do quanto a torre girou
    # (`planner.py`, `rotation = cargo_pick.rotation + sign * arc`). Coleta em (-6, 0) e entrega em
    # (0, ±6): o guindaste fica de um lado ou do outro (giro de -73,7° ou +73,7°). Um muro pequeno
    # no canto da carga girada pelo giro da melhor posição só bloqueia a entrega com esse giro: com
    # o sinal invertido, o planejador aceitaria a posição, e o plano voltaria com a carga no muro.
    load = PlanLoad(1500.0, 3.0, 1.5, 1.2)
    pick = PlanPoint(-6.0, 0.0)
    delivery = PlanPoint(0.0, 6.0 * side)
    free = plan(ScenarioSpec(), load=load, pick=pick, delivery=delivery)
    swing = free.recommendations[0].details[0].swing_deg
    assert abs(swing) % 90 > 10  # com giro de 90° o sinal não mudaria a pegada

    ax, az = _footprint_axes(swing)
    wall = ObstacleSpec(
        "MURO",
        "Muro FICTÍCIO",
        ObstacleKind.BOX,
        delivery.x + ax[0] * (load.width_m / 2 - 0.03) + az[0] * (load.length_m / 2 - 0.03),
        delivery.z + ax[1] * (load.width_m / 2 - 0.03) + az[1] * (load.length_m / 2 - 0.03),
        0.04,
        0.04,
        3.0,
        0.0,
    )

    def blocks(rotation_deg: float) -> bool:
        return footprint_overlaps_obstacle(
            wall, delivery.x, delivery.z, load.width_m / 2, load.length_m / 2, rotation_deg
        )

    assert blocks(swing) and not blocks(-swing)

    result = plan(ScenarioSpec(obstacles=(wall,)), load=load, pick=pick, delivery=delivery)

    assert result.recommendations
    for rec in result.recommendations:
        for detail in rec.details:
            assert not blocks(detail.swing_deg)


def test_monte_estreito_no_caminho_sobe_a_altura_de_transporte() -> None:
    # Terreno no caminho: monte de 2 m e 1 m de raio entre duas amostras dos quadros-chave.
    base = plan(ScenarioSpec()).recommendations[0]
    swing = [p.state for p in base.trajectory if p.phase is PlanPhase.SWING]
    psi_mid = (swing[4].turret_rotation_deg + swing[5].turret_rotation_deg) / 2
    radius = PIVOT_OFFSET_M + swing[4].boom_length_m * math.cos(
        math.radians(swing[4].boom_angle_deg)
    )
    features = []
    for sign in (1, -1):
        ux, uz = direction(base.placements[0][2] + psi_mid)
        features.append(
            TerrainFeatureSpec(
                f"M{sign}", FeatureKind.MOUND, sign * radius * ux, sign * radius * uz, 1.0, 2.0
            )
        )

    rec = plan(ScenarioSpec(terrain=TerrainSpec(features=tuple(features)))).recommendations[0]

    assert rec.details[0].transport_height_m >= 2.0 + 1.0 - 1e-6


def test_descartes_por_colisao_aparecem_com_texto_claro() -> None:
    note = _rejection_note({COLLISION_BOOM: 12, "colisao_cabo": 3, "entrega": 2})

    assert "12 com a lança batendo em obstáculo" in note
    assert "3 com o cabo ou o gancho batendo em obstáculo" in note
    assert "2 com a carga na entrega sobre ou sob obstáculo que não é a carroceria" in note


def test_cenario_cheio_responde_dentro_do_orcamento() -> None:
    obstacles = (
        container_ficticio(),
        pole("P1", -3.0, 9.0),
        pole("P2", 3.0, -9.0),
        ObstacleSpec("PR", "Prédio", ObstacleKind.BOX, 0.0, 16.0, 6.0, 4.0, 12.0, 15.0),
        ObstacleSpec("CA", "Carro", ObstacleKind.BOX, -12.0, 6.0, 2.0, 4.5, 1.5, 30.0),
        ObstacleSpec("AR", "Árvore", ObstacleKind.CYLINDER, 12.0, 8.0, 3.0, 3.0, 7.0, 0.0),
        ObstacleSpec("MU", "Muro", ObstacleKind.BOX, 0.0, -15.0, 14.0, 0.4, 3.0, 0.0),
        ObstacleSpec("TQ", "Tanque", ObstacleKind.CYLINDER, -14.0, -8.0, 4.0, 4.0, 5.0, 0.0),
    )
    terrain = TerrainSpec(
        slope_x_percent=0.5,
        features=(
            TerrainFeatureSpec("M1", FeatureKind.MOUND, 2.0, 5.0, 1.5, 0.8),
            TerrainFeatureSpec("M2", FeatureKind.MOUND, -4.0, -6.0, 2.0, 1.0),
            TerrainFeatureSpec("PL", FeatureKind.PLATEAU, 8.0, -4.0, 3.0, 0.5),
        ),
    )
    use_case = caso_de_uso_planejamento(com_grande=True)

    start = time.perf_counter()
    result = use_case.execute(
        PlanningRequest(
            PlanLoad(6000.0, 3.0, 1.5, 1.2),
            PlanPoint(-7.5, 0.0),
            PlanPoint(7.5, 0.0),
            ScenarioSpec(terrain=terrain, obstacles=obstacles),
        )
    )

    assert time.perf_counter() - start < TIME_BUDGET_S
    assert result.recommendations


def test_carga_dentro_do_barracao_aberto_nao_e_mais_recusada_na_coleta() -> None:
    # IMPORTANTE-1 da revisão do PR #48: o "barracao-aberto" é oco para o planejador, como na cena
    # (`hangarBoxes`), e é o cenário que a IA monta (a carga DENTRO, o guindaste fora, de frente
    # para a porta; ai_fakes.py `scenario_ia_json`). Girado de -90°, a porta (+Z) olha para -X.
    # Antes: nenhum guindaste era tentado ("fica sob ou dentro de «Galpão com frente aberta»").
    # Com o guindaste da fixture (ficha FICTÍCIA) o plano completo não fecha: o cabo atravessa o
    # teto nos posicionamentos que a busca tenta (ver handoff); aqui vale só a coleta liberada.
    barn = ObstacleSpec(
        "BARRACAO",
        "Galpão com frente aberta",
        ObstacleKind.MODEL,
        22.0,
        0.0,
        19.22,
        27.44,
        8.27,
        -90.0,
        "barracao-aberto",
    )

    result = plan(
        ScenarioSpec(obstacles=(barn,)),
        load=PlanLoad(1500.0, 3.0, 0.6, 0.6),
        pick=PlanPoint(11.0, 0.0),
        delivery=PlanPoint(-13.0, 0.0),
    )

    assert not any("sob ou dentro de" in note for note in result.notes)
    assert any("Combinações descartadas" in note for note in result.notes)


def _truck_at_origin() -> ObstacleSpec:
    return ObstacleSpec(
        "CAMINHAO",
        "Caminhão plataforma",
        ObstacleKind.MODEL,
        0.0,
        0.0,
        4.05,
        7.41,
        3.51,
        0.0,
        "caminhao-plataforma",
    )


def test_coleta_sobre_a_carroceria_do_caminhao_tem_plano() -> None:
    # IMPORTANTE-1 do PR #58: a cena assenta a carga sobre a carroceria (PRs #55 e #57); o plano
    # pega a carga ali (base a 1,86 m, centro da pegada na carroceria) em vez de recusar a coleta.
    load = PlanLoad(1500.0, 3.0, 1.5, 1.2)

    result = plan(
        ScenarioSpec(obstacles=(_truck_at_origin(),)),
        load=load,
        pick=PlanPoint(0.0, -1.85),
        delivery=PlanPoint(14.0, -1.85),
    )

    assert result.recommendations, result.notes
    assert result.recommendations[0].valid
    assert not any("sob ou dentro de" in note for note in result.notes)


def test_centro_da_carga_sobre_a_cabine_diz_que_o_centro_vai_na_carroceria() -> None:
    result = plan(
        ScenarioSpec(obstacles=(_truck_at_origin(),)),
        load=PlanLoad(1500.0, 3.0, 1.5, 1.2),
        pick=PlanPoint(0.0, 1.5),
        delivery=PlanPoint(14.0, 0.0),
    )

    assert result.recommendations == ()
    assert "carroceria (traseira)" in result.notes[0]


def test_caixa_carreta_na_entrega_e_recusada_com_o_motivo() -> None:
    trailer = ObstacleSpec("CARRETA", "Carreta", ObstacleKind.BOX, 14.0, 0.0, 2.5, 9.0, 1.3, 0.0)

    result = plan(
        ScenarioSpec(obstacles=(trailer,)),
        load=PlanLoad(1500.0, 3.0, 1.5, 1.2),
        pick=PlanPoint(-14.0, 0.0),
        delivery=PlanPoint(14.0, 0.0),
    )

    assert result.recommendations == ()
    assert "«Carreta»" in result.notes[0]
    assert "só os objetos da biblioteca com superfície de apoio" in result.notes[0]  # ADR-052


def test_descarte_pela_aproximacao_do_gancho_tem_texto_proprio() -> None:
    note = _rejection_note({COLLISION_APPROACH: 7})

    assert "7 com a aproximação do gancho (da partida até a carga) batendo em obstáculo" in note
