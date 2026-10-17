"""Conferência contínua do caminho do plano (TASK-088). Dados FICTÍCIOS (ADR-012).

Os casos vêm das provas da auditoria AUD-01 (F-01, F-02 e F-13): um poste fino entre duas
amostras do giro, a lança atravessando um prédio, o gancho dentro de um galpão e a entrega sobre
uma carreta.
"""

import math
import random

import pytest

from app.domain.entities.scenario import (
    CranePlacementSpec,
    FeatureKind,
    ObstacleKind,
    ObstacleSpec,
    ScenarioSpec,
    TerrainFeatureSpec,
    TerrainSpec,
)
from app.domain.services.planning.models import CraneStateValues, PlanLoad, PlanPoint
from app.domain.services.planning.scene import direction, distance_to_obstacle_m
from app.domain.services.planning.sweep import (
    COLLISION_BOOM,
    COLLISION_CABLE,
    COLLISION_LOAD,
    MAX_SWEEP_SEGMENTS,
    SWEEP_STEP_M,
    Rig,
    body_crossed,
    delivery_cover,
    delivery_surface,
    first_path_collision,
    footprint_overlaps_obstacle,
    load_crossings,
    pick_cover,
    samples_within,
    segment_hits_solid,
    solids_of,
    swing_arc,
    terrain_peak_along,
)
from app.domain.services.planning.terrain import (
    cargo_base_y,
    terrain_height_at,
    terrain_peak_near,
)
from app.domain.value_objects.angle import Angle
from app.domain.value_objects.crane_geometry import CraneGeometry
from app.domain.value_objects.length import Length

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
LOAD = PlanLoad(weight_kg=1000.0, length_m=2.0, width_m=1.0, height_m=1.0)
RADIUS_LOAD = math.hypot(LOAD.length_m, LOAD.width_m) / 2


def box(identifier: str, x: float, z: float, w: float, d: float, h: float, **kw: object):  # type: ignore[no-untyped-def]
    return ObstacleSpec(identifier, identifier, ObstacleKind.BOX, x, z, w, d, h, 0.0, **kw)  # type: ignore[arg-type]


def pole(x: float, z: float, height: float = 8.0) -> ObstacleSpec:
    return ObstacleSpec(
        "POSTE", "Poste FICTÍCIO", ObstacleKind.CYLINDER, x, z, 0.3, 0.3, height, 0.0
    )


def half_turn(radius: float = 30.0):  # type: ignore[no-untyped-def]
    """Giro de 180° com raio fixo, da direção +Z para -Z pela esquerda (+X)."""
    return swing_arc(
        center_x=0.0,
        center_z=0.0,
        start_azimuth_deg=0.0,
        sign=1,
        arc_deg=180.0,
        start_radius_m=radius,
        end_radius_m=radius,
        path_segments=12,
    )


# ---- grade densa ---------------------------------------------------------------------------------


def test_o_giro_e_amostrado_a_no_maximo_um_quarto_de_metro_no_maior_raio() -> None:
    arc = half_turn(30.0)

    assert arc.segments % 12 == 0
    assert arc.step_m <= SWEEP_STEP_M + 1e-12
    for k in range(arc.segments):
        assert math.dist(arc.point(k), arc.point(k + 1)) <= arc.step_m + 1e-9


def test_giro_enorme_respeita_o_teto_e_amplia_o_passo() -> None:
    arc = swing_arc(
        center_x=0.0,
        center_z=0.0,
        start_azimuth_deg=0.0,
        sign=1,
        arc_deg=350.0,
        start_radius_m=80.0,
        end_radius_m=80.0,
        path_segments=12,
    )

    assert arc.segments <= MAX_SWEEP_SEGMENTS
    assert arc.step_m > SWEEP_STEP_M


