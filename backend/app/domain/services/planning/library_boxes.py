"""Caixas de colisão dos objetos OCOS da biblioteca do editor, para o planejador (TASK-088).

A cena trata o "barracão aberto" como casca em arco com a frente aberta (`hangarBoxes` em
`frontend/src/domain/environment/objectLibrary.ts`), e a carga entra pela porta. O planejador usa as
MESMAS caixas: cada uma vira uma parte (`ObstacleSpec` com o id e o nome do objeto e `elevation_m`),
na mesma escala por eixo (tamanho do obstáculo ÷ `baseSize`), girada com o objeto em torno do centro
da planta. Os números espelham o frontend; `tests/domain/services/planning/test_library_boxes.py`
fixa o resultado. Um `model_id` sem caixas aqui continua sendo o prisma cheio.

**Superfícies de apoio (TASK-108; ADR-052).** Todo objeto da biblioteca que declara `loadBed` no
frontend (`objectLibrary.ts`) recebe carga por cima: o caminhão plataforma, a carreta prancha e os
contêineres. `LOAD_SUPPORTS` é o espelho dessa tabela, e
`tests/fixtures/support_surfaces.golden.json`
é o dourado que os dois lados conferem (paridade).
"""

import math
from collections.abc import Sequence
from dataclasses import dataclass, replace
from functools import lru_cache

from app.domain.entities.scenario import ObstacleKind, ObstacleSpec, ScenarioSpec, TerrainSpec
from app.domain.services.planning.terrain import terrain_height_at

HANGAR_MODEL_ID = "barracao-aberto"
HANGAR_BASE_SIZE = (19.22, 27.44, 8.27)
"""`HANGAR_SIZE` do frontend: largura (x), profundidade (z) e altura (y) do modelo, em metros."""
_HANGAR_RADIUS = 8.2
_HANGAR_SHELL = 0.3
_HANGAR_LENGTH = 23.52
_HANGAR_STRIPS = 10
_HANGAR_BACK_STRIPS = 5

PLATFORM_TRUCK_MODEL_ID = "caminhao-plataforma"
_TRUCK_FLAT_HEIGHT = 3.51
_TRUCK_FLAT_BED = 0.53

type Box = tuple[float, float, float, float, float, float]
"""Caixa no referencial do objeto: x e z do centro, y da base, largura, profundidade e altura."""


_PART_SEPARATOR = "#"


def owner_id(obstacle: ObstacleSpec) -> str:
    """Id do obstáculo do cenário a que a parte pertence (o próprio id, se não é uma parte)."""
    if obstacle.elevation_m is None:
        return obstacle.id
    return obstacle.id.rpartition(_PART_SEPARATOR)[0]


def _round2(value: float) -> float:
    """`Math.round(v * 100) / 100` do JavaScript (meio para cima)."""
    return math.floor(value * 100 + 0.5) / 100


def _arch_edges(count: int) -> list[float]:
    return [_round2(_HANGAR_RADIUS * math.sin((i / count) * math.pi / 2)) for i in range(count + 1)]


def hangar_boxes() -> tuple[Box, ...]:
    """Espelho de `hangarBoxes()` do frontend (casca em arco, fundo fechado, frente em +Z)."""
    radius, shell, length = _HANGAR_RADIUS, _HANGAR_SHELL, _HANGAR_LENGTH
    inner = radius - shell

    def outer_at(x: float) -> float:
        return math.sqrt(max(0.0, radius * radius - x * x))

    def inner_at(x: float) -> float:
        return 0.0 if x >= inner else math.sqrt(inner * inner - x * x)

    boxes: list[Box] = []
    edges = _arch_edges(_HANGAR_STRIPS)
    for i in range(_HANGAR_STRIPS):
        near, far = edges[i], edges[i + 1]
        bottom = _round2(inner_at(far))
        top = _round2(outer_at((near + far) / 2))
        for side in (-1, 1):
            boxes.append(
                (
                    _round2(side * (near + far) / 2),
                    0.0,
                    bottom,
                    _round2(far - near),
                    length,
                    _round2(top - bottom),
                )
            )
    back_edges = _arch_edges(_HANGAR_BACK_STRIPS)
    for i in range(_HANGAR_BACK_STRIPS):
        near, far = back_edges[i], back_edges[i + 1]
        for side in (-1, 1):
            boxes.append(
                (
                    _round2(side * (near + far) / 2),
                    _round2(-length / 2 + shell / 2),
                    0.0,
                    _round2(far - near),
                    shell,
                    _round2(outer_at((near + far) / 2)),
                )
            )
    return tuple(boxes)


