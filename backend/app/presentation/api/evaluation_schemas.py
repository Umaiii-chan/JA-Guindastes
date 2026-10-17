"""Schemas Pydantic da avaliação operacional (TASK-024; ADR-006; doc-fonte §§ 14.2 e 14.3).

Ficam na apresentação (ADR-006): o domínio e a aplicação não conhecem Pydantic. Os campos com
unidade levam o sufixo da unidade interna (`_m`, `_deg`, `_kg`; RN-006; docs/development-guide.md
§ 5), como a entrada e a saída conceituais da doc-fonte §§ 14.2 e 14.3.

A saída **não** tem nível de alerta (`NORMAL`, `WARNING`, `CRITICAL`): os limites e níveis estão
pendentes (PEND-004; known-gaps P-005). O `status` só distingue "avaliado" de "não avaliável",
como o resultado do caso de uso `EvaluateOperation` (TASK-015).
"""

from enum import StrEnum
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from app.application.use_cases.evaluate_operation import (
    EvaluatedOperation,
    EvaluationReason,
    NotEvaluableOperation,
    NotEvaluableReason,
    OperationEvaluation,
)
from app.domain.exceptions.geometry_errors import OperationalLimitViolation
from app.domain.services.capacity_limit import CapacityLimit, CapacityLimitLevel
from app.domain.services.environment_factors import SoilKind
from app.domain.services.safety_assessment import (
    AlertSeverity,
    OutriggerSetting,
    SafetyAlert,
    TippingRisk,
)
from app.domain.services.stability import StabilityResult
from app.domain.value_objects.capacity_result import (
    CapacityFound,
    CapacityResult,
    CapacityUnsupportedReason,
)
from app.domain.value_objects.conservative_capacity_result import (
    CapacityLookupStrategy,
    ConservativeCapacityFound,
)
from app.domain.value_objects.interpolated_capacity_result import InterpolatedCapacityFound
from app.domain.value_objects.operational_geometry import OperationalGeometry, Point3D
from app.presentation.api.load_chart_schemas import LoadChartPointResponse
from app.presentation.api.site_schemas import (
    CriticalLiftResponse,
    PowerLineClearanceResponse,
    SitePayload,
)

MAX_ACCESSORY_IDS = 20
AccessoryId = Annotated[str, StringConstraints(min_length=1, max_length=64)]
MAX_OBSTACLE_CONFLICTS = 50
ObstacleConflictId = Annotated[str, StringConstraints(min_length=1, max_length=64)]
"""Id (ou rótulo) de obstáculo em conflito (RN-015), como no `EvaluationRequest` (e no tandem)."""


class AccessorySummaryResponse(BaseModel):
    """Acessório somado ao peso comparado (TASK-056; RN-014)."""

    id: str
    name: str
    weight_kg: float


class OutriggersRequest(BaseModel):
    """Estado das patolas (leva E; RN-013): extensão de 0 a 100 % e macacos apoiados."""

    model_config = ConfigDict(strict=True, allow_inf_nan=False, extra="forbid", frozen=True)

    extension_percent: float = Field(ge=0, le=100, description="Extensão das vigas, de 0 a 100 %.")
    jacks_set: bool = Field(description="Macacos descidos e apoiados no chão.")

    def to_setting(self) -> OutriggerSetting:
        return OutriggerSetting(extension_percent=self.extension_percent, jacks_set=self.jacks_set)