def test_poste_fino_entre_duas_amostras_dos_quadros_chave_e_cruzado() -> None:
    # F-01: com 12 trechos de 15°, o poste a 7,5° fica a 3,9 m das amostras (raio de 30 m).
    azimuth = math.radians(7.5)
    thin = pole(30.0 * math.sin(azimuth), 30.0 * math.cos(azimuth))
    keyframes = [
        (30.0 * math.sin(math.radians(15 * k)), 30.0 * math.cos(math.radians(15 * k)))
        for k in range(13)
    ]
    assert min(distance_to_obstacle_m(thin, x, z) for x, z in keyframes) > RADIUS_LOAD

    assert load_crossings(half_turn(), (thin,), RADIUS_LOAD) == (thin,)


def test_obstaculo_longe_do_caminho_nao_e_cruzado() -> None:
    far = pole(0.0, 0.0)  # no eixo, a 30 m do caminho

    assert load_crossings(half_turn(), (far,), RADIUS_LOAD) == ()


def test_pular_amostras_nao_perde_nenhuma_perto_da_forma() -> None:
    rng = random.Random(88)
    arc = half_turn(18.0)
    for _ in range(60):
        target = pole(rng.uniform(-20, 20), rng.uniform(-20, 20))

        def distance(x: float, z: float, item: ObstacleSpec = target) -> float:
            return distance_to_obstacle_m(item, x, z)

        threshold = rng.uniform(0.1, 3.0)
        brute = [k for k in range(arc.segments + 1) if distance(*arc.point(k)) <= threshold]
        assert list(samples_within(arc, distance, threshold)) == brute


def test_carga_que_passa_sobre_o_corpo_do_guindaste_e_detectada() -> None:
    placement = CranePlacementSpec(0.0, 0.0, 0.0)
    over_cab = swing_arc(
        center_x=0.0,
        center_z=0.0,
        start_azimuth_deg=-90.0,
        sign=1,
        arc_deg=180.0,
        start_radius_m=8.0,
        end_radius_m=8.0,
        path_segments=12,
    )
    behind = swing_arc(
        center_x=0.0,
        center_z=0.0,
        start_azimuth_deg=-90.0,
        sign=-1,
        arc_deg=180.0,
        start_radius_m=12.0,
        end_radius_m=12.0,
        path_segments=12,
    )

    assert body_crossed(over_cab, placement, RADIUS_LOAD)  # a cabine vai até Z = 9,22 m
    assert not body_crossed(behind, placement, RADIUS_LOAD)  # a traseira só até Z = -5,13 m


# ---- terreno no caminho --------------------------------------------------------------------------


def test_monte_estreito_entre_amostras_entra_no_pico_do_terreno() -> None:
    azimuth = math.radians(7.5)
    mound = TerrainFeatureSpec(
        "M1", FeatureKind.MOUND, 30.0 * math.sin(azimuth), 30.0 * math.cos(azimuth), 1.0, 2.0
    )
    terrain = TerrainSpec(features=(mound,))
    keyframes = [
        (30.0 * math.sin(math.radians(15 * k)), 30.0 * math.cos(math.radians(15 * k)))
        for k in range(13)
    ]
    assert max(terrain_height_at(terrain, x, z) for x, z in keyframes) == 0.0

    assert terrain_peak_along(half_turn(), terrain, RADIUS_LOAD) == pytest.approx(2.0)


def test_terreno_plano_sem_feicoes_tem_pico_zero() -> None:
    assert terrain_peak_along(half_turn(), TerrainSpec(), RADIUS_LOAD) == 0.0


