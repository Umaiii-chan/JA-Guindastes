"""Caso de uso `RecommendLiftPlan`: qual guindaste, onde posicioná-lo e como levar a carga
(TASK-075; ADR-038).

Para cada configuração com ficha técnica e tabela de carga ativa, o planejador de domínio
(`app.domain.services.planning`) procura a posição, o comprimento de lança e o caminho do giro que
minimizam a utilização máxima do limite. Cada estado do caminho é avaliado pelo `EvaluateOperation`
(RN-011 a RN-015: tabela, limite do modelo, inclinação, vento, solo e risco), então a capacidade e a
segurança vêm só do cálculo determinístico (RN-004, RN-008). Sem configuração única que sirva, tenta
o tandem: dois guindastes, cada um com no máximo 75 % da capacidade, com a carga dividida pelo
centro
de gravidade (contrato da TASK-074).

Para não consultar o banco a cada estado, o catálogo e as tabelas ativas são lidos uma vez e a
avaliação roda sobre esse retrato, em memória. Não grava nada.
"""

import math
import time
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass, field
from typing import Protocol

from app.application.ports.accessory_repository import AccessoryProvider
from app.application.ports.active_load_chart_provider import ActiveLoadChartProvider
from app.application.ports.configuration_load_rules_provider import ConfigurationLoadRules
from app.application.ports.crane_catalog_listing import CraneCatalogListing
from app.application.ports.crane_catalog_repository import Crane, CraneConfiguration
from app.application.use_cases.evaluate_operation import (
    EvaluatedOperation,
    EvaluateOperation,
    NotEvaluableOperation,
)
from app.domain.entities.accessory import Accessory, AccessoryType
from app.domain.entities.load_chart import LoadChart
from app.domain.entities.scenario import ObstacleSpec, ScenarioSpec
from app.domain.services.environment_factors import SoilKind
from app.domain.services.load_chart_interpolator import LoadChartInterpolator
from app.domain.services.planning.crane_body import crane_bodies_overlap
from app.domain.services.planning.models import (
    CranePlan,
    CraneStateValues,
    PlanLoad,
    PlannerCrane,
    PlanPoint,
    StateAssessment,
    StateEvaluator,
    TrajectoryPoint,
)
from app.domain.services.planning.planner import (
    DELIVERY_BLOCKED,
    HOOK_ATTACH_M,
    PICK_COVERED,
    PlanSearch,
    plan_crane,
    plan_sort_key,
    risk_rank,
)
from app.domain.services.planning.scene import direction
from app.domain.services.planning.sweep import (
    COLLISION_BOOM,
    COLLISION_CABLE,
    COLLISION_LOAD,
    delivery_cover,
    pick_cover,
)
from app.domain.services.planning.tandem import (
    HOIST_POINT_FRACTION,
    TANDEM_CAPACITY_SHARE,
    InvalidTandemGeometryError,
    split_load_by_cg,
)
from app.domain.services.planning.trajectory import (
    build_segments,
    common_schedule,
    start_state,
    to_keyframes,
)
from app.domain.services.safety_assessment import AlertSeverity, OutriggerSetting, TippingRisk
from app.domain.value_objects.angle import Angle
from app.domain.value_objects.crane_geometry import CraneGeometry
from app.domain.value_objects.crane_limits import CraneLimits
from app.domain.value_objects.length import Length
from app.domain.value_objects.mass import Mass
from app.domain.value_objects.operational_state import OperationalState
from app.domain.value_objects.safety_profile import SafetyProfile

