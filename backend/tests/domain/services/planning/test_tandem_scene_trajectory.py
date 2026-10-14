"""Tandem, geometria da cena e trajetória do planejamento (TASK-075). Dados FICTÍCIOS (ADR-012)."""

import pytest

from app.domain.entities.scenario import ObstacleKind, ObstacleSpec
from app.domain.services.planning.models import CraneStateValues, PlanPhase
from app.domain.services.planning.scene import (
    azimuth_deg,
    direction,
    distance_to_obstacle_m,
    wrap_180,
)
from app.domain.services.planning.tandem import (
    InvalidTandemGeometryError,
    split_load_by_cg,
)
from app.domain.services.planning.trajectory import (
    Segment,
    common_schedule,
    phase_durations,
    to_keyframes,
)


def test_cg_no_meio_divide_a_carga_igualmente() -> None:
    shares = split_load_by_cg(6000.0, 0.0, -1.2, 1.2)

    assert shares.share_a_kg == pytest.approx(3000.0)
    assert shares.share_b_kg == pytest.approx(3000.0)


def test_cg_deslocado_da_mais_carga_ao_guindaste_mais_perto() -> None:
    shares = split_load_by_cg(6000.0, 0.6, -1.2, 1.2)

    # O ponto B está a 0,6 m do CG; o A, a 1,8 m: B leva o triplo.
    assert shares.share_a_kg == pytest.approx(1500.0)
    assert shares.share_b_kg == pytest.approx(4500.0)
    assert shares.share_a_kg + shares.share_b_kg == pytest.approx(6000.0)


def test_cg_fora_do_segmento_e_rejeitado() -> None:
    with pytest.raises(InvalidTandemGeometryError):
        split_load_by_cg(1000.0, 2.0, -1.0, 1.0)


def test_pontos_de_icamento_coincidentes_sao_rejeitados() -> None:
    with pytest.raises(InvalidTandemGeometryError):
        split_load_by_cg(1000.0, 0.0, 1.0, 1.0)


def test_angulos_e_direcoes() -> None:
    assert wrap_180(190.0) == pytest.approx(-170.0)
    assert wrap_180(-180.0) == 180.0
    assert azimuth_deg(1.0, 0.0) == pytest.approx(90.0)
    assert azimuth_deg(0.0, 1.0) == pytest.approx(0.0)
    dx, dz = direction(90.0)
    assert (dx, dz) == (pytest.approx(1.0), pytest.approx(0.0, abs=1e-12))


def test_distancia_ao_obstaculo_caixa_girada_e_cilindro() -> None:
    box = ObstacleSpec("B", "caixa", ObstacleKind.BOX, 0, 0, 4.0, 2.0, 3.0, 0.0)
    rotated = ObstacleSpec("R", "caixa girada", ObstacleKind.BOX, 0, 0, 4.0, 2.0, 3.0, 90.0)
    cylinder = ObstacleSpec("C", "cilindro", ObstacleKind.CYLINDER, 0, 0, 4.0, 4.0, 3.0, 0.0)

    assert distance_to_obstacle_m(box, 0.5, 0.5) == 0.0  # dentro
    assert distance_to_obstacle_m(box, 5.0, 0.0) == pytest.approx(3.0)  # meia largura 2
    assert distance_to_obstacle_m(box, 0.0, 4.0) == pytest.approx(3.0)  # meia profundidade 1
    # Girada em 90°, a largura passa para o eixo Z.
    assert distance_to_obstacle_m(rotated, 0.0, 5.0) == pytest.approx(3.0)
    assert distance_to_obstacle_m(cylinder, 5.0, 0.0) == pytest.approx(3.0)
    assert distance_to_obstacle_m(cylinder, 1.0, 1.0) == 0.0


def _segments(approach_s: float, swing_s: float) -> list[Segment]:
    state = CraneStateValues(12.0, 40.0, 0.0, 5.0)
    return [
        Segment(PlanPhase.APPROACH, state, approach_s),
        Segment(PlanPhase.SWING, state, swing_s / 2),
        Segment(PlanPhase.SWING, state, swing_s / 2),
    ]


def test_quadros_chave_acumulam_o_tempo_por_fase() -> None:
    start = CraneStateValues(12.0, 75.0, 0.0, 1.0)

    keyframes = to_keyframes(_segments(10.0, 4.0), start, crane_index=0)

    assert [point.t_s for point in keyframes] == [0.0, 10.0, 12.0, 14.0]
    assert keyframes[0].state == start


def test_cronograma_comum_usa_a_maior_duracao_de_cada_fase() -> None:
    first, second = _segments(10.0, 4.0), _segments(6.0, 8.0)

    schedule = common_schedule([first, second])

    assert schedule == {PlanPhase.APPROACH: 10.0, PlanPhase.SWING: 8.0}
    start = CraneStateValues(12.0, 75.0, 0.0, 1.0)
    slow = to_keyframes(first, start, 0, schedule)
    fast = to_keyframes(second, start, 1, schedule)
    assert [p.t_s for p in slow] == [p.t_s for p in fast]
    assert phase_durations(second) == {PlanPhase.APPROACH: 6.0, PlanPhase.SWING: 8.0}


def test_distancia_ao_corpo_do_guindaste_respeita_o_rumo() -> None:
    from app.domain.entities.scenario import CranePlacementSpec
    from app.domain.services.planning.crane_body import distance_to_crane_body_m

    straight = CranePlacementSpec(0.0, 0.0, 0.0)
    turned = CranePlacementSpec(0.0, 0.0, 90.0)

    # Frente do chassi (+Z): a cabine vai a 9,22 m do eixo; a traseira, a 5,13 m.
    assert distance_to_crane_body_m(straight, 0.0, 8.0) == 0.0
    assert distance_to_crane_body_m(straight, 0.0, 12.22) == pytest.approx(3.0)
    assert distance_to_crane_body_m(straight, 0.0, -8.13) == pytest.approx(3.0)
    # Girado em 90°, o comprimento do chassi passa a ficar sobre o eixo X.
    assert distance_to_crane_body_m(turned, 8.0, 0.0) == 0.0
    assert distance_to_crane_body_m(turned, 0.0, 8.0) == pytest.approx(8.0 - 3.1)
