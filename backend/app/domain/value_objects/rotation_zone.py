"""Zonas de giro de uma configuração (ADR-018 § 1; TASK-046).

Uma tabela oficial pode trazer capacidades diferentes por setor do giro da torre (ex.: "área
frontal" e "áreas lateral e traseira"). A configuração declara as **zonas de giro**, e cada tabela
de carga importada nela indica a sua zona.

Convenções:

- os ângulos seguem a convenção de ψ do ADR-013 C-2: 0° com a lança sobre a frente do chassi,
  positivo no sentido anti-horário visto de cima, em [0°, 360°);
- um setor vai de `start_deg` a `end_deg` no sentido crescente e pode passar por 0° (ex.: frontal
  de 305° a 55°);
- as zonas cobrem 360° sem sobreposição, com as fronteiras compartilhadas, e são pelo menos 2;
- sobre uma fronteira, a ±ε (`ROTATION_ZONE_BOUNDARY_TOLERANCE_DEG`, o ε do ADR-015 aplicado em
  graus), valem as **duas** zonas vizinhas: a avaliação usa a menor capacidade (lado seguro).

Os dados usados com estes tipos nos testes e no seed são FICTÍCIOS (ADR-012).
"""

import math
import re
from dataclasses import dataclass, field

from app.domain.exceptions.domain_errors import InvalidRotationZonesError

ROTATION_ZONE_BOUNDARY_TOLERANCE_DEG = 1e-6
"""ε do ADR-015, em graus: só absorve ruído de ponto flutuante na fronteira entre duas zonas."""

ROTATION_ZONE_CODE_PATTERN = re.compile(r"[A-Z0-9_]{1,32}")
"""Código da zona: 1 a 32 caracteres `[A-Z0-9_]`."""

ROTATION_ZONE_NAME_MAX_LENGTH = 80
MIN_ROTATION_ZONES = 2

_FULL_TURN_DEG = 360.0


def require_rotation_zone_code(code: object) -> str:
    """Devolve `code` se for um código de zona válido; senão, `InvalidRotationZonesError`."""
    if not isinstance(code, str) or not ROTATION_ZONE_CODE_PATTERN.fullmatch(code):
        raise InvalidRotationZonesError(
            f"código de zona inválido: {code!r} (1 a 32 caracteres A-Z, 0-9 ou _)"
        )
    return code


def _require_angle(value: object, name: str) -> float:
    if isinstance(value, bool) or not isinstance(value, int | float):
        raise InvalidRotationZonesError(f"{name} deve ser numérico, recebido {value!r}")
    as_float = float(value) + 0.0
    if not math.isfinite(as_float) or not 0.0 <= as_float < _FULL_TURN_DEG:
        raise InvalidRotationZonesError(f"{name} deve estar em [0, 360), recebido {value!r}")
    return as_float


def _angular_distance_deg(first: float, second: float) -> float:
    """Menor distância entre dois ângulos no círculo, em graus (entre 0 e 180)."""
    difference = abs(first - second) % _FULL_TURN_DEG
    return min(difference, _FULL_TURN_DEG - difference)


@dataclass(frozen=True)
class RotationZone:
    """Um setor do giro da torre, com código e nome (ADR-018 § 1).

    - `code`: 1 a 32 caracteres `[A-Z0-9_]`, único na configuração;
    - `name`: 1 a 80 caracteres, não só espaços;
    - `start_deg` e `end_deg`: em [0°, 360°); o setor vai de `start_deg` a `end_deg` no sentido
      crescente e pode passar por 0°. Os dois não podem coincidir: a amplitude tem de ser maior
      que 2ε, para as duas fronteiras do setor não se confundirem.
    """

    code: str
    name: str
    start_deg: float
    end_deg: float

    def __post_init__(self) -> None:
        require_rotation_zone_code(self.code)
        if (
            not isinstance(self.name, str)
            or not self.name.strip()
            or len(self.name) > ROTATION_ZONE_NAME_MAX_LENGTH
        ):
            raise InvalidRotationZonesError(
                f"nome da zona {self.code!r} deve ter de 1 a {ROTATION_ZONE_NAME_MAX_LENGTH} "
                "caracteres, não só espaços"
            )
        object.__setattr__(self, "start_deg", _require_angle(self.start_deg, "start_deg"))
        object.__setattr__(self, "end_deg", _require_angle(self.end_deg, "end_deg"))
        if self.span_deg <= 2 * ROTATION_ZONE_BOUNDARY_TOLERANCE_DEG:
            raise InvalidRotationZonesError(
                f"a zona {self.code!r} não tem amplitude: start_deg e end_deg coincidem"
            )

    @property
    def span_deg(self) -> float:
        """Amplitude do setor, em graus, no sentido crescente (passa por 0° se preciso)."""
        return (self.end_deg - self.start_deg) % _FULL_TURN_DEG

    def contains(self, turret_rotation_deg: float) -> bool:
        """`True` se ψ está no setor `[start_deg, end_deg)`, sem tolerância."""
        offset = (turret_rotation_deg - self.start_deg) % _FULL_TURN_DEG
        return offset < self.span_deg


