"""Terreno, solo e sapatas em Python (espelho de `frontend/src/domain/environment/environment.ts`,
`craneAttitude.ts` e `scenarioEditing.ts`; TASK-075).

As fórmulas são as mesmas do frontend, para o planejamento e a cena enxergarem o mesmo chão. Os
casos de paridade estão em `tests/domain/services/planning/test_terrain.py`, com valores calculados
pelo código TypeScript. Eixos (ADR-013): Y para cima; X e Z no chão. Metros e graus.
"""

import math
from dataclasses import dataclass

from app.domain.entities.scenario import (
    CranePlacementSpec,
    FeatureKind,
    ScenarioSpec,
    SoilKind,
    TerrainFeatureSpec,
    TerrainSpec,
)

_DEG = math.pi / 180.0
_PLATEAU_TOP = 0.6

SHOE_HALF_LENGTH_M = 3.0
SHOE_HALF_WIDTH_M = 2.5
"""Sapatas FICTÍCIAS (ADR-012): meia distância ao longo do chassi e na transversal."""

DEFAULT_SOIL = SoilKind.COMPACTED
"""Solo fora das zonas pintadas."""


def _cosine_bump(distance: float, radius: float) -> float:
    if radius <= 0 or distance >= radius:
        return 0.0
    return (1 + math.cos(math.pi * distance / radius)) / 2


def _plateau_weight(distance: float, radius: float) -> float:
    top = radius * _PLATEAU_TOP
    if distance <= top:
        return 1.0
    return _cosine_bump(distance - top, radius - top)


def _feature_height(feature: TerrainFeatureSpec, x: float, z: float) -> float:
    dx = x - feature.center_x
    dz = z - feature.center_z
    height = max(0.0, feature.height_m)
    match feature.kind:
        case FeatureKind.MOUND:
            return height * _cosine_bump(math.hypot(dx, dz), feature.radius_m)
        case FeatureKind.PIT:
            return -height * _cosine_bump(math.hypot(dx, dz), feature.radius_m)
        case FeatureKind.PLATEAU:
            return height * _plateau_weight(math.hypot(dx, dz), feature.radius_m)
        case FeatureKind.FLATTEN:
            return 0.0  # tratado em `terrain_height_at` (não é aditivo)
        case FeatureKind.RAMP:
            angle = (feature.direction_deg or 0.0) * _DEG
            along = dx * math.cos(angle) - dz * math.sin(angle)
            across = dx * math.sin(angle) + dz * math.cos(angle)
            half_width = (feature.radius_m if feature.width_m is None else feature.width_m) / 2
            if feature.radius_m <= 0 or abs(along) > feature.radius_m or abs(across) > half_width:
                return 0.0
            return height * (along + feature.radius_m) / (2 * feature.radius_m)
    return 0.0  # pragma: no cover - enum exaustivo


def terrain_height_at(terrain: TerrainSpec, x: float, z: float) -> float:
    """Altura do terreno (m) no ponto (x, z) do chão."""
    height = terrain.slope_x_percent / 100 * x + terrain.slope_z_percent / 100 * z
    for feature in terrain.features:
        if feature.kind is FeatureKind.FLATTEN:
            weight = _plateau_weight(
                math.hypot(x - feature.center_x, z - feature.center_z), feature.radius_m
            )
            height += (feature.height_m - height) * weight
        else:
            height += _feature_height(feature, x, z)
    return height


def cargo_footprint_points(
    length_m: float, width_m: float, x: float, z: float, rotation_y_deg: float
) -> list[tuple[float, float]]:
    """Centro, cantos e meios das arestas da base da carga (como `cargoBaseY` do frontend): a
    largura fica em X local e o comprimento em Z local, girados por `rotation_y_deg`."""
    angle = rotation_y_deg * _DEG
    cos = math.cos(angle)
    sin = math.sin(angle)
    half_x = width_m / 2
    half_z = length_m / 2
    corners = [
        (x + local_x * cos + local_z * sin, z - local_x * sin + local_z * cos)
        for local_x, local_z in (
            (-half_x, -half_z),
            (half_x, -half_z),
            (half_x, half_z),
            (-half_x, half_z),
        )
    ]
    points = [(x, z), *corners]
    for index, (ax, az) in enumerate(corners):
        bx, bz = corners[(index + 1) % len(corners)]
        points.append(((ax + bx) / 2, (az + bz) / 2))
    return points


