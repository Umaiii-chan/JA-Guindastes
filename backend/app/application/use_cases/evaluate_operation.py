"""Caso de uso `EvaluateOperation` (doc-fonte §§ 14.1 a 14.3; RF-015..RF-018, RF-020; ADR-018).

Liga as peças do motor de cálculo na ordem da doc-fonte § 14.1:

1. `GeometryService` (ADR-013 C-5): raio de trabalho, alturas e posições a partir do estado
   operacional e da ficha técnica da configuração (`CraneGeometryProvider`);
2. `LoadChartResolver`: a tabela `ACTIVE` da configuração (`ActiveLoadChartProvider`; RN-001).
   Com **zonas de giro** (ADR-018 § 1; `ConfigurationLoadRulesProvider`), o giro ψ escolhe a zona,
   e vale a tabela ativa dela; a ±ε de uma fronteira, valem as tabelas ativas das duas zonas
   vizinhas;
3. `LoadChartInterpolator`: a capacidade para o comprimento de lança do estado e o **raio
   calculado** (estratégia injetada: na composição, `app/main.py`, a `LinearInterpolationLookup`
   provisória do ADR-030; a `ConservativeTabulatedLookup` do ADR-015/029 e a `ExactPointLookup`
   continuam atrás da mesma porta). Na fronteira, vale a **menor** capacidade das duas zonas
   (lado seguro);
4. utilização `peso comparado / capacidade × 100` (doc-fonte § 14.3). O peso comparado é o de
   `weight_compared_with_capacity`: **carga + gancho** (ADR-018 § 2), com o peso do gancho
   cadastrado na configuração (`None` = 0 kg).

Sem zonas, a configuração se comporta como antes da TASK-046: a tabela ativa sem zona vale para
todo o giro.

Limite de capacidade por modelo (TASK-051; RN-011; ADR-022): a operação avaliada traz o
`CapacityLimit` (capacidade efetiva, utilização contra o limite e faixa OK/WARNING/OVER), com os
limites do guindaste da configuração (`CraneLimitsProvider`; sem ele, valem os padrões).

O `SafetyValidator` da doc-fonte não entra: os níveis de alerta e os limiares estão pendentes
(PEND-004; known-gaps P-005). Por isso o resultado só distingue "avaliado" de "não avaliável" e
lista os motivos, sem `WARNING` nem `CRITICAL`.

Tolerância na busca do ponto: é a da estratégia injetada (ε do ADR-015 na composição). Este caso de
uso passa o raio calculado como está.

Não grava nada. Quem o chama: `POST /api/v1/evaluations` (TASK-024) e o WebSocket
`/api/v1/ws/evaluation` (TASK-025), ligados aos repositórios de banco na raiz de composição
(`app.main`, TASK-029).
"""

import math
from collections.abc import Sequence
from dataclasses import dataclass, replace
from enum import StrEnum

from app.application.ports.accessory_repository import AccessoryProvider
from app.application.ports.active_load_chart_provider import ActiveLoadChartProvider
from app.application.ports.configuration_load_rules_provider import (
    ConfigurationLoadRules,
    ConfigurationLoadRulesProvider,
)
from app.application.ports.crane_geometry_provider import CraneGeometryProvider
from app.application.ports.crane_limits_provider import CraneLimitsProvider
from app.application.ports.safety_profile_provider import SafetyProfileProvider
from app.domain.entities.accessory import Accessory, AccessoryType
from app.domain.entities.load import Load
from app.domain.entities.load_chart import LoadChart, LoadChartStatus
from app.domain.entities.scenario import PowerLineSpec
from app.domain.exceptions.domain_errors import UndefinedUtilizationError
from app.domain.exceptions.geometry_errors import (
    OperationalLimitViolation,
    OperationalStateOutOfLimitsError,
    OutsideGeometricDomainError,
)
from app.domain.services import rigging
from app.domain.services.capacity_limit import CapacityLimit, evaluate_capacity_limit
from app.domain.services.compared_load_weight import weight_compared_with_capacity
from app.domain.services.critical_lift import CriticalLiftAssessment, assess_critical_lift
from app.domain.services.environment_factors import SoilKind, slope_blocks, wind_blocks
from app.domain.services.geometry_service import calculate_operational_geometry
from app.domain.services.load_chart_interpolator import LoadChartInterpolator
from app.domain.services.planning.planner import HOOK_ATTACH_M, REPLACED_HOOK_ATTACH_M
from app.domain.services.power_line import (
    ATTENTION_FACTOR,
    ClearanceStatus,
    CraneParts,
    LineClearance,
    assess_power_lines,
)
from app.domain.services.safety_assessment import (
    AlertSeverity,
    OutriggerSetting,
    SafetyAlert,
    TippingRisk,
    assess_safety,
    limit_level,
)
from app.domain.services.stability import StabilityResult, assess_stability, wind_limit_ms
from app.domain.services.utilization import calculate_utilization_percent
from app.domain.value_objects.capacity_query import CapacityQuery
from app.domain.value_objects.capacity_result import (
    CapacityFound,
    CapacityResult,
    CapacityUnsupported,
    CapacityUnsupportedReason,
)
from app.domain.value_objects.crane_limits import CraneLimits
from app.domain.value_objects.mass import Mass
from app.domain.value_objects.operational_geometry import OperationalGeometry, Point3D
from app.domain.value_objects.operational_state import OperationalState
from app.domain.value_objects.rotation_zone import RotationZone
from app.domain.value_objects.safety_profile import SafetyProfile

