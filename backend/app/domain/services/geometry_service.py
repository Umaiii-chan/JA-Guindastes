"""`GeometryService`: grandezas geométricas a partir do estado operacional (doc-fonte § 14.1).

Implementa as fórmulas do ADR-013 C-5, com as convenções C-1 a C-3 (eixo Y para cima, +Z para a
frente do chassi, graus nas interfaces e radianos só dentro do cálculo):

    (1) alcance horizontal da ponta   R   = a + L·cos θ
    (2) altura da ponta               y_T = h + L·sin θ
    (3) altura do gancho              y_G = y_T − c
    (4) raio de trabalho              working_radius = R
    (5) P = (a·sin ψ, h, a·cos ψ);  T = (R·sin ψ, y_T, R·cos ψ);  G = (R·sin ψ, y_G, R·cos ψ)

Valem as simplificações S-1 a S-8 do ADR-013: sem deflexão, cabo vertical, sem moitão, guindaste
nivelado, lança reta sem jib. Vários itens são A VALIDAR com a empresa (G-1..G-8).

O backend é a fonte de verdade desta geometria (RN-008, ADR-013 C-7): os parâmetros vêm da ficha
técnica (`CraneGeometry`), nunca do GLB (RN-003).
"""

import math

from app.domain.exceptions.geometry_errors import (
    OperationalLimitViolation,
    OperationalStateOutOfLimitsError,
    OutsideGeometricDomainError,
)
from app.domain.value_objects.angle import Angle
from app.domain.value_objects.crane_geometry import CraneGeometry
from app.domain.value_objects.length import Length
from app.domain.value_objects.operational_geometry import OperationalGeometry, Point3D
from app.domain.value_objects.operational_state import OperationalState

_FULL_TURN_DEG = 360.0


def calculate_operational_geometry(
    state: OperationalState, geometry: CraneGeometry
) -> OperationalGeometry:
    """Calcula raio de trabalho, alturas e posições de P, T e G (ADR-013 C-5).

    Levanta, sem corrigir nenhum valor:
    - `OperationalStateOutOfLimitsError` se L, θ, c ou ψ estiverem fora das faixas da ficha
      técnica (limites inclusivos, comparação exata, sem tolerância);
    - `OutsideGeometricDomainError` se a ponta ficar atrás do eixo de giro (R < 0).

    O gancho abaixo do plano de apoio (y_G < 0) não é erro: o ADR-013 não o bloqueia (G-8).
    """
    _require_within_limits(state, geometry)
    working_radius = _working_radius(state, geometry)

    reach_m = _horizontal_reach_m(state, geometry)
    offset_m = geometry.boom_pivot_offset_m
    pivot_height_m = geometry.boom_pivot_height.meters
    boom_angle_rad = math.radians(state.boom_angle.degrees)
    turret_rotation_rad = math.radians(state.turret_rotation.degrees)

    tip_height_m = pivot_height_m + state.boom_length.meters * math.sin(boom_angle_rad)  # (2)
    hook_height_m = tip_height_m - state.cable_length.meters  # (3)

    # Direção horizontal da lança: u(ψ) = (sin ψ, 0, cos ψ) (ADR-013 C-2).
    direction_x = math.sin(turret_rotation_rad)
    direction_z = math.cos(turret_rotation_rad)

    return OperationalGeometry(
        working_radius=working_radius,
        boom_pivot=Point3D(offset_m * direction_x, pivot_height_m, offset_m * direction_z),
        boom_tip=Point3D(reach_m * direction_x, tip_height_m, reach_m * direction_z),
        hook=Point3D(reach_m * direction_x, hook_height_m, reach_m * direction_z),
    )


def _horizontal_reach_m(state: OperationalState, geometry: CraneGeometry) -> float:
    """Fórmula (1): distância horizontal com sinal do eixo de giro até a ponta, R = a + L·cos θ."""
    boom_angle_rad = math.radians(state.boom_angle.degrees)
    return geometry.boom_pivot_offset_m + state.boom_length.meters * math.cos(boom_angle_rad)


def _working_radius(state: OperationalState, geometry: CraneGeometry) -> Length:
    """Fórmula (4): a única definição do raio de trabalho (ADR-013 C-3).

    Raio medido do eixo de giro até a vertical do gancho; com o cabo vertical (S-2), é o alcance
    horizontal da ponta. A definição é A VALIDAR (G-1): se a empresa responder outra (por exemplo,
    raio a partir do pino, alternativa A-1), muda só esta função.
    """
    reach_m = _horizontal_reach_m(state, geometry)
    if reach_m < 0:
        # ADR-013 C-5: o raio não vira |R|.
        raise OutsideGeometricDomainError(reach_m)
    return Length(reach_m)


def _require_within_limits(state: OperationalState, geometry: CraneGeometry) -> None:
    violations: list[OperationalLimitViolation] = []

    if state.boom_length < geometry.boom_length_min:
        violations.append(OperationalLimitViolation.BOOM_LENGTH_BELOW_MIN)
    elif state.boom_length > geometry.boom_length_max:
        violations.append(OperationalLimitViolation.BOOM_LENGTH_ABOVE_MAX)

    if state.boom_angle < geometry.boom_angle_min:
        violations.append(OperationalLimitViolation.BOOM_ANGLE_BELOW_MIN)
    elif state.boom_angle > geometry.boom_angle_max:
        violations.append(OperationalLimitViolation.BOOM_ANGLE_ABOVE_MAX)

    if state.cable_length < geometry.cable_length_min:
        violations.append(OperationalLimitViolation.CABLE_LENGTH_BELOW_MIN)
    elif geometry.cable_length_max is not None and state.cable_length > geometry.cable_length_max:
        violations.append(OperationalLimitViolation.CABLE_LENGTH_ABOVE_MAX)

    if not _turret_rotation_allowed(state.turret_rotation, geometry):
        violations.append(OperationalLimitViolation.TURRET_ROTATION_OUTSIDE_LIMITS)

    if violations:
        raise OperationalStateOutOfLimitsError(tuple(violations))


def _turret_rotation_allowed(turret_rotation: Angle, geometry: CraneGeometry) -> bool:
    """Diz se ψ está no arco permitido: de ψ_min, no sentido positivo, até ψ_max.

    Sem limites, o giro é contínuo e todo ψ é permitido (ADR-013 C-4). Como ψ chega normalizado em
    [0°, 360°) e os limites podem ser negativos (ex.: −30° a 30°), a comparação é feita pelo
    deslocamento angular a partir de ψ_min, módulo 360°.
    """
    minimum = geometry.turret_rotation_min
    maximum = geometry.turret_rotation_max
    if minimum is None or maximum is None:
        return True
    offset_from_min_deg = (turret_rotation.degrees - minimum.degrees) % _FULL_TURN_DEG
    return offset_from_min_deg <= maximum.degrees - minimum.degrees
