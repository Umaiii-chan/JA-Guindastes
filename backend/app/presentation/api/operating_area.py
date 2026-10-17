"""Rota da área de operação (TASK-055; ADR-025; RN-011).

`POST /api/v1/configurations/{configuration_id}/operating-area` devolve uma grade polar de células
(giro ψ × raio R) com o nível `GREEN`, `YELLOW` ou `RED` de cada uma, para um comprimento de lança e
uma carga, com os acessórios de içamento pedidos somados ao peso comparado (RN-014). Nada é
gravado.

- **200** com a grade;
- **404** quando a configuração não tem ficha técnica;
- **422** quando a requisição é malformada, a lança fica fora da faixa da ficha técnica, a grade
  teria células demais ou um acessório pedido não existe no catálogo.

Autorização igual à da avaliação (ADR-016): com banco, qualquer perfil autenticado (a composição
passa a exigência de sessão na inclusão do router). Como na avaliação, o caso de uso chega por uma
dependência FastAPI, para a composição com banco liberar a conexão no fim da requisição.
"""

from collections.abc import Callable, Iterator
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field

from app.application.use_cases.compute_operating_area import (
    ComputeOperatingArea,
    OperatingArea,
    OperatingAreaConfigurationNotFoundError,
    OperatingAreaInvalidInputError,
)
from app.domain.value_objects.mass import Mass
from app.presentation.api.evaluation_schemas import MAX_ACCESSORY_IDS, AccessoryId

OPERATING_AREA_PATH = "/api/v1/configurations/{configuration_id}/operating-area"

type ComputeOperatingAreaDependency = Callable[[], Iterator[ComputeOperatingArea]]
"""Dependência FastAPI (gerador com um só `yield`) que entrega o caso de uso da requisição."""


def shared_compute_operating_area(use_case: ComputeOperatingArea) -> ComputeOperatingAreaDependency:
    def provide() -> Iterator[ComputeOperatingArea]:
        yield use_case

    return provide


class OperatingAreaRequest(BaseModel):
    model_config = ConfigDict(strict=True, allow_inf_nan=False, extra="forbid")

    boom_length_m: float = Field(ge=0, description="Comprimento de lança L, em metros.")
    load_weight_kg: float = Field(ge=0, description="Peso da carga, em quilogramas.")
    psi_step_deg: float = Field(
        default=10, gt=0, le=180, description="Passo do giro ψ da grade, em graus."
    )
    radius_step_m: float = Field(default=1, gt=0, description="Passo do raio R, em metros.")
    ground_slope_deg: float | None = Field(
        default=None, ge=0, description="Inclinação residual do terreno, em graus (opcional)."
    )
    wind_speed_ms: float | None = Field(
        default=None,
        ge=0,
        description="Rajada de 3 s no ponto mais alto, em m/s (EN 13000; opcional; RN-017).",
    )
    load_wind_area_m2: float | None = Field(
        default=None,
        ge=0,
        description="Área de vento da carga `A_W`, em m² (opcional; RN-017): define a velocidade "
        "máxima de rajada e a força do vento sobre a carga.",
    )
    accessory_ids: list[AccessoryId] = Field(
        default_factory=list,
        max_length=MAX_ACCESSORY_IDS,
        description="Ids de acessórios de içamento do catálogo (RN-014), como na avaliação: cada "
        "id soma o peso do acessório ao peso comparado; o mesmo id repetido soma de novo. Id "
        "desconhecido responde 422.",
    )


class OperatingAreaCellResponse(BaseModel):
    psi_deg: float = Field(description="Giro da torre ψ, em graus, em [0°, 360°).")
    radius_m: float = Field(description="Raio de trabalho R, em metros.")
    level: Literal["GREEN", "YELLOW", "RED"] = Field(
        description="`RED`: acima do limite do modelo ou fora da tabela; `YELLOW`: faixa de "
        "atenção; `GREEN`: abaixo dela."
    )


class OperatingAreaResponse(BaseModel):
    configuration_id: str
    boom_length_m: float
    load_weight_kg: float
    compared_weight_kg: float = Field(
        description="Carga + gancho + acessórios, em kg (ADR-018 § 2; RN-014)."
    )
    psi_step_deg: float
    radius_step_m: float
    max_radius_m: float = Field(description="Alcance horizontal máximo da lança, `a + L`, em m.")
    cells: list[OperatingAreaCellResponse]

    @classmethod
    def from_area(cls, area: OperatingArea) -> OperatingAreaResponse:
        return cls(
            configuration_id=area.configuration_id,
            boom_length_m=area.boom_length_m,
            load_weight_kg=area.load_weight_kg,
            compared_weight_kg=area.compared_weight_kg,
            psi_step_deg=area.psi_step_deg,
            radius_step_m=area.radius_step_m,
            max_radius_m=area.max_radius_m,
            cells=[
                OperatingAreaCellResponse(
                    psi_deg=cell.psi_deg, radius_m=cell.radius_m, level=cell.level.value
                )
                for cell in area.cells
            ],
        )


def create_operating_area_router(dependency: ComputeOperatingAreaDependency) -> APIRouter:
    router = APIRouter(tags=["operating-area"])

    @router.post(
        OPERATING_AREA_PATH,
        status_code=status.HTTP_200_OK,
        summary="Área de operação (verde, amarela, vermelha) de uma configuração",
        description=(
            "Grade polar de células (giro × raio) para o comprimento de lança e a carga. Usa a "
            "mesma consulta da avaliação (na composição, a interpolação linear provisória do "
            "ADR-030), as zonas de giro, o gancho, os acessórios (RN-014) e o limite do modelo "
            "(RN-011). Vermelho: acima do limite ou fora da tabela. Nada é gravado."
        ),
        responses={
            status.HTTP_404_NOT_FOUND: {"description": "A configuração não tem ficha técnica."},
            422: {
                "description": "Requisição malformada, lança fora da faixa, grade grande demais "
                "ou acessório inexistente."
            },
        },
    )
    def compute_operating_area(
        configuration_id: str,
        request: OperatingAreaRequest,
        use_case: Annotated[ComputeOperatingArea, Depends(dependency)],
    ) -> OperatingAreaResponse:
        try:
            area = use_case.execute(
                configuration_id=configuration_id,
                boom_length_m=request.boom_length_m,
                load_weight=Mass(request.load_weight_kg),
                psi_step_deg=request.psi_step_deg,
                radius_step_m=request.radius_step_m,
                ground_slope_deg=request.ground_slope_deg,
                wind_speed_ms=request.wind_speed_ms,
                accessory_ids=tuple(request.accessory_ids),
                load_wind_area_m2=request.load_wind_area_m2,
            )
        except OperatingAreaConfigurationNotFoundError:
            raise HTTPException(
                status.HTTP_404_NOT_FOUND,
                detail=f"configuração sem ficha técnica: {configuration_id!r}",
            ) from None
        except OperatingAreaInvalidInputError as error:
            raise HTTPException(422, detail=str(error)) from None
        return OperatingAreaResponse.from_area(area)

    return router
