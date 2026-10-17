"""Planejador de um guindaste: posição, lança e caminho da carga (TASK-075; ADR-038; ADR-042).

Para uma configuração com tabela ativa, procura a posição do guindaste numa grade ao redor da coleta
e da entrega, descartando as posições sobre obstáculos ou com inclinação ou solo fora do limite. Em
cada posição calcula raio e giro na coleta e na entrega, escolhe o sentido do giro (o mais curto que
não cruza obstáculo), a altura de transporte (topo do obstáculo mais alto no caminho + 1 m) e o
comprimento de lança que minimiza a utilização máxima ao longo do caminho.

O caminho inteiro é conferido contra obstáculos e terreno (`sweep.py`, TASK-088): o giro numa grade
densa, a lança, o cabo e as fases verticais. A carga não sai de baixo de obstáculo na coleta e só
pousa sobre a carreta na entrega.

Capacidade e segurança vêm do `StateEvaluator` (o cálculo determinístico do backend); este módulo só
gera os estados a avaliar e escolhe entre eles (RN-004, RN-008).
"""

import math
import time
from collections import Counter
from collections.abc import Callable, Sequence
from dataclasses import dataclass, replace

from app.domain.entities.scenario import (
    CranePlacementSpec,
    ObstacleSpec,
    ScenarioSpec,
)
from app.domain.entities.scenario import SoilKind as ScenarioSoilKind
from app.domain.services import rigging
from app.domain.services.environment_factors import SoilKind
from app.domain.services.planning.crane_body import (
    BODY_HEIGHT_M,
    crane_body_overlaps_obstacle,
    distance_to_crane_body_m,
)
from app.domain.services.planning.library_boxes import expand_obstacles, owner_id
from app.domain.services.planning.models import (
    CranePlan,
    CraneStateValues,
    PlanLoad,
    PlannerCrane,
    PlanPoint,
    StateAssessment,
    StateEvaluator,
)
from app.domain.services.planning.scene import (
    azimuth_deg,
    obstacle_circumradius_m,
    obstacle_top_y,
    wrap_180,
)
from app.domain.services.planning.sweep import (
    DeliverySurface,
    Rig,
    Solid,
    SwingArc,
    body_crossed,
    delivery_surface,
    first_path_collision,
    load_crossings,
    pick_surface,
    solids_of,
    swing_arc,
    terrain_peak_along,
)
from app.domain.services.planning.terrain import (
    ground_slope_under_crane_deg,
    soil_kinds_under_shoes,
    terrain_height_at,
)
from app.domain.services.planning.trajectory import (
    HOIST_M_PER_S,
    SLEW_DEG_PER_S,
    approach_states,
)
from app.domain.services.power_line import power_line_zones
from app.domain.services.safety_assessment import TippingRisk

POSITION_STEP_M = 2.0
"""Passo da grade de posições do guindaste."""
PATH_SEGMENTS = 12
"""Trechos (quadros-chave) do giro na trajetória, da coleta à entrega. A conferência de colisão não
fica só neles: usa a grade densa de `sweep.py`."""
CLEARANCE_M = 1.0
"""Folga entre a base da carga e o topo do obstáculo mais alto no caminho."""
HOOK_ATTACH_M = 1.05
"""Do gancho ao ponto de amarração das lingas, sem medida da cena (`HOOK_ATTACH_OFFSET_M` do
frontend); a tela manda o valor medido no gancho do modelo 3D em uso."""
REPLACED_HOOK_ATTACH_M = 0.01
"""Amarração das lingas quando um moitão substitui o gancho (`REPLACED_HOOK_ATTACH_M` da cena)."""
_VAO_MIN_M = 0.05
"""Altura mínima (m) da base de uma parte elevada para a carga poder passar por baixo dela."""
REST_CLEARANCE_M = 0.03
"""Folga entre a base da carga e o chão quando ela é pousada ou pega, para não encostar."""
DEFAULT_MAX_POSITIONS = 30
DEFAULT_KEEP = 3
REFINE_TOP = 6
_ANGLE_TOLERANCE_DEG = 1e-6
_RISK_RANK: dict[TippingRisk | None, int] = {
    TippingRisk.LOW: 0,
    TippingRisk.ATTENTION: 1,
    TippingRisk.HIGH: 2,
    None: 3,
}

PICK_COVERED = "coleta"
"""Motivo de descarte: a carga na coleta fica sob ou dentro de um obstáculo."""
DELIVERY_BLOCKED = "entrega"
"""Motivo de descarte: na entrega, a carga pousaria sobre ou sob um obstáculo que não é a
carreta."""


def risk_rank(risk: TippingRisk | None) -> int:
    return _RISK_RANK[risk]


def sling_drop_m(load: PlanLoad, *, angle_deg: float | None = None, tandem: bool = False) -> float:
    """Altura das lingas entre o gancho e o topo da carga.

    É a geometria das lingas (comprimento + ângulo) de `domain/services/rigging.py`, a MESMA conta
    da cena (`slingGeometry.ts`; F-19, ADR-051): sem ângulo informado, o padrão da carga.
    """
    return rigging.sling_drop_m(load.length_m, load.width_m, angle_deg=angle_deg, tandem=tandem)


