"""Resultado do `GeometryService` (ADR-013 C-5; RF-015)."""

from dataclasses import dataclass

from app.domain.value_objects._numeric import require_finite
from app.domain.value_objects.length import Length


@dataclass(frozen=True)
class Point3D:
    """Ponto no referencial do guindaste, em metros (ADR-013 C-1).

    Sistema destro com origem no encontro do eixo de giro com o plano de apoio: `x_m` para o lado
    esquerdo do chassi, `y_m` para cima e `z_m` para a frente do chassi. São os mesmos eixos do glTF
    e do Three.js. As coordenadas podem ser negativas.
    """

    x_m: float
    y_m: float
    z_m: float

    def __post_init__(self) -> None:
        object.__setattr__(self, "x_m", require_finite(self.x_m, "coordenada x"))
        object.__setattr__(self, "y_m", require_finite(self.y_m, "coordenada y"))
        object.__setattr__(self, "z_m", require_finite(self.z_m, "coordenada z"))


@dataclass(frozen=True)
class OperationalGeometry:
    """Grandezas geométricas de um estado operacional válido (ADR-013 C-3 e C-5).

    - `working_radius`: raio de trabalho, do eixo de giro até a vertical do gancho. Nunca é
      negativo: se a ponta fica atrás do eixo, o `GeometryService` sinaliza e não devolve
      resultado.
    - `boom_pivot` (P), `boom_tip` (T) e `hook` (G): posições pela fórmula (5).
    - `tip_height_m` (y_T) e `hook_height_m` (y_G): alturas em relação ao plano de apoio. Podem ser
      negativas: o ADR-013 não bloqueia o gancho abaixo do plano de apoio (G-8).

    Tudo é geométrico, sem deflexão da lança nem dimensões de moitão e gancho (S-1, S-3).
    """

    working_radius: Length
    boom_pivot: Point3D
    boom_tip: Point3D
    hook: Point3D

    @property
    def tip_height_m(self) -> float:
        return self.boom_tip.y_m

    @property
    def hook_height_m(self) -> float:
        return self.hook.y_m