class SafetyAlertResponse(BaseModel):
    """Alerta de segurança (RN-013), com mensagem em pt-BR."""

    code: str = Field(description="Código do alerta, legível por máquina.")
    severity: AlertSeverity
    message: str = Field(description="Mensagem para o usuário, em pt-BR.")

    @classmethod
    def from_alert(cls, alert: SafetyAlert) -> SafetyAlertResponse:
        return cls(code=alert.code, severity=alert.severity, message=alert.message)


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
    outriggers: OutriggersRequest | None = Field(
        default=None,
        description="Estado das patolas (opcional). Ausente, gera o alerta INFO "
        "`OUTRIGGERS_NOT_INFORMED` e não entra no risco de tombamento (RN-013).",
    )
    ground_slope_deg: float | None = Field(
        default=None,
        ge=0,
        description="Inclinação residual do terreno sob o guindaste, em graus (opcional). "
        "Ausente, gera o alerta INFO `GROUND_SLOPE_NOT_INFORMED` (RN-013).",
    )
    accessory_ids: list[AccessoryId] = Field(
        default_factory=list,
        max_length=MAX_ACCESSORY_IDS,
        description="Ids de acessórios de içamento do catálogo (TASK-056; RN-014). Cada id soma "
        "o peso do acessório ao peso comparado; o mesmo id repetido soma de novo. Id desconhecido "
        "deixa a operação `NOT_EVALUABLE` com `ACCESSORY_NOT_FOUND`.",
    )
    soil_kinds: list[SoilKindName] | None = Field(
        default=None,
        min_length=4,
        max_length=4,
        description="Solo sob as 4 sapatas, na ordem dianteira esquerda, dianteira direita, "
        "traseira esquerda, traseira direita (opcional; RN-017). Ausente, não entra na avaliação. "
        "A pressão de cada sapata vem da SUA reação por estática do polígono de apoio.",
    )
    wind_speed_ms: float | None = Field(
        default=None,
        ge=0,
        description="Rajada de 3 s no ponto mais alto do guindaste, em m/s (EN 13000; opcional; "
        "RN-017). Ausente, não entra na avaliação.",
    )
    load_wind_area_m2: float | None = Field(
        default=None,
        ge=0,
        description="Área de vento da carga `A_W` (área projetada × coeficiente de arrasto), em "
        "m² (opcional; RN-017). Define a velocidade máxima de rajada "
        "`v_tab · √(1,2 / (A_W / m_H))` (EN 13000) e a força do vento sobre a carga. Ausente, "
        "vale a velocidade da tabela e a carga não recebe vento.",
    )
    obstacle_conflicts: list[Annotated[str, StringConstraints(min_length=1, max_length=64)]] = (
        Field(
            default_factory=list,
            max_length=50,
            description="Ids dos obstáculos no raio de giro (opcional; RN-017). Não vazia, o "
            "risco vira atenção.",
        )
    )
    site: SitePayload | None = Field(
        default=None,
        description="Local da operação (TASK-107; ADR-051): rede elétrica do cenário, posição do "
        "guindaste, dimensões da carga e contexto do içamento. Com ele, a resposta traz a "
        "distância às redes (`power_lines`) e a classificação de içamento crítico "
        "(`critical_lift`), e os alertas correspondentes; sem ele, nada disso é calculado.",
    )


SoilKindName = Literal["rock", "compacted", "clay", "loose_fill"]
"""Tipos de solo aceitos (RN-015); os mesmos valores de `SoilKind`."""


def to_soil_kinds(names: list[SoilKindName] | None) -> tuple[SoilKind, ...]:
    return () if names is None else tuple(SoilKind(name) for name in names)


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
        "tabelados, é o vizinho de menor capacidade. Na interpolação (ADR-030), o ponto usado de "
        "menor capacidade. `null` quando a estratégia não o informa."
    )
    interpolated_points: list[LoadChartPointResponse] | None = Field(
        default=None,
        description="Pontos da tabela usados na interpolação linear (ADR-030); `null` nas "
        "outras estratégias.",
    )

    @classmethod
    def from_capacity(cls, capacity: CapacityFound) -> CapacityResponse:
        if isinstance(capacity, InterpolatedCapacityFound):
            return cls(
                maximum_capacity_kg=capacity.max_capacity.kilograms,
                strategy=capacity.strategy,
                queried_boom_length_m=capacity.query.boom_length.meters,
                queried_working_radius_m=capacity.queried_radius.meters,
                used_point=LoadChartPointResponse.from_point(capacity.lowest_point),
                interpolated_points=[
                    LoadChartPointResponse.from_point(point) for point in capacity.points
                ],
            )
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


