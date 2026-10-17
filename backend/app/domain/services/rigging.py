"""Geometria das lingas: a ÚNICA fonte da altura das lingas (F-19; ADR-051). Serviço puro.

Antes havia quatro definições da mesma altura: o planejador (`sling_drop_m`: metade do maior
lado, entre 0,6 e 3 m), a cena do guindaste único (`slingDropM`, a mesma conta no frontend), o
tandem (1,5 m fixos) e a cena depois de engatar (a folga medida no instante do engate). O plano e
a cena discordavam, e a carga planejada não pousava onde o plano dizia.

Modelo (amarração em ponte, como o aparelho de içamento real): as lingas saem do ponto de
suspensão (o fim do gancho ou da cadeia de acessórios) e prendem nos cantos do topo da carga.

- `reach_m` (r): distância horizontal do eixo do gancho até o canto mais afastado (a
  meia-diagonal da pegada; no tandem, a da metade da carga que cada guindaste ergue);
- `angle_deg` (α): ângulo da linga com a HORIZONTAL (a convenção do ASME B30.9);
- `length_m` (L): comprimento da linga, `L = r / cos α`;
- `drop_m`: altura das lingas, do ponto de suspensão ao topo da carga: `drop = r · tan α`.

Dois dos três (r, α, L) determinam o resto. O padrão é α = 60° (a prática de içamento prefere
60° e aceita 45°; abaixo de 30° o ASME B30.9 proíbe, e a tensão em cada linga passa de 2× a
carga). Se a linga ficaria mais longa que `MAX_PREFERRED_LENGTH_M` com 60°, o padrão desce a 45°;
se ainda assim passa (carga muito comprida), fica em 45° e o aparelho real pediria uma viga de
içamento (balancim).

A mesma conta existe no frontend (`frontend/src/domain/rigging/slingGeometry.ts`). A paridade é
provada por uma tabela de casos única, `backend/tests/fixtures/sling_geometry_cases.json`, lida
pelos testes dos dois lados (pytest e vitest).
"""

import math
from dataclasses import dataclass

PREFERRED_ANGLE_DEG = 60.0
"""Ângulo padrão da linga com a horizontal."""
FALLBACK_ANGLE_DEG = 45.0
"""Ângulo do padrão quando a linga a 60° ficaria longa demais (também o mínimo recomendado)."""
MIN_ALLOWED_ANGLE_DEG = 30.0
"""Abaixo disto o ASME B30.9 proíbe usar a linga: o ângulo informado é recusado."""
MAX_ALLOWED_ANGLE_DEG = 90.0
MAX_PREFERRED_LENGTH_M = 8.0
"""Comprimento a partir do qual o padrão abandona os 60°."""
MIN_DROP_M = 0.3
"""Piso da altura das lingas: o gancho não encosta no topo da carga."""


class InvalidSlingGeometryError(ValueError):
    """Medida ou ângulo que não descreve uma linga (não finito, ≤ 0 ou ângulo fora da faixa)."""


@dataclass(frozen=True, slots=True)
class SlingGeometry:
    """As lingas de uma carga: alcance horizontal, comprimento, ângulo com a horizontal e altura."""

    reach_m: float
    length_m: float
    angle_deg: float
    drop_m: float

    @property
    def below_recommended_angle(self) -> bool:
        """Ângulo abaixo do mínimo recomendado (45°): tensão alta, só em atenção."""
        return self.angle_deg < FALLBACK_ANGLE_DEG - 1e-9

    @property
    def needs_spreader(self) -> bool:
        """A linga passa do comprimento preferido mesmo a 45°: o aparelho real usaria balancim."""
        return self.length_m > MAX_PREFERRED_LENGTH_M + 1e-9


def _positive(name: str, value: float) -> float:
    if isinstance(value, bool) or not isinstance(value, int | float) or not math.isfinite(value):
        raise InvalidSlingGeometryError(f"{name} deve ser um número finito")
    if value <= 0:
        raise InvalidSlingGeometryError(f"{name} deve ser maior que zero")
    return float(value)


