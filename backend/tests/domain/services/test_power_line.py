"""Distância mínima de rede elétrica e içamento crítico (D4; TASK-107; ADR-051). Dados FICTÍCIOS."""

import json
import math
from pathlib import Path

import pytest

from app.domain.entities.scenario import PowerLineSpec
from app.domain.services.critical_lift import assess_critical_lift
from app.domain.services.power_line import (
    ClearanceStatus,
    CraneParts,
    InvalidVoltageError,
    line_clearance,
    power_line_zones,
    required_clearance_m,
    segment_distance_m,
)

FT = 0.3048


@pytest.mark.parametrize(
    ("kv", "feet"),
    [
        (0.38, 10.0),
        (13.8, 10.0),
        (50.0, 10.0),
        (50.1, 10.0 + 0.04 / 12),
        (100.0, 10.0 + 20 / 12),  # 10 pés + 0,4 pol × 50 kV
        (138.0, 10.0 + 35.2 / 12),
        (200.0, 15.0),  # 10 pés + 0,4 pol × 150 kV = 15 pés: a faixa emenda sem salto
        (200.1, 15.0),
        (230.0, 15.0),
        (350.0, 15.0),
        (350.1, 20.0),
        (500.0, 20.0),
        (500.1, 25.0),
        (750.0, 25.0),
        (750.1, 35.0),
        (1000.0, 35.0),
    ],
)
def test_tabela_de_distancia_minima(kv: float, feet: float) -> None:
    assert required_clearance_m(kv) == pytest.approx(feet * FT, abs=1e-6)


def test_ate_50_kv_sao_3_05_m() -> None:
    assert required_clearance_m(50.0) == pytest.approx(3.048)


@pytest.mark.parametrize("kv", [0.0, -1.0, 1000.1, float("nan"), float("inf")])
def test_tensao_fora_da_tabela_e_recusada(kv: float) -> None:
    with pytest.raises(InvalidVoltageError):
        required_clearance_m(kv)


def test_distancia_cresce_com_a_tensao() -> None:
    values = [required_clearance_m(kv) for kv in (13.8, 69, 138, 230, 345, 500, 765, 1000)]
    assert values == sorted(values)


def test_distancia_entre_segmentos() -> None:
    # Paralelos a 3 m de altura de diferença.
    assert segment_distance_m((0, 0, 0), (10, 0, 0), (0, 3, 0), (10, 3, 0)) == pytest.approx(3.0)
    # Cruzados (um sobre o outro): a distância é a vertical.
    assert segment_distance_m((0, 0, -5), (0, 0, 5), (-5, 2, 0), (5, 2, 0)) == pytest.approx(2.0)
    # Ponta contra ponta fora do trecho.
    assert segment_distance_m((0, 0, 0), (1, 0, 0), (4, 4, 0), (9, 4, 0)) == pytest.approx(5.0)
    # Degenerado (ponto).
    assert segment_distance_m((0, 0, 0), (0, 0, 0), (3, 4, 0), (3, 4, 0)) == pytest.approx(5.0)


def make_line(height_m: float = 12.0, voltage_kv: float = 13.8, z: float = 8.0) -> PowerLineSpec:
    return PowerLineSpec("R1", "Rede 13,8 kV", -20.0, z, 20.0, z, height_m, voltage_kv)


def make_parts(**overrides: object) -> CraneParts:
    base: dict[str, object] = {
        "pivot": (0.0, 3.0, 0.0),
        "tip": (0.0, 11.0, 12.0),  # lança em +Z
        "hook": (0.0, 3.0, 12.0),
    }
    base.update(overrides)
    return CraneParts(**base)  # type: ignore[arg-type]


def test_lanca_longe_da_rede_fica_ok() -> None:
    result = line_clearance(make_line(height_m=40.0), make_parts(), (0.0, 0.0))

    assert result.required_m == pytest.approx(3.048)
    assert result.status is ClearanceStatus.OK
    assert result.nearest_part in {"boom", "cable"}