ZERO_MASS = Mass(0.0)


class NotEvaluableReason(StrEnum):
    """Motivos de "não avaliável" que nascem neste caso de uso, legíveis por máquina.

    Os outros motivos vêm do domínio, sem tradução: `OperationalLimitViolation` (estado fora das
    faixas da ficha técnica, um por faixa violada) e `CapacityUnsupportedReason` (consulta fora do
    domínio da tabela). A mensagem mostrada ao usuário ainda não está definida (doc-fonte § 26,
    pergunta 9).
    """

    CRANE_GEOMETRY_NOT_FOUND = "CRANE_GEOMETRY_NOT_FOUND"
    """A configuração não tem ficha técnica geométrica: a geometria não pode ser calculada."""
    OUTSIDE_GEOMETRIC_DOMAIN = "OUTSIDE_GEOMETRIC_DOMAIN"
    """A ponta da lança fica atrás do eixo de giro (R < 0); o raio não vira |R| (ADR-013 C-5)."""
    ACTIVE_LOAD_CHART_NOT_FOUND = "ACTIVE_LOAD_CHART_NOT_FOUND"
    """A configuração não tem tabela de carga ativa (RN-001, RN-004); com zonas de giro, a zona de
    ψ não tem tabela ativa, e o resultado informa a zona (ADR-018)."""
    UTILIZATION_UNDEFINED = "UTILIZATION_UNDEFINED"
    """A tabela devolveu capacidade 0 kg, e a utilização não pode ser calculada."""
    ACCESSORY_NOT_FOUND = "ACCESSORY_NOT_FOUND"
    """Algum `accessory_id` pedido não existe no catálogo (TASK-056): o peso comparado ficaria
    subestimado, então a operação não é avaliável (RN-014)."""


type EvaluationReason = NotEvaluableReason | OperationalLimitViolation | CapacityUnsupportedReason
"""Motivo de uma operação não avaliável. Todos são `StrEnum`, e o tipo diz de qual etapa veio."""


@dataclass(frozen=True)
class EvaluatedOperation:
    """Operação avaliada: a tabela suporta o estado, e o peso foi comparado com a capacidade.

    "Avaliada" não quer dizer "segura" nem "permitida": não há status nem nível de alerta
    (PEND-004), e utilização acima de 100 % também é só avaliada. Se carga igual à capacidade é
    violação também não está decidido (known-gaps P-005).

    - `geometry`: raio, alturas e posições do ADR-013, calculados no backend (RN-008).
    - `capacity`: capacidade admissível do ponto da tabela (RN-004), com o id e a versão da tabela.
      Na fronteira entre duas zonas, é a menor das duas.
    - `utilization_percent`: `compared_weight / capacidade × 100`, sem arredondamento (PEND-002).
    - `load_weight` e `hook_block_weight`: as parcelas do peso comparado (ADR-018 § 2).
    - `rotation_zone`: a zona cuja tabela deu a capacidade, ou `None` sem zonas de giro.
    - `capacity_limit`: o limite de capacidade do modelo e a faixa OK/WARNING/OVER (RN-011;
      TASK-051), calculado sobre a capacidade da tabela. `None` só se a capacidade efetiva for 0.
    - `accessories`: os acessórios de içamento somados ao peso comparado (TASK-056; RN-014).
    - `stability`: a estática da operação (RN-017; TASK-106): tombamento por momentos sobre o
      polígono das sapatas, reação em cada sapata e flecha. `None` se a geometria não foi calculada.
    """

    geometry: OperationalGeometry
    capacity: CapacityFound
    utilization_percent: float
    load_weight: Mass
    hook_block_weight: Mass = ZERO_MASS
    rotation_zone: RotationZone | None = None
    capacity_limit: CapacityLimit | None = None
    tipping_risk: TippingRisk | None = None
    alerts: tuple[SafetyAlert, ...] = ()
    accessories: tuple[Accessory, ...] = ()
    stability: StabilityResult | None = None
    power_line_clearances: tuple[LineClearance, ...] = ()
    critical_lift: CriticalLiftAssessment | None = None

    @property
    def compared_weight(self) -> Mass:
        """Carga + gancho + acessórios: o peso comparado (`weight_compared_with_capacity`)."""
        return weight_compared_with_capacity(
            self.load_weight, self.hook_block_weight, self.accessories
        )

    @property
    def load_chart_id(self) -> str:
        return self.capacity.load_chart_id

    @property
    def load_chart_version(self) -> str:
        """Versão da tabela usada no cálculo (RN-005)."""
        return self.capacity.load_chart_version

    @property
    def reasons(self) -> tuple[EvaluationReason, ...]:
        """Sempre vazio: os motivos só explicam por que uma operação não é avaliável."""
        return ()


