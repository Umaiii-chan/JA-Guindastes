"""Rota do planejamento da operação (TASK-075; ADR-038).

`POST /api/v1/planning/recommend` recebe a carga, os pontos de coleta e de entrega e o cenário, e
devolve as recomendações da melhor para a pior: qual guindaste (ou dois, em tandem), onde
posicioná-lo e a trajetória (aproximar, engatar, levantar, girar, baixar e soltar). Nada é gravado.

- **200** com as recomendações (pode vir vazia, com `notes` explicando o motivo);
- **422** para requisição malformada, cenário inválido ou acessório inexistente.

Capacidade e segurança vêm só do cálculo determinístico do backend (tabela de carga, limites e
RN-011 a RN-015); a rota não estima nada (RN-008). Autorização igual à da avaliação (ADR-016): com
banco, qualquer perfil autenticado (a composição passa a exigência de sessão na inclusão do router).
"""

from collections.abc import Callable, Iterator
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from app.application.use_cases.recommend_lift_plan import (
    CraneDetail,
    PlanningInvalidInputError,
    PlanningRequest,
    PlanningResult,
    Recommendation,
    RecommendLiftPlan,
)
from app.domain.entities.scenario import ScenarioSpec
from app.domain.exceptions.scenario_errors import InvalidScenarioError
from app.domain.services.planning.models import PlanLoad, PlanPoint, TrajectoryPoint
from app.domain.services.planning.planner import HOOK_ATTACH_M
from app.domain.services.safety_assessment import TippingRisk
from app.presentation.api.scenario_schemas import ScenarioSpecPayload

PLANNING_PATH = "/api/v1/planning/recommend"
MAX_ACCESSORY_IDS = 20

type RecommendLiftPlanDependency = Callable[[], Iterator[RecommendLiftPlan]]
"""Dependência FastAPI (gerador com um só `yield`) que entrega o caso de uso da requisição."""

_STRICT_INPUT = ConfigDict(strict=True, allow_inf_nan=False, extra="forbid")
AccessoryId = Annotated[str, StringConstraints(min_length=1, max_length=64)]


def shared_recommend_lift_plan(use_case: RecommendLiftPlan) -> RecommendLiftPlanDependency:
    def provide() -> Iterator[RecommendLiftPlan]:
        yield use_case

    return provide


class PlanLoadPayload(BaseModel):
    model_config = _STRICT_INPUT

    weight_kg: float = Field(gt=0, description="Peso da carga, em kg.")
    length_m: float = Field(gt=0, description="Comprimento, em metros.")
    width_m: float = Field(gt=0, description="Largura, em metros.")
    height_m: float = Field(gt=0, description="Altura, em metros.")
    cg_offset_m: float = Field(
        default=0.0,
        description="Centro de gravidade ao longo do comprimento, a partir do centro (tandem).",
    )


class PlanPointPayload(BaseModel):
    model_config = _STRICT_INPUT

    x: float
    z: float
    rotation_y_deg: float = Field(default=0.0, description="Giro da carga em torno de Y.")


class PlanningRequestBody(BaseModel):
    model_config = _STRICT_INPUT

    load: PlanLoadPayload
    pick: PlanPointPayload = Field(description="Ponto de coleta, no chão.")
    delivery: PlanPointPayload = Field(description="Ponto de entrega, no chão.")
    scenario: ScenarioSpecPayload | None = Field(
        default=None, description="Terreno, obstáculos, solo e vento; sem ele, chão plano e livre."
    )
    accessory_ids: list[AccessoryId] = Field(default_factory=list, max_length=MAX_ACCESSORY_IDS)
    hook_attach_m: float = Field(
        default=HOOK_ATTACH_M,
        gt=0,
        le=10,
        description="Do gancho ao ponto de amarração das lingas, em metros (medido na cena).",
    )


class CraneStateResponse(BaseModel):
    boom_length_m: float
    boom_angle_deg: float
    turret_rotation_deg: float = Field(description="Giro ψ, contínuo (pode passar de ±180°).")
    cable_length_m: float


class PlacementResponse(BaseModel):
    x: float
    z: float
    heading_deg: float


class TrajectoryPointResponse(BaseModel):
    t_s: float
    crane_index: int
    state: CraneStateResponse
    phase: str = Field(
        description="`aproximar`, `engatar`, `levantar`, `girar`, `baixar` ou `soltar`."
    )

    @classmethod
    def from_point(cls, point: TrajectoryPoint) -> TrajectoryPointResponse:
        return cls(
            t_s=point.t_s,
            crane_index=point.crane_index,
            state=CraneStateResponse(
                boom_length_m=point.state.boom_length_m,
                boom_angle_deg=point.state.boom_angle_deg,
                turret_rotation_deg=point.state.turret_rotation_deg,
                cable_length_m=point.state.cable_length_m,
            ),
            phase=point.phase.value,
        )


