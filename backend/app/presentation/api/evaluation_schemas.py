"""Schemas Pydantic da avaliação operacional (TASK-024; ADR-006; doc-fonte §§ 14.2 e 14.3).

Ficam na apresentação (ADR-006): o domínio e a aplicação não conhecem Pydantic. Os campos com
unidade levam o sufixo da unidade interna (`_m`, `_deg`, `_kg`; RN-006; docs/development-guide.md
§ 5), como a entrada e a saída conceituais da doc-fonte §§ 14.2 e 14.3.

A saída **não** tem nível de alerta (`NORMAL`, `WARNING`, `CRITICAL`): os limites e níveis estão
pendentes (PEND-004; known-gaps P-005). O `status` só distingue "avaliado" de "não avaliável",
como o resultado do caso de uso `EvaluateOperation` (TASK-015).
"""

from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.application.use_cases.evaluate_operation import (
    EvaluatedOperation,
    EvaluationReason,
    NotEvaluableOperation,
    NotEvaluableReason,
    OperationEvaluation,
)
from app.domain.exceptions.geometry_errors import OperationalLimitViolation
from app.domain.value_objects.capacity_result import (
    CapacityFound,
    CapacityResult,
    CapacityUnsupportedReason,
)
from app.domain.value_objects.conservative_capacity_result import (
    CapacityLookupStrategy,
    ConservativeCapacityFound,
)
from app.domain.value_objects.operational_geometry import OperationalGeometry, Point3D
from app.presentation.api.load_chart_schemas import LoadChartPointResponse


class EvaluationRequest(BaseModel):
    """Estado operacional e carga a avaliar, em unidades internas (doc-fonte § 14.2; RN-006).

    Validação só de forma (tipos, números finitos, não negativos onde o domínio exige): as faixas
    do guindaste são da ficha técnica e, fora delas, a resposta é "não avaliável", não 422
    (ADR-013 C-5; RN-008: quem valida o estado é o backend, com a ficha técnica).

    `strict`: número em texto (`"20"`) e booleano não viram número. `allow_inf_nan=False`: `NaN` e
    infinito são recusados. `extra="forbid"`: campo desconhecido é erro, para um nome digitado
    errado não ser ignorado em silêncio.
    """

    model_config = ConfigDict(strict=True, allow_inf_nan=False, extra="forbid")

    configuration_id: str = Field(
        min_length=1,
        pattern=r"\S",
        description="Configuração do guindaste a avaliar (RN-001). A ficha técnica geométrica e a "
        "tabela de carga ativa são as dessa configuração.",
    )
    boom_length_m: float = Field(ge=0, description="Comprimento de lança L, em metros (ADR-013).")
    boom_angle_deg: float = Field(
        description="Inclinação da lança θ sobre a horizontal, em graus; 0° horizontal, 90° "
        "vertical (ADR-013 C-2)."
    )
    turret_rotation_deg: float = Field(
        description="Giro da torre ψ, em graus; 0° com a lança para a frente do chassi, positivo "
        "no sentido anti-horário visto de cima. Qualquer valor finito; é normalizado em "
        "[0°, 360°) (ADR-013 C-2)."
    )
    cable_length_m: float = Field(
        ge=0,
        description="Cabo c, em metros: queda vertical da ponta da lança até o gancho "
        "(ADR-013 C-3).",
    )
    load_weight_kg: float = Field(ge=0, description="Peso da carga, em quilogramas.")
    ground_slope_deg: float | None = Field(
        default=None,
        ge=0,
        description="Inclinação residual do terreno sob o guindaste, em graus (TASK-052). "
        "Opcional; aceita e ainda não usada (a TASK-055 a usa no risco de tombamento).",
    )


class Point3DResponse(BaseModel):
    """Ponto no referencial do guindaste, em metros (ADR-013 C-1: Y para cima, +Z para a frente)."""

    x_m: float = Field(description="Coordenada x (lado esquerdo do chassi), em metros.")
    y_m: float = Field(description="Coordenada y (altura sobre o plano de apoio), em metros.")
    z_m: float = Field(description="Coordenada z (frente do chassi), em metros.")

    @classmethod
    def from_point(cls, point: Point3D) -> Point3DResponse:
        return cls(x_m=point.x_m, y_m=point.y_m, z_m=point.z_m)


