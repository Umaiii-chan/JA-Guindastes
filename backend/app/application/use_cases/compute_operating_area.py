"""Caso de uso `ComputeOperatingArea`: área de operação verde, amarela e vermelha (ADR-025; RN-011).

Para um comprimento de lança e uma carga, devolve uma grade polar de células (giro ψ × raio R) com
o nível de cada uma:

- `RED`: acima do limite do modelo (RN-011), fora da tabela de carga ou sem tabela ativa na zona;
- `YELLOW`: na faixa de atenção do limite;
- `GREEN`: abaixo da faixa de atenção.

Usa a estratégia de consulta injetada, a mesma da avaliação (na composição, `app/main.py`, a
interpolação linear provisória do ADR-030; a consulta conservadora do ADR-015/029 continua atrás
da mesma porta), as zonas de giro e o gancho da configuração (ADR-018), os acessórios de içamento
pedidos (RN-014) e o perfil de segurança (`SafetyProfileProvider`; padrões FICTÍCIOS até a
TASK-051). Na fronteira entre zonas vale a menor capacidade. Não grava nada.

O peso comparado é o da avaliação (`weight_compared_with_capacity`): carga + gancho + acessórios
(RN-014). Um `accessory_id` que não existe no catálogo levanta `OperatingAreaInvalidInputError`,
para a grade não sair verde com o peso subestimado.

A grade vai de `radius_step` até o alcance horizontal máximo da lança (`a + L`, ADR-013), de
`psi_step` em `psi_step` graus em [0°, 360°). O giro fora dos limites da ficha técnica não é
tratado à parte: a célula segue a tabela da zona.
"""

import math
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from enum import StrEnum

from app.application.ports.accessory_repository import AccessoryProvider
from app.application.ports.active_load_chart_provider import ActiveLoadChartProvider
from app.application.ports.configuration_load_rules_provider import (
    ConfigurationLoadRules,
    ConfigurationLoadRulesProvider,
)
from app.application.ports.crane_geometry_provider import CraneGeometryProvider
from app.application.ports.safety_profile_provider import SafetyProfileProvider
from app.domain.entities.accessory import Accessory
from app.domain.entities.load_chart import LoadChart
from app.domain.services.compared_load_weight import weight_compared_with_capacity
from app.domain.services.environment_factors import (
    slope_blocks,
    wind_blocks,
)
from app.domain.services.load_chart_interpolator import LoadChartInterpolator
from app.domain.services.safety_assessment import LimitLevel, limit_level
from app.domain.services.stability import assess_stability, wind_limit_ms
from app.domain.value_objects.capacity_query import CapacityQuery
from app.domain.value_objects.capacity_result import CapacityFound
from app.domain.value_objects.crane_geometry import CraneGeometry
from app.domain.value_objects.length import Length
from app.domain.value_objects.mass import Mass
from app.domain.value_objects.operational_geometry import OperationalGeometry, Point3D
from app.domain.value_objects.rotation_zone import RotationZone
from app.domain.value_objects.safety_profile import SafetyProfile

type ChartLookup = Callable[[RotationZone | None], LoadChart | None]

MAX_CELLS = 50_000
"""Teto de células por resposta, para uma grade fina demais não pesar no servidor."""


class AreaLevel(StrEnum):
    GREEN = "GREEN"
    YELLOW = "YELLOW"
    RED = "RED"


class OperatingAreaConfigurationNotFoundError(Exception):
    """A configuração não tem ficha técnica geométrica (não existe, ou não foi cadastrada)."""


class OperatingAreaInvalidInputError(Exception):
    """Parâmetros fora do que a grade aceita (passo inválido, grade grande demais, lança fora,
    acessório que não existe no catálogo)."""


@dataclass(frozen=True)
class OperatingAreaCell:
    psi_deg: float
    radius_m: float
    level: AreaLevel


@dataclass(frozen=True)
class OperatingArea:
    configuration_id: str
    boom_length_m: float
    load_weight_kg: float
    compared_weight_kg: float
    psi_step_deg: float
    radius_step_m: float
    max_radius_m: float
    cells: tuple[OperatingAreaCell, ...]


@dataclass(frozen=True)
class _StabilityInputs:
    """O que a estática de cada célula da grade usa além do raio e do giro (RN-017)."""

    crane: CraneGeometry
    profile: SafetyProfile
    ground_slope_deg: float | None
    wind_speed_ms: float | None
    load_wind_area_m2: float | None


def _worst_level(a: AreaLevel, b: AreaLevel) -> AreaLevel:
    order = (AreaLevel.GREEN, AreaLevel.YELLOW, AreaLevel.RED)
    return max(a, b, key=order.index)


