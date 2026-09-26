from dataclasses import dataclass

from app.domain.value_objects._numeric import require_non_negative_finite


@dataclass(frozen=True, order=True)
class Length:
    """Comprimento em metros, a unidade interna (RN-006, RNF-004).

    Finito e não negativo. Conversão de outras unidades fica fora do domínio: a entrada já
    chega normalizada em metros.
    """

    meters: float

    def __post_init__(self) -> None:
        object.__setattr__(self, "meters", require_non_negative_finite(self.meters, "comprimento"))
