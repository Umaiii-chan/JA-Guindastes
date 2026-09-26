"""Caso de uso `EvaluateOperation` (doc-fonte §§ 14.1 a 14.3; RF-015..RF-018, RF-020).

Liga as peças do motor de cálculo na ordem da doc-fonte § 14.1:

1. `GeometryService` (ADR-013 C-5): raio de trabalho, alturas e posições a partir do estado
   operacional e da ficha técnica da configuração (`CraneGeometryProvider`);
2. `LoadChartResolver`: a tabela `ACTIVE` da configuração (`ActiveLoadChartProvider`; RN-001);
3. `LoadChartInterpolator`: a capacidade para o comprimento de lança do estado e o **raio
   calculado** (estratégia injetada: `ExactPointLookup` ou, na composição, a
   `ConservativeTabulatedLookup` provisória do ADR-015);
4. utilização `carga / capacidade × 100` (doc-fonte § 14.3). O peso comparado com a capacidade é o
   de `weight_compared_with_capacity` (TASK-028): hoje, exatamente o peso informado (RN-006; a
   "carga bruta" depende da PEND-006, e nada é somado).

O `SafetyValidator` da doc-fonte não entra: os níveis de alerta e os limiares estão pendentes
(PEND-004; known-gaps P-005). Por isso o resultado só distingue "avaliado" de "não avaliável" e
lista os motivos, sem `WARNING` nem `CRITICAL`.

Tolerância na busca do ponto: o ADR-013 C-6 prevê uma tolerância só para absorver erro de ponto
flutuante ao comparar L com os comprimentos tabelados, mas deixa o valor para a tarefa do
`LoadChartInterpolator`. Sem valor definido, este caso de uso não inventa um: passa o raio calculado
como está, e a estratégia decide (a `ExactPointLookup` compara com igualdade exata). Consequência
conhecida: um raio calculado raramente coincide com um raio tabelado.

Não grava nada. Quem o chama: `POST /api/v1/evaluations` (TASK-024) e o WebSocket
`/api/v1/ws/evaluation` (TASK-025), ligados aos repositórios de banco na raiz de composição
(`app.main`, TASK-029).
"""

from dataclasses import dataclass
from enum import StrEnum

from app.application.ports.active_load_chart_provider import ActiveLoadChartProvider
from app.application.ports.crane_geometry_provider import CraneGeometryProvider
from app.domain.entities.load import Load
from app.domain.entities.load_chart import LoadChart, LoadChartStatus
from app.domain.exceptions.domain_errors import UndefinedUtilizationError
from app.domain.exceptions.geometry_errors import (
    OperationalLimitViolation,
    OperationalStateOutOfLimitsError,
    OutsideGeometricDomainError,
)
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
from app.domain.value_objects.mass import Mass
from app.domain.value_objects.operational_geometry import OperationalGeometry
from app.domain.value_objects.operational_state import OperationalState


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
    """A configuração não tem tabela de carga ativa (RN-001, RN-004)."""
    UTILIZATION_UNDEFINED = "UTILIZATION_UNDEFINED"
    """A tabela devolveu capacidade 0 kg, e a utilização não pode ser calculada."""


type EvaluationReason = NotEvaluableReason | OperationalLimitViolation | CapacityUnsupportedReason
"""Motivo de uma operação não avaliável. Todos são `StrEnum`, e o tipo diz de qual etapa veio."""


