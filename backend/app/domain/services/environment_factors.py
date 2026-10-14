"""Fatores do ambiente na capacidade e no risco de tombamento (RN-015; TASK-067; ADR-033).

Serviço puro, sem E/S. Todos os valores numéricos são FICTÍCIOS até haver dado oficial (ADR-012).

- inclinação: a capacidade efetiva cai `slope_derating_percent_per_deg` por grau residual;
- vento: sem efeito até 9,8 m/s; de 9,8 a 13,8 m/s a capacidade cai linearmente até 50 %; acima de
  13,8 m/s a operação é bloqueada;
- solo: pressão na pior sapata = (massa do guindaste + peso comparado) × 0,5 ÷ área da sapata.
"""

from enum import StrEnum

from app.domain.value_objects.safety_profile import SafetyProfile

GRAVITY_MS2 = 9.80665
WIND_FREE_LIMIT_MS = 9.8
WIND_BLOCK_LIMIT_MS = 13.8
WIND_MIN_FACTOR = 0.5
MIN_SLOPE_FACTOR = 0.05
"""Piso do fator de inclinação, para a capacidade efetiva nunca zerar (a utilização seguiria
indefinida)."""
WORST_PAD_DISTRIBUTION_FACTOR = 0.5
SOIL_ATTENTION_RATIO = 0.8


class SoilKind(StrEnum):
    ROCK = "rock"
    COMPACTED = "compacted"
    CLAY = "clay"
    LOOSE_FILL = "loose_fill"


SOIL_BEARING_CAPACITY_KPA: dict[SoilKind, float] = {
    SoilKind.ROCK: 1000.0,
    SoilKind.COMPACTED: 300.0,
    SoilKind.CLAY: 150.0,
    SoilKind.LOOSE_FILL: 75.0,
}

PAD_LABELS = ("dianteira esquerda", "dianteira direita", "traseira esquerda", "traseira direita")
"""Ordem das sapatas em `soil_kinds`: fl, fr, rl, rr (contrato da leva E)."""


def slope_factor(ground_slope_deg: float | None, profile: SafetyProfile) -> float:
    """Fator de inclinação da capacidade efetiva (1 sem inclinação informada)."""
    if ground_slope_deg is None:
        return 1.0
    factor = 1.0 - profile.slope_derating_percent_per_deg * ground_slope_deg / 100.0
    return max(MIN_SLOPE_FACTOR, factor)


def slope_blocks(ground_slope_deg: float | None, profile: SafetyProfile) -> bool:
    return ground_slope_deg is not None and ground_slope_deg > profile.max_ground_slope_deg


def wind_factor(wind_speed_ms: float | None) -> float:
    """Fator de vento da capacidade efetiva: 1 até 9,8 m/s, depois cai linearmente até 0,5."""
    if wind_speed_ms is None or wind_speed_ms <= WIND_FREE_LIMIT_MS:
        return 1.0
    if wind_speed_ms >= WIND_BLOCK_LIMIT_MS:
        return WIND_MIN_FACTOR
    span = WIND_BLOCK_LIMIT_MS - WIND_FREE_LIMIT_MS
    return 1.0 - (1.0 - WIND_MIN_FACTOR) * (wind_speed_ms - WIND_FREE_LIMIT_MS) / span


def wind_blocks(wind_speed_ms: float | None) -> bool:
    return wind_speed_ms is not None and wind_speed_ms > WIND_BLOCK_LIMIT_MS


def pad_pressure_kpa(compared_weight_kg: float, profile: SafetyProfile) -> float:
    """Pressão na pior sapata, em kPa."""
    force_n = (profile.crane_mass_kg + compared_weight_kg) * GRAVITY_MS2
    return force_n * WORST_PAD_DISTRIBUTION_FACTOR / profile.outrigger_pad_area_m2 / 1000.0
