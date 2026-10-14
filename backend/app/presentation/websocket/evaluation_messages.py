"""Mensagens do WebSocket de avaliação em tempo real (TASK-025; doc-fonte § 15.4; ADR-010).

Schemas Pydantic ficam na apresentação (ADR-006): o domínio e a aplicação não conhecem Pydantic. Os
nomes dos campos com unidade levam o sufixo da unidade interna (`_m`, `_deg`, `_kg`; RN-006).

Entrada (cliente → servidor), a mensagem `simulation.state.changed` da doc-fonte § 15.4, com um
campo a mais no `payload`, `configuration_id`: ainda não há simulação persistida de onde tirar a
configuração (ver `handoffs/TASK-025.md` § 5).

Saída (servidor → cliente):

- `simulation.evaluated`, com o **mesmo** `sequence` da entrada e o resultado do
  `EvaluateOperation`: `result` é `EVALUATED` ou `NOT_EVALUABLE`. Não há `status` nem nível de
  alerta (`WARNING` da doc-fonte): os níveis estão pendentes (PEND-004);
- `simulation.error`, quando a mensagem não pôde ser avaliada (malformada, tipo desconhecido,
  valores inválidos, grande demais ou falha interna), com o `sequence` quando ele pôde ser lido.

A validação é estrita (RN-008: o backend valida os dados operacionais recebidos): número em texto
(`"20"`), booleano no lugar de número, `sequence` não inteiro, valor não finito e campo desconhecido
são recusados.
"""

from enum import StrEnum
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.application.use_cases.evaluate_operation import (
    EvaluatedOperation,
    NotEvaluableOperation,
    OperationEvaluation,
)
from app.domain.services.capacity_limit import CapacityLimit, CapacityLimitLevel
from app.domain.value_objects.capacity_result import CapacityFound
from app.domain.value_objects.conservative_capacity_result import (
    CapacityLookupStrategy,
    ConservativeCapacityFound,
)
from app.domain.value_objects.interpolated_capacity_result import InterpolatedCapacityFound
from app.domain.value_objects.operational_geometry import OperationalGeometry, Point3D

STATE_CHANGED_TYPE = "simulation.state.changed"
EVALUATED_TYPE = "simulation.evaluated"
ERROR_TYPE = "simulation.error"

INBOUND_MESSAGE_TYPES = frozenset({STATE_CHANGED_TYPE})
"""Tipos de mensagem que o cliente pode enviar."""


# --- Entrada -------------------------------------------------------------------------------------


class OperationalStatePayload(BaseModel):
    """Estado operacional enviado pelo cliente, em unidades internas (RN-006; ADR-013 C-5).

    As faixas da ficha técnica (lança acima do máximo, por exemplo) **não** são validadas aqui: um
    estado fora delas é bem formado e sai como `NOT_EVALUABLE` com os motivos (ADR-013 C-5). Aqui
    só se recusa o que os value objects do domínio já recusam: valor não finito e comprimento ou
    massa negativos (`Length`, `Angle`, `Mass`).
    """

    model_config = ConfigDict(strict=True, extra="forbid", allow_inf_nan=False, frozen=True)

    configuration_id: str = Field(
        min_length=1,
        description="Configuração do guindaste avaliada (RN-001). Provisório: sai daqui quando a "
        "simulação persistida existir (doc-fonte § 15.4 usa `simulation_id` na rota).",
    )
    boom_length_m: float = Field(ge=0, description="Comprimento de lança L, em metros.")
    boom_angle_deg: float = Field(description="Inclinação da lança θ, em graus (ADR-013).")
    turret_rotation_deg: float = Field(description="Giro da torre ψ, em graus (ADR-013).")
    cable_length_m: float = Field(ge=0, description="Queda vertical c, em metros (ADR-013 C-3).")
    load_weight_kg: float = Field(ge=0, description="Massa da carga, em quilogramas.")


class SimulationStateChangedMessage(BaseModel):
    """`simulation.state.changed` (doc-fonte § 15.4)."""

    model_config = ConfigDict(strict=True, extra="forbid", frozen=True)

    type: Literal["simulation.state.changed"]
    sequence: int = Field(
        description="Número da mensagem, devolvido igual na resposta; o cliente ignora respostas "
        "antigas (doc-fonte § 15.4). O servidor não exige ordem nem faixa."
    )
    payload: OperationalStatePayload