@dataclass(frozen=True)
class EvaluatedOperation:
    """Operação avaliada: a tabela suporta o estado, e a carga foi comparada com a capacidade.

    "Avaliada" não quer dizer "segura" nem "permitida": não há status nem nível de alerta
    (PEND-004), e utilização acima de 100 % também é só avaliada. Se carga igual à capacidade é
    violação também não está decidido (known-gaps P-005).

    - `geometry`: raio, alturas e posições do ADR-013, calculados no backend (RN-008).
    - `capacity`: capacidade admissível do ponto da tabela (RN-004), com o id e a versão da tabela.
    - `utilization_percent`: `carga / capacidade × 100`, sem arredondamento (PEND-002).
    """

    geometry: OperationalGeometry
    capacity: CapacityFound
    utilization_percent: float

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
    """

    reasons: tuple[EvaluationReason, ...]
    geometry: OperationalGeometry | None = None
    capacity: CapacityResult | None = None

    def __post_init__(self) -> None:
        reasons = tuple(self.reasons)
        if not reasons:
            raise ValueError("operação não avaliável precisa de pelo menos um motivo (RN-007)")
        object.__setattr__(self, "reasons", reasons)

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
    """O provedor da tabela ativa devolveu uma tabela não `ACTIVE` ou de outra configuração.

    É erro de programação no adapter (quebra o contrato da porta), e não resultado de avaliação: a
    capacidade nunca pode vir de uma tabela de outra configuração (RN-001, RN-004) nem de uma tabela
    que não está ativa. Por isso levanta exceção em vez de devolver "não avaliável".
    """


class EvaluateOperation:
    """Avalia um estado operacional contra a tabela ativa da configuração.

    Nunca propaga os erros de domínio da geometria (estado fora das faixas, R < 0): devolve
    `NotEvaluableOperation` com as violações, como pede o ADR-013 C-5 ("sinaliza, e não corrige") e
    no espírito da RN-007. A ficha técnica e a tabela ativa são buscadas sempre, para o resultado
    listar de uma vez os problemas das duas; a tabela só é **consultada** quando há geometria.
    """

    def __init__(
        self,
        *,
        crane_geometry_provider: CraneGeometryProvider,
        active_load_chart_provider: ActiveLoadChartProvider,
        load_chart_interpolator: LoadChartInterpolator,
    ) -> None:
        self._crane_geometry_provider = crane_geometry_provider
        self._active_load_chart_provider = active_load_chart_provider
        self._load_chart_interpolator = load_chart_interpolator

    def execute_for_load(
        self, *, configuration_id: str, state: OperationalState, load: Load
    ) -> OperationEvaluation:
        """Avalia `state` com a carga `load` (TASK-028) na configuração `configuration_id`.

        O peso comparado com a capacidade é `weight_compared_with_capacity(load)`: hoje o peso
        informado, sem somar nada (PEND-006). Descrição, dimensões e centro de gravidade não entram
        no cálculo (nenhuma regra documentada os usa). O resultado é o mesmo de `execute` com esse
        peso.

        Levanta `InconsistentActiveLoadChartError` se o provedor da tabela quebrar o contrato.
        """
        return self.execute(
            configuration_id=configuration_id,
            state=state,
            load_weight=weight_compared_with_capacity(load),
        )

    def execute(
        self, *, configuration_id: str, state: OperationalState, load_weight: Mass
    ) -> OperationEvaluation:
        """Avalia `state` com o peso `load_weight` na configuração `configuration_id`.

        É a entrada dos contratos REST e WebSocket, que recebem só `load_weight_kg`: sem descrição
        nem dimensões, montar uma `Load` ali exigiria inventar dados. Quem tem a carga completa usa
        `execute_for_load`, que passa pela regra do peso comparado.

        Levanta `InconsistentActiveLoadChartError` se o provedor da tabela quebrar o contrato.
        """
        geometry, geometry_reasons = self._calculate_geometry(configuration_id, state)
        chart, chart_reasons = self._resolve_active_load_chart(configuration_id)
        if geometry is None or chart is None:
            return NotEvaluableOperation(
                reasons=(*geometry_reasons, *chart_reasons), geometry=geometry
            )

        query = CapacityQuery(boom_length=state.boom_length, working_radius=geometry.working_radius)
        capacity = self._load_chart_interpolator.calculate_capacity(chart, query)
        if isinstance(capacity, CapacityUnsupported):
            return NotEvaluableOperation(
                reasons=(capacity.reason,), geometry=geometry, capacity=capacity
            )

        try:
            utilization_percent = calculate_utilization_percent(load_weight, capacity.max_capacity)
        except UndefinedUtilizationError:
            return NotEvaluableOperation(
                reasons=(NotEvaluableReason.UTILIZATION_UNDEFINED,),
                geometry=geometry,
                capacity=capacity,
            )

        return EvaluatedOperation(
            geometry=geometry, capacity=capacity, utilization_percent=utilization_percent
        )

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

    def _resolve_active_load_chart(
        self, configuration_id: str
    ) -> tuple[LoadChart | None, tuple[EvaluationReason, ...]]:
        chart = self._active_load_chart_provider.get_active_load_chart(configuration_id)
        if chart is None:
            return None, (NotEvaluableReason.ACTIVE_LOAD_CHART_NOT_FOUND,)
        if chart.status is not LoadChartStatus.ACTIVE or chart.configuration_id != configuration_id:
            raise InconsistentActiveLoadChartError(
                f"o provedor devolveu a tabela {chart.id!r} (versão {chart.version!r}, status "
                f"{chart.status.value}, configuração {chart.configuration_id!r}) para a "
                f"configuração {configuration_id!r}: esperado status ACTIVE e a mesma configuração"
            )
        return chart, ()
