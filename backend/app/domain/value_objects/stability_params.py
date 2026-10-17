"""Parâmetros da estática de estabilidade do guindaste (TASK-106; ADR-050; RN-017).

**Todos os valores numéricos deste arquivo são FICTÍCIOS** (ADR-012) até a ficha oficial do modelo
(D5 da auditoria de 16/10/2026): o polígono das patolas, a distribuição de massa, a flecha da lança
e o fator de carga de tombamento. Os critérios vêm das normas citadas no ADR-050, mas o número de
cada fator precisa ser conferido na norma vigente e na ficha do fabricante antes de qualquer uso
oficial.

Referencial (ADR-013 C-1): `x` para a esquerda do chassi, `z` para a frente, `y` para cima, origem
no encontro do eixo de giro com o plano de apoio. A estática usa só o plano horizontal `(x, z)`.
"""

import math
from dataclasses import dataclass

DEFAULT_PAD_FRONT_Z_M = 3.0  # FICTÍCIO: do eixo de giro ao par dianteiro de sapatas
DEFAULT_PAD_REAR_Z_M = -3.0  # FICTÍCIO: do eixo de giro ao par traseiro de sapatas
DEFAULT_PAD_HALF_SPAN_FULL_M = 3.8  # FICTÍCIO: meia largura com as vigas 100 % estendidas
DEFAULT_PAD_HALF_SPAN_RETRACTED_M = 1.2  # FICTÍCIO: meia largura com as vigas recolhidas

DEFAULT_CARRIER_MASS_FRACTION = 0.55  # FICTÍCIO: chassi + patolas, sobre a massa do guindaste
DEFAULT_UPPER_MASS_FRACTION = 0.30  # FICTÍCIO: torre + contrapeso (gira com ψ)
DEFAULT_BOOM_MASS_FRACTION = 0.15  # FICTÍCIO: lança (CG no meio, entre o pino e a ponta)
DEFAULT_CARRIER_CG_Z_M = 0.0  # FICTÍCIO: CG do chassi sobre o eixo de giro
DEFAULT_CARRIER_CG_HEIGHT_M = 1.2  # FICTÍCIO
DEFAULT_UPPER_CG_BEHIND_M = 2.0  # FICTÍCIO: CG da torre atrás do eixo, oposto à lança
DEFAULT_UPPER_CG_HEIGHT_M = 2.0  # FICTÍCIO

DEFAULT_TIPPING_LOAD_LIMIT_RATIO = 0.85
"""Carga comparada ≤ 85 % da carga de tombamento sobre patolas (ADR-050 § 2). É o valor que as
tabelas dos fabricantes citam (ASME B30.5; ISO 4305 e EN 13000 partem da carga de teste, com
fator próprio): FICTÍCIO até a ficha oficial."""
DEFAULT_ATTENTION_RATIO = 0.90
"""A partir de 90 % do limite de estabilidade, o risco é de atenção (FICTÍCIO)."""

DEFAULT_DEFLECTION_M_PER_T_M3 = 8e-7
"""Flecha da lança, em metros por tonelada e por metro³ de lança (`Δ = k · Q[t] · L³`): FICTÍCIO,
calibrado para ~1 m com 20 t numa lança de 40 m. Soma-se ao raio só na estática (a consulta à
tabela continua com o raio geométrico, RN-004)."""

DEFAULT_WIND_TABLE_SPEED_MS = 9.0
"""Velocidade de rajada (3 s, no ponto mais alto) até a qual a tabela de carga vale (EN 13000).
FICTÍCIO: vem da tabela de cada modelo."""
WIND_REFERENCE_AREA_PER_TONNE_M2 = 1.2
"""Razão `A_W / m_H` de referência da EN 13000: até 1,2 m² por tonelada a tabela vale até a
velocidade dela."""
AIR_DENSITY_KG_M3 = 1.225
DEFAULT_BOOM_WIND_AREA_PER_M_M2 = 1.28
"""Área de vento da lança por metro de lança (largura 0,8 m × coeficiente 1,6): FICTÍCIO."""