@pytest.mark.parametrize("seed", [1, 2, 3])
def test_pico_do_terreno_nunca_fica_abaixo_do_terreno_sob_a_carga(seed: int) -> None:
    rng = random.Random(seed)
    kinds = [
        FeatureKind.MOUND,
        FeatureKind.PIT,
        FeatureKind.PLATEAU,
        FeatureKind.RAMP,
        FeatureKind.FLATTEN,
    ]
    features = tuple(
        TerrainFeatureSpec(
            f"F{i}",
            rng.choice(kinds),
            rng.uniform(-10, 10),
            rng.uniform(-10, 10),
            rng.uniform(0.5, 5.0),
            rng.uniform(0.2, 2.0),
            direction_deg=rng.uniform(0, 360),
            width_m=rng.uniform(1.0, 4.0),
        )
        for i in range(6)
    )
    terrain = TerrainSpec(
        slope_x_percent=rng.uniform(-3, 3), slope_z_percent=rng.uniform(-3, 3), features=features
    )
    for _ in range(80):
        x, z, radius = rng.uniform(-12, 12), rng.uniform(-12, 12), rng.uniform(0.2, 3.0)
        bound = terrain_peak_near(terrain, x, z, radius)
        for _ in range(30):
            angle = rng.uniform(0, 2 * math.pi)
            distance = radius * math.sqrt(rng.random())
            px, pz = x + distance * math.sin(angle), z + distance * math.cos(angle)
            assert terrain_height_at(terrain, px, pz) <= bound + 1e-9


def test_base_da_carga_assenta_no_ponto_mais_alto_da_pegada() -> None:
    # Rampa de 10 % em X: o canto mais alto da caixa (1 m de largura em X) fica 0,05 m acima do
    # centro.
    terrain = TerrainSpec(slope_x_percent=10.0)

    assert cargo_base_y(terrain, 2.0, 1.0, 0.0, 0.0, 0.0) == pytest.approx(0.05)
    # Girada de 90°, o comprimento (2 m) fica em X.
    assert cargo_base_y(terrain, 2.0, 1.0, 0.0, 0.0, 90.0) == pytest.approx(0.1)


# ---- pegada na coleta e na entrega ---------------------------------------------------------------


def test_pegada_girada_encosta_ou_nao_no_obstaculo() -> None:
    wall = box("MURO", 2.0, 0.0, 0.2, 4.0, 3.0)

    # Comprimento em Z: a carga de 1 m de largura vai de x = -0,5 a 0,5; o muro começa em 1,9.
    assert not footprint_overlaps_obstacle(wall, 0.0, 0.0, 0.5, 1.0, 0.0)
    # Girada de 90°, o comprimento (2 m) vai para X: de -1 a 1, ainda longe.
    assert not footprint_overlaps_obstacle(wall, 0.0, 0.0, 0.5, 1.0, 90.0)
    # Deslocada para x = 1, girada: chega a x = 2 e invade o muro.
    assert footprint_overlaps_obstacle(wall, 1.0, 0.0, 0.5, 1.0, 90.0)
    # Cilindro.
    assert footprint_overlaps_obstacle(pole(0.6, 0.0), 0.0, 0.0, 0.5, 1.0, 0.0)
    assert not footprint_overlaps_obstacle(pole(0.7, 0.0), 0.0, 0.0, 0.5, 1.0, 0.0)


def test_coleta_dentro_do_galpao_fica_coberta() -> None:
    shed = box("GALPAO", -7.5, 0.0, 8.0, 12.0, 6.0)
    scenario = ScenarioSpec(obstacles=(shed,))

    assert pick_cover(scenario, LOAD, PlanPoint(-7.5, 0.0)) == (shed,)
    assert pick_cover(scenario, LOAD, PlanPoint(-13.0, 0.0)) == ()


def test_entrega_sobre_a_carreta_apoia_no_topo_dela() -> None:
    truck = box("CARRETA", 7.5, 0.0, 2.5, 9.0, 1.3)
    scenario = ScenarioSpec(obstacles=(truck,))

    surface = delivery_surface(scenario, LOAD, 7.5, 0.0, 0.0)

    assert surface.rest_y == pytest.approx(1.3)
    assert surface.supports == (truck,)
    assert surface.blockers == ()