def _load_below_hook_m(
    load: PlanLoad, accessory_drop_m: float, hook_attach_m: float, sling_drop: float
) -> float:
    """Distância do gancho à base da carga pendurada."""
    return hook_attach_m + accessory_drop_m + sling_drop + load.height_m


@dataclass(frozen=True, slots=True)
class PlanSearch:
    """Resultado da busca para uma configuração: os melhores planos e por que o resto caiu."""

    plans: tuple[CranePlan, ...]
    rejections: dict[str, int]
    timed_out: bool = False


@dataclass(frozen=True, slots=True)
class _Context:
    """O que vale para toda a busca de uma configuração."""

    scenario: ScenarioSpec
    load: PlanLoad
    pick: PlanPoint
    """Onde o gancho prende a carga na coleta (o centro dela; no tandem, o ponto de içamento)."""
    delivery: PlanPoint
    cargo_pick: PlanPoint
    """Centro e giro da carga na coleta."""
    delivery_center: tuple[float, float]
    """Centro da carga na entrega."""
    fixed_delivery: DeliverySurface | None
    """Superfície da entrega quando o giro da carga já é dado (tandem); senão, depende do giro."""
    radius_load_m: float
    pick_supports: tuple[ObstacleSpec, ...]
    """Caminhões em cuja carroceria a carga está apoiada na coleta."""
    pick_base_y: float
    """Altura da base da carga apoiada na coleta."""
    solids: tuple[Solid, ...]
    accessory_drop_m: float
    hook_attach_m: float
    sling: rigging.SlingGeometry
    """Lingas (comprimento, ângulo e altura; fonte única, `rigging.py`): as mesmas na coleta, no
    giro e na entrega, e as que a cena usa ao tocar o plano."""


@dataclass(frozen=True, slots=True)
class _Sweep:
    """O giro num sentido, na grade densa, com o que não depende do rumo do chassi."""

    sign: int
    arc_deg: float
    arc: SwingArc
    crossed: tuple[ObstacleSpec, ...]
    terrain_top_y: float
    delivery: DeliverySurface


@dataclass(frozen=True, slots=True)
class _Swing:
    sign: int
    arc_deg: float
    arc: SwingArc
    crossed: tuple[ObstacleSpec, ...]
    bottom_y: float
    """Altura absoluta da base da carga durante o giro."""
    crosses_body: bool = False
    """O caminho passa sobre o corpo do próprio guindaste."""
    delivery_rest_y: float = 0.0
    """Altura da base da carga apoiada na entrega (o chão ou o topo da carreta)."""
    delivery_supports: tuple[ObstacleSpec, ...] = ()
    """Veículos-plataforma em que a carga repousa na entrega."""


@dataclass(frozen=True, slots=True)
class _Site:
    """Posição candidata do guindaste, com tudo que não depende do giro nem da lança."""

    placement: CranePlacementSpec
    pick_radius_m: float
    delivery_radius_m: float
    pick_azimuth_deg: float
    delivery_azimuth_deg: float
    ground_y: float
    slope_deg: float
    soil_kinds: tuple[SoilKind, ...]
    conflicts: tuple[str, ...]
    swings: tuple[_Swing, ...] = ()
    """Os sentidos do giro com este rumo, do preferido ao último (sem os de entrega impossível)."""


@dataclass(frozen=True, slots=True)
class _Option:
    site: _Site
    swing: _Swing
    boom_length_m: float
    path: tuple[CraneStateValues, ...]
    pick_state: CraneStateValues
    delivery_state: CraneStateValues
    utilization_percent: float
    risk: TippingRisk | None
    messages: tuple[str, ...]


def _to_env_soil(kinds: Sequence[ScenarioSoilKind]) -> tuple[SoilKind, ...]:
    return tuple(SoilKind(kind.value) for kind in kinds)


def _centered_heading(crane: PlannerCrane, az_pick: float, az_delivery: float) -> float:
    """Rumo do chassi que põe o meio do giro curto no centro do arco permitido (ψ = 0 se livre)."""
    delta = wrap_180(az_delivery - az_pick)
    bisector = az_pick + delta / 2
    geometry = crane.geometry
    center = 0.0
    if geometry.turret_rotation_min is not None and geometry.turret_rotation_max is not None:
        center = (geometry.turret_rotation_min.degrees + geometry.turret_rotation_max.degrees) / 2
    return bisector - center


_HEADING_STEPS_DEG = (0.0, 90.0, 180.0, 270.0)
"""Rumos testados em cada posição: o centrado no giro e os girados de 90° em 90° (com o giro livre),
para a carga não passar sobre a cabine e o corpo do guindaste quando houver um lado melhor."""


