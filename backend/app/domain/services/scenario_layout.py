"""Layout seguro dos obstáculos de um cenário gerado por IA (TASK-081).

O modelo de linguagem às vezes põe um obstáculo onde não cabe (um carro sobre o guindaste, ou sobre
o ponto de entrega). Este serviço é determinístico e puro: dado o cenário, ele desloca cada
obstáculo que invade uma zona reservada para o ponto livre mais próximo, na direção radial a partir
do centro da zona, em passos de 0,5 m (até 60 m), e devolve o que foi movido para a pessoa revisar.

Zonas reservadas, todas no plano XZ:
- guindaste principal e guindastes adicionais: o corpo do guindaste em planta, o mesmo do
  planejamento (`planning/crane_body.py`: X de -3,10 a 3,10 m e Z de -5,13 m, traseira, a 9,22 m,
  cabine, em relação ao eixo de giro, com as patolas estendidas), mais `CRANE_MARGIN_M` de folga
  em volta, girado pelo rumo (`heading_deg`). O retângulo não é centrado no eixo de giro: o chassi
  avança mais para a frente (+Z) do que para trás;
- carga na coleta: a caixa da carga (largura em X local, comprimento em Z local) mais 1,5 m de
  folga em volta;
- entrega: círculo com o raio da entrega mais 1 m.

Exceções: um veículo-plataforma (carreta) pode ficar sobre a entrega, porque a carga é entregue em
cima dele; e o barracão aberto, de onde a carga sai, pode cobrir a coleta e a entrega. Nenhum dos
dois pode invadir o guindaste.

Convenção dos giros (a mesma do editor 3D e da cena): rotação em torno de Y; no referencial do
objeto, a largura fica em X local e o comprimento (a profundidade) em Z local, com a frente do
guindaste em +Z, como a cena desenha a carga (`GroundCargo`: `BoxGeometry(largura, altura,
comprimento)`; `CargoOperation`: `depthM = lengthM`). O ponto local `(lx, lz)` vai para
`(x + lx*cos + lz*sin, z - lx*sin + lz*cos)`.
"""

import math
from dataclasses import dataclass, replace

from app.domain.entities.scenario import ObstacleSpec, ScenarioSpec
from app.domain.services.planning.crane_body import (
    BODY_MAX_X_M,
    BODY_MAX_Z_M,
    BODY_MIN_X_M,
    BODY_MIN_Z_M,
)
from app.domain.services.planning.library_boxes import LOAD_SUPPORTS

CRANE_MARGIN_M = 1.0
"""FICTÍCIO (ADR-012): folga em volta do corpo do guindaste, para um objeto não encostar nele."""
CARGO_MARGIN_M = 1.5
DELIVERY_MARGIN_M = 1.0
STEP_M = 0.5
MAX_DISPLACEMENT_M = 60.0

PLATFORM_MODEL_IDS = frozenset(LOAD_SUPPORTS)
"""Objetos da biblioteca que recebem a carga por cima (ADR-052): caminhão plataforma, carreta
prancha
e contêineres. O nome ficou da TASK-102."""
ANCHORED_MODEL_IDS = frozenset({"barracao-aberto"})

_EPSILON = 1e-9

# Como a frase das suposições chama o que estava no caminho.
_CRANE = "o guindaste"
_CARGO = "a carga na coleta"
_DELIVERY = "o ponto de entrega"
_OTHER_CRANE = "outro guindaste"
_OBSTACLE = "outro objeto"

Point = tuple[float, float]


@dataclass(frozen=True, slots=True)
class _Rect:
    cx: float
    cz: float
    half_x: float
    half_z: float
    rotation_deg: float

    def corners(self) -> tuple[Point, ...]:
        angle = math.radians(self.rotation_deg)
        cos, sin = math.cos(angle), math.sin(angle)
        points: list[Point] = []
        for lx, lz in (
            (-self.half_x, -self.half_z),
            (self.half_x, -self.half_z),
            (self.half_x, self.half_z),
            (-self.half_x, self.half_z),
        ):
            points.append((self.cx + lx * cos + lz * sin, self.cz - lx * sin + lz * cos))
        return tuple(points)

    def moved_to(self, cx: float, cz: float) -> _Rect:
        return replace(self, cx=cx, cz=cz)


@dataclass(frozen=True, slots=True)
class _Circle:
    cx: float
    cz: float
    radius: float


_Shape = _Rect | _Circle


