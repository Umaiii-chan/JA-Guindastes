from dataclasses import dataclass

from app.domain.value_objects._numeric import require_finite


@dataclass(frozen=True, order=True)
class Angle:
    """Ângulo em graus, a unidade interna (RN-006).

    Só exige valor finito. Não restringe faixa, sinal nem normaliza módulo 360°: o zero e o sentido
    dos ângulos estão no ADR-013, e as faixas válidas vêm da ficha técnica (`CraneGeometry`).
    """

    degrees: float

    def __post_init__(self) -> None:
        object.__setattr__(self, "degrees", require_finite(self.degrees, "ângulo"))