# --- Saída: avaliação ----------------------------------------------------------------------------


class Point3DMessage(BaseModel):
    """Ponto no referencial do guindaste, em metros (ADR-013 C-1)."""

    x_m: float
    y_m: float
    z_m: float

    @classmethod
    def from_point(cls, point: Point3D) -> Point3DMessage:
        return cls(x_m=point.x_m, y_m=point.y_m, z_m=point.z_m)


class GeometryMessage(BaseModel):
    """Geometria calculada no backend (ADR-013 C-5; RN-008)."""

    working_radius_m: float = Field(description="Raio de trabalho, em metros.")
    tip_height_m: float = Field(description="Altura da ponta da lança, em metros.")
    hook_height_m: float = Field(description="Altura do gancho, em metros.")
    boom_pivot: Point3DMessage
    boom_tip: Point3DMessage
    hook: Point3DMessage

    @classmethod
    def from_geometry(cls, geometry: OperationalGeometry) -> GeometryMessage:
        return cls(
            working_radius_m=geometry.working_radius.meters,
            tip_height_m=geometry.tip_height_m,
            hook_height_m=geometry.hook_height_m,
            boom_pivot=Point3DMessage.from_point(geometry.boom_pivot),
            boom_tip=Point3DMessage.from_point(geometry.boom_tip),
            hook=Point3DMessage.from_point(geometry.hook),
        )


class TabulatedPointMessage(BaseModel):
    """Ponto da tabela de onde veio a capacidade (ADR-015 item 4)."""

    boom_length_m: float
    working_radius_m: float
    max_capacity_kg: float


class CapacityMessage(BaseModel):
    """Capacidade admissível da tabela ativa (RN-004).

    Com a consulta conservadora provisória (ADR-015), `strategy` é `CONSERVATIVE_PROVISIONAL` e
    vêm o raio consultado e o ponto usado: o valor **não é definitivo**. Com uma estratégia sem
    essa marca (a `ExactPointLookup`), os três campos são `null`.
    """

    maximum_capacity_kg: float = Field(description="Capacidade admissível, em quilogramas.")
    strategy: CapacityLookupStrategy | None = Field(
        description="`CONSERVATIVE_PROVISIONAL` (ADR-015): valor provisório conservador."
    )
    queried_radius_m: float | None = Field(description="Raio consultado na tabela, em metros.")
    used_point: TabulatedPointMessage | None = Field(description="Ponto tabelado usado.")
    interpolated_points: list[TabulatedPointMessage] | None = Field(
        default=None,
        description="Pontos tabelados usados na interpolação linear (ADR-030).",
    )

    @classmethod
    def from_capacity(cls, capacity: CapacityFound) -> CapacityMessage:
        if isinstance(capacity, InterpolatedCapacityFound):
            points = [
                TabulatedPointMessage(
                    boom_length_m=point.boom_length.meters,
                    working_radius_m=point.working_radius.meters,
                    max_capacity_kg=point.max_capacity.kilograms,
                )
                for point in capacity.points
            ]
            lowest = capacity.lowest_point
            return cls(
                maximum_capacity_kg=capacity.max_capacity.kilograms,
                strategy=capacity.strategy,
                queried_radius_m=capacity.queried_radius.meters,
                used_point=TabulatedPointMessage(
                    boom_length_m=lowest.boom_length.meters,
                    working_radius_m=lowest.working_radius.meters,
                    max_capacity_kg=lowest.max_capacity.kilograms,
                ),
                interpolated_points=points,
            )
        if isinstance(capacity, ConservativeCapacityFound):
            point = capacity.used_point
            return cls(
                maximum_capacity_kg=capacity.max_capacity.kilograms,
                strategy=capacity.strategy,
                queried_radius_m=capacity.queried_radius.meters,
                used_point=TabulatedPointMessage(
                    boom_length_m=point.boom_length.meters,
                    working_radius_m=point.working_radius.meters,
                    max_capacity_kg=point.max_capacity.kilograms,
                ),
            )
        return cls(
            maximum_capacity_kg=capacity.max_capacity.kilograms,
            strategy=None,
            queried_radius_m=None,
            used_point=None,
        )


