"""Geometria da cena no plano (obstáculos, ângulos) para o planejamento (TASK-075).

Convenções do ADR-013: eixo Y para cima; o giro ψ é medido a partir de +Z do chassi, com a
direção da lança `(sin ψ, cos ψ)` em (X, Z), positivo no sentido anti-horário visto de cima. O rumo
do chassi (`heading_deg`) gira a cena como `rotation.y`; então o azimute no mundo é `heading + ψ`.
"""

import math
from collections.abc import Sequence

from app.domain.entities.scenario import ObstacleKind, ObstacleSpec, TerrainSpec
from app.domain.services.planning.terrain import terrain_height_at

_DEG = math.pi / 180.0


def wrap_180(angle_deg: float) -> float:
    """Ângulo equivalente em (-180, 180]."""
    wrapped = (angle_deg + 180.0) % 360.0 - 180.0
    return 180.0 if wrapped == -180.0 else wrapped


def wrap_360(angle_deg: float) -> float:
    return angle_deg % 360.0


def azimuth_deg(dx: float, dz: float) -> float:
    """Azimute da direção `(sin a, cos a)`, em graus."""
    return math.atan2(dx, dz) / _DEG


def direction(azimuth: float) -> tuple[float, float]:
    """Vetor unitário (X, Z) do azimute."""
    return math.sin(azimuth * _DEG), math.cos(azimuth * _DEG)


def obstacle_circumradius_m(obstacle: ObstacleSpec) -> float:
    """Raio do menor círculo, centrado no obstáculo, que o envolve."""
    if obstacle.kind is ObstacleKind.CYLINDER:
        return obstacle.width_m / 2
    return math.hypot(obstacle.width_m, obstacle.depth_m) / 2


def obstacle_top_y(terrain: TerrainSpec, obstacle: ObstacleSpec) -> float:
    """Topo do obstáculo (m): base na altura do terreno no centro, mais a altura."""
    ground = terrain_height_at(terrain, obstacle.center_x, obstacle.center_z)
    return ground + (obstacle.elevation_m or 0.0) + obstacle.height_m


def distance_to_obstacle_m(obstacle: ObstacleSpec, x: float, z: float) -> float:
    """Distância do ponto ao contorno do obstáculo no plano (0 dentro dele)."""
    dx = x - obstacle.center_x
    dz = z - obstacle.center_z
    if obstacle.kind is ObstacleKind.CYLINDER:
        return max(0.0, math.hypot(dx, dz) - obstacle.width_m / 2)
    angle = obstacle.rotation_y_deg * _DEG
    cos = math.cos(angle)
    sin = math.sin(angle)
    # Inverso de rotY(angle): leva o ponto ao referencial do obstáculo.
    local_x = dx * cos - dz * sin
    local_z = dx * sin + dz * cos
    outside_x = max(0.0, abs(local_x) - obstacle.width_m / 2)
    outside_z = max(0.0, abs(local_z) - obstacle.depth_m / 2)
    return math.hypot(outside_x, outside_z)


def obstacles_near_points(
    obstacles: Sequence[ObstacleSpec], points: Sequence[tuple[float, float]], margin_m: float
) -> tuple[ObstacleSpec, ...]:
    """Obstáculos a no máximo `margin_m` de algum dos pontos, na ordem da lista."""
    return tuple(
        obstacle
        for obstacle in obstacles
        if any(distance_to_obstacle_m(obstacle, x, z) <= margin_m for x, z in points)
    )