def _platform_truck() -> ObstacleSpec:
    # Caminhão plataforma da biblioteca em escala 1 (4,05 × 7,41 × 3,51 m), no centro, sem giro.
    return ObstacleSpec(
        "C1",
        "Caminhão 1",
        ObstacleKind.MODEL,
        0.0,
        0.0,
        4.05,
        7.41,
        3.51,
        0.0,
        "caminhao-plataforma",
    )


def test_caminhao_plataforma_da_biblioteca_tambem_recebe_a_carga() -> None:
    # A carroceria é o trecho traseiro (z de -3,7 a 0): 1,85 m atrás do centro, com 3,71 m de
    # comprimento (`loadBed` de objectLibrary.ts). Centro da pegada dentro dela: a carga repousa no
    # topo da carroceria (0,53 da altura: 1,86 m de 3,51 m), não no topo da caixa inteira (cabine).
    truck = _platform_truck()

    surface = delivery_surface(ScenarioSpec(obstacles=(truck,)), LOAD, 0.0, -1.85, 0.0)

    assert surface.rest_y == pytest.approx(1.86)
    assert surface.supports == (truck,)
    assert surface.blockers == ()


def test_carga_com_o_centro_fora_da_carroceria_nao_e_entregue_sobre_ela() -> None:
    # Mesmo critério da cena (`loadBeds.ts`): o centro da pegada decide. Sobre a cabine (z > 0), a
    # carga fica no terreno e o caminhão é obstáculo comum: a entrega é recusada.
    truck = _platform_truck()
    scenario = ScenarioSpec(obstacles=(truck,))

    over_cab = delivery_surface(scenario, LOAD, 0.0, 1.5, 0.0)

    assert over_cab.supports == ()
    assert over_cab.rest_y == pytest.approx(0.0)
    assert over_cab.blockers == (truck,)
    assert delivery_cover(scenario, LOAD, PlanPoint(0.0, 1.5)) == (truck,)
    # A carga com o centro dentro da carroceria, ainda que a pegada passe da borda, se apoia nela.
    assert delivery_surface(scenario, LOAD, 0.0, -0.3, 0.0).supports == (truck,)
    assert delivery_cover(scenario, LOAD, PlanPoint(0.0, -1.85)) == ()


def test_carroceria_acompanha_o_giro_e_a_escala_do_caminhao() -> None:
    # Girado de 90° (a traseira, em z local negativo, vai para x negativo) e esticado em z.
    truck = ObstacleSpec(
        "C1",
        "Caminhão 1",
        ObstacleKind.MODEL,
        10.0,
        5.0,
        4.05,
        14.82,
        3.51,
        90.0,
        "caminhao-plataforma",
    )
    scenario = ScenarioSpec(obstacles=(truck,))

    # Centro da carroceria: 3,7 m atrás do centro, no eixo do caminhão: x = 10 - 3,7 = 6,3.
    assert delivery_surface(scenario, LOAD, 6.3, 5.0, 90.0).supports == (truck,)
    assert delivery_surface(scenario, LOAD, 13.7, 5.0, 90.0).supports == ()


def test_entrega_sob_outro_obstaculo_e_recusada() -> None:
    container = box("CONTAINER", 7.5, 0.0, 2.5, 6.0, 2.5)
    scenario = ScenarioSpec(obstacles=(container,))

    assert delivery_surface(scenario, LOAD, 7.5, 0.0, 0.0).blockers == (container,)
    assert delivery_cover(scenario, LOAD, PlanPoint(7.5, 0.0)) == (container,)
    # Ao lado dele, a entrega é livre.
    assert delivery_surface(scenario, LOAD, 10.0, 0.0, 0.0).blockers == ()
    assert delivery_cover(scenario, LOAD, PlanPoint(10.0, 0.0)) == ()