def _stability_level(
    inputs: _StabilityInputs, boom_length_m: float, radius_m: float, psi_deg: float, compared: Mass
) -> AreaLevel:
    """Nível da estática da célula `(ψ, R)`: a lança com o ângulo que dá o raio `R` e o cabo mínimo.

    Raio sem lança possível (`R − a` fora de `[−L, L]`, ou ponta atrás do eixo): a célula não tem
    estática, e a faixa da tabela decide, como antes."""
    crane = inputs.crane
    cosine = (radius_m - crane.boom_pivot_offset_m) / boom_length_m
    if not 0 <= cosine <= 1:
        return AreaLevel.GREEN
    angle = math.acos(cosine)
    direction = (math.sin(math.radians(psi_deg)), math.cos(math.radians(psi_deg)))
    pivot_y = crane.boom_pivot_height.meters
    tip_y = pivot_y + boom_length_m * math.sin(angle)
    hook_y = tip_y - crane.cable_length_min.meters
    offset = crane.boom_pivot_offset_m
    geometry = OperationalGeometry(
        working_radius=Length(radius_m),
        boom_pivot=Point3D(offset * direction[0], pivot_y, offset * direction[1]),
        boom_tip=Point3D(radius_m * direction[0], tip_y, radius_m * direction[1]),
        hook=Point3D(radius_m * direction[0], hook_y, radius_m * direction[1]),
    )
    stability = assess_stability(
        params=inputs.profile.stability,
        crane_mass_kg=inputs.profile.crane_mass_kg,
        geometry=geometry,
        turret_rotation_deg=psi_deg,
        boom_length_m=boom_length_m,
        compared_weight_kg=compared.kilograms,
        ground_slope_deg=inputs.ground_slope_deg,
        wind_speed_ms=inputs.wind_speed_ms,
        load_wind_area_m2=inputs.load_wind_area_m2,
    )
    if stability.tipped or stability.tipping_ratio >= 1.0:
        return AreaLevel.RED
    if stability.tipping_ratio >= inputs.profile.stability.attention_ratio:
        return AreaLevel.YELLOW
    return AreaLevel.GREEN


