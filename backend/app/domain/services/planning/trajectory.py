"""Trajetória da operação: aproximar → engatar → levantar → girar → baixar → soltar (TASK-075).

A trajetória é uma lista de quadros-chave (`TrajectoryPoint`): o frontend interpola entre eles, em
ordem, para animar o guindaste ou para dar o passo a passo. Os tempos usam velocidades FICTÍCIAS
(ADR-012) de giro, lança, telescópio e cabo; são só para a animação, não entram em capacidade.
"""

from collections.abc import Sequence
from dataclasses import dataclass

from app.domain.services.planning.models import (
    CranePlan,
    CraneStateValues,
    PlanPhase,
    TrajectoryPoint,
)
from app.domain.value_objects.crane_geometry import CraneGeometry

SLEW_DEG_PER_S = 6.0
LUFF_DEG_PER_S = 2.0
TELESCOPE_M_PER_S = 0.8
HOIST_M_PER_S = 1.2
MIN_SEGMENT_S = 1.5
MIN_SWING_SEGMENT_S = 0.4
HOLD_S = 2.0
HOOK_ABOVE_LOAD_M = 2.0
"""Quanto o gancho para acima da carga ao fim da aproximação."""
START_BOOM_ANGLE_DEG = 75.0


@dataclass(frozen=True, slots=True)
class Segment:
    """Trecho entre dois quadros-chave: vai ao estado `end` durante `duration_s`."""

    phase: PlanPhase
    end: CraneStateValues
    duration_s: float


def _travel_s(start: CraneStateValues, end: CraneStateValues, minimum_s: float) -> float:
    seconds = max(
        abs(end.turret_rotation_deg - start.turret_rotation_deg) / SLEW_DEG_PER_S,
        abs(end.boom_angle_deg - start.boom_angle_deg) / LUFF_DEG_PER_S,
        abs(end.boom_length_m - start.boom_length_m) / TELESCOPE_M_PER_S,
        abs(end.cable_length_m - start.cable_length_m) / HOIST_M_PER_S,
    )
    return max(minimum_s, seconds)


def start_state(plan: CranePlan, geometry: CraneGeometry) -> CraneStateValues:
    """Pose inicial: lança recolhida e erguida, gancho no alto, já voltada para a carga."""
    angle = max(
        plan.boom_angle_pick_deg, min(geometry.boom_angle_max.degrees, START_BOOM_ANGLE_DEG)
    )
    return CraneStateValues(
        boom_length_m=geometry.boom_length_min.meters,
        boom_angle_deg=angle,
        turret_rotation_deg=plan.pick_state.turret_rotation_deg,
        cable_length_m=geometry.cable_length_min.meters,
    )


def build_segments(plan: CranePlan, geometry: CraneGeometry) -> tuple[Segment, ...]:
    """Trechos de cada fase, com a duração natural de cada um."""
    start = start_state(plan, geometry)
    pick = plan.pick_state
    cable_min = geometry.cable_length_min.meters
    cable_max = geometry.cable_length_max.meters if geometry.cable_length_max else float("inf")
    above_cable = min(cable_max, max(cable_min, pick.cable_length_m - HOOK_ABOVE_LOAD_M))
    above = CraneStateValues(
        pick.boom_length_m, pick.boom_angle_deg, pick.turret_rotation_deg, above_cable
    )
    segments: list[Segment] = []
    current = start

    def move(phase: PlanPhase, end: CraneStateValues, minimum_s: float = MIN_SEGMENT_S) -> None:
        nonlocal current
        segments.append(Segment(phase, end, _travel_s(current, end, minimum_s)))
        current = end

    def hold(phase: PlanPhase) -> None:
        segments.append(Segment(phase, current, HOLD_S))

    move(PlanPhase.APPROACH, above)
    move(PlanPhase.HOOK, pick)
    hold(PlanPhase.HOOK)
    move(PlanPhase.LIFT, plan.path[0])
    for sample in plan.path[1:]:
        move(PlanPhase.SWING, sample, MIN_SWING_SEGMENT_S)
    move(PlanPhase.LOWER, plan.delivery_state)
    hold(PlanPhase.RELEASE)
    return tuple(segments)


def phase_durations(segments: Sequence[Segment]) -> dict[PlanPhase, float]:
    """Duração natural de cada fase (soma dos trechos dela)."""
    totals: dict[PlanPhase, float] = {}
    for segment in segments:
        totals[segment.phase] = totals.get(segment.phase, 0.0) + segment.duration_s
    return totals


def common_schedule(all_segments: Sequence[Sequence[Segment]]) -> dict[PlanPhase, float]:
    """Duração de cada fase para guindastes sincronizados: a maior entre eles."""
    schedule: dict[PlanPhase, float] = {}
    for segments in all_segments:
        for phase, seconds in phase_durations(segments).items():
            schedule[phase] = max(schedule.get(phase, 0.0), seconds)
    return schedule


def to_keyframes(
    segments: Sequence[Segment],
    start: CraneStateValues,
    crane_index: int,
    schedule: dict[PlanPhase, float] | None = None,
) -> tuple[TrajectoryPoint, ...]:
    """Quadros-chave com o tempo acumulado. Com `schedule`, cada fase dura o que ele manda."""
    natural = phase_durations(segments)
    points = [TrajectoryPoint(0.0, crane_index, start, PlanPhase.APPROACH)]
    elapsed = 0.0
    for segment in segments:
        scale = 1.0
        if schedule is not None and natural.get(segment.phase, 0.0) > 0:
            scale = schedule[segment.phase] / natural[segment.phase]
        elapsed += segment.duration_s * scale
        points.append(TrajectoryPoint(round(elapsed, 3), crane_index, segment.end, segment.phase))
    return tuple(points)


def build_trajectory(
    plan: CranePlan,
    geometry: CraneGeometry,
    crane_index: int = 0,
    schedule: dict[PlanPhase, float] | None = None,
) -> tuple[TrajectoryPoint, ...]:
    return to_keyframes(
        build_segments(plan, geometry), start_state(plan, geometry), crane_index, schedule
    )