_HANGAR_BOXES = hangar_boxes()


def platform_truck_bed_ratio() -> float:
    """Altura da carroceria do caminhão plataforma em fração da altura do objeto: o primeiro
    trecho de `caminhao-plataforma` no frontend (0,53 · 3,51 m, arredondado) sobre 3,51 m."""
    return _round2(_TRUCK_FLAT_HEIGHT * _TRUCK_FLAT_BED) / _TRUCK_FLAT_HEIGHT


_TRUCK_FLAT_SIZE = (4.05, 7.41, _TRUCK_FLAT_HEIGHT)
"""`TRUCK_FLAT` do frontend: largura (x), profundidade (z) e altura (y) do modelo, em metros."""


_TRUCK_FLAT_SECTIONS = (
    (0.0, 0.5, 0.53, 1.0),
    (0.5, 0.8, 1.0, 0.9),
    (0.8, 1.0, 0.62, 1.0),
)
"""Trechos do caminhão plataforma, de trás (-Z) para a frente: de, até (fração do comprimento),
altura e largura (fração do tamanho); `TRUCK_FLAT_COLLISION` do frontend. O 1º é a carroceria."""


def platform_truck_boxes() -> tuple[Box, ...]:
    """Espelho de `vehicle(TRUCK_FLAT, ...)` do frontend: as caixas por trecho do caminhão
    plataforma (x, z, y, largura, profundidade, altura), a carroceria primeiro."""
    width, depth, height = _TRUCK_FLAT_SIZE
    return tuple(
        (
            0.0,
            _round2(depth * ((start + end) / 2 - 0.5)),
            0.0,
            _round2(width * width_share),
            _round2(depth * (end - start)),
            _round2(height * height_share),
        )
        for start, end, height_share, width_share in _TRUCK_FLAT_SECTIONS
    )


def platform_truck_bed() -> Box:
    """Espelho de `loadBed` do caminhão plataforma (`TRUCK_FLAT_COLLISION[0]` do frontend): a
    carroceria, o trecho traseiro de 0 a 0,5 do comprimento, na largura toda e a 0,53 da altura."""
    return platform_truck_boxes()[0]


type Size = tuple[float, float, float]

NO_CAPACITY_SOURCE = (
    "FICTÍCIO: sem dado de capacidade para carga apoiada neste objeto; "
    "o peso apoiado não é conferido"
)
"""Rótulo de um apoio sem capacidade conhecida (`capacity_kg=None`): o planejador não limita o peso,
e o plano diz que o apoio é FICTÍCIO."""


@dataclass(frozen=True, slots=True)
class SupportSpec:
    """Superfície de apoio declarada de um objeto da biblioteca (`loadBed` no frontend)."""

    model_id: str
    label: str
    base_size: Size
    """Tamanho do modelo (`baseSize` do frontend): a escala por eixo é o tamanho do obstáculo ÷
    ele."""
    boxes: tuple[Box, ...]
    """Caixas de colisão do objeto (`collision`), no referencial dele."""
    bed: Box
    """A superfície de apoio (`loadBed`): o topo dela (`y + altura`) é onde a carga repousa."""
    capacity_kg: float | None = None
    """Capacidade de carga apoiada (kg), SE houver dado. `None` = sem dado: o peso não é
    limitado e o
    apoio é rotulado FICTÍCIO (`capacity_source`)."""
    capacity_source: str = NO_CAPACITY_SOURCE

    @property
    def top_ratio(self) -> float:
        """Altura do topo do apoio em fração da altura do objeto."""
        return (self.bed[2] + self.bed[5]) / self.base_size[2]

    @property
    def fictitious(self) -> bool:
        return self.capacity_kg is None


def _solid_box(size: Size) -> Box:
    """`solid(size)` do frontend: uma caixa que cobre a planta e a altura toda."""
    return (0.0, 0.0, 0.0, _round2(size[0]), _round2(size[1]), size[2])