def _site_at(
    crane: PlannerCrane,
    scenario: ScenarioSpec,
    pick: PlanPoint,
    delivery: PlanPoint,
    load: PlanLoad,
    compared_kg: float,
    placement: CranePlacementSpec,
) -> _Site | str:
    """A posição com este rumo, ou a chave do motivo de descarte."""
    x, z = placement.x, placement.z
    radius_load = math.hypot(load.length_m, load.width_m) / 2
    if any(
        crane_body_overlaps_obstacle(placement, obstacle)
        for obstacle in scenario.obstacles
        if obstacle.elevation_m is None or obstacle.elevation_m < BODY_HEIGHT_M
    ):
        return "obstaculo"
    if any(
        distance_to_crane_body_m(placement, point.x, point.z) < radius_load
        for point in (pick, delivery)
    ):
        return "corpo"
    slope = round(ground_slope_under_crane_deg(scenario.terrain, placement), 2)
    if slope > crane.profile.max_ground_slope_deg:
        return "inclinacao"
    # O solo não filtra mais aqui: a pressão de cada sapata depende do raio e do giro (estática do
    # polígono, RN-017), então é conferida em cada estado avaliado (SOIL_BEARING_EXCEEDED).
    soils = _to_env_soil(soil_kinds_under_shoes(scenario, placement))
    rp = math.hypot(pick.x - x, pick.z - z)
    rd = math.hypot(delivery.x - x, delivery.z - z)
    reach = max(rp, rd)
    conflicts = tuple(
        sorted(
            {
                owner_id(obstacle)
                for obstacle in scenario.obstacles
                if math.hypot(obstacle.center_x - x, obstacle.center_z - z)
                - obstacle_circumradius_m(obstacle)
                <= reach
            }
        )
    )
    return _Site(
        placement=placement,
        pick_radius_m=rp,
        delivery_radius_m=rd,
        pick_azimuth_deg=azimuth_deg(pick.x - x, pick.z - z),
        delivery_azimuth_deg=azimuth_deg(delivery.x - x, delivery.z - z),
        ground_y=terrain_height_at(scenario.terrain, x, z),
        slope_deg=slope,
        soil_kinds=soils,
        conflicts=conflicts,
    )


def _sites(
    crane: PlannerCrane,
    ctx: _Context,
    weight_with_extras_kg: float,
    rejections: Counter[str],
    max_positions: int,
) -> list[tuple[_Site, ...]]:
    """As `max_positions` posições livres de menor raio máximo, cada uma com os rumos possíveis.

    As posições são avaliadas em ordem de raio máximo (depois X e Z) e a busca para quando junta
    `max_positions`: o resultado é o mesmo de avaliar todas e ficar com as primeiras, com menos
    trabalho (a conferência densa do giro custa mais que a de 13 pontos). O rumo não é escolhido
    aqui: `plan_crane` confere todos, com os dois sentidos do giro (TASK-089)."""
    pick, delivery = ctx.pick, ctx.delivery
    geometry = crane.geometry
    pivot = geometry.boom_pivot_offset_m
    max_reach = min(
        crane.max_radius_m,
        pivot
        + geometry.boom_length_max.meters * math.cos(math.radians(geometry.boom_angle_min.degrees)),
    )
    min_reach = pivot + geometry.boom_length_min.meters * math.cos(
        math.radians(geometry.boom_angle_max.degrees)
    )
    free_turret = geometry.turret_rotation_min is None or geometry.turret_rotation_max is None
    mid_x = (pick.x + delivery.x) / 2
    mid_z = (pick.z + delivery.z) / 2
    steps_x = math.ceil((abs(pick.x - delivery.x) / 2 + max_reach) / POSITION_STEP_M)
    steps_z = math.ceil((abs(pick.z - delivery.z) / 2 + max_reach) / POSITION_STEP_M)
    compared_kg = weight_with_extras_kg + crane.hook_block_weight_kg

    candidates: list[tuple[float, float, float]] = []
    for i in range(-steps_x, steps_x + 1):
        for j in range(-steps_z, steps_z + 1):
            x = mid_x + i * POSITION_STEP_M
            z = mid_z + j * POSITION_STEP_M
            rp = math.hypot(pick.x - x, pick.z - z)
            rd = math.hypot(delivery.x - x, delivery.z - z)
            if max(rp, rd) > max_reach + 1e-9 or min(rp, rd) < min_reach - 1e-9:
                continue  # fora do alcance da lança (não conta como descarte: é a maior parte)
            candidates.append((max(rp, rd), x, z))
    candidates.sort()

    positions: list[tuple[_Site, ...]] = []
    for _, x, z in candidates:
        if len(positions) >= max_positions:
            break
        base_heading = _centered_heading(
            crane,
            azimuth_deg(pick.x - x, pick.z - z),
            azimuth_deg(delivery.x - x, delivery.z - z),
        )
        sweeps: list[_Sweep] | None = None
        headings: list[_Site] = []
        reason = "obstaculo"
        for step in _HEADING_STEPS_DEG if free_turret else (0.0,):
            placement = CranePlacementSpec(x=x, z=z, heading_deg=base_heading + step)
            result = _site_at(crane, ctx.scenario, pick, delivery, ctx.load, compared_kg, placement)
            if isinstance(result, str):
                reason = result
                continue
            if sweeps is None:
                sweeps = _sweeps(ctx, result)
            swings = _swings(ctx, result, sweeps)
            if not swings:
                reason = DELIVERY_BLOCKED
                break  # a entrega não depende do rumo
            headings.append(replace(result, swings=tuple(swings)))
        if not headings:
            rejections[reason] += 1
        else:
            positions.append(tuple(headings))
    return positions


