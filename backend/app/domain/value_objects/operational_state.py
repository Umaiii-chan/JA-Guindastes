from dataclasses import dataclass

from app.domain.exceptions.geometry_errors import InvalidOperationalStateError
from app.domain.value_objects.angle import Angle
from app.domain.value_objects.length import Length

_FULL_TURN_DEG = 360.0


def _normalize_turret_rotation_deg(degrees: float) -> float:
    """Leva o giro para [0°, 360°) (ADR-013 C-2)."""
    normalized = degrees % _FULL_TURN_DEG
    # Para negativos muito pequenos, `%` arredonda para 360.0 (ex.: -1e-20 % 360.0 == 360.0).
    return 0.0 if normalized == _FULL_TURN_DEG else normalized


@dataclass(frozen=True)
class OperationalState:
    """Entradas operacionais da geometria: L, θ, ψ e c (ADR-013 C-5; doc-fonte § 14.2).

    - `boom_length` (L, `boom_length_m`): distância do pino do pé da lança até a ponta.
    - `boom_angle` (θ, `boom_angle_deg`): inclinação da lança sobre a horizontal; 0° horizontal,
      positivo quando a ponta sobe, 90° vertical.
    - `turret_rotation` (ψ, `turret_rotation_deg`): giro da torre em torno do eixo vertical; 0°
      com a lança apontando para a frente do chassi (+Z), positivo no sentido anti-horário visto
      de cima. Guardado normalizado em [0°, 360°), como pede o ADR-013 C-2.
    - `cable_length` (c, `cable_length_m`): queda vertical da ponta até o gancho; não é o cabo
      desenrolado do guincho (ADR-013 C-3, S-4).

    Este value object não compara as entradas com as faixas do guindaste: isso é do
    `GeometryService`, que conhece a ficha técnica. Raio e altura nunca são entrada (ADR-013 C-7).
    """

    boom_length: Length
    boom_angle: Angle
    turret_rotation: Angle
    cable_length: Length

    def __post_init__(self) -> None:
        for field_name, value, expected in (
            ("boom_length", self.boom_length, Length),
            ("boom_angle", self.boom_angle, Angle),
            ("turret_rotation", self.turret_rotation, Angle),
            ("cable_length", self.cable_length, Length),
        ):
            if not isinstance(value, expected):
                raise InvalidOperationalStateError(
                    f"{field_name} deve ser {expected.__name__}, recebido {value!r}"
                )
        object.__setattr__(
            self,
            "turret_rotation",
            Angle(_normalize_turret_rotation_deg(self.turret_rotation.degrees)),
        )