def test_a_lanca_que_cruza_a_rede_por_baixo_viola() -> None:
    # A rede a z = 8, 12 m de altura; a lança passa por z = 8 a y = 3 + 8·(8/12) ≈ 8,33 m.
    result = line_clearance(make_line(height_m=10.0), make_parts(), (0.0, 0.0))

    assert result.distance_m < result.required_m
    assert result.status is ClearanceStatus.VIOLATION
    assert result.nearest_part == "boom"


def test_entre_a_minima_e_1_5x_e_atencao() -> None:
    # A lança sobe 8 m a cada 12 m: a distância perpendicular é a vertical × cos(33,7°). Para ficar
    # a 3,048 × 1,2 = 3,66 m perpendicular, a rede fica 3,66 / 0,832 = 4,4 m acima do ponto de
    # passagem da lança (y ≈ 8,33 em z = 8).
    height = 3.0 + 8 * (8 / 12) + 3.66 / math.cos(math.atan(8 / 12))
    result = line_clearance(make_line(height_m=height), make_parts(), (0.0, 0.0))

    assert result.status is ClearanceStatus.ATTENTION


def test_a_carga_pendurada_entra_na_distancia() -> None:
    # Carga de 4 × 2 m com o topo a 1,5 m do gancho e 2 m de altura (base a y = 16,5); a rede
    # passa a y = 15, sob a carga, longe do cabo e da lança.
    parts = make_parts(
        tip=(0.0, 30.0, 12.0),
        hook=(0.0, 20.0, 12.0),
        load_radius_m=math.hypot(4, 2) / 2,
        load_drop_m=1.5,
        load_height_m=2.0,
    )
    line = PowerLineSpec("R1", "Rede", -20.0, 12.0, 20.0, 12.0, 15.0, 13.8)
    result = line_clearance(line, parts, (0.0, 0.0))

    assert result.nearest_part == "load"
    assert result.status is ClearanceStatus.VIOLATION


def test_o_giro_varrido_acha_a_posicao_pior_que_a_atual() -> None:
    """Hoje a lança aponta para longe da rede (-Z); girando ela passa debaixo da rede (+Z)."""
    parts = make_parts(tip=(0.0, 11.0, -12.0), hook=(0.0, 3.0, -12.0))
    result = line_clearance(make_line(height_m=10.0), parts, (0.0, 0.0))

    assert result.status is ClearanceStatus.OK
    assert result.swept_distance_m < result.distance_m
    assert result.swept_status is ClearanceStatus.VIOLATION


def test_o_giro_nao_usa_posicao_que_o_guindaste_nao_alcanca_alem_do_raio() -> None:
    """Rede mais longe que o alcance da lança em qualquer giro: a varredura não inventa risco."""
    result = line_clearance(make_line(height_m=10.0, z=60.0), make_parts(), (0.0, 0.0))

    assert result.swept_status is ClearanceStatus.OK


def test_zona_do_planejador_cobre_a_distancia_minima_em_volta_do_trecho() -> None:
    (zone,) = power_line_zones([make_line(height_m=12.0, voltage_kv=13.8)])
    d = required_clearance_m(13.8)

    assert zone.width_m == pytest.approx(40.0 + 2 * d)
    assert zone.depth_m == pytest.approx(2 * d)
    assert zone.elevation_m == pytest.approx(12.0 - d)
    assert zone.elevation_m + zone.height_m == pytest.approx(12.0 + d)
    assert (zone.center_x, zone.center_z) == pytest.approx((0.0, 8.0))
    assert zone.rotation_y_deg == pytest.approx(0.0)


def test_zona_de_trecho_inclinado_gira_com_o_trecho() -> None:
    line = PowerLineSpec("R1", "Rede", 0.0, 0.0, 0.0, 10.0, 12.0, 69.0)
    (zone,) = power_line_zones([line])

    # O eixo X local da caixa (cos a, −sin a) deve apontar para +Z (a direção do trecho).
    angle = math.radians(zone.rotation_y_deg)
    assert (math.cos(angle), -math.sin(angle)) == pytest.approx((0.0, 1.0), abs=1e-9)