class CraneDetailResponse(BaseModel):
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
    swing_deg: float = Field(description="Giro total; positivo = anti-horário (esquerda).")
    utilization_percent: float
    transport_height_m: float = Field(description="Altura da base da carga durante o giro.")
    crossed_obstacle_ids: list[str]

    @classmethod
    def from_detail(cls, detail: CraneDetail) -> CraneDetailResponse:
        return cls(
            configuration_id=detail.configuration_id,
            manufacturer_id=detail.manufacturer_id,
            crane_id=detail.crane_id,
            label=detail.label,
            share_kg=detail.share_kg,
            boom_length_m=detail.boom_length_m,
            boom_angle_pick_deg=detail.boom_angle_pick_deg,
            boom_angle_delivery_deg=detail.boom_angle_delivery_deg,
            pick_radius_m=detail.pick_radius_m,
            delivery_radius_m=detail.delivery_radius_m,
            swing_deg=detail.swing_deg,
            utilization_percent=detail.utilization_percent,
            transport_height_m=detail.transport_height_m,
            crossed_obstacle_ids=list(detail.crossed_obstacle_ids),
        )


class RecommendationResponse(BaseModel):
    kind: str = Field(description="`single` (um guindaste) ou `tandem` (dois).")
    configuration_ids: list[str]
    placements: list[PlacementResponse]
    max_limit_utilization_percent: float = Field(
        description="Maior utilização do limite ao longo do caminho; no tandem, já sobre 75 % da "
        "capacidade de cada guindaste."
    )
    tipping_risk: TippingRisk | None
    valid: bool = Field(description="Dentro do limite de capacidade e sem risco alto.")
    summary: str
    trajectory: list[TrajectoryPointResponse]
    notes: list[str]
    details: list[CraneDetailResponse]

    @classmethod
    def from_recommendation(cls, item: Recommendation) -> RecommendationResponse:
        return cls(
            kind=item.kind,
            configuration_ids=list(item.configuration_ids),
            placements=[PlacementResponse(x=x, z=z, heading_deg=h) for x, z, h in item.placements],
            max_limit_utilization_percent=item.max_limit_utilization_percent,
            tipping_risk=item.tipping_risk,
            valid=item.valid,
            summary=item.summary,
            trajectory=[TrajectoryPointResponse.from_point(point) for point in item.trajectory],
            notes=list(item.notes),
            details=[CraneDetailResponse.from_detail(detail) for detail in item.details],
        )


class PlanningResponse(BaseModel):
    recommendations: list[RecommendationResponse]
    notes: list[str]

    @classmethod
    def from_result(cls, result: PlanningResult) -> PlanningResponse:
        return cls(
            recommendations=[
                RecommendationResponse.from_recommendation(item) for item in result.recommendations
            ],
            notes=list(result.notes),
        )


def create_planning_router(dependency: RecommendLiftPlanDependency) -> APIRouter:
    router = APIRouter(tags=["planning"])

    @router.post(
        PLANNING_PATH,
        status_code=status.HTTP_200_OK,
        summary="Recomendar guindaste, posição e trajetória para levar uma carga",
        description=(
            "Para cada configuração com tabela de carga ativa, procura a posição do guindaste "
            "(grade de 2 m ao redor da coleta e da entrega, fora de obstáculos e com solo e "
            "inclinação dentro do limite), o comprimento de lança e o sentido do giro que "
            "minimizam a maior utilização do limite ao longo do caminho (RN-011 a RN-015). A carga "
            "viaja a 1 m acima do obstáculo mais alto do caminho. Sem configuração única que "
            "sirva, tenta o tandem: dois guindastes, cada um com no máximo 75 % da capacidade. "
            "Nada é gravado."
        ),
        responses={422: {"description": "Requisição malformada, cenário inválido ou acessório."}},
    )
    def recommend(
        body: PlanningRequestBody,
        use_case: Annotated[RecommendLiftPlan, Depends(dependency)],
    ) -> PlanningResponse:
        try:
            scenario = body.scenario.to_domain() if body.scenario is not None else None
        except InvalidScenarioError as error:
            raise RequestValidationError(
                [
                    {
                        "loc": ("body", "scenario", *error.field.split(".")),
                        "msg": str(error),
                        "type": "value_error",
                    }
                ]
            ) from None

        request = PlanningRequest(
            load=PlanLoad(
                weight_kg=body.load.weight_kg,
                length_m=body.load.length_m,
                width_m=body.load.width_m,
                height_m=body.load.height_m,
                cg_offset_m=body.load.cg_offset_m,
            ),
            pick=PlanPoint(body.pick.x, body.pick.z, body.pick.rotation_y_deg),
            delivery=PlanPoint(body.delivery.x, body.delivery.z, body.delivery.rotation_y_deg),
            scenario=scenario if scenario is not None else ScenarioSpec(),
            accessory_ids=tuple(body.accessory_ids),
            hook_attach_m=body.hook_attach_m,
        )
        try:
            result = use_case.execute(request)
        except PlanningInvalidInputError as error:
            raise HTTPException(422, detail=str(error)) from None
        return PlanningResponse.from_result(result)

    return router