@dataclass(frozen=True, slots=True)
class _Zone:
    shape: _Shape
    reason: str


@dataclass(frozen=True, slots=True)
class ObstacleMove:
    """Um obstáculo que saiu do lugar, com a frase pronta para as suposições do rascunho."""

    obstacle_id: str
    label: str
    from_xz: Point
    to_xz: Point
    reason: str

    def describe(self) -> str:
        return (
            f"{self.label} movido de ({_fmt(self.from_xz[0])}; {_fmt(self.from_xz[1])}) "
            f"para ({_fmt(self.to_xz[0])}; {_fmt(self.to_xz[1])}) "
            f"para não ficar sobre {self.reason}."
        )


@dataclass(frozen=True, slots=True)
class ScenarioLayout:
    spec: ScenarioSpec
    moves: tuple[ObstacleMove, ...]


def is_platform_vehicle(obstacle: ObstacleSpec) -> bool:
    """Objeto da biblioteca com superfície de apoio (caminhão plataforma, carreta prancha,
    contêiner):
    a carga pode ser entregue em cima dele (ADR-049 e ADR-052; o planejador e a cena só apoiam a
    carga neles). Uma caixa chamada "carreta" é obstáculo comum."""
    return obstacle.model_id in PLATFORM_MODEL_IDS


def make_scenario_layout_safe(
    spec: ScenarioSpec, *, load_length_m: float, load_width_m: float
) -> ScenarioLayout:
    """O cenário com os obstáculos fora das zonas reservadas e a lista do que foi movido."""
    crane_zones = [_crane_zone(spec.crane.x, spec.crane.z, spec.crane.heading_deg, _CRANE)]
    crane_zones += [
        _crane_zone(c.placement.x, c.placement.z, c.placement.heading_deg, _OTHER_CRANE)
        for c in spec.cranes
    ]
    cargo_zones: list[_Zone] = []
    if spec.cargo is not None:
        # Largura em X local e comprimento em Z local, como a cena desenha a carga no chão.
        cargo_box = _Rect(
            spec.cargo.x,
            spec.cargo.z,
            load_width_m / 2 + CARGO_MARGIN_M,
            load_length_m / 2 + CARGO_MARGIN_M,
            spec.cargo.rotation_y_deg,
        )
        cargo_zones.append(_Zone(cargo_box, _CARGO))
    delivery_zones: list[_Zone] = []
    if spec.delivery is not None:
        radius = spec.delivery.radius_m + DELIVERY_MARGIN_M
        delivery_zones.append(_Zone(_Circle(spec.delivery.x, spec.delivery.z, radius), _DELIVERY))

    obstacles = list(spec.obstacles)
    # Objetos ancorados (barracão) não saem do lugar por causa de outros objetos: entram primeiro.
    order = sorted(range(len(obstacles)), key=lambda i: 0 if _is_anchored(obstacles[i]) else 1)
    placed: list[_Zone] = []
    result: dict[int, ObstacleSpec] = {}
    moves: dict[int, ObstacleMove] = {}
    for index in order:
        obstacle = obstacles[index]
        zones = list(crane_zones)
        if not _is_anchored(obstacle):
            # Um apoio (caminhão plataforma, carreta prancha, contêiner; ADR-052) pode ficar sob a
            # carga na coleta e sob o ponto de entrega: é onde ela repousa. Os outros objetos saem.
            if not is_platform_vehicle(obstacle):
                zones += cargo_zones + delivery_zones
            zones += placed
        rect = _footprint(obstacle)
        reason = _blocking_reason(rect, zones)
        if reason is not None:
            moved = _find_free_spot(rect, zones)
            if moved is not None:
                obstacle = replace(obstacle, center_x=moved[0], center_z=moved[1])
                moves[index] = ObstacleMove(
                    obstacle.id, obstacle.label, (rect.cx, rect.cz), moved, reason
                )
        result[index] = obstacle
        placed.append(_Zone(_footprint(obstacle), _OBSTACLE))

    if not moves:
        return ScenarioLayout(spec, ())
    new_spec = replace(spec, obstacles=tuple(result[i] for i in range(len(obstacles))))
    return ScenarioLayout(new_spec, tuple(moves[i] for i in sorted(moves)))


# --- geometria ------------------------------------------------------------------------------------