def check_angle_deg(angle_deg: float) -> float:
    """Ângulo válido (de 30° a 90°), ou `InvalidSlingGeometryError`."""
    value = _positive("o ângulo da linga", angle_deg)
    if value < MIN_ALLOWED_ANGLE_DEG - 1e-9 or value > MAX_ALLOWED_ANGLE_DEG + 1e-9:
        raise InvalidSlingGeometryError(
            f"o ângulo da linga deve ficar entre {MIN_ALLOWED_ANGLE_DEG:g}° e "
            f"{MAX_ALLOWED_ANGLE_DEG:g}° com a horizontal"
        )
    return value


def reach_m(length_m: float, width_m: float, *, tandem: bool = False) -> float:
    """Alcance horizontal do ponto de suspensão ao canto mais afastado da pegada.

    Guindaste único: a meia-diagonal da pegada inteira. Tandem: cada guindaste ergue a sua metade
    (içamento a 1/4 e 3/4 do comprimento; ADR-041), então vale a meia-diagonal da metade.
    """
    length = _positive("o comprimento da carga", length_m)
    width = _positive("a largura da carga", width_m)
    along = length / 4 if tandem else length / 2
    return math.hypot(along, width / 2)


def from_angle(reach: float, angle_deg: float) -> SlingGeometry:
    """Lingas com o alcance `reach` e o ângulo `angle_deg`: `L = r / cos α`, `queda = r · tan α`."""
    r = _positive("o alcance horizontal", reach)
    alpha = check_angle_deg(angle_deg)
    if alpha >= MAX_ALLOWED_ANGLE_DEG - 1e-9:
        # Vertical: a queda não depende de r; o piso mantém o gancho fora da carga.
        return SlingGeometry(r, MIN_DROP_M, alpha, MIN_DROP_M)
    radians = math.radians(alpha)
    natural = r * math.tan(radians)
    if natural >= MIN_DROP_M:
        return SlingGeometry(r, r / math.cos(radians), alpha, natural)
    # Piso da queda: o ângulo efetivo sobe um pouco (carga pequena com linga a 30°-45°).
    return SlingGeometry(
        r, math.hypot(r, MIN_DROP_M), math.degrees(math.atan2(MIN_DROP_M, r)), MIN_DROP_M
    )


def from_length(reach: float, length_m: float) -> SlingGeometry:
    """Lingas com o alcance `reach` e o comprimento `length_m`: `α = acos(r / L)`.

    Recusa a linga mais curta que o alcance (não chega ao canto) e a que daria ângulo menor que o
    mínimo permitido.
    """
    r = _positive("o alcance horizontal", reach)
    length = _positive("o comprimento da linga", length_m)
    if length <= r:
        raise InvalidSlingGeometryError("a linga é mais curta que o alcance horizontal até o canto")
    alpha = math.degrees(math.acos(r / length))
    check_angle_deg(alpha)
    drop = max(MIN_DROP_M, math.sqrt(length * length - r * r))
    return SlingGeometry(r, math.hypot(r, drop), math.degrees(math.atan2(drop, r)), drop)


def default_geometry(
    length_m: float,
    width_m: float,
    *,
    angle_deg: float | None = None,
    tandem: bool = False,
) -> SlingGeometry:
    """As lingas da carga `length_m × width_m`: o ângulo informado, ou o padrão (60°; 45° se longa).

    É a conta que o planejador, o tandem e a cena usam para a altura das lingas. `angle_deg=None`
    escolhe o padrão; um valor fora de 30°–90° levanta `InvalidSlingGeometryError`.
    """
    reach = reach_m(length_m, width_m, tandem=tandem)
    if angle_deg is not None:
        return from_angle(reach, angle_deg)
    preferred = from_angle(reach, PREFERRED_ANGLE_DEG)
    if preferred.length_m <= MAX_PREFERRED_LENGTH_M + 1e-9:
        return preferred
    return from_angle(reach, FALLBACK_ANGLE_DEG)


def sling_drop_m(
    length_m: float,
    width_m: float,
    *,
    angle_deg: float | None = None,
    tandem: bool = False,
) -> float:
    """Altura das lingas (m) entre o ponto de suspensão e o topo da carga (`default_geometry`)."""
    return default_geometry(length_m, width_m, angle_deg=angle_deg, tandem=tandem).drop_m