def test_obstaculo_baixo_sob_a_carga_sobre_a_carreta_nao_bloqueia() -> None:
    truck = box("CARRETA", 0.0, 0.0, 2.5, 9.0, 1.3)
    curb = box("MEIO-FIO", 0.0, 0.0, 3.0, 0.3, 0.2)

    surface = delivery_surface(ScenarioSpec(obstacles=(truck, curb)), LOAD, 0.0, 0.0, 0.0)

    assert surface.rest_y == pytest.approx(1.3)
    assert surface.blockers == ()


# ---- lança, cabo e carga -------------------------------------------------------------------------


def test_segmento_contra_caixa_girada_e_cilindro() -> None:
    (building,) = solids_of(ScenarioSpec(obstacles=(box("PREDIO", 0.0, 7.0, 3.0, 3.0, 12.0),)))
    (cylinder,) = solids_of(ScenarioSpec(obstacles=(pole(0.0, 7.0, 12.0),)))

    # Da origem a (0, 20, 14): passa por z = 7 a 10 m de altura, dentro do prédio de 12 m.
    assert segment_hits_solid(building, (0.0, 0.0, 0.0), (0.0, 20.0, 14.0), 0.0)
    assert not segment_hits_solid(building, (0.0, 14.0, 0.0), (0.0, 20.0, 14.0), 0.0)
    assert segment_hits_solid(cylinder, (0.0, 0.0, 0.0), (0.0, 20.0, 14.0), 0.0)
    assert not segment_hits_solid(cylinder, (1.0, 0.0, 0.0), (1.0, 20.0, 14.0), 0.0)
    assert segment_hits_solid(cylinder, (1.0, 0.0, 0.0), (1.0, 20.0, 14.0), 0.9)


def rig() -> Rig:
    return Rig(
        geometry=GEOMETRY,
        placement=CranePlacementSpec(0.0, 0.0, 0.0),
        ground_y=0.0,
        load_radius_m=RADIUS_LOAD,
        load_height_m=1.0,
        rigging_m=2.05,
        hook_drop_m=1.05,
    )


def state(angle: float, psi: float, cable: float, length: float = 18.0) -> CraneStateValues:
    return CraneStateValues(length, angle, psi, cable)


def collision(scenario: ScenarioSpec, path: list[CraneStateValues], **kw: float) -> str | None:
    radius = GEOMETRY.boom_pivot_offset_m + path[0].boom_length_m * math.cos(
        math.radians(path[0].boom_angle_deg)
    )
    arc = swing_arc(
        center_x=0.0,
        center_z=0.0,
        start_azimuth_deg=path[0].turret_rotation_deg,
        sign=1 if path[-1].turret_rotation_deg >= path[0].turret_rotation_deg else -1,
        arc_deg=abs(path[-1].turret_rotation_deg - path[0].turret_rotation_deg),
        start_radius_m=radius,
        end_radius_m=radius,
        path_segments=len(path) - 1,
    )
    pick = kw.get("pick_cable", path[0].cable_length_m)
    delivery = kw.get("delivery_cable", path[-1].cable_length_m)
    pick_state = CraneStateValues(
        path[0].boom_length_m, path[0].boom_angle_deg, path[0].turret_rotation_deg, pick
    )
    delivery_state = CraneStateValues(
        path[-1].boom_length_m, path[-1].boom_angle_deg, path[-1].turret_rotation_deg, delivery
    )
    return first_path_collision(
        rig(),
        solids_of(scenario),
        arc=arc,
        path=path,
        approach=(pick_state, pick_state),
        pick_state=pick_state,
        pick_load_top_y=kw.get("pick_top", 1.0),
        delivery_state=delivery_state,
        delivery_load_top_y=kw.get("delivery_top", 1.0),
    )


def swing(angle: float = 50.0, cable: float = 6.0, start: float = -90.0, end: float = 90.0):  # type: ignore[no-untyped-def]
    return [state(angle, start + (end - start) * k / 12, cable) for k in range(13)]


