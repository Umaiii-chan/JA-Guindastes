"""Estado das patolas enviado pelo cliente (leva E; TASK-054; ADR-024).

Compartilhado pela requisição REST e pela mensagem WebSocket da avaliação. Por ora o backend só
valida a forma: ainda não usa o campo (o risco de tombamento é da TASK-055; RN-013).
"""

from pydantic import BaseModel, ConfigDict, Field


class OutriggersRequest(BaseModel):
    """Patolas do guindaste, como a tela as mostra."""

    model_config = ConfigDict(strict=True, extra="forbid", allow_inf_nan=False, frozen=True)

    extension_percent: float = Field(
        ge=0, le=100, description="Extensão das vigas, de 0 (recolhidas) a 100 %."
    )
    jacks_set: bool = Field(description="Macacos descidos e apoiados no chão.")
