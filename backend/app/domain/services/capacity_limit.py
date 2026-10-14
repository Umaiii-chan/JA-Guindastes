"""Limite de capacidade por modelo e faixas OK, WARNING e OVER (RN-011; TASK-051; ADR-022).

Capacidade efetiva = capacidade da tabela × limite do modelo × fator de inclinação × fator de
vento (RN-015). Acima dela, o status é `OVER`. A
partir da faixa de atenção (% do limite), é `WARNING`. Carga igual à capacidade efetiva ainda não
está "acima": o limite é inclusivo.
"""

from dataclasses import dataclass
from enum import StrEnum

from app.domain.value_objects.crane_limits import CraneLimits
from app.domain.value_objects.mass import Mass


class CapacityLimitLevel(StrEnum):
    OK = "OK"
    WARNING = "WARNING"
    OVER = "OVER"


@dataclass(frozen=True)
class CapacityLimit:
    """Resultado da comparação com o limite do modelo.

    `limit_utilization_percent` é `peso comparado / capacidade efetiva × 100`, sem arredondamento.
    """

    limit_percent: float
    effective_capacity_kg: float
    limit_utilization_percent: float
    warning_band_percent: float
    level: CapacityLimitLevel
    slope_factor: float = 1.0
    wind_factor: float = 1.0


def evaluate_capacity_limit(
    table_capacity: Mass,
    compared_weight: Mass,
    limits: CraneLimits | None = None,
    *,
    slope_factor: float = 1.0,
    wind_factor: float = 1.0,
    blocked: bool = False,
) -> CapacityLimit | None:
    """Aplica o limite do modelo à capacidade da tabela.

    Devolve `None` se a capacidade efetiva for zero (a utilização contra o limite é indefinida).
    Sem `limits`, vale o padrão (100 % e faixa de 90 %). Os fatores de inclinação e de vento
    reduzem a capacidade efetiva; com `blocked` (terreno inclinado demais ou vento acima do limite),
    o nível é sempre `OVER`.
    """
    settings = CraneLimits() if limits is None else limits
    effective_kg = (
        table_capacity.kilograms
        * settings.capacity_limit_percent
        / 100
        * slope_factor
        * wind_factor
    )
    if effective_kg <= 0:
        return None
    utilization = compared_weight.kilograms / effective_kg * 100
    if blocked or compared_weight.kilograms > effective_kg:
        level = CapacityLimitLevel.OVER
    elif utilization >= settings.warning_band_percent:
        level = CapacityLimitLevel.WARNING
    else:
        level = CapacityLimitLevel.OK
    return CapacityLimit(
        limit_percent=settings.capacity_limit_percent,
        effective_capacity_kg=effective_kg,
        limit_utilization_percent=utilization,
        warning_band_percent=settings.warning_band_percent,
        level=level,
        slope_factor=slope_factor,
        wind_factor=wind_factor,
    )