_ZONE_CODE_DESCRIPTION = (
    "Zona de giro usada (ADR-018; TASK-046), ou `null` sem zonas; na fronteira, a zona cuja "
    "tabela deu a menor capacidade (mesmas regras do `rotation_zone_code` da avaliação REST)."
)
_HOOK_DESCRIPTION = "Peso do gancho da configuração, em kg (0 se não cadastrado)."
_COMPARED_DESCRIPTION = "Carga + gancho, em kg: o peso comparado com a capacidade."


class CapacityLimitMessage(BaseModel):
    """Limite de capacidade do modelo e nível OK/WARNING/OVER (RN-011; TASK-051)."""

    limit_percent: float
    effective_capacity_kg: float = Field(description="Capacidade da tabela × limite, em kg.")
    limit_utilization_percent: float = Field(
        description="`compared_weight_kg / capacidade efetiva × 100`, sem arredondamento."
    )
    warning_band_percent: float
    level: CapacityLimitLevel

    @classmethod
    def from_limit(cls, limit: CapacityLimit | None) -> CapacityLimitMessage | None:
        if limit is None:
            return None
        return cls(
            limit_percent=limit.limit_percent,
            effective_capacity_kg=limit.effective_capacity_kg,
            limit_utilization_percent=limit.limit_utilization_percent,
            warning_band_percent=limit.warning_band_percent,
            level=limit.level,
        )


class EvaluatedPayload(BaseModel):
    """Operação avaliada. "Avaliada" não quer dizer "segura": não há status (PEND-004)."""

    result: Literal["EVALUATED"] = "EVALUATED"
    geometry: GeometryMessage
    capacity: CapacityMessage
    utilization_percent: float = Field(
        description="`compared_weight_kg / capacidade × 100`, sem arredondamento (PEND-002)."
    )
    load_chart_id: str
    load_chart_version: str = Field(description="Versão da tabela usada no cálculo (RN-005).")
    rotation_zone_code: str | None = Field(description=_ZONE_CODE_DESCRIPTION)
    rotation_zone_name: str | None = Field(description="Nome da zona, ou `null`.")
    hook_block_weight_kg: float = Field(description=_HOOK_DESCRIPTION)
    compared_weight_kg: float = Field(description=_COMPARED_DESCRIPTION)
    capacity_limit: CapacityLimitMessage | None = Field(
        default=None, description="Limite de capacidade do modelo e nível (RN-011; TASK-051)."
    )
    reasons: list[str] = Field(description="Sempre vazio numa operação avaliada.")


class NotEvaluablePayload(BaseModel):
    """Operação não avaliável: só os motivos, sem utilização (RN-007, RF-020)."""

    result: Literal["NOT_EVALUABLE"] = "NOT_EVALUABLE"
    geometry: GeometryMessage | None = Field(
        description="Presente quando a geometria pôde ser calculada (ADR-013 C-6)."
    )
    capacity: CapacityMessage | None = Field(
        description="Presente só quando a tabela devolveu capacidade (0 kg: utilização indefinida)."
    )
    load_chart_id: str | None = Field(description="`null` se a tabela não chegou a ser consultada.")
    load_chart_version: str | None = Field(
        description="`null` se a tabela não chegou a ser consultada (RN-005)."
    )
    rotation_zone_code: str | None = Field(description=_ZONE_CODE_DESCRIPTION)
    rotation_zone_name: str | None = Field(description="Nome da zona, ou `null`.")
    hook_block_weight_kg: float = Field(description=_HOOK_DESCRIPTION)
    compared_weight_kg: float = Field(description=_COMPARED_DESCRIPTION)
    reasons: list[str] = Field(
        description="Motivos legíveis por máquina, nunca vazio, na ordem das etapas."
    )


type EvaluationPayload = Annotated[
    EvaluatedPayload | NotEvaluablePayload, Field(discriminator="result")
]