def _ends_ground(ctx: _Context) -> float:
    return max(
        terrain_height_at(ctx.scenario.terrain, ctx.pick.x, ctx.pick.z),
        terrain_height_at(ctx.scenario.terrain, ctx.delivery.x, ctx.delivery.z),
    )


def _swing_seconds(swing: _Swing, ctx: _Context) -> float:
    """Tempo estimado do giro, com a subida e a descida extras da altura de transporte."""
    minimum_bottom_y = _ends_ground(ctx) + CLEARANCE_M
    extra_lift_m = max(0.0, swing.bottom_y - minimum_bottom_y)
    return swing.arc_deg / SLEW_DEG_PER_S + 2 * extra_lift_m / HOIST_M_PER_S


def _sweeps(ctx: _Context, site: _Site) -> list[_Sweep]:
    """Os dois sentidos do giro nesta posição: o que a carga cruza, o terreno sob ela e onde ela
    pousa na entrega. Não dependem do rumo do chassi."""
    delta = wrap_180(site.delivery_azimuth_deg - site.pick_azimuth_deg)
    short_sign = -1 if delta < 0 else 1
    options = [(short_sign, abs(delta))]
    if abs(delta) > 0.5:
        options.append((-short_sign, 360.0 - abs(delta)))
    sweeps: list[_Sweep] = []
    for sign, arc_deg in options:
        arc = swing_arc(
            center_x=site.placement.x,
            center_z=site.placement.z,
            start_azimuth_deg=site.pick_azimuth_deg,
            sign=sign,
            arc_deg=arc_deg,
            start_radius_m=site.pick_radius_m,
            end_radius_m=site.delivery_radius_m,
            path_segments=PATH_SEGMENTS,
        )
        if ctx.fixed_delivery is not None:
            delivery = ctx.fixed_delivery
        else:
            # A carga gira com a torre: na entrega, está girada do quanto o guindaste girou.
            x, z = ctx.delivery_center
            rotation = ctx.cargo_pick.rotation_y_deg + sign * arc_deg
            delivery = delivery_surface(ctx.scenario, ctx.load, x, z, rotation)
        sweeps.append(
            _Sweep(
                sign,
                arc_deg,
                arc,
                load_crossings(arc, ctx.scenario.obstacles, ctx.radius_load_m),
                terrain_peak_along(arc, ctx.scenario.terrain, ctx.radius_load_m),
                delivery,
            )
        )
    return sweeps


def _swings(ctx: _Context, site: _Site, sweeps: Sequence[_Sweep]) -> list[_Swing]:
    """Os sentidos do giro com o rumo de `site`, do preferido ao último.

    Vale o de menor tempo estimado: o giro mais a subida e a descida extras para passar sobre os
    obstáculos do caminho e sobre o corpo do guindaste (a carga vai a topo do mais alto + 1 m).
    Assim, o sentido curto é o escolhido mesmo cruzando um obstáculo baixo, e o longo só vence
    quando o obstáculo do curto é alto demais para valer a subida; se o curto não tem lança
    possível, tenta-se o outro. Sentidos em que a entrega bate em obstáculo ficam de fora.
    """
    ends_ground = _ends_ground(ctx)
    swings: list[_Swing] = []
    for sweep in sweeps:
        if sweep.delivery.blockers:
            continue
        crosses_body = body_crossed(sweep.arc, site.placement, ctx.radius_load_m)
        tops = [ends_ground, sweep.terrain_top_y]
        if crosses_body:
            tops.append(site.ground_y + BODY_HEIGHT_M)
        # Partes elevadas de um objeto oco (o teto do barracão) deixam um vão por baixo: a carga
        # pode passar sob elas, baixa, antes de ser obrigada a subir acima delas. A conferência do
        # caminho (`_collision`) decide se o vão serve; senão vale a altura acima de tudo.
        beneath = [
            obstacle
            for obstacle in sweep.crossed
            if obstacle.elevation_m is not None and obstacle.elevation_m > _VAO_MIN_M
        ]
        over = [obstacle for obstacle in sweep.crossed if obstacle not in beneath]
        heights: list[float] = []
        for group in ([over] if beneath else []) + [list(sweep.crossed)]:
            tallest = max([*tops, *(obstacle_top_y(ctx.scenario.terrain, o) for o in group)])
            if tallest + CLEARANCE_M not in heights:
                heights.append(tallest + CLEARANCE_M)
        for bottom_y in heights:
            swings.append(
                _Swing(
                    sweep.sign,
                    sweep.arc_deg,
                    sweep.arc,
                    sweep.crossed,
                    bottom_y,
                    crosses_body,
                    sweep.delivery.rest_y,
                    sweep.delivery.supports,
                )
            )

    swings.sort(key=lambda swing: _swing_rank(swing, ctx))
    return swings


