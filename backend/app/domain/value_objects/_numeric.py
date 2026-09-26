"""Validação numérica compartilhada pelos value objects de grandeza física."""

import math

from app.domain.exceptions.domain_errors import InvalidQuantityError


def require_finite(value: float, quantity: str) -> float:
    """Devolve `value` como `float` finito ou levanta `InvalidQuantityError`.

    `bool` é recusado de propósito: em Python ele é subclasse de `int`, e `True` como
    comprimento ou massa é quase sempre um erro de chamada.
    """
    if isinstance(value, bool) or not isinstance(value, int | float):
        raise InvalidQuantityError(f"{quantity} deve ser numérico, recebido {value!r}")
    as_float = float(value)
    if not math.isfinite(as_float):
        raise InvalidQuantityError(f"{quantity} deve ser finito, recebido {value!r}")
    # Soma com 0.0 normaliza -0.0 para 0.0.
    return as_float + 0.0


def require_non_negative_finite(value: float, quantity: str) -> float:
    """Como `require_finite`, e também recusa valores negativos."""
    as_float = require_finite(value, quantity)
    if as_float < 0:
        raise InvalidQuantityError(f"{quantity} não pode ser negativo, recebido {value!r}")
    return as_float