@dataclass(frozen=True)
class NotEvaluableOperation:
    """Operação não avaliável: não há utilização, só os motivos (RN-007, RF-020).

    Não há `utilization_percent` aqui de propósito: quem recebe este resultado não tem número para
    ler por engano (mesmo raciocínio do `CapacityUnsupported`, TASK-008).

    - `reasons`: todos os motivos encontrados, nunca vazio, na ordem das etapas (ficha técnica e
      geometria, tabela ativa, consulta à tabela, utilização).
    - `geometry`: presente quando a geometria pôde ser calculada, mesmo sem capacidade (ADR-013
      C-6: "a geometria continua aparecendo; a capacidade, não"). `None` sem ficha técnica, com o
      estado fora das faixas ou com R < 0.
    - `capacity`: o resultado da consulta à tabela, quando ela foi feita, ou `None`. É
      `CapacityUnsupported` fora do domínio da tabela, ou `CapacityFound` com 0 kg quando a
      utilização é indefinida.
    - `load_weight` e `hook_block_weight`: as parcelas do peso comparado (ADR-018 § 2).
    - `rotation_zone`: com zonas de giro, a zona de ψ. Sem tabela ativa, é a zona sem tabela; com a
      consulta fora da tabela, a zona da tabela consultada; na fronteira sem consulta, a primeira
      das duas zonas na ordem declarada. `None` sem zonas.
    """

    reasons: tuple[EvaluationReason, ...]
    geometry: OperationalGeometry | None = None
    capacity: CapacityResult | None = None
    load_weight: Mass = ZERO_MASS
    hook_block_weight: Mass = ZERO_MASS
    rotation_zone: RotationZone | None = None
    tipping_risk: TippingRisk | None = None
    alerts: tuple[SafetyAlert, ...] = ()
    accessories: tuple[Accessory, ...] = ()
    stability: StabilityResult | None = None
    power_line_clearances: tuple[LineClearance, ...] = ()
    critical_lift: CriticalLiftAssessment | None = None

    def __post_init__(self) -> None:
        reasons = tuple(self.reasons)
        if not reasons:
            raise ValueError("operação não avaliável precisa de pelo menos um motivo (RN-007)")
        object.__setattr__(self, "reasons", reasons)

    @property
    def compared_weight(self) -> Mass:
        """Carga + gancho + acessórios, mesmo sem capacidade para comparar."""
        return weight_compared_with_capacity(
            self.load_weight, self.hook_block_weight, self.accessories
        )

    @property
    def load_chart_id(self) -> str | None:
        """Id da tabela consultada, ou `None` se a tabela não chegou a ser consultada."""
        return None if self.capacity is None else self.capacity.load_chart_id

    @property
    def load_chart_version(self) -> str | None:
        """Versão da tabela consultada (RN-005), ou `None` se ela não chegou a ser consultada."""
        return None if self.capacity is None else self.capacity.load_chart_version


type OperationEvaluation = EvaluatedOperation | NotEvaluableOperation