CONTAINER_BASE_SIZE: Size = (2.72, 6.0, 2.54)
"""`CONTAINER` do frontend: o GLB do contêiner (Kenney); os de 20 e 40 pés o esticam até o
tamanho ISO."""
FLATBED_TRAILER_MODEL_ID = "carreta-prancha"
FLATBED_TRAILER_BASE_SIZE: Size = (2.6, 13.0, 1.5)
"""`FLATBED_TRAILER` do frontend: carreta prancha de 3 eixos, convés a 1,5 m do chão (medidas
típicas,
FICTÍCIAS: não são de um fabricante; o GLB é gerado por `scripts/build-carreta-prancha.mjs`)."""

_PLATFORM_TRUCK_SPEC = SupportSpec(
    PLATFORM_TRUCK_MODEL_ID,
    "caminhão plataforma",
    _TRUCK_FLAT_SIZE,
    platform_truck_boxes(),
    platform_truck_boxes()[0],
)

LOAD_SUPPORTS: dict[str, SupportSpec] = {
    spec.model_id: spec
    for spec in (
        _PLATFORM_TRUCK_SPEC,
        SupportSpec(
            FLATBED_TRAILER_MODEL_ID,
            "carreta prancha",
            FLATBED_TRAILER_BASE_SIZE,
            (_solid_box(FLATBED_TRAILER_BASE_SIZE),),
            _solid_box(FLATBED_TRAILER_BASE_SIZE),
        ),
        *(
            SupportSpec(
                model_id,
                label,
                CONTAINER_BASE_SIZE,
                (_solid_box(CONTAINER_BASE_SIZE),),
                _solid_box(CONTAINER_BASE_SIZE),
            )
            for model_id, label in (
                ("conteiner", "contêiner"),
                ("conteiner-20", "contêiner de 20 pés"),
                ("conteiner-40", "contêiner de 40 pés"),
                ("conteiner-40hc", "contêiner de 40 pés high cube"),
            )
        ),
    )
}
"""Objetos da biblioteca que recebem a carga por cima, por `model_id`; espelho de `loadBed` em
`objectLibrary.ts` (ADR-052). Só quem está aqui é apoio: uma caixa chamada "carreta" não é."""


def support_of(obstacle: ObstacleSpec) -> SupportSpec | None:
    """A superfície de apoio do obstáculo (objeto da biblioteca que a declara), ou `None`."""
    if obstacle.kind is not ObstacleKind.MODEL or obstacle.model_id is None:
        return None
    return LOAD_SUPPORTS.get(obstacle.model_id)


def is_load_support(obstacle: ObstacleSpec) -> bool:
    return support_of(obstacle) is not None


def support_top_ratio(obstacle: ObstacleSpec) -> float:
    """Altura do topo do apoio em fração da altura do objeto (0 se o objeto não é apoio)."""
    spec = support_of(obstacle)
    return 0.0 if spec is None else spec.top_ratio


def bed_contains(obstacle: ObstacleSpec, x: float, z: float) -> bool:
    """O ponto (x, z) do plano cai dentro da superfície de apoio de `obstacle` (o retângulo dela,
    na escala e no giro do objeto)? Critério de apoio da carga: o centro da pegada dela; igual ao do
    frontend (`loadBeds.ts`). `False` para quem não é apoio."""
    spec = support_of(obstacle)
    if spec is None:
        return False
    bed_x, bed_z, _, bed_w, bed_d, _ = spec.bed
    base_w, base_d, _ = spec.base_size
    sx = obstacle.width_m / base_w
    sz = obstacle.depth_m / base_d
    angle = math.radians(obstacle.rotation_y_deg)
    dx = x - obstacle.center_x
    dz = z - obstacle.center_z
    # Inverso de rotY(ângulo): leva o ponto ao referencial do objeto.
    local_x = dx * math.cos(angle) - dz * math.sin(angle)
    local_z = dx * math.sin(angle) + dz * math.cos(angle)
    return (
        abs(local_x - bed_x * sx) <= bed_w * sx / 2 + 1e-9
        and abs(local_z - bed_z * sz) <= bed_d * sz / 2 + 1e-9
    )