@dataclass(frozen=True)
class RotationZones:
    """As zonas de giro de uma configuração: cobrem 360° sem sobreposição (ADR-018 § 1).

    Invariantes (violar levanta `InvalidRotationZonesError`):
    - pelo menos 2 zonas, todas `RotationZone`;
    - códigos únicos;
    - ordenadas pelo início, o fim de cada zona coincide (±ε) com o início da seguinte, e a soma
      das amplitudes é 360° (±ε por zona): nem buraco, nem sobreposição, nem volta dupla.

    A ordem declarada é mantida (`zones`): é a ordem da resposta da API e a do desempate na
    fronteira.
    """

    zones: tuple[RotationZone, ...]
    _ordered: tuple[RotationZone, ...] = field(init=False, repr=False, compare=False)

    def __post_init__(self) -> None:
        zones = tuple(self.zones)
        for zone in zones:
            if not isinstance(zone, RotationZone):
                raise InvalidRotationZonesError(f"zona inválida: {zone!r}")
        if len(zones) < MIN_ROTATION_ZONES:
            raise InvalidRotationZonesError(
                f"declare pelo menos {MIN_ROTATION_ZONES} zonas de giro, recebido {len(zones)}"
            )
        codes = [zone.code for zone in zones]
        repeated = sorted({code for code in codes if codes.count(code) > 1})
        if repeated:
            raise InvalidRotationZonesError(f"códigos de zona repetidos: {', '.join(repeated)}")

        ordered = tuple(sorted(zones, key=lambda zone: zone.start_deg))
        for current, following in zip(ordered, (*ordered[1:], ordered[0]), strict=True):
            if (
                _angular_distance_deg(current.end_deg, following.start_deg)
                > ROTATION_ZONE_BOUNDARY_TOLERANCE_DEG
            ):
                raise InvalidRotationZonesError(
                    f"as zonas precisam cobrir 360° sem sobreposição: a zona {current.code!r} "
                    f"termina em {current.end_deg}°, mas a seguinte ({following.code!r}) começa "
                    f"em {following.start_deg}°"
                )
        total_span = sum(zone.span_deg for zone in ordered)
        if abs(total_span - _FULL_TURN_DEG) > len(ordered) * ROTATION_ZONE_BOUNDARY_TOLERANCE_DEG:
            raise InvalidRotationZonesError(
                f"as zonas precisam cobrir 360° sem sobreposição: somam {total_span}°"
            )

        object.__setattr__(self, "zones", zones)
        object.__setattr__(self, "_ordered", ordered)

    @property
    def codes(self) -> tuple[str, ...]:
        return tuple(zone.code for zone in self.zones)

    def by_code(self, code: str) -> RotationZone | None:
        return next((zone for zone in self.zones if zone.code == code), None)

    def zones_at(self, turret_rotation_deg: float) -> tuple[RotationZone, ...]:
        """Zona(s) que valem para o giro ψ (em graus; normalizado em [0°, 360°)).

        - dentro de um setor: a zona dele;
        - a ±ε de uma fronteira: as duas zonas vizinhas, na ordem declarada.
        """
        psi = turret_rotation_deg % _FULL_TURN_DEG
        ordered = self._ordered
        for current, following in zip(ordered, (*ordered[1:], ordered[0]), strict=True):
            if (
                _angular_distance_deg(psi, current.end_deg) <= ROTATION_ZONE_BOUNDARY_TOLERANCE_DEG
                or _angular_distance_deg(psi, following.start_deg)
                <= ROTATION_ZONE_BOUNDARY_TOLERANCE_DEG
            ):
                return tuple(zone for zone in self.zones if zone in (current, following))
        for zone in self.zones:
            if zone.contains(psi):
                return (zone,)
        # Inalcançável: as zonas cobrem 360° e as brechas de até ε caem no caso da fronteira.
        raise InvalidRotationZonesError(f"nenhuma zona contém o giro {turret_rotation_deg}°")