def _swing_rank(swing: _Swing, ctx: _Context) -> tuple[float, bool, float]:
    """Preferência entre giros: o de menor tempo, depois o que não cruza nada, depois o mais
    curto."""
    return (
        round(_swing_seconds(swing, ctx), 3),
        bool(swing.crossed) or swing.crosses_body,
        swing.arc_deg,
    )


def _routes(
    crane: PlannerCrane, ctx: _Context, headings: Sequence[_Site]
) -> list[tuple[_Site, _Swing]]:
    """Todos os rumos e os dois sentidos do giro de uma posição, do mais rápido ao mais lento.

    Sem zonas de giro, ψ não muda a avaliação (TASK-089): dois rumos com o mesmo sentido, a mesma
    altura de transporte e o mesmo chão sob as sapatas dão a mesma opção, e só o primeiro fica."""
    routes = [(site, swing) for site in headings for swing in site.swings]
    routes.sort(key=lambda route: _swing_rank(route[1], ctx))
    if crane.zone_boundaries_deg:
        return routes
    seen: set[tuple[int, float, float, tuple[SoilKind, ...]]] = set()
    unique: list[tuple[_Site, _Swing]] = []
    for site, swing in routes:
        key = (swing.sign, round(swing.bottom_y, 6), site.slope_deg, site.soil_kinds)
        if key not in seen:
            seen.add(key)
            unique.append((site, swing))
    return unique


ZONE_BOUNDARY_OFFSET_DEG = 1e-3
"""Quanto antes e depois de cada fronteira de zona o giro é avaliado (TASK-089)."""


def _boundary_states(
    crane: PlannerCrane, path: Sequence[CraneStateValues]
) -> list[CraneStateValues]:
    """Estados do giro logo antes e logo depois de cada fronteira de zona atravessada, entre dois
    quadros-chave, interpolados como a cena (L, θ, ψ e c em linha reta), então com o raio de lá.

    Numa zona, a capacidade só cai com o raio, e o raio só muda num sentido entre dois quadros: o
    pior ponto de cada zona fica num quadro-chave ou numa fronteira (F-06)."""
    if not crane.zone_boundaries_deg:
        return []
    states: list[CraneStateValues] = []
    for a, b in zip(path, path[1:], strict=False):
        span = b.turret_rotation_deg - a.turret_rotation_deg
        if abs(span) < 1e-9:
            continue
        low, high = sorted((a.turret_rotation_deg, b.turret_rotation_deg))
        for boundary in crane.zone_boundaries_deg:
            turn = math.ceil((low - boundary - ZONE_BOUNDARY_OFFSET_DEG) / 360.0)
            while boundary + 360.0 * turn <= high + ZONE_BOUNDARY_OFFSET_DEG:
                for offset in (-ZONE_BOUNDARY_OFFSET_DEG, ZONE_BOUNDARY_OFFSET_DEG):
                    psi = boundary + 360.0 * turn + offset
                    if low <= psi <= high:
                        f = (psi - a.turret_rotation_deg) / span
                        states.append(
                            CraneStateValues(
                                a.boom_length_m + (b.boom_length_m - a.boom_length_m) * f,
                                a.boom_angle_deg + (b.boom_angle_deg - a.boom_angle_deg) * f,
                                psi,
                                a.cable_length_m + (b.cable_length_m - a.cable_length_m) * f,
                            )
                        )
                turn += 1
    return states


def _boom_angle_deg(crane: PlannerCrane, boom_length_m: float, radius_m: float) -> float | None:
    """θ que dá o raio `radius_m` com a lança `boom_length_m` (R = a + L·cos θ), dentro da faixa."""
    geometry = crane.geometry
    cosine = (radius_m - geometry.boom_pivot_offset_m) / boom_length_m
    if cosine > 1 + 1e-9 or cosine < -1e-9:
        return None
    angle = math.degrees(math.acos(min(1.0, max(-1.0, cosine))))
    if not (
        geometry.boom_angle_min.degrees - _ANGLE_TOLERANCE_DEG
        <= angle
        <= geometry.boom_angle_max.degrees + _ANGLE_TOLERANCE_DEG
    ):
        return None
    return angle


def _cable_m(
    crane: PlannerCrane, boom_length_m: float, angle_deg: float, hook_y_rel: float
) -> float | None:
    """Cabo c que põe o gancho na altura `hook_y_rel` (relativa ao plano de apoio), na faixa."""
    geometry = crane.geometry
    cable = (
        geometry.boom_pivot_height.meters
        + boom_length_m * math.sin(math.radians(angle_deg))
        - hook_y_rel
    )
    cable_max = geometry.cable_length_max.meters if geometry.cable_length_max else math.inf
    if cable < geometry.cable_length_min.meters - 1e-9 or cable > cable_max + 1e-9:
        return None
    return cable


