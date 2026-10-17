"""Estabilidade do guindaste por estática do polígono de apoio (TASK-106; ADR-050; RN-017).

Substitui a regra fixa do RN-013 e o 0,5 do peso do RN-015 por física. Serviço puro, sem E/S.
Valores numéricos FICTÍCIOS (ADR-012; `StabilityParams`).

**Modelo.** Referencial do ADR-013 C-1: `x` à esquerda, `z` à frente, `y` para cima; a estática
usa o plano `(x, z)` e as alturas `y`. O polígono de apoio é o retângulo das quatro sapatas (a
largura depende da extensão das vigas; as sapatas são fl, fr, rl, rr, como em `soil_kinds`).
Pesos:

- chassi + patolas (fixo, CG sobre o eixo), torre + contrapeso (gira com ψ, CG atrás do eixo,
  oposto à lança) e lança (CG no meio entre o pino e a ponta, tirado da geometria do ADR-013);
- carga comparada (carga + gancho + acessórios, RN-014), no gancho, deslocada para fora pela
  flecha da lança, `Δ = k · Q[t] · L³`.

**Tombamento (momento estabilizante × momento de tombamento).** Para cada lado `e` do polígono
(a linha de tombamento), `S_e` é o momento dos pesos do guindaste em relação a ele (positivo para
dentro) e `O_e` o momento que tomba: a carga FATORADA `Q / r` (`r` = `tipping_load_limit_ratio`,
0,85: carga comparada ≤ 85 % da carga de tombamento sobre patolas), mais o vento e a inclinação
residual, que na falta de direção entram no PIOR sentido para todo lado:

- vento: `F = ½ ρ_ar v² · A` (rajada de 3 s no ponto mais alto, EN 13000) vezes a altura de
  aplicação, para a carga (`A_W` informada) e para a lança (área por metro × L);
- inclinação residual α: cada peso `W_i` na altura `h_i` desloca-se `h_i · sen α` para fora da
  linha, o que soma `sen α · (Σ W_i h_i + Q/r · h_carga)` ao momento de tombamento.

`ρ_e = O_e / S_e` e `ρ = max_e ρ_e`. `ρ ≥ 1` é tombamento (com a carga sem vento nem inclinação,
`ρ = 1` é exatamente `carga = 85 % da carga de tombamento`). Atenção a partir de `attention_ratio`.

**Reação nas sapatas (estática do polígono).** Só com os pesos verticais (vento e inclinação
entram no tombamento, não aqui): plataforma rígida de quatro apoios,
`R_i = N/4 + N·e_z·(z_i − z̄)/(4·l_z²) + N·e_x·x_i/(4·l_x²)` com `N` o peso total, `(e_x, e_z)` a
posição da resultante e `l_x`, `l_z` as meias dimensões do retângulo. Se uma sapata descarrega
(`R < 0`), ela sai e as três restantes são resolvidas por equilíbrio (`ΣR = N`,
`ΣR·x = N·e_x`, `ΣR·z = N·e_z`). Se outra também descarregaria, as sapatas perderam o apoio
(`tipped`).

Referências (ADR-050): ISO 4305 (determinação da estabilidade de guindastes móveis) e EN 13000
(guindastes móveis: estabilidade, carga de teste e vento). A numeração brasileira equivalente da
ISO 4305 e os fatores exatos de cada norma NÃO foram verificados aqui: os fatores seguem FICTÍCIOS.
"""

import math
from dataclasses import dataclass

from app.domain.value_objects.operational_geometry import OperationalGeometry
from app.domain.value_objects.stability_params import (
    AIR_DENSITY_KG_M3,
    WIND_REFERENCE_AREA_PER_TONNE_M2,
    StabilityParams,
)

GRAVITY_MS2 = 9.80665
MAX_RATIO = 999.0
"""Teto de `ρ` quando o guindaste sozinho já fica fora da linha de tombamento (nunca infinito: o
número vai para o JSON)."""
_EPS = 1e-9

PAD_ORDER = ("fl", "fr", "rl", "rr")
"""Sapatas em `reactions_kg`, as mesmas de `PAD_LABELS` e de `soil_kinds`."""
_EDGE_NAMES = ("dianteira", "lado direito", "traseira", "lado esquerdo")


