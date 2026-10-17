"""Parâmetros de segurança de um modelo de guindaste (RN-011, RN-013; ADR-025).

Os valores padrão são **FICTÍCIOS** (ADR-012) e valem até a TASK-051 trazer o limite por modelo e
`max_ground_slope_deg` do catálogo, atrás da porta `SafetyProfileProvider`.
"""

import math
from dataclasses import dataclass, field

from app.domain.value_objects.crane_limits import (
    DEFAULT_CRANE_MASS_KG,
    DEFAULT_OUTRIGGER_PAD_AREA_M2,
    DEFAULT_SLOPE_DERATING_PERCENT_PER_DEG,
)
from app.domain.value_objects.stability_params import StabilityParams

DEFAULT_CAPACITY_LIMIT_PERCENT = 100.0
DEFAULT_WARNING_BAND_PERCENT = 90.0
DEFAULT_MAX_GROUND_SLOPE_DEG = 1.0


@dataclass(frozen=True)
class SafetyProfile:
    """Limite de uso da capacidade, faixa de atenção e inclinação residual máxima do modelo.

    - `capacity_limit_percent`: de 1 a 100 (RN-011); a capacidade efetiva é a da tabela × limite;
    - `warning_band_percent`: de 1 a 100; atenção a partir desta % do limite;
    - `max_ground_slope_deg`: inclinação residual máxima sob o guindaste (RN-013), ≥ 0;
    - `crane_mass_kg`, `outrigger_pad_area_m2`: massa do guindaste e área de cada sapata (RN-017);
    - `slope_derating_percent_per_deg`: OBSOLETO desde a TASK-106 (a RN-015 foi substituída pela
      RN-017; a inclinação residual entra como momento de tombamento). O campo fica só pelo
      cadastro e não é lido por nenhuma conta;
    - `stability`: a ficha de estabilidade (polígono das sapatas, massas, flecha e fatores; todos
      FICTÍCIOS, `StabilityParams`).
    """

    capacity_limit_percent: float = DEFAULT_CAPACITY_LIMIT_PERCENT
    warning_band_percent: float = DEFAULT_WARNING_BAND_PERCENT
    max_ground_slope_deg: float = DEFAULT_MAX_GROUND_SLOPE_DEG
    slope_derating_percent_per_deg: float = DEFAULT_SLOPE_DERATING_PERCENT_PER_DEG
    crane_mass_kg: float = DEFAULT_CRANE_MASS_KG
    outrigger_pad_area_m2: float = DEFAULT_OUTRIGGER_PAD_AREA_M2
    stability: StabilityParams = field(default_factory=StabilityParams)

    def __post_init__(self) -> None:
        for name, value, low, high in (
            ("capacity_limit_percent", self.capacity_limit_percent, 1.0, 100.0),
            ("warning_band_percent", self.warning_band_percent, 1.0, 100.0),
            ("max_ground_slope_deg", self.max_ground_slope_deg, 0.0, math.inf),
            ("slope_derating_percent_per_deg", self.slope_derating_percent_per_deg, 0.0, 100.0),
            ("crane_mass_kg", self.crane_mass_kg, 0.0, math.inf),
            ("outrigger_pad_area_m2", self.outrigger_pad_area_m2, 0.0, math.inf),
        ):
            if isinstance(value, bool) or not isinstance(value, int | float):
                raise ValueError(f"{name} deve ser numérico, recebido {value!r}")
            if not math.isfinite(value) or not low <= value <= high:
                raise ValueError(f"{name} fora da faixa [{low}, {high}]: {value!r}")