def test_lanca_que_atravessa_um_predio_no_giro_e_recusada() -> None:
    # F-02: prédio de 12 m a 7 m do eixo, no meio do giro (azimute 0). Com L = 18 m e θ = 50°, a
    # lança passa a 3 + 6,5·tg 50° = 10,7 m de altura sobre ele.
    building = box("PREDIO", 0.0, 7.0, 3.0, 3.0, 12.0)

    assert collision(ScenarioSpec(obstacles=(building,)), swing()) == COLLISION_BOOM
    # Com 7 m, a lança passa sobre a borda mais próxima (r = 5,5 m) a 3 + 5·tg 50° = 9,0 m: 2 m
    # acima do topo. (O obstáculo é crescido da meia-seção em quina, um pouco conservador.)
    low = box("PREDIO", 0.0, 7.0, 3.0, 3.0, 7.0)
    assert collision(ScenarioSpec(obstacles=(low,)), swing()) is None


def test_lanca_entre_amostras_dos_quadros_chave_tambem_e_vista() -> None:
    # Poste alto a 7,5° do primeiro quadro-chave depois do meio: só a grade densa o encontra.
    psi = 7.5
    ux, uz = direction(psi)
    tall = pole(6.0 * ux, 6.0 * uz, 20.0)

    assert collision(ScenarioSpec(obstacles=(tall,)), swing()) == COLLISION_BOOM


def test_carga_que_passa_baixa_ao_lado_de_obstaculo_e_recusada() -> None:
    # A carga gira a 12,07 m do eixo; o muro fica a 0,8 m da borda do círculo dela, abaixo do topo.
    radius = GEOMETRY.boom_pivot_offset_m + 18.0 * math.cos(math.radians(50.0))
    wall = ObstacleSpec("MURO", "Muro", ObstacleKind.BOX, 0.0, radius + 0.8, 4.0, 0.2, 5.0, 0.0)

    assert collision(ScenarioSpec(obstacles=(wall,)), swing(cable=12.0)) == COLLISION_LOAD


def test_cabo_que_desce_por_dentro_de_obstaculo_na_entrega_e_recusado() -> None:
    radius = GEOMETRY.boom_pivot_offset_m + 18.0 * math.cos(math.radians(50.0))
    ux, uz = direction(90.0)
    roof = box("TELHADO", radius * ux, radius * uz, 2.0, 2.0, 4.0)
    path = swing(cable=6.0)

    # No giro, o gancho fica a 3 + 18·sen 50° − 6 = 10,8 m: acima do telhado de 4 m. Na entrega, o
    # cabo desce até a carga no chão, por dentro dele.
    assert collision(ScenarioSpec(obstacles=(roof,)), path, delivery_cable=12.0) == COLLISION_CABLE


def test_pose_de_partida_e_aproximacao_sao_conferidas() -> None:
    # A pose de partida (lança recolhida a 75°) e a descida até a pose de coleta passam pelo prédio.
    building = box("PREDIO", 0.0, -5.0, 3.0, 3.0, 30.0)
    start = state(75.0, 180.0, 1.0, length=12.0)
    pick = state(30.0, 180.0, 10.0)
    arc = swing_arc(
        center_x=0.0,
        center_z=0.0,
        start_azimuth_deg=180.0,
        sign=1,
        arc_deg=0.0,
        start_radius_m=16.0,
        end_radius_m=16.0,
        path_segments=1,
    )

    hit = first_path_collision(
        rig(),
        solids_of(ScenarioSpec(obstacles=(building,))),
        arc=arc,
        path=[pick, pick],
        approach=(start, pick),
        pick_state=pick,
        pick_load_top_y=1.0,
        delivery_state=pick,
        delivery_load_top_y=1.0,
    )

    assert hit in (COLLISION_BOOM, COLLISION_CABLE)


def test_sem_obstaculo_nao_ha_colisao() -> None:
    assert collision(ScenarioSpec(), swing()) is None
