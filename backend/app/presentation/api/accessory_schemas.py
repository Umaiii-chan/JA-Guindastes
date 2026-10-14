"""Schemas Pydantic do catálogo de acessórios de içamento (TASK-056; ADR-006; ADR-026; RN-014).

Entradas estritas como as do catálogo de guindastes: `strict`, `allow_inf_nan=False` e
`extra="forbid"` (ids são gerados pelo servidor). Os campos com unidade levam o sufixo (`_kg`, `_m`;
RN-006). Valores cadastrados são FICTÍCIOS e configuráveis (ADR-012).
"""

from typing import Annotated, Self

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

from app.domain.entities.accessory import (
    ACCESSORY_RIGGING_HEIGHT_MAX_M,
    ACCESSORY_WEIGHT_MAX_KG,
    Accessory,
    AccessoryType,
)

_STRICT_INPUT = ConfigDict(strict=True, allow_inf_nan=False, extra="forbid")
RequiredText = Annotated[str, StringConstraints(min_length=1, pattern=r"\S")]

_MODEL_FILE_DESCRIPTION = (
    "Nome do arquivo GLB/glTF em `frontend/public/models/acessorios/` (só o nome, sem pasta), ou "
    "`null` se o modelo 3D estiver pendente: o acessório entra só no peso e na distância."
)


class AccessoryCreateRequest(BaseModel):
    model_config = _STRICT_INPUT

    type: AccessoryType = Field(
        strict=False, description="Tipo do acessório de içamento (texto, ex.: `SHACKLE`)."
    )
    name: RequiredText = Field(description="Nome do acessório.")
    weight_kg: float = Field(
        ge=0, le=ACCESSORY_WEIGHT_MAX_KG, description="Peso, somado ao peso comparado (RN-014)."
    )
    rigging_height_m: float = Field(
        default=0.0,
        ge=0,
        le=ACCESSORY_RIGGING_HEIGHT_MAX_M,
        description="Quanto o acessório afasta a carga abaixo do gancho, em metros.",
    )
    model_file: str | None = Field(default=None, description=_MODEL_FILE_DESCRIPTION)
    credit: str | None = Field(default=None, description="Autoria do modelo 3D de terceiros.")
    license: str | None = Field(default=None, description="Licença do modelo 3D de terceiros.")


class AccessoryUpdateRequest(BaseModel):
    """Edição parcial: campo ausente mantém o valor; `model_file`, `credit` e `license` aceitam
    `null` para apagar. Pelo menos um campo é obrigatório."""

    model_config = _STRICT_INPUT

    type: AccessoryType | None = Field(default=None, strict=False)
    name: RequiredText | None = Field(default=None)
    weight_kg: float | None = Field(default=None, ge=0, le=ACCESSORY_WEIGHT_MAX_KG)
    rigging_height_m: float | None = Field(default=None, ge=0, le=ACCESSORY_RIGGING_HEIGHT_MAX_M)
    model_file: str | None = Field(default=None, description=_MODEL_FILE_DESCRIPTION)
    credit: str | None = Field(default=None)
    license: str | None = Field(default=None)

    @model_validator(mode="after")
    def _at_least_one_field_and_no_null_required(self) -> Self:
        fields = self.model_fields_set
        if not fields:
            raise ValueError("informe pelo menos um campo para editar")
        for required in ("type", "name", "weight_kg", "rigging_height_m"):
            if required in fields and getattr(self, required) is None:
                raise ValueError(f"{required} não aceita null")
        return self


class AccessoryResponse(BaseModel):
    id: str
    type: AccessoryType
    name: str
    weight_kg: float
    rigging_height_m: float
    model_file: str | None
    credit: str | None
    license: str | None

    @classmethod
    def from_entity(cls, accessory: Accessory) -> Self:
        return cls(
            id=accessory.id,
            type=accessory.type,
            name=accessory.name,
            weight_kg=accessory.weight.kilograms,
            rigging_height_m=accessory.rigging_height_m,
            model_file=accessory.model_file,
            credit=accessory.credit,
            license=accessory.license,
        )


class AccessoryErrorResponse(BaseModel):
    detail: str
