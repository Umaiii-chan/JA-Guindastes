from dataclasses import dataclass

from app.domain.exceptions.geometry_errors import InvalidCraneGeometryError
from app.domain.value_objects._numeric import require_finite
from app.domain.value_objects.angle import Angle
from app.domain.value_objects.length import Length

# ADR-013 C-2: as fórmulas valem para −90° < θ ≤ 90°.
_BOOM_ANGLE_EXCLUSIVE_LOWER_DEG = -90.0
_BOOM_ANGLE_INCLUSIVE_UPPER_DEG = 90.0
_FULL_TURN_DEG = 360.0


def _require_instance(value: object, expected: type, field_name: str) -> None:
    if not isinstance(value, expected):
        raise InvalidCraneGeometryError(
            f"{field_name} deve ser {expected.__name__}, recebido {value!r}"
        )


@dataclass(frozen=True)
class CraneGeometry:
    """Parâmetros geométricos do guindaste, da ficha técnica cadastrada no backend (ADR-013 C-4).

    Nunca vêm do GLB (RN-003, known-gaps P-003). Onde isto fica no modelo de domínio (atributo de
    `CraneKinematics`, entidade própria ou parte de `CraneConfiguration`) ainda não foi decidido;
    o ADR-013 fixa só o conteúdo e as unidades.

    - `boom_pivot_offset_m` (a): distância horizontal do eixo de giro até o pino do pé da lança P,
      na direção da lança. Tem sinal: positiva se P fica do lado da ponta, negativa se fica atrás
      do eixo; 0 é válido. É `float` em metros porque `Length` não aceita negativo.
    - `boom_pivot_height` (h): altura de P acima do plano de apoio.
    - `boom_length_min`/`boom_length_max`: faixa do comprimento da lança L (iguais se a lança for
      fixa).
    - `boom_angle_min`/`boom_angle_max`: faixa da inclinação θ, dentro de −90° < θ ≤ 90°.
    - `cable_length_min`/`cable_length_max`: faixa do cabo c (queda vertical da ponta até o
      gancho). `cable_length_max` é opcional.
    - `turret_rotation_min`/`turret_rotation_max`: limites do giro ψ, os dois ou nenhum. Sem
      limites, o giro é contínuo. Com limites, o giro permitido é o arco que sai de
      `turret_rotation_min` e vai, no sentido positivo (anti-horário visto de cima), até
      `turret_rotation_max`; por isso exige mínimo ≤ máximo e amplitude menor que 360°. Os valores
      podem ser negativos (ex.: −30° a 30° é o setor da frente).

    Invariantes: todo mínimo ≤ máximo; faixa de θ dentro de −90° < θ ≤ 90°; tipos corretos.
    Violá-los levanta `InvalidCraneGeometryError`.
    """

    boom_pivot_offset_m: float
    boom_pivot_height: Length
    boom_length_min: Length
    boom_length_max: Length
    boom_angle_min: Angle
    boom_angle_max: Angle
    cable_length_min: Length
    cable_length_max: Length | None = None
    turret_rotation_min: Angle | None = None
    turret_rotation_max: Angle | None = None

    def __post_init__(self) -> None:
        object.__setattr__(
            self,
            "boom_pivot_offset_m",
            require_finite(self.boom_pivot_offset_m, "offset horizontal do pino da lança"),
        )
        _require_instance(self.boom_pivot_height, Length, "boom_pivot_height")
        _require_instance(self.boom_length_min, Length, "boom_length_min")
        _require_instance(self.boom_length_max, Length, "boom_length_max")
        _require_instance(self.boom_angle_min, Angle, "boom_angle_min")
        _require_instance(self.boom_angle_max, Angle, "boom_angle_max")
        _require_instance(self.cable_length_min, Length, "cable_length_min")
        if self.cable_length_max is not None:
            _require_instance(self.cable_length_max, Length, "cable_length_max")
        if self.turret_rotation_min is not None:
            _require_instance(self.turret_rotation_min, Angle, "turret_rotation_min")
        if self.turret_rotation_max is not None:
            _require_instance(self.turret_rotation_max, Angle, "turret_rotation_max")

        if self.boom_length_min > self.boom_length_max:
            raise InvalidCraneGeometryError(
                "boom_length_min maior que boom_length_max: "
                f"{self.boom_length_min.meters} m > {self.boom_length_max.meters} m"
            )

        if self.boom_angle_min > self.boom_angle_max:
            raise InvalidCraneGeometryError(
                "boom_angle_min maior que boom_angle_max: "
                f"{self.boom_angle_min.degrees}° > {self.boom_angle_max.degrees}°"
            )
        if self.boom_angle_min.degrees <= _BOOM_ANGLE_EXCLUSIVE_LOWER_DEG:
            raise InvalidCraneGeometryError(
                f"boom_angle_min deve ser maior que {_BOOM_ANGLE_EXCLUSIVE_LOWER_DEG}°, "
                f"recebido {self.boom_angle_min.degrees}° (ADR-013 C-2)"
            )
        if self.boom_angle_max.degrees > _BOOM_ANGLE_INCLUSIVE_UPPER_DEG:
            raise InvalidCraneGeometryError(
                f"boom_angle_max deve ser no máximo {_BOOM_ANGLE_INCLUSIVE_UPPER_DEG}°, "
                f"recebido {self.boom_angle_max.degrees}° (ADR-013 C-2)"
            )

        if self.cable_length_max is not None and self.cable_length_min > self.cable_length_max:
            raise InvalidCraneGeometryError(
                "cable_length_min maior que cable_length_max: "
                f"{self.cable_length_min.meters} m > {self.cable_length_max.meters} m"
            )

        self._validate_turret_rotation_limits()

    def _validate_turret_rotation_limits(self) -> None:
        if self.turret_rotation_min is None and self.turret_rotation_max is None:
            return
        if self.turret_rotation_min is None or self.turret_rotation_max is None:
            raise InvalidCraneGeometryError(
                "turret_rotation_min e turret_rotation_max devem ser informados juntos "
                "(sem os dois, o giro é contínuo)"
            )
        span_deg = self.turret_rotation_max.degrees - self.turret_rotation_min.degrees
        if span_deg < 0:
            raise InvalidCraneGeometryError(
                "turret_rotation_min maior que turret_rotation_max: "
                f"{self.turret_rotation_min.degrees}° > {self.turret_rotation_max.degrees}°"
            )
        if span_deg >= _FULL_TURN_DEG:
            raise InvalidCraneGeometryError(
                f"amplitude de giro de {span_deg}° não é menor que {_FULL_TURN_DEG}°: "
                "para giro contínuo, não informe limites"
            )