@dataclass(frozen=True)
class StabilityResult:
    """Resultado da estática de estabilidade.

    - `tipping_ratio`: `ρ = O / S` do lado mais crítico (0 = sem tendência de tombar; ≥ 1 = tomba
      com a margem da norma). Com `r` = 0,85, `ρ` é também a carga comparada ÷ (85 % da carga de
      tombamento daquele lado) quando não há vento nem inclinação;
    - `critical_edge`: o lado do polígono onde `ρ` é máximo (`dianteira`, `lado direito`,
      `traseira`, `lado esquerdo`);
    - `reactions_kg`: força vertical em cada sapata (fl, fr, rl, rr), em kgf;
    - `tipped`: as sapatas perderam o apoio (reação negativa em duas); as reações ficam em 0;
    - `total_weight_kg`: peso total apoiado nas sapatas (guindaste + carga comparada);
    - `deflection_m`: flecha somada ao raio da carga; `pad_half_span_m`: meia largura usada;
    - `wind_force_n`: força de vento total (carga + lança) usada no momento (0 sem vento);
    - `wind_limit_ms`: velocidade máxima de rajada para esta carga (EN 13000).
    """

    tipping_ratio: float
    critical_edge: str
    reactions_kg: tuple[float, float, float, float]
    tipped: bool
    total_weight_kg: float
    deflection_m: float
    pad_half_span_m: float
    wind_force_n: float
    wind_limit_ms: float

    @property
    def worst_pad_reaction_kg(self) -> float:
        return max(self.reactions_kg)

    @property
    def worst_pad_share(self) -> float:
        """A fração do peso total que a sapata mais carregada recebe (0,25 com peso no centro)."""
        return (
            self.worst_pad_reaction_kg / self.total_weight_kg if self.total_weight_kg > 0 else 0.0
        )


def pad_half_span_m(extension_percent: float | None, params: StabilityParams) -> float:
    """Meia largura entre as sapatas: interpola entre a recolhida e a estendida pela extensão das
    vigas (`None` = não informada: 100 %)."""
    fraction = 1.0 if extension_percent is None else min(1.0, max(0.0, extension_percent / 100.0))
    return params.pad_half_span_retracted_m + fraction * (
        params.pad_half_span_full_m - params.pad_half_span_retracted_m
    )


def wind_limit_ms(
    compared_weight_kg: float, wind_area_m2: float | None, params: StabilityParams
) -> float:
    """Velocidade máxima de rajada (EN 13000): a da tabela, até `A_W / m_H ≤ 1,2 m²/t`; acima disso
    `v_max = v_tab · √(1,2 / (A_W / m_H))`, com `A_W` a área de vento da carga e `m_H` a massa içada
    (carga + gancho + acessórios), em toneladas. Sem área informada, vale a da tabela."""
    v_tab = params.wind_table_speed_ms
    if wind_area_m2 is None or wind_area_m2 <= 0 or compared_weight_kg <= 0:
        return v_tab
    ratio = wind_area_m2 / (compared_weight_kg / 1000.0)
    if ratio <= WIND_REFERENCE_AREA_PER_TONNE_M2:
        return v_tab
    return v_tab * math.sqrt(WIND_REFERENCE_AREA_PER_TONNE_M2 / ratio)


def boom_deflection_m(
    compared_weight_kg: float, boom_length_m: float, params: StabilityParams
) -> float:
    """Flecha da lança sob a carga: `Δ = k · Q[t] · L³` (FICTÍCIA)."""
    return params.deflection_m_per_t_m3 * (compared_weight_kg / 1000.0) * boom_length_m**3