class ComputeOperatingArea:
    def __init__(
        self,
        *,
        crane_geometry_provider: CraneGeometryProvider,
        active_load_chart_provider: ActiveLoadChartProvider,
        load_chart_interpolator: LoadChartInterpolator,
        configuration_load_rules_provider: ConfigurationLoadRulesProvider | None = None,
        safety_profile_provider: SafetyProfileProvider | None = None,
        accessory_provider: AccessoryProvider | None = None,
    ) -> None:
        self._geometry_provider = crane_geometry_provider
        self._chart_provider = active_load_chart_provider
        self._interpolator = load_chart_interpolator
        self._rules_provider = configuration_load_rules_provider
        self._profile_provider = safety_profile_provider
        self._accessory_provider = accessory_provider

    def execute(
        self,
        *,
        configuration_id: str,
        boom_length_m: float,
        load_weight: Mass,
        psi_step_deg: float = 10.0,
        radius_step_m: float = 1.0,
        ground_slope_deg: float | None = None,
        wind_speed_ms: float | None = None,
        accessory_ids: Sequence[str] = (),
        load_wind_area_m2: float | None = None,
    ) -> OperatingArea:
        """Calcula a grade. Terreno inclinado demais ou vento acima do limite (EN 13000) deixam
        tudo vermelho; em cada célula, a estabilidade (RN-017) também conta: `ρ ≥ 1` é vermelho e
        a faixa de atenção é amarela, com a inclinação e o vento como momento, como na avaliação.
        `accessory_ids` (RN-014): cada ocorrência soma o peso do acessório ao peso comparado.
        Levanta `OperatingAreaConfigurationNotFoundError` ou `OperatingAreaInvalidInputError`."""
        geometry = self._geometry_provider.get_crane_geometry(configuration_id)
        if geometry is None:
            raise OperatingAreaConfigurationNotFoundError(configuration_id)
        if not (math.isfinite(psi_step_deg) and 0 < psi_step_deg <= 180):
            raise OperatingAreaInvalidInputError("psi_step_deg deve estar em (0, 180]")
        if not (math.isfinite(radius_step_m) and radius_step_m > 0):
            raise OperatingAreaInvalidInputError("radius_step_m deve ser maior que zero")
        boom = geometry.boom_length_min.meters, geometry.boom_length_max.meters
        if not boom[0] <= boom_length_m <= boom[1]:
            raise OperatingAreaInvalidInputError(
                f"boom_length_m fora da faixa da ficha técnica ({boom[0]:g} a {boom[1]:g} m)"
            )

        max_radius = geometry.boom_pivot_offset_m + boom_length_m
        psi_count = math.ceil(360.0 / psi_step_deg - 1e-9)
        radius_count = max(0, math.floor(max_radius / radius_step_m + 1e-9))
        if psi_count * radius_count > MAX_CELLS:
            raise OperatingAreaInvalidInputError(
                f"a grade teria {psi_count * radius_count} células (máximo {MAX_CELLS}): "
                "aumente psi_step_deg ou radius_step_m"
            )

        accessories = self._resolve_accessories(accessory_ids)
        rules = self._rules(configuration_id)
        profile = self._profile(configuration_id)
        hook = rules.hook_block_weight or Mass(0.0)
        compared = weight_compared_with_capacity(load_weight, hook, accessories)
        # A inclinação e o vento deixaram de ser fatores da capacidade (RN-017; ADR-050).
        factor = 1.0
        blocked = slope_blocks(ground_slope_deg, profile) or wind_blocks(
            wind_speed_ms, wind_limit_ms(compared.kilograms, load_wind_area_m2, profile.stability)
        )
        stability_inputs = _StabilityInputs(
            crane=geometry,
            profile=profile,
            ground_slope_deg=ground_slope_deg,
            wind_speed_ms=wind_speed_ms,
            load_wind_area_m2=load_wind_area_m2,
        )

        # A tabela ativa de cada zona é buscada uma vez (a consulta ao banco é o custo).
        charts: dict[str | None, LoadChart | None] = {}

        def chart_for(zone: RotationZone | None) -> LoadChart | None:
            code = None if zone is None else zone.code
            if code not in charts:
                charts[code] = self._chart_provider.get_active_load_chart(
                    configuration_id, rotation_zone_code=code
                )
            return charts[code]

        cells: list[OperatingAreaCell] = []
        for psi_index in range(psi_count):
            psi = psi_index * psi_step_deg
            zones: tuple[RotationZone | None, ...] = (
                (None,) if rules.rotation_zones is None else rules.rotation_zones.zones_at(psi)
            )
            for radius_index in range(1, radius_count + 1):
                radius = radius_index * radius_step_m
                level = self._cell_level(
                    zones, chart_for, boom_length_m, radius, compared, profile, factor, blocked
                )
                if level is not AreaLevel.RED and not blocked:
                    level = _worst_level(
                        level,
                        _stability_level(stability_inputs, boom_length_m, radius, psi, compared),
                    )
                cells.append(OperatingAreaCell(psi_deg=psi, radius_m=radius, level=level))

        return OperatingArea(
            configuration_id=configuration_id,
            boom_length_m=boom_length_m,
            load_weight_kg=load_weight.kilograms,
            compared_weight_kg=compared.kilograms,
            psi_step_deg=psi_step_deg,
            radius_step_m=radius_step_m,
            max_radius_m=max_radius,
            cells=tuple(cells),
        )

    def _cell_level(
        self,
        zones: tuple[RotationZone | None, ...],
        chart_for: ChartLookup,
        boom_length_m: float,
        radius_m: float,
        compared: Mass,
        profile: SafetyProfile,
        factor: float = 1.0,
        blocked: bool = False,
    ) -> AreaLevel:
        if blocked:
            return AreaLevel.RED
        query = CapacityQuery(boom_length=Length(boom_length_m), working_radius=Length(radius_m))
        capacities: list[Mass] = []
        for zone in zones:
            chart = chart_for(zone)
            if chart is None:
                return AreaLevel.RED
            result = self._interpolator.calculate_capacity(chart, query)
            if not isinstance(result, CapacityFound):
                return AreaLevel.RED
            capacities.append(result.max_capacity)
        # Menor capacidade (lado seguro), como na avaliação.
        capacity = min(capacities)
        match limit_level(compared.kilograms, capacity.kilograms, profile, factor):
            case LimitLevel.OVER:
                return AreaLevel.RED
            case LimitLevel.WARNING:
                return AreaLevel.YELLOW
            case LimitLevel.OK:
                return AreaLevel.GREEN

    def _resolve_accessories(self, accessory_ids: Sequence[str]) -> tuple[Accessory, ...]:
        """Os acessórios pedidos, na ordem e com repetições, como `EvaluateOperation` resolve.

        Na avaliação, um id desconhecido deixa a operação não avaliável (`ACCESSORY_NOT_FOUND`);
        a grade não tem esse estado, então o pedido é recusado em vez de sair com o peso menor."""
        if not accessory_ids:
            return ()
        provider = self._accessory_provider
        found = {} if provider is None else provider.get_accessories(tuple(accessory_ids))
        missing = [item for item in accessory_ids if item not in found]
        if missing:
            raise OperatingAreaInvalidInputError(f"acessório não encontrado: {missing[0]!r}")
        return tuple(found[item] for item in accessory_ids)

    def _rules(self, configuration_id: str) -> ConfigurationLoadRules:
        provider = self._rules_provider
        rules = None if provider is None else provider.get_load_rules(configuration_id)
        return ConfigurationLoadRules() if rules is None else rules

    def _profile(self, configuration_id: str) -> SafetyProfile:
        provider = self._profile_provider
        profile = None if provider is None else provider.get_safety_profile(configuration_id)
        return SafetyProfile() if profile is None else profile