def _crane_zone(x: float, z: float, heading_deg: float, reason: str) -> _Zone:
    """O corpo do guindaste (`crane_body.py`) mais a folga, com o centro no meio do corpo."""
    local_cx = (BODY_MIN_X_M + BODY_MAX_X_M) / 2
    local_cz = (BODY_MIN_Z_M + BODY_MAX_Z_M) / 2
    angle = math.radians(heading_deg)
    cos, sin = math.cos(angle), math.sin(angle)
    rect = _Rect(
        x + local_cx * cos + local_cz * sin,
        z - local_cx * sin + local_cz * cos,
        (BODY_MAX_X_M - BODY_MIN_X_M) / 2 + CRANE_MARGIN_M,
        (BODY_MAX_Z_M - BODY_MIN_Z_M) / 2 + CRANE_MARGIN_M,
        heading_deg,
    )
    return _Zone(rect, reason)


def _is_anchored(obstacle: ObstacleSpec) -> bool:
    return obstacle.model_id in ANCHORED_MODEL_IDS


def _footprint(obstacle: ObstacleSpec) -> _Rect:
    return _Rect(
        obstacle.center_x,
        obstacle.center_z,
        obstacle.width_m / 2,
        obstacle.depth_m / 2,
        obstacle.rotation_y_deg,
    )


def _blocking_reason(rect: _Rect, zones: list[_Zone]) -> str | None:
    for zone in zones:
        if _overlaps(rect, zone.shape):
            return zone.reason
    return None


def _find_free_spot(rect: _Rect, zones: list[_Zone]) -> Point | None:
    """O centro livre mais próximo, na direção radial da zona invadida; `None` se não há."""
    blocking = next((zone for zone in zones if _overlaps(rect, zone.shape)), None)
    if blocking is None:
        return (rect.cx, rect.cz)
    dx, dz = rect.cx - blocking.shape.cx, rect.cz - blocking.shape.cz
    norm = math.hypot(dx, dz)
    ux, uz = (1.0, 0.0) if norm < _EPSILON else (dx / norm, dz / norm)
    for step in range(1, int(MAX_DISPLACEMENT_M / STEP_M) + 1):
        candidate = rect.moved_to(rect.cx + ux * step * STEP_M, rect.cz + uz * step * STEP_M)
        if not any(_overlaps(candidate, zone.shape) for zone in zones):
            return (candidate.cx, candidate.cz)
    return None


def _overlaps(rect: _Rect, shape: _Shape) -> bool:
    if isinstance(shape, _Circle):
        return _rect_circle_overlap(rect, shape)
    return _rects_overlap(rect, shape)


def _axes(corners: tuple[Point, ...]) -> list[Point]:
    axes: list[Point] = []
    for i in range(2):
        ex = corners[i + 1][0] - corners[i][0]
        ez = corners[i + 1][1] - corners[i][1]
        length = math.hypot(ex, ez) or 1.0
        axes.append((-ez / length, ex / length))
    return axes


def _project(corners: tuple[Point, ...], axis: Point) -> tuple[float, float]:
    values = [x * axis[0] + z * axis[1] for x, z in corners]
    return min(values), max(values)


def _rects_overlap(a: _Rect, b: _Rect) -> bool:
    """Teste do eixo separador; só encostar na borda não conta como sobreposição."""
    corners_a, corners_b = a.corners(), b.corners()
    for axis in (*_axes(corners_a), *_axes(corners_b)):
        min_a, max_a = _project(corners_a, axis)
        min_b, max_b = _project(corners_b, axis)
        if max_a <= min_b + _EPSILON or max_b <= min_a + _EPSILON:
            return False
    return True


def _rect_circle_overlap(rect: _Rect, circle: _Circle) -> bool:
    angle = math.radians(rect.rotation_deg)
    cos, sin = math.cos(angle), math.sin(angle)
    dx, dz = circle.cx - rect.cx, circle.cz - rect.cz
    # Centro do círculo no referencial do retângulo (inverso do giro de `_Rect.corners`).
    local_x = dx * cos - dz * sin
    local_z = dx * sin + dz * cos
    nearest_x = max(-rect.half_x, min(rect.half_x, local_x))
    nearest_z = max(-rect.half_z, min(rect.half_z, local_z))
    return math.hypot(local_x - nearest_x, local_z - nearest_z) < circle.radius - _EPSILON


def _fmt(value: float) -> str:
    text = f"{round(value, 1):.1f}".replace(".", ",")
    return text[:-2] if text.endswith(",0") else text