def test_zona_de_rede_baixa_nao_fica_abaixo_do_chao() -> None:
    (zone,) = power_line_zones([make_line(height_m=1.0, voltage_kv=500.0)])

    assert zone.elevation_m == 0.0
    assert zone.height_m == pytest.approx(1.0 + required_clearance_m(500.0))


# --- içamento crítico -----------------------------------------------------------------------


def critical(**overrides: object):  # type: ignore[no-untyped-def]
    args: dict[str, object] = {
        "capacity_usage_ratio": 0.5,
        "tandem": False,
        "load_over_occupied": False,
        "min_clearance_ratio": None,
        "wind_speed_ms": None,
        "ground_slope_deg": None,
        "max_ground_slope_deg": 3.0,
        "soil_attention": False,
    }
    args.update(overrides)
    return assess_critical_lift(**args)  # type: ignore[arg-type]


def test_icamento_comum_nao_e_critico() -> None:
    result = critical()

    assert not result.is_critical
    assert result.plan_items == ()


@pytest.mark.parametrize(
    ("overrides", "code"),
    [
        ({"capacity_usage_ratio": 0.75}, "CAPACITY_75"),
        ({"capacity_usage_ratio": 0.9}, "CAPACITY_75"),
        ({"tandem": True}, "TANDEM"),
        ({"load_over_occupied": True}, "LOAD_OVER_OCCUPIED"),
        ({"min_clearance_ratio": 1.49}, "POWER_LINE_CLOSE"),
        ({"min_clearance_ratio": 0.5}, "POWER_LINE_CLOSE"),
        ({"wind_speed_ms": 9.7}, "WIND_NEAR_LIMIT"),
        ({"soil_attention": True}, "GROUND_CONDITIONS"),
        ({"ground_slope_deg": 2.1}, "GROUND_CONDITIONS"),
    ],
)
def test_cada_gatilho_torna_o_icamento_critico(overrides: dict[str, object], code: str) -> None:
    result = critical(**overrides)

    assert result.is_critical
    assert [t.code for t in result.triggers] == [code]
    assert result.plan_items  # o plano exigido vem junto


@pytest.mark.parametrize(
    "overrides",
    [
        {"capacity_usage_ratio": 0.7499},
        {"min_clearance_ratio": 1.5},
        {"min_clearance_ratio": 3.0},
        {"wind_speed_ms": 9.66},  # 70 % de 13,8 m/s: o limite não entra, "acima de" entra
        {"ground_slope_deg": 2.0},  # 70 % de 3° = 2,1°
        {"capacity_usage_ratio": None},
    ],
)
def test_limiares_exatos_nao_disparam(overrides: dict[str, object]) -> None:
    assert not critical(**overrides).is_critical


def test_varios_gatilhos_somam_os_motivos_e_o_plano_sem_repetir() -> None:
    result = critical(tandem=True, min_clearance_ratio=1.0, load_over_occupied=True)

    assert [t.code for t in result.triggers] == ["TANDEM", "LOAD_OVER_OCCUPIED", "POWER_LINE_CLOSE"]
    assert len(set(result.plan_items)) == len(result.plan_items)
    assert any("NR-10" in item for item in result.plan_items)


# --- paridade com o frontend (tabela única de casos) ---------------------------------------


_CASOS = json.loads(
    (
        Path(__file__).resolve().parents[2] / "fixtures" / "power_line_clearance_cases.json"
    ).read_text(encoding="utf-8")
)


@pytest.mark.parametrize("caso", _CASOS["casos"], ids=lambda c: f"{c['tensao_kv']} kV")
def test_tabela_unica_de_distancia_minima(caso: dict[str, float]) -> None:
    assert required_clearance_m(caso["tensao_kv"]) == pytest.approx(
        caso["minima_m"], abs=_CASOS["tolerancia"]
    )


@pytest.mark.parametrize("kv", _CASOS["fora_da_tabela_kv"])
def test_tabela_unica_recusa_a_tensao_fora_da_tabela(kv: float) -> None:
    with pytest.raises(InvalidVoltageError):
        required_clearance_m(kv)
