from dataclasses import dataclass

from app.domain.value_objects._numeric import require_finite


@dataclass(frozen=True, order=True)
class Angle:
    """Ângulo em graus, a unidade interna (RN-006).

    Só exige valor finito. Não restringe faixa, sinal nem normaliza módulo 360°, porque o zero e o
    sentido dos ângulos ainda não estão definidos (known-gaps P-001).
    """

    degrees: float

    def __post_init__(self) -> None:
        object.__setattr__(self, "degrees", require_finite(self.degrees, "ângulo"))