def cargo_base_y(
    terrain: TerrainSpec, length_m: float, width_m: float, x: float, z: float, rotation_y_deg: float
) -> float:
    """Altura (m) em que a base da carga assenta (`cargoBaseY`): o ponto mais alto do terreno sob a
    pegada (centro, cantos e meios das arestas), para a caixa não entrar no chão."""
    return max(
        terrain_height_at(terrain, px, pz)
        for px, pz in cargo_footprint_points(length_m, width_m, x, z, rotation_y_deg)
    )


def _ramp_frame(feature: TerrainFeatureSpec, x: float, z: float) -> tuple[float, float, float]:
    """(ao longo, através, meia largura) do ponto no referencial da rampa."""
    angle = (feature.direction_deg or 0.0) * _DEG
    dx = x - feature.center_x
    dz = z - feature.center_z
    along = dx * math.cos(angle) - dz * math.sin(angle)
    across = dx * math.sin(angle) + dz * math.cos(angle)
    half_width = (feature.radius_m if feature.width_m is None else feature.width_m) / 2
    return along, across, half_width


def feature_distance_m(feature: TerrainFeatureSpec, x: float, z: float) -> float:
    """Distância (m, no plano) do ponto à região que a feição altera (0 dentro dela); infinita
    para feição sem raio. Muda no máximo 1 m por metro andado (serve para pular amostras)."""
    if feature.radius_m <= 0:
        return math.inf
    if feature.kind is FeatureKind.RAMP:
        along, across, half_width = _ramp_frame(feature, x, z)
        return math.hypot(
            max(0.0, abs(along) - feature.radius_m), max(0.0, abs(across) - half_width)
        )
    return max(0.0, math.hypot(x - feature.center_x, z - feature.center_z) - feature.radius_m)


def feature_peak_near(feature: TerrainFeatureSpec, x: float, z: float, radius_m: float) -> float:
    """Limite superior (m) do quanto a feição sobe o terreno no círculo de raio `radius_m` em volta
    de (x, z). A cava só desce (0) e a nivelação não soma (fica em `terrain_peak_near`)."""
    height = max(0.0, feature.height_m)
    distance = math.hypot(x - feature.center_x, z - feature.center_z)
    nearest = max(0.0, distance - radius_m)
    match feature.kind:
        case FeatureKind.MOUND:
            return height * _cosine_bump(nearest, feature.radius_m)
        case FeatureKind.PLATEAU:
            return height * _plateau_weight(nearest, feature.radius_m)
        case FeatureKind.RAMP:
            if feature.radius_m <= 0:
                return 0.0
            along, across, half_width = _ramp_frame(feature, x, z)
            if abs(along) > feature.radius_m + radius_m or abs(across) > half_width + radius_m:
                return 0.0
            farthest = min(feature.radius_m, along + radius_m)
            return height * max(0.0, (farthest + feature.radius_m) / (2 * feature.radius_m))
        case FeatureKind.PIT | FeatureKind.FLATTEN:
            return 0.0
    return 0.0  # pragma: no cover - enum exaustivo


def terrain_plane_peak_near(terrain: TerrainSpec, x: float, z: float, radius_m: float) -> float:
    """Maior altura do plano inclinado (sem as feições) no círculo de raio `radius_m`."""
    gradient = math.hypot(terrain.slope_x_percent, terrain.slope_z_percent) / 100
    plane = terrain.slope_x_percent / 100 * x + terrain.slope_z_percent / 100 * z
    return plane + gradient * radius_m


def terrain_peak_near(terrain: TerrainSpec, x: float, z: float, radius_m: float) -> float:
    """Limite superior (m) da altura do terreno no círculo de raio `radius_m` em volta de (x, z).

    As feições somam ao plano, e a nivelação leva a altura para perto da dela; então o terreno no
    círculo não passa do maior entre o plano e as nivelações que o tocam, mais a soma dos picos das
    outras feições que o tocam."""
    base = terrain_plane_peak_near(terrain, x, z, radius_m)
    added = 0.0
    for feature in terrain.features:
        if feature_distance_m(feature, x, z) > radius_m:
            continue
        if feature.kind is FeatureKind.FLATTEN:
            base = max(base, feature.height_m)
        else:
            added += feature_peak_near(feature, x, z, radius_m)
    return base + added