class InconsistentActiveLoadChartError(Exception):
    """O provedor da tabela ativa devolveu uma tabela não `ACTIVE`, de outra configuração ou de
    outra zona de giro.

    É erro de programação no adapter (quebra o contrato da porta), e não resultado de avaliação: a
    capacidade nunca pode vir de uma tabela de outra configuração (RN-001, RN-004), de outra zona
    nem de uma tabela que não está ativa. Por isso levanta exceção em vez de devolver "não
    avaliável".
    """


type _ZoneChart = tuple[RotationZone | None, LoadChart]


@dataclass(frozen=True, slots=True)
class SiteContext:
    """O local da operação, para a rede elétrica e o içamento crítico (D4; TASK-107; ADR-051).

    Sem ele, a avaliação não olha a rede nem classifica o içamento (o resultado é o de antes).
    `crane_*` posicionam o guindaste no mundo (a geometria vem no referencial do chassi, com o
    plano de apoio em y = 0, como a altura da rede); `load_*_m` são as dimensões da carga (sem elas
    não há carga na conta da distância); `sling_angle_deg` é o ângulo das lingas (sem ele, o padrão
    da carga: a mesma geometria do plano, F-19).
    """

    power_lines: tuple[PowerLineSpec, ...] = ()
    crane_x_m: float = 0.0
    crane_z_m: float = 0.0
    crane_heading_deg: float = 0.0
    load_length_m: float | None = None
    load_width_m: float | None = None
    load_height_m: float | None = None
    sling_angle_deg: float | None = None
    hook_attach_m: float = HOOK_ATTACH_M
    tandem: bool = False
    load_over_occupied: bool = False


