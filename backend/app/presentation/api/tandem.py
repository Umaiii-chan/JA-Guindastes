"""Rota REST do içamento com dois guindastes (TASK-074; RN-016; ADR-037).

`POST /api/v1/evaluations/tandem` recebe o peso e o centro de gravidade da carga e, para cada um dos
dois guindastes, a configuração, a posição, o estado operacional e o ponto de içamento. Devolve a
divisão da carga (alavanca dos pontos em relação ao CG), a avaliação de cada guindaste com a parte
dele (limite de 75 % da capacidade efetiva), `tandem_ok` e os alertas em pt-BR. Nada é gravado.

Reaproveita o caso de uso `EvaluateOperation` da avaliação individual. Pontos de içamento iguais
respondem 422.

Ambiente (TASK-090; RN-014, RN-015): cada guindaste aceita os mesmos campos opcionais da avaliação
individual (`outriggers`, `ground_slope_deg`, `accessory_ids`, `soil_kinds`, `obstacle_conflicts`),
porque cada um tem as próprias patolas, o próprio chão e a própria cadeia de acessórios; o vento
(`wind_speed_ms`) é do local e vale para os dois. Ausentes, o resultado é o de antes. O gancho de
cada guindaste, pela posição, pelo rumo e pelo estado, tem de estar sobre o ponto de içamento dele.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field

from app.application.use_cases.evaluate_operation import EvaluateOperation
from app.application.use_cases.evaluate_tandem import (
    EvaluateTandem,
    TandemCraneInput,
    TandemEvaluation,
)
from app.domain.entities.scenario import CranePlacementSpec
from app.domain.services.tandem_hook_alignment import TANDEM_HOOK_POINT_TOLERANCE_M
from app.domain.value_objects.angle import Angle
from app.domain.value_objects.length import Length
from app.domain.value_objects.operational_state import OperationalState
from app.presentation.api.evaluation_schemas import (
    MAX_ACCESSORY_IDS,
    MAX_OBSTACLE_CONFLICTS,
    AccessoryId,
    EvaluationResponse,
    ObstacleConflictId,
    OutriggersRequest,
    SafetyAlertResponse,
    SoilKindName,
    to_soil_kinds,
)
from app.presentation.api.evaluations import (
    EVALUATIONS_PATH,
    EvaluateOperationDependency,
    EvaluationDependencies,
    as_evaluate_operation_dependency,
)

TANDEM_PATH = f"{EVALUATIONS_PATH}/tandem"
_TOLERANCE_TEXT = f"{TANDEM_HOOK_POINT_TOLERANCE_M:g}".replace(".", ",")


class _Strict(BaseModel):
    model_config = ConfigDict(strict=True, allow_inf_nan=False, extra="forbid")


class PlanPointRequest(_Strict):
    x: float
    z: float


class TandemPlacementRequest(_Strict):
    x: float
    z: float
    heading_deg: float = 0.0


class TandemStateRequest(_Strict):
    boom_length_m: float = Field(ge=0)
    boom_angle_deg: float
    turret_rotation_deg: float
    cable_length_m: float = Field(ge=0)


class TandemCraneRequest(_Strict):
    configuration_id: str = Field(min_length=1, pattern=r"\S")
    placement: TandemPlacementRequest
    state: TandemStateRequest
    hook_point: PlanPointRequest = Field(
        description="Ponto de içamento sobre a carga, no plano do mundo (metros). O gancho do "
        "guindaste (posição, rumo e estado) tem de estar a até "
        f"{_TOLERANCE_TEXT} m dele (FICTÍCIO), senão o alerta "
        "`TANDEM_HOOK_OFF_POINT` reprova o tandem."
    )
    outriggers: OutriggersRequest | None = Field(
        default=None,
        description="Patolas deste guindaste (opcional), como na avaliação individual (RN-013).",
    )
    ground_slope_deg: float | None = Field(
        default=None,
        ge=0,
        description="Inclinação do terreno sob este guindaste, em graus (opcional; RN-015).",
    )
    accessory_ids: list[AccessoryId] = Field(
        default_factory=list,
        max_length=MAX_ACCESSORY_IDS,
        description="Acessórios de içamento do gancho deste guindaste (opcional; RN-014). Id "
        "desconhecido deixa este guindaste `NOT_EVALUABLE` com `ACCESSORY_NOT_FOUND`.",
    )
    soil_kinds: list[SoilKindName] | None = Field(
        default=None,
        min_length=4,
        max_length=4,
        description="Solo sob as 4 sapatas deste guindaste, na ordem da avaliação individual "
        "(opcional; RN-015).",
    )
    obstacle_conflicts: list[ObstacleConflictId] = Field(
        default_factory=list,
        max_length=MAX_OBSTACLE_CONFLICTS,
        description="Obstáculos no raio de giro deste guindaste (opcional; RN-015).",
    )


class TandemRequest(_Strict):
    load_weight_kg: float = Field(ge=0, description="Peso da carga, em kg.")
    load_cg: PlanPointRequest = Field(description="Centro de gravidade da carga, no plano.")
    cranes: list[TandemCraneRequest] = Field(
        min_length=2, max_length=2, description="Exatamente dois guindastes."
    )
    wind_speed_ms: float | None = Field(
        default=None,
        ge=0,
        description="Velocidade do vento no local, em m/s, para os dois guindastes (opcional; "
        "RN-015).",
    )


class TandemResponse(BaseModel):
    shares_kg: list[float] = Field(description="Parte da carga de cada guindaste, em kg.")
    share_percent: list[float] = Field(description="Parte de cada guindaste, em % do peso.")
    evaluations: list[EvaluationResponse] = Field(
        description="Avaliação de cada guindaste com a parte dele e o limite de 75 % (RN-016)."
    )
    tandem_ok: bool = Field(description="Verdadeiro só quando os dois guindastes estão OK.")
    alerts: list[SafetyAlertResponse] = Field(description="Alertas do tandem, em pt-BR.")

    @classmethod
    def from_tandem(cls, request: TandemRequest, result: TandemEvaluation) -> TandemResponse:
        return cls(
            shares_kg=list(result.shares_kg),
            share_percent=[fraction * 100 for fraction in result.fractions],
            evaluations=[
                EvaluationResponse.from_evaluation(crane.configuration_id, evaluation)
                for crane, evaluation in zip(request.cranes, result.evaluations, strict=True)
            ],
            tandem_ok=result.tandem_ok,
            alerts=[SafetyAlertResponse.from_alert(alert) for alert in result.alerts],
        )


def create_tandem_router(
    dependencies: EvaluationDependencies | EvaluateOperationDependency,
) -> APIRouter:
    use_case_dependency = as_evaluate_operation_dependency(dependencies)
    router = APIRouter(prefix=TANDEM_PATH, tags=["evaluations"])

    @router.post(
        "",
        status_code=status.HTTP_200_OK,
        summary="Avaliar o içamento de uma carga por dois guindastes (tandem)",
        description=(
            "Divide o peso pela alavanca dos pontos de içamento em relação ao centro de "
            "gravidade e avalia cada guindaste com a parte dele, usando no máximo 75 % da "
            "capacidade efetiva (RN-016). Cada guindaste leva o próprio ambiente e os próprios "
            "acessórios (RN-014, RN-015), e o gancho dele tem de estar sobre o ponto de "
            "içamento. `tandem_ok` só é verdadeiro quando os dois estão OK. "
            "Pontos de içamento iguais respondem 422. Nada é gravado."
        ),
    )
    def evaluate_tandem(
        request: TandemRequest,
        use_case: Annotated[EvaluateOperation, Depends(use_case_dependency)],
    ) -> TandemResponse:
        cranes = [
            TandemCraneInput(
                configuration_id=crane.configuration_id,
                state=OperationalState(
                    boom_length=Length(crane.state.boom_length_m),
                    boom_angle=Angle(crane.state.boom_angle_deg),
                    turret_rotation=Angle(crane.state.turret_rotation_deg),
                    cable_length=Length(crane.state.cable_length_m),
                ),
                hook_point=(crane.hook_point.x, crane.hook_point.z),
                placement=CranePlacementSpec(
                    x=crane.placement.x,
                    z=crane.placement.z,
                    heading_deg=crane.placement.heading_deg,
                ),
                outriggers=None if crane.outriggers is None else crane.outriggers.to_setting(),
                ground_slope_deg=crane.ground_slope_deg,
                accessory_ids=tuple(crane.accessory_ids),
                soil_kinds=to_soil_kinds(crane.soil_kinds),
                obstacle_conflicts=tuple(crane.obstacle_conflicts),
            )
            for crane in request.cranes
        ]
        try:
            result = EvaluateTandem(use_case).execute(
                load_weight_kg=request.load_weight_kg,
                load_cg=(request.load_cg.x, request.load_cg.z),
                cranes=cranes,
                wind_speed_ms=request.wind_speed_ms,
            )
        except ValueError as error:
            raise HTTPException(
                status_code=422,
                detail="Os dois pontos de içamento não podem coincidir.",
            ) from error
        return TandemResponse.from_tandem(request, result)

    return router
