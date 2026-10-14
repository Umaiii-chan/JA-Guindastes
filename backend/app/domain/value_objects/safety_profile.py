"""Parâmetros de segurança de um modelo de guindaste (RN-011, RN-013; ADR-025).

Os valores padrão são **FICTÍCIOS** (ADR-012) e valem até a TASK-051 trazer o limite por modelo e
`max_ground_slope_deg` do catálogo, atrás da porta `SafetyProfileProvider`.
"""

import math
from dataclasses import dataclass

DEFAULT_CAPACITY_LIMIT_PERCENT = 100.0
DEFAULT_WARNING_BAND_PERCENT = 90.0
DEFAULT_MAX_GROUND_SLOPE_DEG = 1.0


@dataclass(frozen=True)
class SafetyProfile:
    """Limite de uso da capacidade, faixa de atenção e inclinação residual máxima do modelo.

    - `capacity_limit_percent`: de 1 a 100 (RN-011); a capacidade efetiva é a da tabela × limite;
    - `warning_band_percent`: de 1 a 100; atenção a partir desta % do limite;
    - `max_ground_slope_deg`: inclinação residual máxima sob o guindaste (RN-013), ≥ 0.
    """

    capacity_limit_percent: float = DEFAULT_CAPACITY_LIMIT_PERCENT
    warning_band_percent: float = DEFAULT_WARNING_BAND_PERCENT
    max_ground_slope_deg: float = DEFAULT_MAX_GROUND_SLOPE_DEG

    def __post_init__(self) -> None:
        for name, value, low, high in (
            ("capacity_limit_percent", self.capacity_limit_percent, 1.0, 100.0),
            ("warning_band_percent", self.warning_band_percent, 1.0, 100.0),
            ("max_ground_slope_deg", self.max_ground_slope_deg, 0.0, math.inf),
        ):
            if isinstance(value, bool) or not isinstance(value, int | float):
                raise ValueError(f"{name} deve ser numérico, recebido {value!r}")
            if not math.isfinite(value) or not low <= value <= high:
                raise ValueError(f"{name} fora da faixa [{low}, {high}]: {value!r}")
