"""Caso de uso `EvaluateOperation` (doc-fonte §§ 14.1 a 14.3; RF-015..RF-018, RF-020; ADR-018).

Liga as peças do motor de cálculo na ordem da doc-fonte § 14.1:

1. `GeometryService` (ADR-013 C-5): raio de trabalho, alturas e posições a partir do estado
   operacional e da ficha técnica da configuração (`CraneGeometryProvider`);
2. `LoadChartResolver`: a tabela `ACTIVE` da configuração (`ActiveLoadChartProvider`; RN-001).
   Com **zonas de giro** (ADR-018 § 1; `ConfigurationLoadRulesProvider`), o giro ψ escolhe a zona,
   e vale a tabela ativa dela; a ±ε de uma fronteira, valem as tabelas ativas das duas zonas
   vizinhas;
3. `LoadChartInterpolator`: a capacidade para o comprimento de lança do estado e o **raio
   calculado** (estratégia injetada: `ExactPointLookup` ou, na composição, a
   `ConservativeTabulatedLookup` provisória do ADR-015). Na fronteira, vale a **menor**
   capacidade das duas zonas (lado seguro);
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

from dataclasses import dataclass
from enum import StrEnum

from app.application.ports.active_load_chart_provider import ActiveLoadChartProvider
from app.application.ports.configuration_load_rules_provider import (
    ConfigurationLoadRules,
    ConfigurationLoadRulesProvider,
)
from app.application.ports.crane_geometry_provider import CraneGeometryProvider
from app.application.ports.crane_limits_provider import CraneLimitsProvider
from app.domain.entities.load import Load
from app.domain.entities.load_chart import LoadChart, LoadChartStatus
from app.domain.exceptions.domain_errors import UndefinedUtilizationError
from app.domain.exceptions.geometry_errors import (
    OperationalLimitViolation,
    OperationalStateOutOfLimitsError,
    OutsideGeometricDomainError,
)
from app.domain.services.capacity_limit import CapacityLimit, evaluate_capacity_limit
from app.domain.services.compared_load_weight import weight_compared_with_capacity
from app.domain.services.geometry_service import calculate_operational_geometry
from app.domain.services.load_chart_interpolator import LoadChartInterpolator
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
from app.domain.value_objects.operational_geometry import OperationalGeometry
from app.domain.value_objects.operational_state import OperationalState
from app.domain.value_objects.rotation_zone import RotationZone

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
    """

    geometry: OperationalGeometry
    capacity: CapacityFound
    utilization_percent: float
    load_weight: Mass
    hook_block_weight: Mass = ZERO_MASS
    rotation_zone: RotationZone | None = None
    capacity_limit: CapacityLimit | None = None

    @property
    def compared_weight(self) -> Mass:
        """Carga + gancho: o peso comparado com a capacidade (`weight_compared_with_capacity`)."""
        return weight_compared_with_capacity(self.load_weight, self.hook_block_weight)

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

    def __post_init__(self) -> None:
        reasons = tuple(self.reasons)
        if not reasons:
            raise ValueError("operação não avaliável precisa de pelo menos um motivo (RN-007)")
        object.__setattr__(self, "reasons", reasons)

    @property
    def compared_weight(self) -> Mass:
        """Carga + gancho (`weight_compared_with_capacity`), mesmo sem capacidade para comparar."""
        return weight_compared_with_capacity(self.load_weight, self.hook_block_weight)

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
    ) -> None:
        self._crane_geometry_provider = crane_geometry_provider
        self._active_load_chart_provider = active_load_chart_provider
        self._load_chart_interpolator = load_chart_interpolator
        self._configuration_load_rules_provider = configuration_load_rules_provider
        self._crane_limits_provider = crane_limits_provider

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
        self, *, configuration_id: str, state: OperationalState, load_weight: Mass
    ) -> OperationEvaluation:
        """Avalia `state` com o peso da carga `load_weight` na configuração `configuration_id`.

        É a entrada dos contratos REST e WebSocket, que recebem só `load_weight_kg`. O gancho da
        configuração é somado aqui, por `weight_compared_with_capacity`.

        Levanta `InconsistentActiveLoadChartError` se o provedor da tabela quebrar o contrato.
        """
        rules = self._load_rules(configuration_id)
        hook_block_weight = rules.hook_block_weight or ZERO_MASS
        compared_weight = weight_compared_with_capacity(load_weight, hook_block_weight)
        zones: tuple[RotationZone | None, ...] = (
            (None,)
            if rules.rotation_zones is None
            else rules.rotation_zones.zones_at(state.turret_rotation.degrees)
        )

        geometry, geometry_reasons = self._calculate_geometry(configuration_id, state)
        charts, missing_zone = self._resolve_active_load_charts(configuration_id, zones)
        if geometry is None or missing_zone is not None:
            chart_reasons = () if missing_zone is None else _NO_ACTIVE_CHART
            return NotEvaluableOperation(
                reasons=(*geometry_reasons, *chart_reasons),
                geometry=geometry,
                load_weight=load_weight,
                hook_block_weight=hook_block_weight,
                rotation_zone=zones[0] if missing_zone is None else missing_zone[0],
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
            )

        return EvaluatedOperation(
            geometry=geometry,
            capacity=capacity,
            utilization_percent=utilization_percent,
            load_weight=load_weight,
            hook_block_weight=hook_block_weight,
            rotation_zone=zone,
            capacity_limit=evaluate_capacity_limit(
                capacity.max_capacity, compared_weight, self._crane_limits(configuration_id)
            ),
        )

    def _crane_limits(self, configuration_id: str) -> CraneLimits | None:
        provider = self._crane_limits_provider
        return None if provider is None else provider.get_crane_limits(configuration_id)

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