TIME_BUDGET_S = 2.5
"""Tempo máximo da busca; passado dele, a resposta usa o que já foi achado (cenários grandes)."""
MAX_SINGLE_RESULTS = 5
MAX_TANDEM_RESULTS = 3
MAX_FALLBACK_RESULTS = 3
MAX_BOOM_LENGTH_CANDIDATES = 8
REPLACED_HOOK_ATTACH_M = 0.01
"""Amarração das lingas quando um moitão substitui o gancho (`REPLACED_HOOK_ATTACH_M` da cena)."""
MIN_TANDEM_SEPARATION_M = 8.0
"""Distância mínima entre os eixos dos dois guindastes do tandem."""
TANDEM_PLANS_PER_SIDE = 6
"""Planos guardados por configuração para cada ponto de içamento, de onde saem os pares."""
TANDEM_BODIES = "tandem_corpos"
"""Motivo de descarte: no par do tandem, os corpos dos dois guindastes se sobrepõem."""
TANDEM_SENSES = "tandem_sentidos"
"""Motivo de descarte: no par do tandem, os dois giram em sentidos opostos."""
_MIN_SWING_FOR_SENSE_DEG = 0.5
_ASSUMED_OUTRIGGERS = OutriggerSetting(extension_percent=100.0, jacks_set=True)

_REJECTION_TEXT = {
    "obstaculo": "sobre obstáculos",
    "inclinacao": "com inclinação acima do limite do modelo",
    "solo": "com solo que não suporta a pressão das sapatas",
    "lanca": "fora da faixa de inclinação da lança",
    "cabo": "sem cabo suficiente para a altura de transporte",
    "OUTSIDE_GEOMETRIC_DOMAIN": "fora do alcance geométrico",
    COLLISION_BOOM: "com a lança batendo em obstáculo",
    COLLISION_CABLE: "com o cabo ou o gancho batendo em obstáculo",
    COLLISION_LOAD: "com a carga batendo em obstáculo no caminho",
    PICK_COVERED: "com a carga na coleta sob obstáculo",
    DELIVERY_BLOCKED: "com a carga na entrega sobre ou sob obstáculo que não é a carreta",
}
_TANDEM_PAIR_TEXT = {
    TANDEM_BODIES: "com os corpos dos guindastes sobrepostos",
    TANDEM_SENSES: "com giros em sentidos opostos",
}


class _Search(Protocol):
    def __call__(
        self,
        crane: PlannerCrane,
        pick: PlanPoint,
        delivery: PlanPoint,
        *,
        keep: int,
        share_kg: float | None = None,
        capacity_share: float = 1.0,
        cargo_pick: PlanPoint | None = None,
        cargo_delivery: PlanPoint | None = None,
    ) -> PlanSearch: ...


class PlanningInvalidInputError(Exception):
    """Entrada que o planejamento não aceita (acessório inexistente, carga sem peso)."""


@dataclass(frozen=True)
class PlanningRequest:
    load: PlanLoad
    pick: PlanPoint
    delivery: PlanPoint
    scenario: ScenarioSpec
    accessory_ids: tuple[str, ...] = ()
    hook_attach_m: float = HOOK_ATTACH_M
    """Do gancho ao ponto de amarração das lingas, medido no modelo 3D em uso."""


@dataclass(frozen=True)
class CraneDetail:
    """O que um dos guindastes da recomendação faz."""

    configuration_id: str
    manufacturer_id: str
    crane_id: str
    label: str
    share_kg: float
    boom_length_m: float
    boom_angle_pick_deg: float
    boom_angle_delivery_deg: float
    pick_radius_m: float
    delivery_radius_m: float
    swing_deg: float
    utilization_percent: float
    transport_height_m: float
    crossed_obstacle_ids: tuple[str, ...]


@dataclass(frozen=True)
class Recommendation:
    kind: str
    """`single` ou `tandem`."""
    configuration_ids: tuple[str, ...]
    placements: tuple[tuple[float, float, float], ...]
    """(x, z, rumo) de cada guindaste."""
    max_limit_utilization_percent: float
    tipping_risk: TippingRisk | None
    valid: bool
    trajectory: tuple[TrajectoryPoint, ...]
    notes: tuple[str, ...]
    summary: str
    details: tuple[CraneDetail, ...]


@dataclass(frozen=True)
class PlanningResult:
    recommendations: tuple[Recommendation, ...]
    notes: tuple[str, ...] = field(default=())
    timed_out: bool = False
    """A busca parou no orçamento de tempo (`TIME_BUDGET_S`): pode haver opção não avaliada."""


@dataclass(frozen=True)
class _Entry:
    configuration: CraneConfiguration
    crane: Crane
    label: str
    profile: SafetyProfile
    charts: dict[str | None, LoadChart]