def assess_stability(
    *,
    params: StabilityParams,
    crane_mass_kg: float,
    geometry: OperationalGeometry,
    turret_rotation_deg: float,
    boom_length_m: float,
    compared_weight_kg: float,
    outrigger_extension_percent: float | None = None,
    ground_slope_deg: float | None = None,
    wind_speed_ms: float | None = None,
    load_wind_area_m2: float | None = None,
) -> StabilityResult:
    """Tombamento (`ρ`) e reação nas sapatas de uma operação (ver o docstring do módulo)."""
    half_span = pad_half_span_m(outrigger_extension_percent, params)
    zf, zr = params.pad_front_z_m, params.pad_rear_z_m
    pads = {
        "fl": (half_span, zf),
        "fr": (-half_span, zf),
        "rl": (half_span, zr),
        "rr": (-half_span, zr),
    }

    psi = math.radians(turret_rotation_deg)
    direction = (math.sin(psi), math.cos(psi))  # u(ψ) no plano (x, z), ADR-013 C-2
    deflection = boom_deflection_m(compared_weight_kg, boom_length_m, params)

    carrier = (
        crane_mass_kg * params.carrier_mass_fraction,
        0.0,
        params.carrier_cg_z_m,
        params.carrier_cg_height_m,
    )
    upper = (
        crane_mass_kg * params.upper_mass_fraction,
        -params.upper_cg_behind_m * direction[0],
        -params.upper_cg_behind_m * direction[1],
        params.upper_cg_height_m,
    )
    pivot, tip = geometry.boom_pivot, geometry.boom_tip
    boom = (
        crane_mass_kg * params.boom_mass_fraction,
        (pivot.x_m + tip.x_m) / 2,
        (pivot.z_m + tip.z_m) / 2,
        (pivot.y_m + tip.y_m) / 2,
    )
    hook = geometry.hook
    load = (
        compared_weight_kg,
        hook.x_m + deflection * direction[0],
        hook.z_m + deflection * direction[1],
        hook.y_m,
    )
    crane_parts = (carrier, upper, boom)

    wind_load_n = 0.0
    wind_boom_n = 0.0
    if wind_speed_ms is not None and wind_speed_ms > 0:
        dynamic_pressure = 0.5 * AIR_DENSITY_KG_M3 * wind_speed_ms**2
        wind_load_n = dynamic_pressure * (load_wind_area_m2 or 0.0)
        wind_boom_n = dynamic_pressure * params.boom_wind_area_per_m_m2 * boom_length_m
    wind_moment_kgf_m = (
        wind_load_n * max(load[3], 0.0) + wind_boom_n * max(boom[3], 0.0)
    ) / GRAVITY_MS2

    factored_load = compared_weight_kg / params.tipping_load_limit_ratio
    sin_slope = math.sin(math.radians(ground_slope_deg)) if ground_slope_deg else 0.0
    slope_moment = sin_slope * (
        sum(w * max(h, 0.0) for w, _x, _z, h in crane_parts) + factored_load * max(load[3], 0.0)
    )

    ratio, edge = _tipping_ratio(
        pads=pads,
        crane_parts=crane_parts,
        load=load,
        factored_load=factored_load,
        extra_overturning=wind_moment_kgf_m + slope_moment,
    )

    total = sum(w for w, *_ in crane_parts) + load[0]
    cx = (sum(w * x for w, x, _z, _h in crane_parts) + load[0] * load[1]) / total if total else 0.0
    cz = (sum(w * z for w, _x, z, _h in crane_parts) + load[0] * load[2]) / total if total else 0.0
    reactions, tipped = pad_reactions(pads, total, cx, cz)
    return StabilityResult(
        tipping_ratio=min(ratio, MAX_RATIO),
        critical_edge=edge,
        reactions_kg=reactions,
        tipped=tipped,
        total_weight_kg=total,
        deflection_m=deflection,
        pad_half_span_m=half_span,
        wind_force_n=wind_load_n + wind_boom_n,
        wind_limit_ms=wind_limit_ms(compared_weight_kg, load_wind_area_m2, params),
    )


def _inward(origin: tuple[float, float], outward: tuple[float, float], x: float, z: float) -> float:
    """Distância do ponto `(x, z)` à linha de tombamento, positiva para dentro do polígono."""
    return -((x - origin[0]) * outward[0] + (z - origin[1]) * outward[1])


