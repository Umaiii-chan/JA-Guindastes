"""Corpo do guindaste no plano, para o planejamento não passar a carga por dentro dele (TASK-075).

Medidas do modelo 3D ilustrativo do guindaste 80 t (`frontend/public/models/guindaste-80t.glb`, nó
`crane-base` sem a torre, patolas estendidas; a torre sobe a 4,57 m): em relação ao eixo de giro, X
de -3,10 a 3,10 m, Z de -5,13 m (traseira) a 9,22 m (cabine, frente do chassi) e altura de até
4,6 m. São medidas do desenho FICTÍCIO (ADR-012), as mesmas caixas com que a cena confere colisões;
com um modelo 3D real, elas passam a vir da ficha técnica.
"""

import math

from app.domain.entities.scenario import CranePlacementSpec, ObstacleSpec
from app.domain.services.planning.scene import distance_to_obstacle_m

BODY_MIN_X_M = -3.10
BODY_MAX_X_M = 3.10
BODY_MIN_Z_M = -5.13
BODY_MAX_Z_M = 9.22
BODY_HEIGHT_M = 4.6

_DEG = math.pi / 180.0
_SAMPLE_STEP_M = 1.0


def distance_to_crane_body_m(placement: CranePlacementSpec, x: float, z: float) -> float:
    """Distância do ponto (mundo) ao contorno do corpo do guindaste no plano (0 dentro dele)."""
    heading = placement.heading_deg * _DEG
    dx = x - placement.x
    dz = z - placement.z
    # Inverso de rotY(heading): leva o ponto ao referencial do chassi (+Z para a frente).
    local_x = dx * math.cos(heading) - dz * math.sin(heading)
    local_z = dx * math.sin(heading) + dz * math.cos(heading)
    outside_x = max(BODY_MIN_X_M - local_x, 0.0, local_x - BODY_MAX_X_M)
    outside_z = max(BODY_MIN_Z_M - local_z, 0.0, local_z - BODY_MAX_Z_M)
    return math.hypot(outside_x, outside_z)


def _body_samples(placement: CranePlacementSpec) -> list[tuple[float, float]]:
    heading = placement.heading_deg * _DEG
    cos = math.cos(heading)
    sin = math.sin(heading)
    samples: list[tuple[float, float]] = []
    steps_x = round((BODY_MAX_X_M - BODY_MIN_X_M) / _SAMPLE_STEP_M)
    steps_z = round((BODY_MAX_Z_M - BODY_MIN_Z_M) / _SAMPLE_STEP_M)
    for i in range(steps_x + 1):
        local_x = BODY_MIN_X_M + (BODY_MAX_X_M - BODY_MIN_X_M) * i / steps_x
        for j in range(steps_z + 1):
            local_z = BODY_MIN_Z_M + (BODY_MAX_Z_M - BODY_MIN_Z_M) * j / steps_z
            samples.append(
                (
                    placement.x + local_x * cos + local_z * sin,
                    placement.z - local_x * sin + local_z * cos,
                )
            )
    return samples


def crane_body_overlaps_obstacle(placement: CranePlacementSpec, obstacle: ObstacleSpec) -> bool:
    """O corpo do guindaste (em planta) encosta no obstáculo? Amostra o corpo a cada metro e confere
    também o centro do obstáculo, para um obstáculo pequeno dentro do corpo não escapar."""
    if distance_to_crane_body_m(placement, obstacle.center_x, obstacle.center_z) == 0.0:
        return True
    return any(distance_to_obstacle_m(obstacle, x, z) == 0.0 for x, z in _body_samples(placement))