def _profile_of(limits: CraneLimits) -> SafetyProfile:
    return SafetyProfile(
        capacity_limit_percent=limits.capacity_limit_percent,
        warning_band_percent=limits.warning_band_percent,
        max_ground_slope_deg=limits.max_ground_slope_deg,
        slope_derating_percent_per_deg=limits.slope_derating_percent_per_deg,
        crane_mass_kg=limits.crane_mass_kg,
        outrigger_pad_area_m2=limits.outrigger_pad_area_m2,
    )


class _SnapshotProviders:
    """Portas de leitura do `EvaluateOperation` sobre o catálogo lido uma vez."""

    def __init__(self, entries: Sequence[_Entry]) -> None:
        self._by_id = {entry.configuration.id: entry for entry in entries}

    def get_crane_geometry(self, configuration_id: str):  # type: ignore[no-untyped-def]
        entry = self._by_id.get(configuration_id)
        return None if entry is None else entry.configuration.geometry

    def get_active_load_chart(
        self, configuration_id: str, rotation_zone_code: str | None = None
    ) -> LoadChart | None:
        entry = self._by_id.get(configuration_id)
        return None if entry is None else entry.charts.get(rotation_zone_code)

    def get_load_rules(self, configuration_id: str) -> ConfigurationLoadRules | None:
        entry = self._by_id.get(configuration_id)
        if entry is None:
            return None
        return ConfigurationLoadRules(
            rotation_zones=entry.configuration.rotation_zones,
            hook_block_weight=entry.configuration.hook_block_weight,
        )

    def get_crane_limits(self, configuration_id: str) -> CraneLimits | None:
        entry = self._by_id.get(configuration_id)
        return None if entry is None else entry.crane.limits

    def get_safety_profile(self, configuration_id: str) -> SafetyProfile | None:
        entry = self._by_id.get(configuration_id)
        return None if entry is None else entry.profile


