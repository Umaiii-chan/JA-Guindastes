"""Estabilidade por estática do polígono de apoio (RN-017; TASK-106; ADR-050). Valores FICTÍCIOS.

Os números esperados saem de contas feitas à mão (escritas por extenso nos testes), com os
parâmetros padrão de `StabilityParams`: guindaste de 36 000 kg (chassi 55 % sobre o eixo a 1,2 m;
torre 30 % a 2 m atrás do eixo, a 2 m de altura; lança 15 % no meio entre o pino e a ponta),
sapatas em `z = ±3 m` e `x = ±3,8 m` (vigas 100 %), carga com fator 0,85 e flecha
`Δ = 8e-7 · Q[t] · L³`.
"""

import math

import pytest

from app.domain.services.stability import (
    GRAVITY_MS2,
    _tipping_ratio,
    assess_stability,
    boom_deflection_m,
    pad_half_span_m,
    wind_limit_ms,
)
from app.domain.value_objects.length import Length
from app.domain.value_objects.operational_geometry import OperationalGeometry, Point3D
from app.domain.value_objects.stability_params import StabilityParams

PARAMS = StabilityParams()
CRANE_KG = 36_000.0
LENGTH_M = 20.0
CARRIER_KG, UPPER_KG, BOOM_KG = 19_800.0, 10_800.0, 5_400.0  # 55 %, 30 %, 15 % de 36 000
HOOK_Y, TIP_Y, PIVOT_Y = 15.0, 19.0, 2.0
BOOM_CG_Y = (PIVOT_Y + TIP_Y) / 2  # 10,5 m


def geometry(psi_deg: float, radius_m: float = 11.0, pivot_m: float = 1.0) -> OperationalGeometry:
    """Lança no azimute ψ: pino a 1 m do eixo e ponta/gancho a 11 m (u = (sen ψ, cos ψ))."""
    ux, uz = math.sin(math.radians(psi_deg)), math.cos(math.radians(psi_deg))
    return OperationalGeometry(
        working_radius=Length(radius_m),
        boom_pivot=Point3D(pivot_m * ux, PIVOT_Y, pivot_m * uz),
        boom_tip=Point3D(radius_m * ux, TIP_Y, radius_m * uz),
        hook=Point3D(radius_m * ux, HOOK_Y, radius_m * uz),
    )


def assess(psi_deg: float = 0.0, load_kg: float = 4_000.0, **kwargs: object):  # type: ignore[no-untyped-def]
    return assess_stability(
        params=PARAMS,
        crane_mass_kg=CRANE_KG,
        geometry=geometry(psi_deg),
        turret_rotation_deg=psi_deg,
        boom_length_m=LENGTH_M,
        compared_weight_kg=load_kg,
        **kwargs,  # type: ignore[arg-type]
    )


def test_deflection_is_k_times_load_in_tonnes_times_length_cubed() -> None:
    # 8e-7 × 4 t × 20³ = 8e-7 × 4 × 8000 = 0,0256 m
    assert boom_deflection_m(4_000.0, 20.0, PARAMS) == pytest.approx(0.0256)


@pytest.mark.parametrize(
    ("extension", "half_span"), [(None, 3.8), (100.0, 3.8), (0.0, 1.2), (50.0, 2.5), (150.0, 3.8)]
)
def test_pad_half_span_interpolates_between_retracted_and_full(
    extension: float | None, half_span: float
) -> None:
    # 1,2 + f × (3,8 − 1,2): f = 0,5 → 2,5 m
    assert pad_half_span_m(extension, PARAMS) == pytest.approx(half_span)


def test_front_edge_ratio_is_the_overturning_over_the_stabilizing_moment() -> None:
    # Eixo da lança à frente (ψ = 0): a linha de tombamento é a dianteira, z = 3 m.
    # S = 19 800·(3 − 0) + 10 800·(3 + 2) + 5 400·(3 − 6) = 59 400 + 54 000 − 16 200 = 97 200 kgf·m
    stabilizing = 19_800 * 3 + 10_800 * 5 + 5_400 * (3 - 6)
    assert stabilizing == 97_200
    # O = (4 000 / 0,85) · (11 + 0,0256 − 3) = 4 705,88 · 8,0256 = 37 767,1 kgf·m
    overturning = (4_000 / 0.85) * (11 + 0.0256 - 3)

    result = assess()

    assert result.critical_edge == "dianteira"
    assert result.tipping_ratio == pytest.approx(overturning / stabilizing)
    assert result.tipping_ratio == pytest.approx(0.38855, abs=1e-5)
    assert result.deflection_m == pytest.approx(0.0256)