def _tipping_ratio(
    *,
    pads: dict[str, tuple[float, float]],
    crane_parts: tuple[tuple[float, float, float, float], ...],
    load: tuple[float, float, float, float],
    factored_load: float,
    extra_overturning: float,
) -> tuple[float, str]:
    """`ρ = O / S` máximo entre os quatro lados do retângulo de apoio, e o nome do lado."""
    vertices = [pads["fl"], pads["fr"], pads["rr"], pads["rl"]]
    centroid = (sum(p[0] for p in vertices) / 4, sum(p[1] for p in vertices) / 4)
    worst_ratio, worst_edge = 0.0, _EDGE_NAMES[0]
    for index, name in enumerate(_EDGE_NAMES):
        a, b = vertices[index], vertices[(index + 1) % 4]
        edge_x, edge_z = b[0] - a[0], b[1] - a[1]
        length = math.hypot(edge_x, edge_z)
        normal = (edge_z / length, -edge_x / length)
        if (centroid[0] - a[0]) * normal[0] + (centroid[1] - a[1]) * normal[1] > 0:
            normal = (-normal[0], -normal[1])  # para fora do polígono

        stabilizing = sum(w * _inward(a, normal, x, z) for w, x, z, _h in crane_parts)
        load_distance = _inward(a, normal, load[1], load[2])
        # O fator da carga só vale para o lado que tomba: do lado de dentro da linha a carga
        # estabiliza, e fatorá-la para cima contaria estabilidade a mais.
        load_weight = factored_load if load_distance < 0 else load[0]
        net = stabilizing + load_weight * load_distance - extra_overturning
        if stabilizing > _EPS:
            ratio = max(0.0, (stabilizing - net) / stabilizing)
        else:
            ratio = MAX_RATIO if net <= 0 else 0.0
        if ratio > worst_ratio:
            worst_ratio, worst_edge = ratio, name
    return worst_ratio, worst_edge


def pad_reactions(
    pads: dict[str, tuple[float, float]], total_kg: float, cx: float, cz: float
) -> tuple[tuple[float, float, float, float], bool]:
    """Reação vertical em cada sapata (fl, fr, rl, rr), em kgf, para o peso `total_kg` com a
    resultante em `(cx, cz)`. Devolve `(reações, tipped)`; ver o docstring do módulo."""
    positions = [pads[name] for name in PAD_ORDER]
    half_x = abs(pads["fl"][0])
    mean_z = (pads["fl"][1] + pads["rl"][1]) / 2
    half_z = (pads["fl"][1] - pads["rl"][1]) / 2
    rigid = [
        total_kg / 4
        + total_kg * (cz - mean_z) * (z - mean_z) / (4 * half_z**2)
        + total_kg * cx * x / (4 * half_x**2)
        for x, z in positions
    ]
    if min(rigid) >= -_EPS:
        return _clean(rigid), False
    dropped = rigid.index(min(rigid))
    keep = [i for i in range(4) if i != dropped]
    solved = _three_pad_reactions([positions[i] for i in keep], total_kg, cx, cz)
    if solved is None or min(solved) < -1e-6 * max(total_kg, 1.0):
        return (0.0, 0.0, 0.0, 0.0), True
    reactions = [0.0] * 4
    for slot, value in zip(keep, solved, strict=True):
        reactions[slot] = max(0.0, value)
    return _clean(reactions), False


def _clean(values: list[float]) -> tuple[float, float, float, float]:
    cleaned = [0.0 if abs(v) < _EPS else v for v in values]
    return cleaned[0], cleaned[1], cleaned[2], cleaned[3]


def _three_pad_reactions(
    positions: list[tuple[float, float]], total: float, cx: float, cz: float
) -> list[float] | None:
    """Equilíbrio de três apoios: `ΣR = N`, `ΣR·x = N·cx`, `ΣR·z = N·cz` (regra de Cramer)."""
    (x1, z1), (x2, z2), (x3, z3) = positions
    determinant = _det3([[1, 1, 1], [x1, x2, x3], [z1, z2, z3]])
    if abs(determinant) < _EPS:
        return None
    rhs = (total, total * cx, total * cz)
    columns = ([1, x1, z1], [1, x2, z2], [1, x3, z3])
    results = []
    for k in range(3):
        matrix = [list(col) for col in columns]
        matrix[k] = list(rhs)
        # as colunas de `matrix` são as incógnitas; monta por linhas para o determinante
        rows = [[matrix[c][r] for c in range(3)] for r in range(3)]
        results.append(_det3(rows) / determinant)
    return results


def _det3(m: list[list[float]]) -> float:
    return (
        m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1])
        - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0])
        + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
    )