class RecommendLiftPlan:
    def __init__(
        self,
        *,
        catalog: CraneCatalogListing,
        active_load_chart_provider: ActiveLoadChartProvider,
        load_chart_interpolator: LoadChartInterpolator,
        accessory_provider: AccessoryProvider | None = None,
        time_budget_s: float = TIME_BUDGET_S,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._catalog = catalog
        self._chart_provider = active_load_chart_provider
        self._interpolator = load_chart_interpolator
        self._accessory_provider = accessory_provider
        self._time_budget_s = time_budget_s
        self._clock = clock

    def execute(self, request: PlanningRequest) -> PlanningResult:
        """Recomenda configurações, posições e trajetórias, da melhor para a pior.

        Levanta `PlanningInvalidInputError` para entrada que não dá para planejar.
        """
        load = request.load
        if not (math.isfinite(load.weight_kg) and load.weight_kg > 0):
            raise PlanningInvalidInputError("o peso da carga deve ser maior que zero")
        accessories = self._resolve_accessories(request.accessory_ids)
        accessory_drop_m = sum(item.rigging_height_m for item in accessories)
        accessory_weight_kg = sum(item.weight.kilograms for item in accessories)
        # Um moitão da cadeia substitui o gancho do modelo: a carga pende dele (como na cena).
        replaces_hook = any(item.type is AccessoryType.HOOK_BLOCK for item in accessories)
        hook_attach_m = REPLACED_HOOK_ATTACH_M if replaces_hook else request.hook_attach_m
        blocked = _blocked_ends_note(request)
        if blocked is not None:
            return PlanningResult((), (blocked,))
        deadline = self._clock() + self._time_budget_s

        entries, notes = self._read_catalog()
        if not entries:
            return PlanningResult((), (*notes, "Nenhum guindaste com tabela de carga ativa."))

        snapshot = _SnapshotProviders(entries)
        use_case = EvaluateOperation(
            crane_geometry_provider=snapshot,
            active_load_chart_provider=snapshot,
            load_chart_interpolator=self._interpolator,
            configuration_load_rules_provider=snapshot,
            crane_limits_provider=snapshot,
            safety_profile_provider=snapshot,
            accessory_provider=self._accessory_provider,
        )
        evaluator = _make_evaluator(use_case, request.accessory_ids)
        planner_cranes = [_planner_crane(entry) for entry in entries]
        wind = request.scenario.wind.speed_ms if request.scenario.wind else None
        wind_speed = wind if wind is not None and wind > 0 else None

        def search(
            crane: PlannerCrane,
            pick: PlanPoint,
            delivery: PlanPoint,
            *,
            keep: int,
            share_kg: float | None = None,
            capacity_share: float = 1.0,
            cargo_pick: PlanPoint | None = None,
            cargo_delivery: PlanPoint | None = None,
        ) -> PlanSearch:
            return plan_crane(
                crane=crane,
                scenario=request.scenario,
                load=load,
                pick=pick,
                delivery=delivery,
                evaluator=evaluator,
                share_kg=share_kg,
                extra_weight_kg=accessory_weight_kg,
                accessory_drop_m=accessory_drop_m,
                hook_attach_m=hook_attach_m,
                capacity_share=capacity_share,
                wind_speed_ms=wind_speed,
                keep=keep,
                deadline=deadline,
                clock=self._clock,
                hoist_pick=(pick.x, pick.z) if share_kg is not None else None,
                hoist_delivery=(delivery.x, delivery.z) if share_kg is not None else None,
                cargo_pick=cargo_pick,
                cargo_delivery=cargo_delivery,
            )

        rejections: dict[str, int] = {}
        timed_out = False

        def tracked(
            crane: PlannerCrane,
            pick: PlanPoint,
            delivery: PlanPoint,
            *,
            keep: int,
            share_kg: float | None = None,
            capacity_share: float = 1.0,
            cargo_pick: PlanPoint | None = None,
            cargo_delivery: PlanPoint | None = None,
        ) -> PlanSearch:
            """A busca, juntando os descartes e lembrando se o orçamento de tempo acabou (F-28)."""
            nonlocal timed_out
            found = search(
                crane,
                pick,
                delivery,
                keep=keep,
                share_kg=share_kg,
                capacity_share=capacity_share,
                cargo_pick=cargo_pick,
                cargo_delivery=cargo_delivery,
            )
            timed_out = timed_out or found.timed_out
            _merge(rejections, found)
            return found

        singles: list[CranePlan] = []
        for crane in planner_cranes:
            found = tracked(crane, request.pick, request.delivery, keep=1)
            singles.extend(found.plans)
        singles.sort(key=plan_sort_key)
        geometries = {crane.configuration_id: crane.geometry for crane in planner_cranes}

        valid_singles = [plan for plan in singles if plan.valid]
        if valid_singles:
            chosen = [
                _single_recommendation(plan, geometries[plan.configuration_id])
                for plan in valid_singles[:MAX_SINGLE_RESULTS]
            ]
            return PlanningResult(tuple(chosen), tuple(notes), timed_out)

        tandems = self._plan_tandem(planner_cranes, request, tracked, geometries, rejections)
        valid_tandems = [item for item in tandems if item.valid]
        if valid_tandems:
            return PlanningResult(
                tuple(valid_tandems[:MAX_TANDEM_RESULTS]),
                (
                    *notes,
                    "Nenhum guindaste sozinho atende: a recomendação usa dois guindastes (tandem).",
                ),
                timed_out,
            )

        fallback: list[Recommendation] = [
            _single_recommendation(plan, geometries[plan.configuration_id]) for plan in singles
        ]
        fallback.extend(tandems)
        fallback.sort(
            key=lambda item: (item.max_limit_utilization_percent, risk_rank(item.tipping_risk))
        )
        return PlanningResult(
            tuple(fallback[:MAX_FALLBACK_RESULTS]),
            (
                *notes,
                _rejection_note(rejections),
                *_tandem_pair_note(rejections),
                "Nenhuma opção atende ao limite de capacidade.",
            ),
            timed_out,
        )

    # ---- catálogo ------------------------------------------------------------------------------

    def _resolve_accessories(self, accessory_ids: Sequence[str]) -> tuple[Accessory, ...]:
        if not accessory_ids:
            return ()
        provider = self._accessory_provider
        found = {} if provider is None else provider.get_accessories(tuple(accessory_ids))
        missing = [item for item in accessory_ids if item not in found]
        if missing:
            raise PlanningInvalidInputError(f"acessório não encontrado: {missing[0]!r}")
        return tuple(found[item] for item in accessory_ids)

    def _read_catalog(self) -> tuple[list[_Entry], list[str]]:
        """Configurações com ficha técnica e ao menos uma tabela ativa."""
        entries: list[_Entry] = []
        notes: list[str] = []
        manufacturers = {item.id: item.name for item in self._catalog.list_manufacturers()}
        for crane in self._catalog.list_cranes():
            for configuration in self._catalog.list_configurations(crane.id):
                if configuration.geometry is None:
                    continue
                zones = configuration.rotation_zones
                codes: tuple[str | None, ...] = (None,) if zones is None else zones.codes
                charts = {}
                for code in codes:
                    chart = self._chart_provider.get_active_load_chart(
                        configuration.id, rotation_zone_code=code
                    )
                    if chart is not None:
                        charts[code] = chart
                if not charts:
                    continue
                label = " · ".join(
                    part
                    for part in (
                        manufacturers.get(crane.manufacturer_id),
                        crane.model_name,
                        configuration.name,
                    )
                    if part
                )
                entries.append(
                    _Entry(configuration, crane, label, _profile_of(crane.limits), charts)
                )
        return entries, notes

    # ---- tandem --------------------------------------------------------------------------------

    def _plan_tandem(
        self,
        planner_cranes: list[PlannerCrane],
        request: PlanningRequest,
        search: _Search,
        geometries: Mapping[str, CraneGeometry],
        rejections: dict[str, int],
    ) -> list[Recommendation]:
        load = request.load
        half_span = HOIST_POINT_FRACTION * load.length_m
        try:
            shares = split_load_by_cg(load.weight_kg, load.cg_offset_m, -half_span, half_span)
        except InvalidTandemGeometryError:
            return []

        def hoist_points(point: PlanPoint, offset: float) -> PlanPoint:
            dx, dz = direction(point.rotation_y_deg)
            return PlanPoint(point.x + dx * offset, point.z + dz * offset, point.rotation_y_deg)

        side_plans: list[list[CranePlan]] = []
        for offset, share in ((-half_span, shares.share_a_kg), (half_span, shares.share_b_kg)):
            pick = hoist_points(request.pick, offset)
            delivery = hoist_points(request.delivery, offset)
            plans: list[CranePlan] = []
            for crane in planner_cranes:
                found = search(
                    crane,
                    pick,
                    delivery,
                    keep=TANDEM_PLANS_PER_SIDE,
                    share_kg=share,
                    capacity_share=TANDEM_CAPACITY_SHARE,
                    # A carga inteira fica no centro dela, com o giro dado pelos dois ganchos.
                    cargo_pick=request.pick,
                    cargo_delivery=request.delivery,
                )
                plans.extend(found.plans)
            side_plans.append(plans)

        pairs: list[tuple[CranePlan, CranePlan]] = []
        for plan_a in side_plans[0]:
            for plan_b in side_plans[1]:
                separation = math.hypot(
                    plan_a.placement.x - plan_b.placement.x,
                    plan_a.placement.z - plan_b.placement.z,
                )
                if separation < MIN_TANDEM_SEPARATION_M:
                    continue
                problem = _impossible_pair(plan_a, plan_b)
                if problem is not None:
                    rejections[problem] = rejections.get(problem, 0) + 1
                    continue
                pairs.append((plan_a, plan_b))

        def pair_key(pair: tuple[CranePlan, CranePlan]) -> tuple[bool, float, int]:
            first, second = pair
            return (
                not (first.valid and second.valid),
                round(max(first.max_utilization_percent, second.max_utilization_percent), 1),
                max(risk_rank(first.tipping_risk), risk_rank(second.tipping_risk)),
            )

        pairs.sort(key=pair_key)
        results: list[Recommendation] = []
        seen: set[tuple[str, str]] = set()
        for first, second in pairs:
            ids = (first.configuration_id, second.configuration_id)
            if ids in seen:
                continue
            seen.add(ids)
            results.append(
                _tandem_recommendation(
                    first, second, geometries, shares.share_a_kg, shares.share_b_kg
                )
            )
            if len(results) >= MAX_TANDEM_RESULTS + MAX_FALLBACK_RESULTS:
                break
        return results


# ---- avaliação ---------------------------------------------------------------------------------


def _make_evaluator(use_case: EvaluateOperation, accessory_ids: Sequence[str]) -> StateEvaluator:
    def evaluate(
        *,
        configuration_id: str,
        state: CraneStateValues,
        load_weight_kg: float,
        ground_slope_deg: float | None,
        soil_kinds: Sequence[SoilKind],
        wind_speed_ms: float | None,
        obstacle_conflicts: Sequence[str],
    ) -> StateAssessment:
        evaluation = use_case.execute(
            configuration_id=configuration_id,
            state=OperationalState(
                boom_length=Length(state.boom_length_m),
                boom_angle=Angle(state.boom_angle_deg),
                turret_rotation=Angle(state.turret_rotation_deg),
                cable_length=Length(max(0.0, state.cable_length_m)),
            ),
            load_weight=Mass(load_weight_kg),
            outriggers=_ASSUMED_OUTRIGGERS,
            ground_slope_deg=ground_slope_deg,
            accessory_ids=accessory_ids,
            soil_kinds=soil_kinds,
            wind_speed_ms=wind_speed_ms,
            obstacle_conflicts=obstacle_conflicts,
        )
        if isinstance(evaluation, NotEvaluableOperation):
            return StateAssessment(evaluable=False, reason=str(evaluation.reasons[0].value))
        assert isinstance(evaluation, EvaluatedOperation)
        limit = evaluation.capacity_limit
        if limit is None:
            return StateAssessment(evaluable=False, reason="UTILIZATION_UNDEFINED")
        messages = tuple(
            alert.message for alert in evaluation.alerts if alert.severity is not AlertSeverity.INFO
        )
        return StateAssessment(
            evaluable=True,
            utilization_percent=limit.limit_utilization_percent,
            risk=evaluation.tipping_risk,
            messages=messages,
        )

    return evaluate


def _planner_crane(entry: _Entry) -> PlannerCrane:
    geometry = entry.configuration.geometry
    assert geometry is not None
    points = [point for chart in entry.charts.values() for point in chart.points]
    max_radius = max((point.working_radius.meters for point in points), default=0.0)
    low = geometry.boom_length_min.meters
    high = geometry.boom_length_max.meters
    lengths = sorted(
        {point.boom_length.meters for point in points if low <= point.boom_length.meters <= high}
    )
    if not lengths:
        lengths = sorted({low, high})
    if len(lengths) > MAX_BOOM_LENGTH_CANDIDATES:
        step = (len(lengths) - 1) / (MAX_BOOM_LENGTH_CANDIDATES - 1)
        lengths = [lengths[round(index * step)] for index in range(MAX_BOOM_LENGTH_CANDIDATES)]
    return PlannerCrane(
        configuration_id=entry.configuration.id,
        label=entry.label,
        geometry=geometry,
        profile=entry.profile,
        hook_block_weight_kg=(
            0.0
            if entry.configuration.hook_block_weight is None
            else entry.configuration.hook_block_weight.kilograms
        ),
        max_radius_m=max_radius,
        boom_lengths_m=tuple(lengths),
        manufacturer_id=entry.crane.manufacturer_id,
        crane_id=entry.crane.id,
        zone_boundaries_deg=_zone_boundaries(entry.configuration),
    )


def _zone_boundaries(configuration: CraneConfiguration) -> tuple[float, ...]:
    zones = configuration.rotation_zones
    return () if zones is None else tuple(sorted({zone.start_deg for zone in zones.zones}))


def _tandem_pair_note(rejections: dict[str, int]) -> tuple[str, ...]:
    """Por que pares de guindastes ficaram fora do tandem (F-04), se ficaram."""
    parts = [
        f"{rejections[key]} {text}"
        for key, text in _TANDEM_PAIR_TEXT.items()
        if rejections.get(key, 0) > 0
    ]
    if not parts:
        return ()
    return ("Pares de guindastes descartados para o tandem: " + "; ".join(parts) + ".",)


def _impossible_pair(first: CranePlan, second: CranePlan) -> str | None:
    """Por que o par não serve para o tandem, ou `None` (correção mínima do F-04, TASK-089).

    Cada guindaste é planejado sozinho; o par só é aceito se os corpos não se sobrepõem e os dois
    giram no mesmo sentido (em sentidos opostos, a distância entre os ganchos muda no caminho, e a
    carga, rígida, não acompanha)."""
    if crane_bodies_overlap(first.placement, second.placement):
        return TANDEM_BODIES
    if (
        abs(first.swing_deg) > _MIN_SWING_FOR_SENSE_DEG
        and abs(second.swing_deg) > _MIN_SWING_FOR_SENSE_DEG
        and first.swing_deg * second.swing_deg < 0
    ):
        return TANDEM_SENSES
    return None


def _names(obstacles: Sequence[ObstacleSpec]) -> str:
    return ", ".join(f"«{obstacle.label}»" for obstacle in obstacles)


def _blocked_ends_note(request: PlanningRequest) -> str | None:
    """Motivo claro quando a coleta ou a entrega não dão para nenhum guindaste (TASK-088)."""
    covered = pick_cover(request.scenario, request.load, request.pick)
    if covered:
        return (
            f"A carga na coleta fica sob ou dentro de {_names(covered)}: o gancho não chega a ela "
            "por cima. Tire a carga de baixo do obstáculo ou mude o ponto de coleta."
        )
    blocked = delivery_cover(request.scenario, request.load, request.delivery)
    if blocked:
        return (
            f"O ponto de entrega fica sob ou dentro de {_names(blocked)}: só a carreta ou o "
            "caminhão plataforma recebe a carga por cima. Mude o ponto de entrega."
        )
    return None


def _merge(rejections: dict[str, int], search: PlanSearch) -> None:
    for key, count in search.rejections.items():
        rejections[key] = rejections.get(key, 0) + count


def _rejection_note(rejections: dict[str, int]) -> str:
    combinations = {k: v for k, v in rejections.items() if k not in _TANDEM_PAIR_TEXT}
    parts = [
        f"{count} {_REJECTION_TEXT.get(key, 'sem tabela para o estado')}"
        for key, count in sorted(combinations.items(), key=lambda item: -item[1])[:3]
        if count > 0
    ]
    if not parts:
        return "Nenhuma posição ao alcance das lanças ficou livre."
    return "Combinações descartadas: " + "; ".join(parts) + "."


# ---- montagem das recomendações ----------------------------------------------------------------


def _fmt(value: float, digits: int = 1) -> str:
    return f"{value:.{digits}f}".replace(".", ",")


def _swing_text(swing_deg: float) -> str:
    side = "esquerda" if swing_deg > 0 else "direita"
    return f"{_fmt(abs(swing_deg), 0)}° para a {side}"


def _detail(plan: CranePlan) -> CraneDetail:
    return CraneDetail(
        configuration_id=plan.configuration_id,
        manufacturer_id=plan.manufacturer_id,
        crane_id=plan.crane_id,
        label=plan.label,
        share_kg=plan.share_kg,
        boom_length_m=plan.boom_length_m,
        boom_angle_pick_deg=plan.boom_angle_pick_deg,
        boom_angle_delivery_deg=plan.boom_angle_delivery_deg,
        pick_radius_m=plan.pick_radius_m,
        delivery_radius_m=plan.delivery_radius_m,
        swing_deg=plan.swing_deg,
        utilization_percent=plan.max_utilization_percent,
        transport_height_m=plan.transport_height_m,
        crossed_obstacle_ids=plan.crossed_obstacle_ids,
    )


def _plan_notes(plan: CranePlan, prefix: str = "") -> list[str]:
    placement = plan.placement
    notes = [
        f"{prefix}Posição do guindaste: X {_fmt(placement.x)} m, Z {_fmt(placement.z)} m, "
        f"rumo {_fmt(placement.heading_deg, 0)}°.",
        f"{prefix}Raio de {_fmt(plan.pick_radius_m)} m na coleta e "
        f"{_fmt(plan.delivery_radius_m)} m "
        f"na entrega; giro de {_swing_text(plan.swing_deg)}.",
        f"{prefix}Lança de {_fmt(plan.boom_length_m)} m, a {_fmt(plan.boom_angle_pick_deg, 0)}° na "
        f"coleta e {_fmt(plan.boom_angle_delivery_deg, 0)}° na entrega.",
        f"{prefix}Utilização máxima do limite: {_fmt(plan.max_utilization_percent, 0)} %.",
    ]
    if plan.crossed_obstacle_ids or plan.crosses_body:
        over = "os obstáculos do caminho" if plan.crossed_obstacle_ids else "o guindaste"
        if plan.crossed_obstacle_ids and plan.crosses_body:
            over += " e o guindaste"
        notes.append(
            f"{prefix}Carga erguida a {_fmt(plan.transport_height_m)} m do chão para passar sobre "
            f"{over}."
        )
    notes.extend(f"{prefix}{message}" for message in plan.messages)
    if not plan.valid:
        notes.append(f"{prefix}Esta opção passa do limite de capacidade ou do risco permitido.")
    return notes


def _summary(plan: CranePlan) -> str:
    return (
        f"{_fmt(plan.max_utilization_percent, 0)} % do limite · raio "
        f"{_fmt(max(plan.pick_radius_m, plan.delivery_radius_m))} m · "
        f"giro {_swing_text(plan.swing_deg)}"
    )


def _single_recommendation(plan: CranePlan, geometry: CraneGeometry) -> Recommendation:
    placement = plan.placement
    segments = build_segments(plan, geometry)
    return Recommendation(
        kind="single",
        configuration_ids=(plan.configuration_id,),
        placements=((placement.x, placement.z, placement.heading_deg),),
        max_limit_utilization_percent=plan.max_utilization_percent,
        tipping_risk=plan.tipping_risk,
        valid=plan.valid,
        trajectory=to_keyframes(segments, start_state(plan, geometry), 0),
        notes=tuple(_plan_notes(plan)),
        summary=_summary(plan),
        details=(_detail(plan),),
    )


def _tandem_recommendation(
    first: CranePlan,
    second: CranePlan,
    geometries: Mapping[str, CraneGeometry],
    share_a: float,
    share_b: float,
) -> Recommendation:
    segments = [
        build_segments(first, geometries[first.configuration_id]),
        build_segments(second, geometries[second.configuration_id]),
    ]
    schedule = common_schedule(segments)
    keyframes = (
        *to_keyframes(
            segments[0], start_state(first, geometries[first.configuration_id]), 0, schedule
        ),
        *to_keyframes(
            segments[1], start_state(second, geometries[second.configuration_id]), 1, schedule
        ),
    )
    utilization = max(first.max_utilization_percent, second.max_utilization_percent)
    risk = max((first.tipping_risk, second.tipping_risk), key=risk_rank)
    valid = first.valid and second.valid
    notes = [
        f"Divisão da carga: {_fmt(share_a, 0)} kg e {_fmt(share_b, 0)} kg, pela posição dos pontos "
        "de içamento em relação ao centro de gravidade.",
        "Cada guindaste usa no máximo 75 % da capacidade dele.",
        *_plan_notes(first, "Guindaste 1: "),
        *_plan_notes(second, "Guindaste 2: "),
    ]
    return Recommendation(
        kind="tandem",
        configuration_ids=(first.configuration_id, second.configuration_id),
        placements=tuple(
            (plan.placement.x, plan.placement.z, plan.placement.heading_deg)
            for plan in (first, second)
        ),
        max_limit_utilization_percent=utilization,
        tipping_risk=risk,
        valid=valid,
        trajectory=tuple(sorted(keyframes, key=lambda point: (point.t_s, point.crane_index))),
        notes=tuple(notes),
        summary=f"2 guindastes · {_fmt(utilization, 0)} % do limite (75 % cada)",
        details=(_detail(first), _detail(second)),
    )