def terrain_slope_deg_at(terrain: TerrainSpec, x: float, z: float, step_m: float = 0.5) -> float:
    """Inclinação do plano tangente (graus, sem sinal), por diferença central de passo `step_m`."""
    gx = (terrain_height_at(terrain, x + step_m, z) - terrain_height_at(terrain, x - step_m, z)) / (
        2 * step_m
    )
    gz = (terrain_height_at(terrain, x, z + step_m) - terrain_height_at(terrain, x, z - step_m)) / (
        2 * step_m
    )
    return math.atan(math.hypot(gx, gz)) / _DEG


def terrain_slope_under_footprint_deg(
    terrain: TerrainSpec,
    placement: CranePlacementSpec,
    half_length_m: float,
    half_width_m: float,
) -> float:
    """Inclinação média (graus) do plano pelos cantos de uma base retangular."""
    angle = placement.heading_deg * _DEG

    def corner(along: float, across: float) -> float:
        x = placement.x + along * math.cos(angle) + across * math.sin(angle)
        z = placement.z - along * math.sin(angle) + across * math.cos(angle)
        return terrain_height_at(terrain, x, z)

    front_left = corner(half_length_m, -half_width_m)
    front_right = corner(half_length_m, half_width_m)
    rear_left = corner(-half_length_m, -half_width_m)
    rear_right = corner(-half_length_m, half_width_m)
    grad_along = (front_left + front_right - rear_left - rear_right) / 2 / (2 * half_length_m)
    grad_across = (front_right + rear_right - front_left - rear_left) / 2 / (2 * half_width_m)
    return math.atan(math.hypot(grad_along, grad_across)) / _DEG


def ground_slope_under_crane_deg(terrain: TerrainSpec, placement: CranePlacementSpec) -> float:
    """Inclinação sob as sapatas FICTÍCIAS (`groundSlopeUnderCraneDeg`): o eixo "ao longo" do
    cálculo é a frente do chassi quando o rumo do cenário vale `h - 90°` (ADR-023)."""
    footprint = CranePlacementSpec(
        x=placement.x, z=placement.z, heading_deg=placement.heading_deg - 90.0
    )
    return terrain_slope_under_footprint_deg(
        terrain, footprint, SHOE_HALF_LENGTH_M, SHOE_HALF_WIDTH_M
    )


@dataclass(frozen=True, slots=True)
class ShoePoint:
    position: str
    x: float
    z: float
    y: float


def shoe_points(terrain: TerrainSpec, placement: CranePlacementSpec) -> tuple[ShoePoint, ...]:
    """Sapatas no mundo, na ordem dianteira esquerda, dianteira direita, traseira esquerda e
    traseira direita (`shoePoints`; "esquerda" é -X do referencial do guindaste)."""
    heading = placement.heading_deg * _DEG
    cos = math.cos(heading)
    sin = math.sin(heading)

    def corner(position: str, local_x: float, local_z: float) -> ShoePoint:
        x = placement.x + local_x * cos + local_z * sin
        z = placement.z - local_x * sin + local_z * cos
        return ShoePoint(position, x, z, terrain_height_at(terrain, x, z))

    return (
        corner("fl", -SHOE_HALF_WIDTH_M, SHOE_HALF_LENGTH_M),
        corner("fr", SHOE_HALF_WIDTH_M, SHOE_HALF_LENGTH_M),
        corner("rl", -SHOE_HALF_WIDTH_M, -SHOE_HALF_LENGTH_M),
        corner("rr", SHOE_HALF_WIDTH_M, -SHOE_HALF_LENGTH_M),
    )


def soil_at(spec: ScenarioSpec, x: float, z: float) -> SoilKind:
    """Solo no ponto: a zona pintada mais recente que o contém, senão `compacted`."""
    for zone in reversed(spec.soil_zones):
        if math.hypot(x - zone.center_x, z - zone.center_z) <= zone.radius_m:
            return zone.kind
    return DEFAULT_SOIL


def soil_kinds_under_shoes(
    spec: ScenarioSpec, placement: CranePlacementSpec
) -> tuple[SoilKind, ...]:
    """Solo sob as quatro sapatas; vazio sem zonas de solo (como `soilKindsUnderShoes`)."""
    if not spec.soil_zones:
        return ()
    return tuple(soil_at(spec, shoe.x, shoe.z) for shoe in shoe_points(spec.terrain, placement))
