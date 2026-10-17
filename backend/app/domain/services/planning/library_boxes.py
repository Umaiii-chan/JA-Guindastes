"""Caixas de colisão dos objetos OCOS da biblioteca do editor, para o planejador (TASK-088).

A cena trata o "barracão aberto" como casca em arco com a frente aberta (`hangarBoxes` em
`frontend/src/domain/environment/objectLibrary.ts`), e a carga entra pela porta. O planejador usa as
MESMAS caixas: cada uma vira uma parte (`ObstacleSpec` com o id e o nome do objeto e `elevation_m`),
na mesma escala por eixo (tamanho do obstáculo ÷ `baseSize`), girada com o objeto em torno do centro
da planta. Os números espelham o frontend; `tests/domain/services/planning/test_library_boxes.py`
fixa o resultado. Um `model_id` sem caixas aqui continua sendo o prisma cheio.
"""

import math
from dataclasses import replace
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


def _parts(obstacle: ObstacleSpec, terrain: TerrainSpec) -> tuple[ObstacleSpec, ...]:
    base_w, base_d, base_h = HANGAR_BASE_SIZE
    sx = obstacle.width_m / base_w
    sz = obstacle.depth_m / base_d
    sy = obstacle.height_m / base_h
    angle = math.radians(obstacle.rotation_y_deg)
    cos, sin = math.cos(angle), math.sin(angle)
    ground = terrain_height_at(terrain, obstacle.center_x, obstacle.center_z)
    parts: list[ObstacleSpec] = []
    for index, (x, z, y, w, d, h) in enumerate(_HANGAR_BOXES):
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


_cached_parts = lru_cache(maxsize=256)(_parts)


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