@dataclass(frozen=True)
class StabilityParams:
    """Ficha de estabilidade do modelo (FICTÍCIA): polígono das sapatas, massas, flecha e fatores.

    As frações de massa somam 1: `carrier_mass_fraction + upper_mass_fraction +
    boom_mass_fraction`, sobre `SafetyProfile.crane_mass_kg`.
    """

    pad_front_z_m: float = DEFAULT_PAD_FRONT_Z_M
    pad_rear_z_m: float = DEFAULT_PAD_REAR_Z_M
    pad_half_span_full_m: float = DEFAULT_PAD_HALF_SPAN_FULL_M
    pad_half_span_retracted_m: float = DEFAULT_PAD_HALF_SPAN_RETRACTED_M
    carrier_mass_fraction: float = DEFAULT_CARRIER_MASS_FRACTION
    upper_mass_fraction: float = DEFAULT_UPPER_MASS_FRACTION
    boom_mass_fraction: float = DEFAULT_BOOM_MASS_FRACTION
    carrier_cg_z_m: float = DEFAULT_CARRIER_CG_Z_M
    carrier_cg_height_m: float = DEFAULT_CARRIER_CG_HEIGHT_M
    upper_cg_behind_m: float = DEFAULT_UPPER_CG_BEHIND_M
    upper_cg_height_m: float = DEFAULT_UPPER_CG_HEIGHT_M
    tipping_load_limit_ratio: float = DEFAULT_TIPPING_LOAD_LIMIT_RATIO
    attention_ratio: float = DEFAULT_ATTENTION_RATIO
    deflection_m_per_t_m3: float = DEFAULT_DEFLECTION_M_PER_T_M3
    wind_table_speed_ms: float = DEFAULT_WIND_TABLE_SPEED_MS
    boom_wind_area_per_m_m2: float = DEFAULT_BOOM_WIND_AREA_PER_M_M2

    def __post_init__(self) -> None:
        for name in (
            "pad_front_z_m",
            "pad_rear_z_m",
            "pad_half_span_full_m",
            "pad_half_span_retracted_m",
            "carrier_mass_fraction",
            "upper_mass_fraction",
            "boom_mass_fraction",
            "carrier_cg_z_m",
            "carrier_cg_height_m",
            "upper_cg_behind_m",
            "upper_cg_height_m",
            "tipping_load_limit_ratio",
            "attention_ratio",
            "deflection_m_per_t_m3",
            "wind_table_speed_ms",
            "boom_wind_area_per_m_m2",
        ):
            value = getattr(self, name)
            if isinstance(value, bool) or not isinstance(value, int | float):
                raise ValueError(f"{name} deve ser numérico, recebido {value!r}")
            if not math.isfinite(value):
                raise ValueError(f"{name} deve ser finito: {value!r}")
        if self.pad_front_z_m <= self.pad_rear_z_m:
            raise ValueError("o par dianteiro de sapatas deve ficar à frente do traseiro")
        if not 0 < self.pad_half_span_retracted_m <= self.pad_half_span_full_m:
            raise ValueError("meia largura recolhida deve ficar entre 0 (exclusivo) e a estendida")
        if min(self.carrier_mass_fraction, self.upper_mass_fraction, self.boom_mass_fraction) < 0:
            raise ValueError("as frações de massa não podem ser negativas")
        total = self.carrier_mass_fraction + self.upper_mass_fraction + self.boom_mass_fraction
        if not math.isclose(total, 1.0, abs_tol=1e-9):
            raise ValueError(f"as frações de massa devem somar 1, somam {total!r}")
        if not 0 < self.tipping_load_limit_ratio <= 1:
            raise ValueError("tipping_load_limit_ratio deve ficar em (0, 1]")
        if not 0 < self.attention_ratio <= 1:
            raise ValueError("attention_ratio deve ficar em (0, 1]")
        if min(self.deflection_m_per_t_m3, self.wind_table_speed_ms) < 0:
            raise ValueError("flecha e velocidade da tabela não podem ser negativas")
        if self.boom_wind_area_per_m_m2 < 0:
            raise ValueError("a área de vento da lança não pode ser negativa")