def _assess(
    evaluator: StateEvaluator,
    crane: PlannerCrane,
    site: _Site,
    state: CraneStateValues,
    weight_kg: float,
    wind_speed_ms: float | None,
) -> StateAssessment:
    return evaluator(
        configuration_id=crane.configuration_id,
        state=state,
        load_weight_kg=weight_kg,
        ground_slope_deg=site.slope_deg if site.slope_deg > 0 else None,
        soil_kinds=site.soil_kinds,
        wind_speed_ms=wind_speed_ms,
        obstacle_conflicts=site.conflicts,
    )


def _worst(
    assessments: Sequence[StateAssessment], capacity_share: float
) -> tuple[float, TippingRisk | None, tuple[str, ...]] | str:
    """Pior utilização e pior risco; ou o motivo, se algum estado não for avaliável."""
    worst_util = 0.0
    worst_rank = 0
    worst_risk: TippingRisk | None = TippingRisk.LOW
    messages: list[str] = []
    for assessment in assessments:
        if not assessment.evaluable:
            return assessment.reason or "tabela"
        worst_util = max(worst_util, assessment.utilization_percent / capacity_share)
        rank = risk_rank(assessment.risk)
        if rank > worst_rank:
            worst_rank = rank
            worst_risk = assessment.risk
        for message in assessment.messages:
            if message not in messages:
                messages.append(message)
    return worst_util, worst_risk, tuple(messages)


