import math

from app.domain.exceptions.domain_errors import UndefinedUtilizationError
from app.domain.value_objects.mass import Mass


def calculate_utilization_percent(load: Mass, capacity: Mass) -> float:
    """Utilização da capacidade em %: `load / capacity × 100` (doc-fonte § 14.3).

    - Sem arredondamento: a política está pendente (PEND-002).
    - Sem status nem alerta: os níveis estão pendentes (PEND-004); se carga igual à capacidade é
      violação também não está decidido (known-gaps P-005).
    - `load` é a massa que o chamador decide comparar; se é bruta, com acessórios, moitões ou cabos,
      não está decidido (PEND-006, P-005).

    Levanta `UndefinedUtilizationError` se `capacity` for zero, ou se o resultado não for finito.
    """
    if capacity.kilograms == 0:
        raise UndefinedUtilizationError("utilização indefinida: capacidade igual a zero")
    utilization = load.kilograms / capacity.kilograms * 100
    if not math.isfinite(utilization):
        raise UndefinedUtilizationError("utilização indefinida: resultado não finito")
    return utilization