class CapacityLimitResponse(BaseModel):
    """Limite de capacidade do modelo e faixa de status (RN-011; TASK-051; ADR-022)."""

    limit_percent: float = Field(description="Limite de uso da capacidade do modelo, de 1 a 100 %.")
    effective_capacity_kg: float = Field(
        description="Capacidade efetiva, em kg: a capacidade da tabela × o limite."
    )
    limit_utilization_percent: float = Field(
        description="`compared_weight_kg / capacidade efetiva × 100`, sem arredondamento."
    )
    warning_band_percent: float = Field(
        description="A partir desta % do limite, o nível é `WARNING`."
    )
    slope_factor: float = Field(
        default=1.0,
        description="Obsoleto: sempre 1. A inclinação entra como momento de tombamento "
        "(`stability`; RN-017, que substitui a RN-015).",
    )
    wind_factor: float = Field(
        default=1.0,
        description="Obsoleto: sempre 1. O vento entra como limite de rajada e momento de "
        "tombamento (`stability`; RN-017, que substitui a RN-015).",
    )
    level: CapacityLimitLevel = Field(
        description="`OK`; `WARNING` na faixa de atenção; `OVER` acima da capacidade efetiva."
    )

    @classmethod
    def from_limit(cls, limit: CapacityLimit | None) -> CapacityLimitResponse | None:
        if limit is None:
            return None
        return cls(
            limit_percent=limit.limit_percent,
            effective_capacity_kg=limit.effective_capacity_kg,
            limit_utilization_percent=limit.limit_utilization_percent,
            warning_band_percent=limit.warning_band_percent,
            level=limit.level,
            slope_factor=limit.slope_factor,
            wind_factor=limit.wind_factor,
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


class StabilityResponse(BaseModel):
    """Estática da operação: tombamento por momentos e reação em cada sapata (RN-017; ADR-050).

    Valores de um modelo FICTÍCIO (ADR-012) até a ficha oficial de estabilidade do modelo.
    """

    tipping_ratio_percent: float = Field(
        description="Momento de tombamento ÷ momento estabilizante do lado crítico do polígono de "
        "apoio, em %. 100 % é o limite com a margem da norma (carga ≤ 85 % da carga de "
        "tombamento); a partir de 90 %, atenção."
    )
    critical_edge: str = Field(
        description="Lado do polígono onde o tombamento é mais provável (dianteira, lado direito, "
        "traseira, lado esquerdo)."
    )
    tipped: bool = Field(description="As sapatas perderam o apoio: o guindaste tomba.")
    pad_reactions_kg: list[float] = Field(
        min_length=4,
        max_length=4,
        description="Força vertical em cada sapata, em kgf, na ordem dianteira esquerda, "
        "dianteira direita, traseira esquerda, traseira direita.",
    )
    worst_pad_share: float = Field(
        description="Fração do peso total (guindaste + carga) na sapata mais carregada."
    )
    deflection_m: float = Field(
        description="Flecha da lança somada ao raio da carga, só na estática (RN-004 mantém o "
        "raio geométrico na tabela)."
    )
    pad_half_span_m: float = Field(description="Meia largura entre as sapatas usada, em metros.")
    wind_limit_ms: float = Field(
        description="Velocidade máxima de rajada para esta carga (EN 13000), em m/s."
    )
    wind_force_n: float = Field(description="Força de vento total (carga + lança), em N.")

    @classmethod
    def from_stability(cls, stability: StabilityResult | None) -> StabilityResponse | None:
        if stability is None:
            return None
        return cls(
            tipping_ratio_percent=stability.tipping_ratio * 100,
            critical_edge=stability.critical_edge,
            tipped=stability.tipped,
            pad_reactions_kg=list(stability.reactions_kg),
            worst_pad_share=stability.worst_pad_share,
            deflection_m=stability.deflection_m,
            pad_half_span_m=stability.pad_half_span_m,
            wind_limit_ms=stability.wind_limit_ms,
            wind_force_n=stability.wind_force_n,
        )


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
        description="Carga + gancho + acessórios, em kg: o peso comparado com a capacidade "
        "(ADR-018 § 2; RN-014)."
    )
    accessories_weight_kg: float | None = Field(
        description="Soma dos pesos dos acessórios de içamento enviados (TASK-056; RN-014), ou "
        "`null` quando nenhum acessório foi enviado."
    )
    accessories: list[AccessorySummaryResponse] = Field(
        description="Acessórios somados ao peso comparado, na ordem enviada; vazio sem acessórios."
    )
    load_chart_id: str | None = Field(
        description="Id da tabela consultada; `null` quando a tabela não chegou a ser consultada."
    )
    load_chart_version: str | None = Field(
        description="Versão da tabela consultada (RN-005); `null` quando ela não chegou a ser "
        "consultada."
    )
    capacity_limit: CapacityLimitResponse | None = Field(
        default=None,
        description="Limite de capacidade do modelo e nível OK/WARNING/OVER (RN-011; TASK-051). "
        "`null` em `NOT_EVALUABLE`.",
    )
    reasons: list[NotEvaluableReasonResponse] = Field(
        description="Motivos de `NOT_EVALUABLE`, na ordem das etapas (ficha técnica e geometria, "
        "tabela ativa, consulta à tabela, utilização); nunca vazio nesse caso. Sempre vazio em "
        "`EVALUATED`."
    )
    tipping_risk: TippingRisk | None = Field(
        default=None,
        description="Risco de tombamento por regras (RN-013; ADR-025): `LOW`, `ATTENTION` ou "
        "`HIGH`; `null` quando não há capacidade para comparar e nenhuma regra dispara.",
    )
    alerts: list[SafetyAlertResponse] = Field(
        default_factory=list, description="Alertas de segurança, em pt-BR (RN-013, RN-017)."
    )
    stability: StabilityResponse | None = Field(
        default=None,
        description="Estática da operação (RN-017; ADR-050): margem de tombamento, reação em "
        "cada sapata, flecha e limite de vento. `null` sem geometria calculada.",
    )
    power_lines: list[PowerLineClearanceResponse] = Field(
        default_factory=list,
        description="Distância de cada trecho de rede ao guindaste (ADR-051); vazio sem `site`.",
    )
    critical_lift: CriticalLiftResponse | None = Field(
        default=None,
        description="Classificação do içamento (crítico ou não, gatilhos e plano exigido); "
        "`null` sem `site`.",
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
        accessories = [
            AccessorySummaryResponse(id=item.id, name=item.name, weight_kg=item.weight.kilograms)
            for item in evaluation.accessories
        ]
        accessories_kg = sum(item.weight_kg for item in accessories) if accessories else None
        match evaluation:
            case EvaluatedOperation():
                return cls(
                    accessories_weight_kg=accessories_kg,
                    accessories=accessories,
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
                    capacity_limit=CapacityLimitResponse.from_limit(evaluation.capacity_limit),
                    tipping_risk=evaluation.tipping_risk,
                    alerts=[SafetyAlertResponse.from_alert(a) for a in evaluation.alerts],
                    stability=StabilityResponse.from_stability(evaluation.stability),
                    power_lines=_clearances(evaluation),
                    critical_lift=_critical(evaluation),
                )
            case NotEvaluableOperation():
                return cls(
                    accessories_weight_kg=accessories_kg,
                    accessories=accessories,
                    rotation_zone_code=zone_code,
                    rotation_zone_name=zone_name,
                    hook_block_weight_kg=hook_kg,
                    compared_weight_kg=compared_kg,
                    tipping_risk=evaluation.tipping_risk,
                    alerts=[SafetyAlertResponse.from_alert(a) for a in evaluation.alerts],
                    stability=StabilityResponse.from_stability(evaluation.stability),
                    power_lines=_clearances(evaluation),
                    critical_lift=_critical(evaluation),
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


def _clearances(evaluation: OperationEvaluation) -> list[PowerLineClearanceResponse]:
    return [PowerLineClearanceResponse.from_clearance(c) for c in evaluation.power_line_clearances]


def _critical(evaluation: OperationEvaluation) -> CriticalLiftResponse | None:
    item = evaluation.critical_lift
    return None if item is None else CriticalLiftResponse.from_assessment(item)