class EvaluateOperation:
    """Avalia um estado operacional contra a tabela ativa da configuração (ou da zona de ψ).

    Nunca propaga os erros de domínio da geometria (estado fora das faixas, R < 0): devolve
    `NotEvaluableOperation` com as violações, como pede o ADR-013 C-5 ("sinaliza, e não corrige") e
    no espírito da RN-007. A ficha técnica e a tabela ativa são buscadas sempre, para o resultado
    listar de uma vez os problemas das duas; a tabela só é **consultada** quando há geometria.

    `configuration_load_rules_provider` fornece as zonas de giro e o peso do gancho (ADR-018). Sem
    ele (ou com `None` da porta), a configuração é tratada como sem zonas e sem gancho.
    """

    def __init__(
        self,
        *,
        crane_geometry_provider: CraneGeometryProvider,
        active_load_chart_provider: ActiveLoadChartProvider,
        load_chart_interpolator: LoadChartInterpolator,
        configuration_load_rules_provider: ConfigurationLoadRulesProvider | None = None,
        crane_limits_provider: CraneLimitsProvider | None = None,
        safety_profile_provider: SafetyProfileProvider | None = None,
        accessory_provider: AccessoryProvider | None = None,
    ) -> None:
        self._crane_geometry_provider = crane_geometry_provider
        self._active_load_chart_provider = active_load_chart_provider
        self._load_chart_interpolator = load_chart_interpolator
        self._configuration_load_rules_provider = configuration_load_rules_provider
        self._crane_limits_provider = crane_limits_provider
        self._safety_profile_provider = safety_profile_provider
        self._accessory_provider = accessory_provider

    def execute_for_load(
        self, *, configuration_id: str, state: OperationalState, load: Load
    ) -> OperationEvaluation:
        """Avalia `state` com a carga `load` (TASK-028) na configuração `configuration_id`.

        O peso comparado com a capacidade é `weight_compared_with_capacity`: o peso informado mais
        o gancho da configuração (ADR-018 § 2). Descrição, dimensões e centro de gravidade não
        entram no cálculo (nenhuma regra documentada os usa). O resultado é o mesmo de `execute`
        com `load.weight`.

        Levanta `InconsistentActiveLoadChartError` se o provedor da tabela quebrar o contrato.
        """
        return self.execute(configuration_id=configuration_id, state=state, load_weight=load.weight)

    def execute(
        self,
        *,
        configuration_id: str,
        state: OperationalState,
        load_weight: Mass,
        outriggers: OutriggerSetting | None = None,
        ground_slope_deg: float | None = None,
        accessory_ids: Sequence[str] = (),
        soil_kinds: Sequence[SoilKind] = (),
        wind_speed_ms: float | None = None,
        obstacle_conflicts: Sequence[str] = (),
        capacity_factor: float = 1.0,
        load_wind_area_m2: float | None = None,
        site: SiteContext | None = None,
    ) -> OperationEvaluation:
        """Avalia como `_evaluate_load_chart` e acrescenta o risco de tombamento e os alertas.

        `outriggers` e `ground_slope_deg` são opcionais (leva E; ADR-025): ausentes, não entram
        no risco e geram alertas INFO de "não informado" (RN-013). `soil_kinds`, `wind_speed_ms` e
        `obstacle_conflicts` (RN-017) também são opcionais, mas ausentes não geram alerta.
        A inclinação residual e o vento entram na estática de estabilidade (`stability`, RN-017;
        ADR-050), e não mais como fatores da capacidade efetiva. `load_wind_area_m2` é a área de
        vento da carga (`A_W`, EN 13000); ausente, a velocidade máxima de rajada é a da tabela.

        `capacity_factor` (RN-016; TASK-074) é um fator adicional sobre a capacidade efetiva, para
        o içamento com dois guindastes (0,75). O padrão (1) não muda nada.

        `site` (TASK-107; ADR-051): a rede elétrica do cenário e o contexto do içamento. Com ele, o
        resultado traz a distância às redes e a classificação de içamento crítico, e os alertas
        correspondentes entram DEPOIS do `assess_safety`: não mudam o `tipping_risk`.
        """
        profile = self.safety_profile(configuration_id)
        evaluation = self._evaluate_load_chart(
            configuration_id=configuration_id,
            state=state,
            load_weight=load_weight,
            accessory_ids=accessory_ids,
            ground_slope_deg=ground_slope_deg,
            wind_speed_ms=wind_speed_ms,
            profile=profile,
            capacity_factor=capacity_factor,
            load_wind_area_m2=load_wind_area_m2,
        )
        stability = (
            None
            if evaluation.geometry is None
            else assess_stability(
                params=profile.stability,
                crane_mass_kg=profile.crane_mass_kg,
                geometry=evaluation.geometry,
                turret_rotation_deg=state.turret_rotation.degrees,
                boom_length_m=state.boom_length.meters,
                compared_weight_kg=evaluation.compared_weight.kilograms,
                outrigger_extension_percent=(
                    None if outriggers is None else outriggers.extension_percent
                ),
                ground_slope_deg=ground_slope_deg,
                wind_speed_ms=wind_speed_ms,
                load_wind_area_m2=load_wind_area_m2,
            )
        )
        capacity = evaluation.capacity
        if isinstance(capacity, CapacityFound):
            level = limit_level(
                evaluation.compared_weight.kilograms,
                capacity.max_capacity.kilograms,
                profile,
                capacity_factor,
            )
        else:
            level = None
        outside_chart = any(
            isinstance(reason, CapacityUnsupportedReason) for reason in evaluation.reasons
        )
        assessment = assess_safety(
            profile=profile,
            load_weight_kg=load_weight.kilograms,
            level=level,
            outside_chart=outside_chart,
            outriggers=outriggers,
            ground_slope_deg=ground_slope_deg,
            soil_kinds=soil_kinds,
            wind_speed_ms=wind_speed_ms,
            obstacle_conflicts=obstacle_conflicts,
            stability=stability,
            wind_limit_ms=wind_limit_ms(
                evaluation.compared_weight.kilograms, load_wind_area_m2, profile.stability
            ),
        )
        result = replace(
            evaluation,
            tipping_risk=assessment.tipping_risk,
            alerts=assessment.alerts,
            stability=stability,
        )
        if site is None:
            return result
        return self._with_site(
            result,
            site,
            profile=profile,
            ground_slope_deg=ground_slope_deg,
            wind_speed_ms=wind_speed_ms,
            wind_limit=wind_limit_ms(
                evaluation.compared_weight.kilograms, load_wind_area_m2, profile.stability
            ),
        )

    def _with_site(
        self,
        result: OperationEvaluation,
        site: SiteContext,
        *,
        profile: SafetyProfile,
        ground_slope_deg: float | None,
        wind_speed_ms: float | None,
        wind_limit: float,
    ) -> OperationEvaluation:
        """Distância às redes e içamento crítico; os alertas novos entram sem tocar no risco."""
        clearances = _power_line_clearances(result, site)
        capacity_limit = result.capacity_limit if isinstance(result, EvaluatedOperation) else None
        usage_ratio = (
            None if capacity_limit is None else capacity_limit.limit_utilization_percent / 100
        )
        min_ratio = (
            min(c.swept_distance_m / c.required_m for c in clearances) if clearances else None
        )
        critical = assess_critical_lift(
            capacity_usage_ratio=usage_ratio,
            tandem=site.tandem,
            load_over_occupied=site.load_over_occupied,
            min_clearance_ratio=min_ratio,
            wind_speed_ms=wind_speed_ms,
            wind_limit_ms=wind_limit,
            ground_slope_deg=ground_slope_deg,
            max_ground_slope_deg=profile.max_ground_slope_deg,
            soil_attention=any(alert.code in _SOIL_ATTENTION_CODES for alert in result.alerts),
        )
        new_alerts = [*_clearance_alerts(clearances), *_critical_alerts(critical)]
        alerts = tuple(sorted((*result.alerts, *new_alerts), key=_alert_rank))
        return replace(
            result, alerts=alerts, power_line_clearances=clearances, critical_lift=critical
        )

    def safety_profile(self, configuration_id: str) -> SafetyProfile:
        """Parâmetros de segurança da configuração; sem provedor ou sem dado, os padrões."""
        provider = self._safety_profile_provider
        profile = None if provider is None else provider.get_safety_profile(configuration_id)
        return SafetyProfile() if profile is None else profile

    def _evaluate_load_chart(
        self,
        *,
        configuration_id: str,
        state: OperationalState,
        load_weight: Mass,
        accessory_ids: Sequence[str] = (),
        ground_slope_deg: float | None = None,
        wind_speed_ms: float | None = None,
        profile: SafetyProfile | None = None,
        capacity_factor: float = 1.0,
        load_wind_area_m2: float | None = None,
    ) -> OperationEvaluation:
        """Avalia `state` com o peso da carga `load_weight` na configuração `configuration_id`.

        É a entrada dos contratos REST e WebSocket, que recebem só `load_weight_kg`. O gancho da
        configuração é somado aqui, por `weight_compared_with_capacity`.

        `accessory_ids` (TASK-056; RN-014): acessórios de içamento do catálogo; cada ocorrência soma
        o peso do acessório ao peso comparado. Um id desconhecido (ou sem catálogo de acessórios)
        deixa a operação não avaliável com `ACCESSORY_NOT_FOUND`, em vez de subestimar o peso.

        Levanta `InconsistentActiveLoadChartError` se o provedor da tabela quebrar o contrato.
        """
        safety_profile = SafetyProfile() if profile is None else profile
        rules = self._load_rules(configuration_id)
        hook_block_weight = rules.hook_block_weight or ZERO_MASS
        accessories, missing_accessories = self._resolve_accessories(accessory_ids)
        compared_weight = weight_compared_with_capacity(load_weight, hook_block_weight, accessories)
        zones: tuple[RotationZone | None, ...] = (
            (None,)
            if rules.rotation_zones is None
            else rules.rotation_zones.zones_at(state.turret_rotation.degrees)
        )

        geometry, geometry_reasons = self._calculate_geometry(configuration_id, state)
        charts, missing_zone = self._resolve_active_load_charts(configuration_id, zones)
        if geometry is None or missing_zone is not None or missing_accessories:
            chart_reasons = () if missing_zone is None else _NO_ACTIVE_CHART
            accessory_reasons = _ACCESSORY_NOT_FOUND if missing_accessories else ()
            return NotEvaluableOperation(
                reasons=(*geometry_reasons, *chart_reasons, *accessory_reasons),
                geometry=geometry,
                load_weight=load_weight,
                hook_block_weight=hook_block_weight,
                rotation_zone=zones[0] if missing_zone is None else missing_zone[0],
                accessories=accessories,
            )

        query = CapacityQuery(boom_length=state.boom_length, working_radius=geometry.working_radius)
        found: list[tuple[RotationZone | None, CapacityFound]] = []
        for zone, chart in charts:
            capacity = self._load_chart_interpolator.calculate_capacity(chart, query)
            if isinstance(capacity, CapacityUnsupported):
                # Na fronteira, sem a capacidade de uma das zonas não há "menor" confiável.
                return NotEvaluableOperation(
                    reasons=(capacity.reason,),
                    geometry=geometry,
                    capacity=capacity,
                    load_weight=load_weight,
                    hook_block_weight=hook_block_weight,
                    rotation_zone=zone,
                    accessories=accessories,
                )
            found.append((zone, capacity))

        # Menor capacidade (lado seguro); no empate, a primeira zona na ordem declarada.
        zone, capacity = min(found, key=lambda item: item[1].max_capacity)
        try:
            utilization_percent = calculate_utilization_percent(
                compared_weight, capacity.max_capacity
            )
        except UndefinedUtilizationError:
            return NotEvaluableOperation(
                reasons=(NotEvaluableReason.UTILIZATION_UNDEFINED,),
                geometry=geometry,
                capacity=capacity,
                load_weight=load_weight,
                hook_block_weight=hook_block_weight,
                rotation_zone=zone,
                accessories=accessories,
            )

        return EvaluatedOperation(
            geometry=geometry,
            capacity=capacity,
            utilization_percent=utilization_percent,
            load_weight=load_weight,
            hook_block_weight=hook_block_weight,
            rotation_zone=zone,
            capacity_limit=evaluate_capacity_limit(
                capacity.max_capacity,
                compared_weight,
                self._crane_limits(configuration_id),
                extra_factor=capacity_factor,
                blocked=slope_blocks(ground_slope_deg, safety_profile)
                or wind_blocks(
                    wind_speed_ms,
                    wind_limit_ms(
                        compared_weight.kilograms, load_wind_area_m2, safety_profile.stability
                    ),
                ),
            ),
            accessories=accessories,
        )

    def _crane_limits(self, configuration_id: str) -> CraneLimits | None:
        provider = self._crane_limits_provider
        return None if provider is None else provider.get_crane_limits(configuration_id)

    def _resolve_accessories(
        self, accessory_ids: Sequence[str]
    ) -> tuple[tuple[Accessory, ...], bool]:
        """Os acessórios pedidos, na ordem e com repetições, e se algum id não foi encontrado."""
        if not accessory_ids:
            return (), False
        provider = self._accessory_provider
        found = {} if provider is None else provider.get_accessories(tuple(accessory_ids))
        accessories = tuple(found[item] for item in accessory_ids if item in found)
        return accessories, len(accessories) != len(accessory_ids)

    def _load_rules(self, configuration_id: str) -> ConfigurationLoadRules:
        provider = self._configuration_load_rules_provider
        rules = None if provider is None else provider.get_load_rules(configuration_id)
        return ConfigurationLoadRules() if rules is None else rules

    def _calculate_geometry(
        self, configuration_id: str, state: OperationalState
    ) -> tuple[OperationalGeometry | None, tuple[EvaluationReason, ...]]:
        crane_geometry = self._crane_geometry_provider.get_crane_geometry(configuration_id)
        if crane_geometry is None:
            return None, (NotEvaluableReason.CRANE_GEOMETRY_NOT_FOUND,)
        try:
            return calculate_operational_geometry(state, crane_geometry), ()
        except OperationalStateOutOfLimitsError as error:
            return None, error.violations
        except OutsideGeometricDomainError:
            return None, (NotEvaluableReason.OUTSIDE_GEOMETRIC_DOMAIN,)

    def _resolve_active_load_charts(
        self, configuration_id: str, zones: tuple[RotationZone | None, ...]
    ) -> tuple[list[_ZoneChart], tuple[RotationZone | None] | None]:
        """Tabelas ativas das zonas pedidas e a primeira zona sem tabela ativa (ou `None`)."""
        charts: list[_ZoneChart] = []
        missing: tuple[RotationZone | None] | None = None
        for zone in zones:
            code = None if zone is None else zone.code
            chart = self._active_load_chart_provider.get_active_load_chart(
                configuration_id, rotation_zone_code=code
            )
            if chart is None:
                missing = (zone,) if missing is None else missing
                continue
            if (
                chart.status is not LoadChartStatus.ACTIVE
                or chart.configuration_id != configuration_id
                or chart.rotation_zone_code != code
            ):
                raise InconsistentActiveLoadChartError(
                    f"o provedor devolveu a tabela {chart.id!r} (versão {chart.version!r}, status "
                    f"{chart.status.value}, configuração {chart.configuration_id!r}, zona "
                    f"{chart.rotation_zone_code!r}) para a configuração {configuration_id!r} na "
                    f"zona {code!r}: esperado status ACTIVE, a mesma configuração e a mesma zona"
                )
            charts.append((zone, chart))
        return charts, missing


