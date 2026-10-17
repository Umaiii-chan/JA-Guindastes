"""Fatores do ambiente no risco de operação (RN-015 substituída pela RN-017; TASK-106; ADR-050).

Serviço puro, sem E/S. Valores numéricos FICTÍCIOS até haver dado oficial (ADR-012).

O que mudou em relação à TASK-067 (ADR-033), por decisão D1 do Anderson (16/10/2026):

- **Inclinação**: deixou de reduzir a capacidade em % por grau. A inclinação residual entra como
  momento de tombamento (`stability.assess_stability`); o que sobra aqui é o limite duro
  (`slope_blocks`: acima do máximo do modelo a tabela não vale, e o risco é alto).
- **Vento**: deixou de ser uma rampa 9,8 → 13,8 m/s. Vale a EN 13000: rajada de 3 s no ponto
  mais alto e `v_max = v_tab · √(1,2 / (A_W / m_H))` (`stability.wind_limit_ms`); acima de
  `v_max` a operação é bloqueada, e a partir de 90 % de `v_max` o risco é de atenção. O vento
  também soma ao momento de tombamento.
- **Solo**: a pressão de cada sapata vem da SUA reação por estática do polígono de apoio
  (`stability.pad_reactions`), e não de `(massa + peso) × 0,5 ÷ área` em todas.

`slope_factor` e `wind_factor` não existem mais: o fator da capacidade efetiva por inclinação e
vento é sempre 1 (os campos `slope_factor` e `wind_factor` do contrato continuam, valendo 1).
"""

from collections.abc import Sequence
from enum import StrEnum

from app.domain.services.stability import GRAVITY_MS2
from app.domain.value_objects.safety_profile import SafetyProfile

SOIL_ATTENTION_RATIO = 0.8
WIND_ATTENTION_RATIO = 0.9
"""A partir de 90 % da velocidade máxima de rajada (`v_max`), o risco é de atenção (FICTÍCIO)."""


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


def slope_blocks(ground_slope_deg: float | None, profile: SafetyProfile) -> bool:
    """Inclinação residual acima do máximo do modelo: a tabela não vale (limite duro, RN-013)."""
    return ground_slope_deg is not None and ground_slope_deg > profile.max_ground_slope_deg


def wind_blocks(wind_speed_ms: float | None, wind_limit_ms: float) -> bool:
    """Rajada acima da velocidade máxima (`v_max`, EN 13000): operação bloqueada."""
    return wind_speed_ms is not None and wind_speed_ms > wind_limit_ms


def wind_near_limit(wind_speed_ms: float | None, wind_limit_ms: float) -> bool:
    """Rajada de 90 % de `v_max` até `v_max`: atenção."""
    return (
        wind_speed_ms is not None
        and wind_speed_ms <= wind_limit_ms
        and wind_speed_ms > WIND_ATTENTION_RATIO * wind_limit_ms
    )


def pad_pressures_kpa(reactions_kg: Sequence[float], profile: SafetyProfile) -> tuple[float, ...]:
    """Pressão em cada sapata (fl, fr, rl, rr), em kPa: a reação (kgf) ÷ a área da sapata."""
    return tuple(
        reaction * GRAVITY_MS2 / profile.outrigger_pad_area_m2 / 1000.0 for reaction in reactions_kg
    )