class GeometryResponse(BaseModel):
    """Geometria operacional calculada no backend (ADR-013 C-5; RN-008)."""

    working_radius_m: float = Field(
        description="Raio de trabalho, do eixo de giro até a vertical do gancho, em metros."
    )
    tip_height_m: float = Field(description="Altura da ponta da lança, em metros.")
    hook_height_m: float = Field(
        description="Altura do gancho, em metros; pode ser negativa (ADR-013 G-8)."
    )
    boom_pivot: Point3DResponse = Field(description="Pino do pé da lança (P).")
    boom_tip: Point3DResponse = Field(description="Ponta da lança (T).")
    hook: Point3DResponse = Field(description="Gancho (G).")

    @classmethod
    def from_geometry(cls, geometry: OperationalGeometry) -> GeometryResponse:
        return cls(
            working_radius_m=geometry.working_radius.meters,
            tip_height_m=geometry.tip_height_m,
            hook_height_m=geometry.hook_height_m,
            boom_pivot=Point3DResponse.from_point(geometry.boom_pivot),
            boom_tip=Point3DResponse.from_point(geometry.boom_tip),
            hook=Point3DResponse.from_point(geometry.hook),
        )


class CapacityResponse(BaseModel):
    """Capacidade admissível tirada da tabela de carga ativa (RN-004)."""

    maximum_capacity_kg: float = Field(
        description="Capacidade admissível, em quilogramas. É sempre a de um ponto da tabela."
    )
    strategy: CapacityLookupStrategy | None = Field(
        description="Estratégia que produziu a capacidade. `CONSERVATIVE_PROVISIONAL` é a "
        "consulta conservadora **provisória** do ADR-015 (até PEND-001 e PEND-003): o valor não "
        "é definitivo e não deve ser apresentado como tal. `null` quando a estratégia não informa "
        "a sua marca."
    )
    queried_boom_length_m: float | None = Field(
        description="Comprimento de lança consultado na tabela, em metros; `null` quando a "
        "estratégia não o informa."
    )
    queried_working_radius_m: float | None = Field(
        description="Raio consultado na tabela (o raio calculado), em metros; `null` quando a "
        "estratégia não o informa."
    )
    used_point: LoadChartPointResponse | None = Field(
        description="Ponto da tabela de onde veio a capacidade (ADR-015 item 4). Entre dois raios "
        "tabelados, é o vizinho de menor capacidade. `null` quando a estratégia não o informa."
    )

    @classmethod
    def from_capacity(cls, capacity: CapacityFound) -> CapacityResponse:
        if isinstance(capacity, ConservativeCapacityFound):
            return cls(
                maximum_capacity_kg=capacity.max_capacity.kilograms,
                strategy=capacity.strategy,
                queried_boom_length_m=capacity.query.boom_length.meters,
                queried_working_radius_m=capacity.queried_radius.meters,
                used_point=LoadChartPointResponse.from_point(capacity.used_point),
            )
        return cls(
            maximum_capacity_kg=capacity.max_capacity.kilograms,
            strategy=None,
            queried_boom_length_m=None,
            queried_working_radius_m=None,
            used_point=None,
        )


class ReasonCategory(StrEnum):
    """De que etapa da avaliação veio o motivo de "não avaliável"."""

    EVALUATION = "EVALUATION"
    """Falta de dados ou resultado do próprio caso de uso (ficha técnica, tabela ativa, R < 0,
    utilização indefinida)."""
    OPERATIONAL_LIMIT = "OPERATIONAL_LIMIT"
    """Estado fora de uma faixa da ficha técnica (ADR-013 C-5)."""
    LOAD_CHART_DOMAIN = "LOAD_CHART_DOMAIN"
    """Consulta fora do domínio da tabela de carga (RN-007; ADR-015)."""


class NotEvaluableReasonResponse(BaseModel):
    """Um motivo de "não avaliável", legível por máquina (RN-007; RF-020).

    Não há mensagem para o usuário: o texto ainda não está definido (doc-fonte § 26, pergunta 9).
    """

    code: NotEvaluableReason | OperationalLimitViolation | CapacityUnsupportedReason = Field(
        description="Código do motivo."
    )
    category: ReasonCategory = Field(description="Etapa da avaliação de onde veio o motivo.")

    @classmethod
    def from_reason(cls, reason: EvaluationReason) -> NotEvaluableReasonResponse:
        match reason:
            case NotEvaluableReason():
                category = ReasonCategory.EVALUATION
            case OperationalLimitViolation():
                category = ReasonCategory.OPERATIONAL_LIMIT
            case CapacityUnsupportedReason():
                category = ReasonCategory.LOAD_CHART_DOMAIN
        return cls(code=reason, category=category)


