from dataclasses import dataclass

from app.domain.value_objects._numeric import require_non_negative_finite


@dataclass(frozen=True, order=True)
class Mass:
    """Massa em quilogramas, a unidade interna (RN-006).

    Finita e não negativa. Conversão de outras unidades fica fora do domínio: a entrada já chega
    normalizada em kg.
    """

    kilograms: float

    def __post_init__(self) -> None:
        object.__setattr__(self, "kilograms", require_non_negative_finite(self.kilograms, "massa"))
