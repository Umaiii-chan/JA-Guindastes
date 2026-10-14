"""Limites operacionais do modelo de guindaste (RN-011, RN-013; TASK-051; ADR-022).

Ficam no modelo (`Crane`), não na configuração: valem para todas as configurações dele. Os valores
padrão de `max_ground_slope_deg` e `max_leveling_deg` são FICTÍCIOS até haver dado oficial
(ADR-012).
"""

from dataclasses import dataclass

from app.domain.exceptions.domain_errors import InvalidQuantityError
from app.domain.value_objects._numeric import require_non_negative_finite

DEFAULT_CAPACITY_LIMIT_PERCENT = 100.0
DEFAULT_WARNING_BAND_PERCENT = 90.0
DEFAULT_MAX_GROUND_SLOPE_DEG = 1.0  # FICTÍCIO
DEFAULT_MAX_LEVELING_DEG = 3.0  # FICTÍCIO
MAX_SLOPE_DEG = 45.0
"""Limite de sanidade das inclinações cadastradas."""


def _percent_in_range(value: float, name: str) -> float:
    number = require_non_negative_finite(value, name)
    if not 1.0 <= number <= 100.0:
        raise InvalidQuantityError(f"{name} deve estar entre 1 e 100 %, recebido {value!r}")
    return number


def _slope(value: float, name: str) -> float:
    number = require_non_negative_finite(value, name)
    if number > MAX_SLOPE_DEG:
        raise InvalidQuantityError(
            f"{name} deve ser de 0 a {MAX_SLOPE_DEG} graus, recebido {value!r}"
        )
    return number


@dataclass(frozen=True)
class CraneLimits:
    """Limites do modelo de guindaste.

    - `capacity_limit_percent`: limite de uso da capacidade, de 1 a 100 % (RN-011);
    - `warning_band_percent`: a partir desta % do limite o status é "atenção", de 1 a 100 %;
    - `max_ground_slope_deg`: inclinação residual máxima do terreno sob o guindaste (RN-013);
    - `max_leveling_deg`: correção máxima de nivelamento pelos macacos.
    """

    capacity_limit_percent: float = DEFAULT_CAPACITY_LIMIT_PERCENT
    warning_band_percent: float = DEFAULT_WARNING_BAND_PERCENT
    max_ground_slope_deg: float = DEFAULT_MAX_GROUND_SLOPE_DEG
    max_leveling_deg: float = DEFAULT_MAX_LEVELING_DEG

    def __post_init__(self) -> None:
        for name, check in (
            ("capacity_limit_percent", _percent_in_range),
            ("warning_band_percent", _percent_in_range),
            ("max_ground_slope_deg", _slope),
            ("max_leveling_deg", _slope),
        ):
            object.__setattr__(self, name, check(getattr(self, name), name))