_NO_ACTIVE_CHART: tuple[EvaluationReason, ...] = (NotEvaluableReason.ACTIVE_LOAD_CHART_NOT_FOUND,)

_ACCESSORY_NOT_FOUND: tuple[EvaluationReason, ...] = (NotEvaluableReason.ACCESSORY_NOT_FOUND,)


_SOIL_ATTENTION_CODES = frozenset({"SOIL_BEARING_NEAR_LIMIT", "SOIL_BEARING_EXCEEDED"})

_SEVERITY_ORDER = {AlertSeverity.CRITICAL: 0, AlertSeverity.ATTENTION: 1, AlertSeverity.INFO: 2}

_PART_LABELS = {"boom": "lança", "cable": "cabo de aço", "load": "carga"}


def _alert_rank(alert: SafetyAlert) -> int:
    """Ordem do `assess_safety`: críticos, atenção e informativos (a ordenação é estável)."""
    return _SEVERITY_ORDER[alert.severity]


def _power_line_clearances(
    result: OperationEvaluation, site: SiteContext
) -> tuple[LineClearance, ...]:
    """Distância 3D de lança, cabo e carga às redes, agora e com o giro varrido (ADR-051)."""
    geometry = result.geometry
    if geometry is None or not site.power_lines:
        return ()
    heading = math.radians(site.crane_heading_deg)
    cos = math.cos(heading)
    sin = math.sin(heading)

    def world(point: Point3D) -> tuple[float, float, float]:
        # `rotY(heading)`: o referencial do chassi (+Z para a frente) no mundo.
        return (
            site.crane_x_m + point.x_m * cos + point.z_m * sin,
            point.y_m,
            site.crane_z_m - point.x_m * sin + point.z_m * cos,
        )

    load_radius = 0.0
    load_drop = 0.0
    load_height = 0.0
    if site.load_length_m and site.load_width_m and site.load_height_m:
        sling = rigging.default_geometry(
            site.load_length_m,
            site.load_width_m,
            angle_deg=site.sling_angle_deg,
            tandem=site.tandem,
        )
        replaces_hook = any(a.type is AccessoryType.HOOK_BLOCK for a in result.accessories)
        attach = REPLACED_HOOK_ATTACH_M if replaces_hook else site.hook_attach_m
        load_radius = math.hypot(site.load_length_m, site.load_width_m) / 2
        load_drop = attach + sum(a.rigging_height_m for a in result.accessories) + sling.drop_m
        load_height = site.load_height_m
    parts = CraneParts(
        pivot=world(geometry.boom_pivot),
        tip=world(geometry.boom_tip),
        hook=world(geometry.hook),
        load_radius_m=load_radius,
        load_drop_m=load_drop,
        load_height_m=load_height,
    )
    return assess_power_lines(site.power_lines, parts, (site.crane_x_m, site.crane_z_m))


