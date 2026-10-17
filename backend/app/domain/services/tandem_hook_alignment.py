"""Gancho sobre o ponto de içamento no tandem (TASK-090; RN-016; ADR-037).

Serviço puro, sem E/S. No tandem, cada cabo tem de descer a prumo sobre o ponto de içamento dele:
com o gancho ao lado do ponto, o cabo puxa a carga de lado, e a divisão pela alavanca (RN-016),
calculada com os pontos, deixa de valer.

O gancho G vem da geometria do ADR-013 no referencial do guindaste (origem no eixo de giro,
`x = R·sin ψ`, `z = R·cos ψ`) e vai ao mundo pela posição do eixo de giro e pelo rumo do chassi. O
rumo gira em torno de Y como o `rotation.y` do Three.js (a frente +Z do chassi vai para +X com rumo
de +90°), a mesma conta de `localToWorld` em `frontend/src/domain/tandem/tandem.ts`.
"""

import math

from app.domain.entities.scenario import CranePlacementSpec
from app.domain.value_objects.operational_geometry import Point3D

TANDEM_HOOK_POINT_TOLERANCE_M = 0.5
"""FICTÍCIO (ADR-012): maior distância horizontal (m) entre o gancho e o ponto de içamento para o
cabo contar como a prumo. Não vem de norma nem de fabricante; a pessoa responsável pode trocar."""


def crane_point_to_world(
    placement: CranePlacementSpec, local_x_m: float, local_z_m: float
) -> tuple[float, float]:
    """Ponto (x, z) do referencial do guindaste em `placement` no plano do mundo."""
    heading = math.radians(placement.heading_deg)
    cos = math.cos(heading)
    sin = math.sin(heading)
    return (
        placement.x + local_x_m * cos + local_z_m * sin,
        placement.z - local_x_m * sin + local_z_m * cos,
    )


def hook_distance_to_point_m(
    placement: CranePlacementSpec, hook: Point3D, point: tuple[float, float]
) -> float:
    """Distância horizontal (m) do gancho `hook` (referencial do guindaste) a `point` (mundo)."""
    x, z = crane_point_to_world(placement, hook.x_m, hook.z_m)
    return math.hypot(x - point[0], z - point[1])