class EvaluationResponse(BaseModel):
    """Resultado da avaliação de um estado operacional (doc-fonte § 14.3), sem nível de alerta."""

    status: Literal["EVALUATED", "NOT_EVALUABLE"] = Field(
        description="`EVALUATED`: a tabela suporta o estado e a carga foi comparada com a "
        'capacidade. `NOT_EVALUABLE`: não há utilização, só os motivos. "Avaliado" não quer '
        'dizer "seguro" nem "permitido": níveis de alerta estão pendentes (PEND-004), e '
        "utilização acima de 100 % também é só `EVALUATED`."
    )
    configuration_id: str = Field(description="Configuração avaliada, como enviada.")
    geometry: GeometryResponse | None = Field(
        description="Geometria calculada; presente sempre que pôde ser calculada, mesmo sem "
        "capacidade (ADR-013 C-6). `null` sem ficha técnica, com o estado fora das faixas ou com "
        "a ponta atrás do eixo de giro."
    )
    capacity: CapacityResponse | None = Field(
        description="Capacidade da tabela, quando ela suportou a consulta. Num `NOT_EVALUABLE` "
        "por utilização indefinida, é a capacidade 0 kg que a tabela devolveu. `null` quando a "
        "tabela não foi consultada ou a consulta ficou fora do domínio dela."
    )
    utilization_percent: float | None = Field(
        description="`compared_weight_kg / capacidade × 100`, sem arredondamento (PEND-002). Só "
        "existe em `EVALUATED`."
    )
    rotation_zone_code: str | None = Field(
        description="Zona de giro usada (ADR-018; TASK-046), ou `null` numa configuração sem "
        "zonas. Na fronteira entre duas zonas (±ε), é a zona cuja tabela deu a menor capacidade. "
        "Em `NOT_EVALUABLE`: a zona sem tabela ativa, a da tabela que não cobriu a consulta, ou "
        "a zona de ψ (na fronteira, a primeira na ordem cadastrada)."
    )
    rotation_zone_name: str | None = Field(
        description="Nome da zona de `rotation_zone_code`, ou `null`."
    )
    hook_block_weight_kg: float = Field(
        description="Peso do gancho da configuração, em kg (0 se não cadastrado; ADR-018 § 2)."
    )
    compared_weight_kg: float = Field(
        description="Carga + gancho, em kg: o peso comparado com a capacidade (ADR-018 § 2)."
    )
    load_chart_id: str | None = Field(
        description="Id da tabela consultada; `null` quando a tabela não chegou a ser consultada."
    )
    load_chart_version: str | None = Field(
        description="Versão da tabela consultada (RN-005); `null` quando ela não chegou a ser "
        "consultada."
    )
    reasons: list[NotEvaluableReasonResponse] = Field(
        description="Motivos de `NOT_EVALUABLE`, na ordem das etapas (ficha técnica e geometria, "
        "tabela ativa, consulta à tabela, utilização); nunca vazio nesse caso. Sempre vazio em "
        "`EVALUATED`."
    )

    @classmethod
    def from_evaluation(
        cls, configuration_id: str, evaluation: OperationEvaluation
    ) -> EvaluationResponse:
        zone = evaluation.rotation_zone
        zone_code = None if zone is None else zone.code
        zone_name = None if zone is None else zone.name
        hook_kg = evaluation.hook_block_weight.kilograms
        compared_kg = evaluation.compared_weight.kilograms
        match evaluation:
            case EvaluatedOperation():
                return cls(
                    status="EVALUATED",
                    configuration_id=configuration_id,
                    geometry=GeometryResponse.from_geometry(evaluation.geometry),
                    capacity=CapacityResponse.from_capacity(evaluation.capacity),
                    utilization_percent=evaluation.utilization_percent,
                    load_chart_id=evaluation.load_chart_id,
                    load_chart_version=evaluation.load_chart_version,
                    reasons=[],
                    rotation_zone_code=zone_code,
                    rotation_zone_name=zone_name,
                    hook_block_weight_kg=hook_kg,
                    compared_weight_kg=compared_kg,
                )
            case NotEvaluableOperation():
                return cls(
                    rotation_zone_code=zone_code,
                    rotation_zone_name=zone_name,
                    hook_block_weight_kg=hook_kg,
                    compared_weight_kg=compared_kg,
                    status="NOT_EVALUABLE",
                    configuration_id=configuration_id,
                    geometry=(
                        None
                        if evaluation.geometry is None
                        else GeometryResponse.from_geometry(evaluation.geometry)
                    ),
                    capacity=_found_capacity_or_none(evaluation.capacity),
                    utilization_percent=None,
                    load_chart_id=evaluation.load_chart_id,
                    load_chart_version=evaluation.load_chart_version,
                    reasons=[
                        NotEvaluableReasonResponse.from_reason(reason)
                        for reason in evaluation.reasons
                    ],
                )


def _found_capacity_or_none(capacity: CapacityResult | None) -> CapacityResponse | None:
    if isinstance(capacity, CapacityFound):
        return CapacityResponse.from_capacity(capacity)
    return None
