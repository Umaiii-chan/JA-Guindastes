"""Rota da área de operação (TASK-055; ADR-025; RN-011).

`POST /api/v1/configurations/{configuration_id}/operating-area` devolve uma grade polar de células
(giro ψ × raio R) com o nível `GREEN`, `YELLOW` ou `RED` de cada uma, para um comprimento de lança e
uma carga. Nada é gravado.

- **200** com a grade;
- **404** quando a configuração não tem ficha técnica;
- **422** quando a requisição é malformada, a lança fica fora da faixa da ficha técnica ou a grade
  teria células demais.

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
    compared_weight_kg: float = Field(description="Carga + gancho, em kg (ADR-018 § 2).")
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
            "consulta conservadora (ADR-029), as zonas de giro, o gancho e o limite do modelo "
            "(RN-011). Vermelho: acima do limite ou fora da tabela. Nada é gravado."
        ),
        responses={
            status.HTTP_404_NOT_FOUND: {"description": "A configuração não tem ficha técnica."},
            422: {
                "description": "Requisição malformada, lança fora da faixa ou grade grande demais."
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