def test_load_at_the_factored_limit_gives_exactly_ratio_one() -> None:
    # Sem vento, inclinação nem flecha, ρ = 1 quando 4 000/0,85 · (11 − 3) = S: Q = 0,85 · S/8.
    params = StabilityParams(deflection_m_per_t_m3=0.0)
    limit_kg = 0.85 * 97_200 / (11 - 3)  # 10 327,5 kg: a carga que tomba, com o fator 0,85
    result = assess_stability(
        params=params,
        crane_mass_kg=CRANE_KG,
        geometry=geometry(0.0),
        turret_rotation_deg=0.0,
        boom_length_m=LENGTH_M,
        compared_weight_kg=limit_kg,
    )
    assert result.tipping_ratio == pytest.approx(1.0)


def test_side_edge_ratio_with_the_boom_to_the_left() -> None:
    # ψ = 90°: lança para +x. Linha de tombamento esquerda em x = 3,8 m; torre em x = −2.
    # S = 19 800·3,8 + 10 800·(3,8 + 2) + 5 400·(3,8 − 6) = 75 240 + 62 640 − 11 880 = 126 000
    stabilizing = 19_800 * 3.8 + 10_800 * (3.8 + 2) + 5_400 * (3.8 - 6)
    assert stabilizing == pytest.approx(126_000)
    overturning = (4_000 / 0.85) * (11 + 0.0256 - 3.8)

    result = assess(psi_deg=90.0)

    assert result.critical_edge == "lado esquerdo"
    assert result.tipping_ratio == pytest.approx(overturning / stabilizing)


def test_retracted_outriggers_shrink_the_polygon_and_raise_the_ratio() -> None:
    full = assess(psi_deg=90.0)
    retracted = assess(psi_deg=90.0, outrigger_extension_percent=0.0)

    # Meia largura 1,2 m: S = 19 800·1,2 + 10 800·3,2 + 5 400·(1,2 − 6) = 23 760 + 34 560 − 25 920
    stabilizing = 19_800 * 1.2 + 10_800 * 3.2 + 5_400 * (1.2 - 6)
    assert stabilizing == pytest.approx(32_400)
    assert retracted.tipping_ratio == pytest.approx((4_000 / 0.85) * (11.0256 - 1.2) / 32_400)
    assert retracted.tipping_ratio > full.tipping_ratio


def test_diagonal_is_better_than_the_side_for_the_same_radius() -> None:
    # Sobre a diagonal (ψ = 45°) a linha de tombamento fica mais longe do CG que a lateral
    # estreita: com a carga de 4 000 kg o ρ cai de 0,3886 (frente) para cerca de 0,22.
    diagonal = assess(psi_deg=45.0)
    assert diagonal.tipping_ratio == pytest.approx(0.2249, abs=2e-3)
    assert diagonal.tipping_ratio < assess(psi_deg=0.0).tipping_ratio


def test_pad_reactions_by_statics_front_pads_carry_more_than_half() -> None:
    # N = 36 000 + 4 000 = 40 000 kgf; Σ W·z = 0 − 21 600 + 32 400 + 4 000·11,0256 = 54 902,4
    # e_z = 1,3726; R_frente = N/4 + N·e_z·3 / (4·3²) = 10 000 + 54 902,4 / 12 = 14 575,2 kgf
    result = assess()

    fl, fr, rl, rr = result.reactions_kg
    assert fl == pytest.approx(14_575.2)
    assert fr == pytest.approx(14_575.2)
    assert rl == pytest.approx(5_424.8)
    assert rr == pytest.approx(5_424.8)
    assert sum(result.reactions_kg) == pytest.approx(40_000.0)
    assert not result.tipped
    # O 0,5 fictício do RN-015 vale agora 2 × 14 575,2 / 40 000 = 0,729 na frente, e o pior
    # por sapata, 14 575,2 / 40 000 = 0,364 do peso total
    assert result.worst_pad_reaction_kg == pytest.approx(14_575.2)
    assert result.worst_pad_share == pytest.approx(0.364, abs=1e-3)


def test_one_pad_unloads_and_the_other_three_hold_the_weight() -> None:
    # ψ = 45° com 14 000 kg: a sapata traseira direita (rr) descarrega; as outras três resolvem
    # ΣR = N, ΣR·x = N·e_x e ΣR·z = N·e_z.
    psi = 45.0
    result = assess(psi_deg=psi, load_kg=14_000.0)

    ux, uz = math.sin(math.radians(psi)), math.cos(math.radians(psi))
    deflection = 8e-7 * 14 * LENGTH_M**3
    parts = [
        (CARRIER_KG, 0.0, 0.0),
        (UPPER_KG, -2.0 * ux, -2.0 * uz),
        (BOOM_KG, 6.0 * ux, 6.0 * uz),
        (14_000.0, (11.0 + deflection) * ux, (11.0 + deflection) * uz),
    ]
    total = sum(w for w, _x, _z in parts)
    assert total == pytest.approx(50_000.0)
    sum_x = sum(w * x for w, x, _z in parts)
    sum_z = sum(w * z for w, _x, z in parts)

    fl, fr, rl, rr = result.reactions_kg
    assert rr == 0.0
    assert min(fl, fr, rl) > 0
    assert fl + fr + rl == pytest.approx(total)
    # fl = (+3,8; +3), fr = (−3,8; +3), rl = (+3,8; −3)
    assert 3.8 * fl - 3.8 * fr + 3.8 * rl == pytest.approx(sum_x)
    assert 3.0 * fl + 3.0 * fr - 3.0 * rl == pytest.approx(sum_z)
    assert not result.tipped