def _clearance_alerts(clearances: Sequence[LineClearance]) -> list[SafetyAlert]:
    alerts: list[SafetyAlert] = []
    for item in clearances:
        required = f"{item.required_m:.2f} m a {item.voltage_kv:g} kV"
        if item.status is ClearanceStatus.VIOLATION:
            part = _PART_LABELS[item.nearest_part]
            alerts.append(
                SafetyAlert(
                    "POWER_LINE_CLEARANCE_VIOLATION",
                    AlertSeverity.CRITICAL,
                    f"{item.label}: {part} a {item.distance_m:.2f} m da rede, abaixo da "
                    f"distância mínima ({required}).",
                )
            )
        elif item.swept_status is ClearanceStatus.VIOLATION:
            alerts.append(
                SafetyAlert(
                    "POWER_LINE_SWEPT_VIOLATION",
                    AlertSeverity.CRITICAL,
                    f"{item.label}: girando, a distância à rede cai a {item.swept_distance_m:.2f} "
                    f"m, abaixo da mínima ({required}).",
                )
            )
        elif ClearanceStatus.ATTENTION in (item.status, item.swept_status):
            alerts.append(
                SafetyAlert(
                    "POWER_LINE_CLEARANCE_NEAR",
                    AlertSeverity.ATTENTION,
                    f"{item.label}: distância à rede de {item.swept_distance_m:.2f} m (mínima "
                    f"{required}), abaixo de {ATTENTION_FACTOR:g}× a mínima.",
                )
            )
    return alerts


def _critical_alerts(critical: CriticalLiftAssessment) -> list[SafetyAlert]:
    if not critical.is_critical:
        return []
    return [
        SafetyAlert(
            "CRITICAL_LIFT",
            AlertSeverity.ATTENTION,
            f"Içamento CRÍTICO: {'; '.join(critical.reasons)}. Plano de içamento exigido: "
            f"{'; '.join(critical.plan_items)}.",
        )
    ]