class SimulationEvaluatedMessage(BaseModel):
    """`simulation.evaluated` (doc-fonte § 15.4), sem `status` (PEND-004)."""

    type: Literal["simulation.evaluated"] = "simulation.evaluated"
    sequence: int
    payload: EvaluationPayload

    @classmethod
    def from_evaluation(
        cls, sequence: int, evaluation: OperationEvaluation
    ) -> SimulationEvaluatedMessage:
        payload: EvaluatedPayload | NotEvaluablePayload
        zone = evaluation.rotation_zone
        zone_code = None if zone is None else zone.code
        zone_name = None if zone is None else zone.name
        hook_kg = evaluation.hook_block_weight.kilograms
        compared_kg = evaluation.compared_weight.kilograms
        match evaluation:
            case EvaluatedOperation():
                payload = EvaluatedPayload(
                    geometry=GeometryMessage.from_geometry(evaluation.geometry),
                    capacity=CapacityMessage.from_capacity(evaluation.capacity),
                    utilization_percent=evaluation.utilization_percent,
                    load_chart_id=evaluation.load_chart_id,
                    load_chart_version=evaluation.load_chart_version,
                    rotation_zone_code=zone_code,
                    rotation_zone_name=zone_name,
                    hook_block_weight_kg=hook_kg,
                    compared_weight_kg=compared_kg,
                    capacity_limit=CapacityLimitMessage.from_limit(evaluation.capacity_limit),
                    reasons=[],
                )
            case NotEvaluableOperation():
                capacity = evaluation.capacity
                payload = NotEvaluablePayload(
                    geometry=(
                        None
                        if evaluation.geometry is None
                        else GeometryMessage.from_geometry(evaluation.geometry)
                    ),
                    capacity=(
                        CapacityMessage.from_capacity(capacity)
                        if isinstance(capacity, CapacityFound)
                        else None
                    ),
                    load_chart_id=evaluation.load_chart_id,
                    load_chart_version=evaluation.load_chart_version,
                    rotation_zone_code=zone_code,
                    rotation_zone_name=zone_name,
                    hook_block_weight_kg=hook_kg,
                    compared_weight_kg=compared_kg,
                    reasons=[reason.value for reason in evaluation.reasons],
                )
        return cls(sequence=sequence, payload=payload)


# --- Saída: erro ---------------------------------------------------------------------------------


class ErrorCode(StrEnum):
    """Motivo, legível por máquina, de uma mensagem que não foi avaliada."""

    MALFORMED_MESSAGE = "MALFORMED_MESSAGE"
    """Não é um objeto JSON em texto (JSON inválido, `NaN`, lista, frame binário...)."""
    MESSAGE_TOO_LARGE = "MESSAGE_TOO_LARGE"
    """A mensagem passa do limite de tamanho provisório (A VALIDAR, P-008); não é lida."""
    UNKNOWN_MESSAGE_TYPE = "UNKNOWN_MESSAGE_TYPE"
    """`type` é texto, mas não é um tipo que o cliente pode enviar."""
    INVALID_MESSAGE = "INVALID_MESSAGE"
    """Campos ausentes, de tipo errado, desconhecidos ou com valor inválido (RN-008)."""
    INTERNAL_ERROR = "INTERNAL_ERROR"
    """Falha inesperada no servidor ao avaliar; os detalhes ficam só no log."""


class ErrorDetailMessage(BaseModel):
    """Um problema de validação: onde (`location`) e o quê."""

    location: list[str | int] = Field(description='Caminho do campo, ex.: `["payload", ...]`.')
    message: str
    error_type: str = Field(description="Tipo do erro do Pydantic, legível por máquina.")


class ErrorPayload(BaseModel):
    code: ErrorCode
    message: str = Field(description="Descrição legível por pessoa.")
    errors: list[ErrorDetailMessage] = Field(default_factory=list)


class SimulationErrorMessage(BaseModel):
    """`simulation.error`: a mensagem não foi avaliada; a conexão continua aberta."""

    type: Literal["simulation.error"] = "simulation.error"
    sequence: int | None = Field(
        description="O `sequence` da mensagem recusada, quando ele é um inteiro; senão `null`."
    )
    payload: ErrorPayload