def test_two_pads_unloading_means_the_crane_tipped() -> None:
    result = assess(psi_deg=0.0, load_kg=40_000.0)

    assert result.tipped
    assert result.reactions_kg == (0.0, 0.0, 0.0, 0.0)
    assert result.tipping_ratio >= 1.0


def test_wind_adds_to_the_overturning_moment_of_every_edge() -> None:
    # v = 10 m/s, A_W = 20 m²: q = ½ · 1,225 · 10² = 61,25 Pa
    # carga: 61,25 · 20 = 1 225 N a 15 m; lança: 61,25 · 1,28 · 20 = 1 568 N a 10,5 m
    q = 0.5 * 1.225 * 10.0**2
    load_n, boom_n = q * 20.0, q * 1.28 * LENGTH_M
    assert (load_n, boom_n) == pytest.approx((1_225.0, 1_568.0))
    moment_kgf_m = (load_n * HOOK_Y + boom_n * BOOM_CG_Y) / GRAVITY_MS2

    calm = assess()
    windy = assess(wind_speed_ms=10.0, load_wind_area_m2=20.0)

    assert windy.wind_force_n == pytest.approx(load_n + boom_n)
    assert windy.tipping_ratio - calm.tipping_ratio == pytest.approx(moment_kgf_m / 97_200)
    # O vento não muda o peso apoiado: as reações são as mesmas
    assert windy.reactions_kg == pytest.approx(calm.reactions_kg)


def test_residual_slope_adds_a_moment_proportional_to_the_heights() -> None:
    # α = 1°: sen α · (Σ W·h + Q/0,85 · h_carga)
    # Σ W·h = 19 800·1,2 + 10 800·2,0 + 5 400·10,5 = 23 760 + 21 600 + 56 700 = 102 060
    # Q/0,85 · 15 = 4 705,88 · 15 = 70 588,2 → soma 172 648,2 · sen 1° = 3 013,2 kgf·m
    extra = math.sin(math.radians(1.0)) * (102_060 + (4_000 / 0.85) * HOOK_Y)
    assert extra == pytest.approx(3_013.2, abs=0.2)

    flat = assess()
    sloped = assess(ground_slope_deg=1.0)

    assert sloped.tipping_ratio - flat.tipping_ratio == pytest.approx(extra / 97_200)
    assert sloped.reactions_kg == pytest.approx(flat.reactions_kg)


@pytest.mark.parametrize(
    ("load_kg", "area_m2", "table_ms", "expected_ms"),
    [
        (10_000.0, 12.0, 9.0, 9.0),  # A_W/m_H = 1,2 m²/t: ainda a velocidade da tabela
        (10_000.0, 30.0, 9.0, 5.692),  # 9 · √(1,2 / 3,0) = 9 · 0,63246
        (65_000.0, 280.0, 11.2, 5.911),  # auditoria (65 t, 280 m²): 11,2 · √(1,2 / 4,3077) = 5,91
        (10_000.0, None, 9.0, 9.0),  # sem área informada, vale a da tabela
    ],
)
def test_wind_limit_follows_en_13000(
    load_kg: float, area_m2: float | None, table_ms: float, expected_ms: float
) -> None:
    params = StabilityParams(wind_table_speed_ms=table_ms)
    assert wind_limit_ms(load_kg, area_m2, params) == pytest.approx(expected_ms, abs=1e-3)


def test_the_factored_load_only_counts_on_the_side_it_overturns() -> None:
    # Carga de 1 000 kg (fatorada: 1 000 / 0,85 = 1 176,5 kg) DENTRO do polígono, em z = 2 m, com um
    # momento de tombamento externo de 20 000 kgf·m e o guindaste de 10 000 kg sobre o eixo.
    # Aresta dianteira (z = 3): S = 10 000 · 3 = 30 000 e a carga estabiliza a 1 m dela, com o peso
    # SEM fator: ρ = (20 000 − 1 000 · 1) / 30 000 = 0,6333 (com o fator seria 0,6274: estabilidade
    # a mais). As outras arestas dão 0,4263 (lados, 3,8 m) e 0,5 (traseira, 5 m da carga).
    pads = {"fl": (3.8, 3.0), "fr": (-3.8, 3.0), "rl": (3.8, -3.0), "rr": (-3.8, -3.0)}

    ratio, edge = _tipping_ratio(
        pads=pads,
        crane_parts=((10_000.0, 0.0, 0.0, 1.0),),
        load=(1_000.0, 0.0, 2.0, 5.0),
        factored_load=1_000.0 / 0.85,
        extra_overturning=20_000.0,
    )

    assert edge == "dianteira"
    assert ratio == pytest.approx((20_000 - 1_000 * 1) / 30_000)