def is_platform_truck(obstacle: ObstacleSpec) -> bool:
    return obstacle.kind is ObstacleKind.MODEL and obstacle.model_id == PLATFORM_TRUCK_MODEL_ID


def _box_parts(
    obstacle: ObstacleSpec,
    terrain: TerrainSpec,
    boxes: Sequence[Box],
    base_size: tuple[float, float, float],
) -> tuple[ObstacleSpec, ...]:
    """Cada caixa do objeto como uma parte: na escala por eixo (tamanho do obstáculo ÷ `base_size`),
    girada com o objeto em torno do centro da planta, com a base na altura do terreno no centro."""
    base_w, base_d, base_h = base_size
    sx = obstacle.width_m / base_w
    sz = obstacle.depth_m / base_d
    sy = obstacle.height_m / base_h
    angle = math.radians(obstacle.rotation_y_deg)
    cos, sin = math.cos(angle), math.sin(angle)
    ground = terrain_height_at(terrain, obstacle.center_x, obstacle.center_z)
    parts: list[ObstacleSpec] = []
    for index, (x, z, y, w, d, h) in enumerate(boxes):
        lx, lz = x * sx, z * sz
        # rotY(ângulo): do referencial do objeto ao mundo (inverso de `distance_to_obstacle_m`).
        center_x = obstacle.center_x + lx * cos + lz * sin
        center_z = obstacle.center_z - lx * sin + lz * cos
        parts.append(
            replace(
                obstacle,
                id=f"{obstacle.id}{_PART_SEPARATOR}{index}",
                kind=ObstacleKind.BOX,
                model_id=None,
                center_x=center_x,
                center_z=center_z,
                width_m=w * sx,
                depth_m=d * sz,
                height_m=h * sy,
                elevation_m=ground + y * sy - terrain_height_at(terrain, center_x, center_z),
            )
        )
    return tuple(parts)


def _parts(obstacle: ObstacleSpec, terrain: TerrainSpec) -> tuple[ObstacleSpec, ...]:
    return _box_parts(obstacle, terrain, _HANGAR_BOXES, HANGAR_BASE_SIZE)


def _higher_parts(obstacle: ObstacleSpec, terrain: TerrainSpec) -> tuple[ObstacleSpec, ...]:
    """As caixas do apoio mais altas que a superfície de apoio (a cabine e a frente do caminhão
    plataforma; nenhuma no contêiner nem na prancha), como caixas no mundo: a carga apoiada não pode
    invadi-las."""
    spec = support_of(obstacle)
    if spec is None:
        return ()
    bed_top = spec.bed[2] + spec.bed[5]
    higher = tuple(
        box for box in spec.boxes if box != spec.bed and box[2] + box[5] > bed_top + 1e-9
    )
    return _box_parts(obstacle, terrain, higher, spec.base_size) if higher else ()


def _cab_parts(obstacle: ObstacleSpec, terrain: TerrainSpec) -> tuple[ObstacleSpec, ...]:
    """Compatibilidade (TASK-102): as partes mais altas que a carroceria do caminhão plataforma."""
    return _higher_parts(obstacle, terrain)


_cached_parts = lru_cache(maxsize=256)(_parts)
support_higher_parts = lru_cache(maxsize=256)(_higher_parts)
platform_truck_cab_parts = support_higher_parts


def is_hollow(obstacle: ObstacleSpec) -> bool:
    return obstacle.kind is ObstacleKind.MODEL and obstacle.model_id == HANGAR_MODEL_ID


def expand_obstacles(scenario: ScenarioSpec) -> tuple[ObstacleSpec, ...]:
    """Obstáculos do cenário com os objetos ocos trocados pelas caixas deles (as demais partes têm
    o id e o nome do objeto). Idempotente: as partes já são caixas."""
    if not any(is_hollow(obstacle) for obstacle in scenario.obstacles):
        return scenario.obstacles
    expanded: list[ObstacleSpec] = []
    for obstacle in scenario.obstacles:
        if is_hollow(obstacle):
            expanded.extend(_cached_parts(obstacle, scenario.terrain))
        else:
            expanded.append(obstacle)
    return tuple(expanded)