def _try_length(
    *,
    crane: PlannerCrane,
    ctx: _Context,
    site: _Site,
    swing: _Swing,
    boom_length_m: float,
    evaluator: StateEvaluator,
    weight_kg: float,
    capacity_share: float,
    wind_speed_ms: float | None,
    rejections: Counter[str],
) -> _Option | None:
    load = ctx.load
    below_hook = _load_below_hook_m(load, ctx.accessory_drop_m, ctx.hook_attach_m, ctx.sling.drop_m)
    transport_hook_y = swing.bottom_y + below_hook - site.ground_y
    # Na coleta, o gancho para a `sling_drop_m` acima do topo da carga apoiada, com as lingas
    # esticadas (a cena só engata aí; F-19): a carga pende, depois, exatamente `below_hook`
    # abaixo do gancho, a mesma altura das lingas do plano.
    pick_hook_y = (
        ctx.pick_base_y
        + load.height_m
        + ctx.hook_attach_m
        + ctx.accessory_drop_m
        + ctx.sling.drop_m
        - site.ground_y
    )
    # Na entrega, a carga pousa no chão ou no topo da carreta (`delivery_surface`).
    delivery_hook_y = swing.delivery_rest_y + REST_CLEARANCE_M + below_hook - site.ground_y
    psi_pick = wrap_180(site.pick_azimuth_deg - site.placement.heading_deg)

    path: list[CraneStateValues] = []
    for k in range(PATH_SEGMENTS + 1):
        t = k / PATH_SEGMENTS
        radius = site.pick_radius_m + (site.delivery_radius_m - site.pick_radius_m) * t
        angle = _boom_angle_deg(crane, boom_length_m, radius)
        if angle is None:
            rejections["lanca"] += 1
            return None
        cable = _cable_m(crane, boom_length_m, angle, transport_hook_y)
        if cable is None:
            rejections["cabo"] += 1
            return None
        path.append(
            CraneStateValues(boom_length_m, angle, psi_pick + swing.sign * swing.arc_deg * t, cable)
        )
    first, last = path[0], path[-1]
    pick_cable = _cable_m(crane, boom_length_m, first.boom_angle_deg, pick_hook_y)
    delivery_cable = _cable_m(crane, boom_length_m, last.boom_angle_deg, delivery_hook_y)
    if pick_cable is None or delivery_cable is None:
        rejections["cabo"] += 1
        return None
    pick_state = CraneStateValues(
        boom_length_m, first.boom_angle_deg, first.turret_rotation_deg, pick_cable
    )
    delivery_state = CraneStateValues(
        boom_length_m, last.boom_angle_deg, last.turret_rotation_deg, delivery_cable
    )

    sampled = (
        pick_state,
        path[PATH_SEGMENTS // 2],
        delivery_state,
        *_boundary_states(crane, path),
    )
    result = _worst(
        [_assess(evaluator, crane, site, s, weight_kg, wind_speed_ms) for s in sampled],
        capacity_share,
    )
    if isinstance(result, str):
        rejections[result] += 1
        return None
    util, risk, messages = result
    return _Option(
        site, swing, boom_length_m, tuple(path), pick_state, delivery_state, util, risk, messages
    )


def _collision(crane: PlannerCrane, ctx: _Context, option: _Option) -> str | None:
    """Motivo de colisão da lança, do cabo ou da carga no caminho inteiro da opção, ou `None`."""
    load = ctx.load
    rig = Rig(
        geometry=crane.geometry,
        placement=option.site.placement,
        ground_y=option.site.ground_y,
        load_radius_m=ctx.radius_load_m,
        load_height_m=load.height_m,
        rigging_m=ctx.hook_attach_m + ctx.accessory_drop_m + ctx.sling.drop_m,
        hook_drop_m=ctx.hook_attach_m + ctx.accessory_drop_m,
    )
    return first_path_collision(
        rig,
        ctx.solids,
        arc=option.swing.arc,
        path=option.path,
        approach=approach_states(option.pick_state, crane.geometry),
        pick_state=option.pick_state,
        pick_load_top_y=ctx.pick_base_y + load.height_m,
        delivery_state=option.delivery_state,
        delivery_load_top_y=option.swing.delivery_rest_y + REST_CLEARANCE_M + load.height_m,
        delivery_supports=option.swing.delivery_supports,
        pick_supports=ctx.pick_supports,
    )


def _option_key(option: _Option) -> tuple[bool, float, int]:
    valid = option.utilization_percent <= 100.0 and option.risk is not TippingRisk.HIGH
    return (not valid, option.utilization_percent, risk_rank(option.risk))


def plan_crane(
    *,
    crane: PlannerCrane,
    scenario: ScenarioSpec,
    load: PlanLoad,
    pick: PlanPoint,
    delivery: PlanPoint,
    evaluator: StateEvaluator,
    share_kg: float | None = None,
    extra_weight_kg: float = 0.0,
    accessory_drop_m: float = 0.0,
    hook_attach_m: float = HOOK_ATTACH_M,
    capacity_share: float = 1.0,
    wind_speed_ms: float | None = None,
    max_positions: int = DEFAULT_MAX_POSITIONS,
    keep: int = DEFAULT_KEEP,
    deadline: float | None = None,
    clock: Callable[[], float] = time.monotonic,
    hoist_pick: tuple[float, float] | None = None,
    hoist_delivery: tuple[float, float] | None = None,
    cargo_pick: PlanPoint | None = None,
    cargo_delivery: PlanPoint | None = None,
    sling_angle_deg: float | None = None,
) -> PlanSearch:
    """Melhores planos de `crane` para levar a carga de `pick` a `delivery`.

    `sling_angle_deg` é o ângulo das lingas com a horizontal (30° a 85°); omitido, vale o padrão
    da carga (`rigging.default_geometry`). No tandem (`share_kg` dado) cada guindaste ergue a
    sua metade.

    `share_kg` é o peso que este guindaste leva (a carga inteira, se omitido); `capacity_share` é a
    fração da capacidade que ele pode usar (0,75 no tandem). `pick` e `delivery` são os pontos onde
    o gancho deste guindaste prende a carga. `cargo_pick` é o centro e o giro da carga na coleta (o
    próprio `pick`, se omitido); `cargo_delivery`, o centro e o giro dela na entrega quando já são
    dados (tandem); se omitido, ela fica centrada em `delivery` e girada do quanto a torre girou.
    """
    weight_kg = load.weight_kg if share_kg is None else share_kg
    # Objetos ocos da biblioteca (o barracão aberto) viram as caixas que a cena usa (ADR-042).
    # A rede elétrica vira zona de distância mínima: obstáculo elevado (ADR-051).
    scenario = replace(
        scenario,
        obstacles=(*expand_obstacles(scenario), *power_line_zones(scenario.power_lines)),
    )
    rejections: Counter[str] = Counter()
    cargo_at_pick = pick if cargo_pick is None else cargo_pick
    pick_surf = pick_surface(scenario, load, cargo_at_pick)
    if pick_surf.blockers:
        rejections[PICK_COVERED] += 1
        return PlanSearch((), dict(rejections))
    fixed_delivery: DeliverySurface | None = None
    delivery_center = (delivery.x, delivery.z)
    if cargo_delivery is not None:
        delivery_center = (cargo_delivery.x, cargo_delivery.z)
        fixed_delivery = delivery_surface(
            scenario, load, cargo_delivery.x, cargo_delivery.z, cargo_delivery.rotation_y_deg
        )
        if fixed_delivery.blockers:
            rejections[DELIVERY_BLOCKED] += 1
            return PlanSearch((), dict(rejections))
    ctx = _Context(
        scenario=scenario,
        load=load,
        pick=pick,
        delivery=delivery,
        cargo_pick=cargo_at_pick,
        delivery_center=delivery_center,
        fixed_delivery=fixed_delivery,
        radius_load_m=math.hypot(load.length_m, load.width_m) / 2,
        pick_supports=pick_surf.supports,
        pick_base_y=pick_surf.rest_y,
        solids=solids_of(scenario),
        accessory_drop_m=accessory_drop_m,
        hook_attach_m=hook_attach_m,
        sling=rigging.default_geometry(
            load.length_m, load.width_m, angle_deg=sling_angle_deg, tandem=share_kg is not None
        ),
    )
    positions = _sites(crane, ctx, weight_kg + extra_weight_kg, rejections, max_positions)
    options: list[_Option] = []
    timed_out = False
    for headings in positions:
        if deadline is not None and clock() > deadline:
            timed_out = True
            break
        # Todos os rumos e os dois sentidos, do mais rápido ao mais lento: vale o primeiro que
        # atende (válidas primeiro, o tempo só desempata); se nenhum atende, o mais rápido (F-18).
        best: _Option | None = None
        for site, swing in _routes(crane, ctx, headings):
            candidates = [
                option
                for length in crane.boom_lengths_m
                if (
                    option := _try_length(
                        crane=crane,
                        ctx=ctx,
                        site=site,
                        swing=swing,
                        boom_length_m=length,
                        evaluator=evaluator,
                        weight_kg=weight_kg,
                        capacity_share=capacity_share,
                        wind_speed_ms=wind_speed_ms,
                        rejections=rejections,
                    )
                )
                is not None
            ]
            # A melhor opção que não bate em nada; as que batem saem com o motivo.
            found: _Option | None = None
            for option in sorted(candidates, key=_option_key):
                collision = _collision(crane, ctx, option)
                if collision is None:
                    found = option
                    break
                rejections[collision] += 1
            if found is None:
                continue
            if best is None:
                best = found
            if not _option_key(found)[0]:
                best = found
                break
        if best is not None:
            options.append(best)

    options.sort(key=_option_key)
    plans: list[CranePlan] = []
    for option in options[: max(REFINE_TOP, keep)]:
        plan = _refine(
            crane=crane,
            ctx=ctx,
            option=option,
            evaluator=evaluator,
            weight_kg=weight_kg,
            capacity_share=capacity_share,
            wind_speed_ms=wind_speed_ms,
            hoist_pick=hoist_pick,
            hoist_delivery=hoist_delivery,
        )
        if plan is not None:
            plans.append(plan)
    plans.sort(key=plan_sort_key)
    return PlanSearch(tuple(plans[:keep]), dict(rejections), timed_out)


def plan_sort_key(plan: CranePlan) -> tuple[bool, float, int]:
    """Válidas primeiro, depois a menor utilização máxima (a 0,1 %) e o menor risco."""
    return (not plan.valid, round(plan.max_utilization_percent, 1), risk_rank(plan.tipping_risk))


def _refine(
    *,
    crane: PlannerCrane,
    ctx: _Context,
    option: _Option,
    evaluator: StateEvaluator,
    weight_kg: float,
    capacity_share: float,
    wind_speed_ms: float | None,
    hoist_pick: tuple[float, float] | None,
    hoist_delivery: tuple[float, float] | None,
) -> CranePlan | None:
    """Avalia todas as amostras do caminho e monta o plano com o pior ponto."""
    site = option.site
    states = (
        option.pick_state,
        *option.path,
        *_boundary_states(crane, option.path),
        option.delivery_state,
    )
    result = _worst(
        [_assess(evaluator, crane, site, s, weight_kg, wind_speed_ms) for s in states],
        capacity_share,
    )
    if isinstance(result, str):
        return None
    util, risk, messages = result
    valid = util <= 100.0 and risk is not TippingRisk.HIGH
    swing = option.swing
    return CranePlan(
        configuration_id=crane.configuration_id,
        label=crane.label,
        placement=site.placement,
        boom_length_m=option.boom_length_m,
        pick_radius_m=site.pick_radius_m,
        delivery_radius_m=site.delivery_radius_m,
        swing_deg=swing.sign * swing.arc_deg,
        pick_state=option.pick_state,
        delivery_state=option.delivery_state,
        path=option.path,
        transport_height_m=swing.bottom_y - ctx.pick_base_y,
        crossed_obstacle_ids=tuple(dict.fromkeys(owner_id(obstacle) for obstacle in swing.crossed)),
        crosses_body=swing.crosses_body,
        max_utilization_percent=util,
        tipping_risk=risk,
        valid=valid,
        share_kg=weight_kg,
        boom_angle_pick_deg=option.pick_state.boom_angle_deg,
        boom_angle_delivery_deg=option.delivery_state.boom_angle_deg,
        messages=messages,
        ground_slope_deg=site.slope_deg,
        manufacturer_id=crane.manufacturer_id,
        crane_id=crane.crane_id,
        hoist_pick=hoist_pick,
        hoist_delivery=hoist_delivery,
        sling_length_m=ctx.sling.length_m,
        sling_angle_deg=ctx.sling.angle_deg,
        sling_drop_m=ctx.sling.drop_m,
    )


__all__ = [
    "DELIVERY_BLOCKED",
    "PICK_COVERED",
    "PlanSearch",
    "PlannerCrane",
    "plan_crane",
    "plan_sort_key",
    "risk_rank",
    "sling_drop_m",
]
