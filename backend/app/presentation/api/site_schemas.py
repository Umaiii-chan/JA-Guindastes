"""Schemas do local da operação: rede elétrica e içamento crítico (D4; TASK-107; ADR-051).

Compartilhados pelo `POST /api/v1/evaluations` e pelo WebSocket `/api/v1/ws/evaluation`: o pedido
traz o `site` (opcional) e a resposta traz a distância às redes e a classificação do içamento.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.application.use_cases.evaluate_operation import SiteContext
from app.domain.entities.scenario import MAX_POWER_LINES, PowerLineSpec
from app.domain.exceptions.scenario_errors import InvalidScenarioError
from app.domain.services.critical_lift import CriticalLiftAssessment
from app.domain.services.power_line import LineClearance
from app.presentation.api.scenario_schemas import PowerLinePayload

_STRICT = ConfigDict(strict=True, allow_inf_nan=False, extra="forbid")


class SitePayload(BaseModel):
    """Onde está o guindaste, a rede do cenário e o que se sabe do içamento.

    Sem `site`, a avaliação é a de antes (sem rede e sem classificação de içamento crítico).
    """

    model_config = _STRICT

    power_lines: list[PowerLinePayload] = Field(
        default_factory=list,
        max_length=MAX_POWER_LINES,
        description="Trechos de rede elétrica do cenário; a tensão de cada um define a distância "
        "mínima (tabela ASME B30.5 / OSHA 1926.1408).",
    )
    crane_x_m: float = Field(default=0.0, description="Posição X do eixo de giro no mundo (m).")
    crane_z_m: float = Field(default=0.0, description="Posição Z do eixo de giro no mundo (m).")
    crane_heading_deg: float = Field(
        default=0.0, description="Giro do chassi em torno de Y (graus), como no cenário."
    )
    load_length_m: float | None = Field(default=None, gt=0, description="Comprimento da carga (m).")
    load_width_m: float | None = Field(default=None, gt=0, description="Largura da carga (m).")
    load_height_m: float | None = Field(default=None, gt=0, description="Altura da carga (m).")
    sling_angle_deg: float | None = Field(
        default=None,
        ge=30,
        le=90,
        description="Ângulo das lingas com a horizontal (F-19); sem ele, o padrão da carga.",
    )
    hook_attach_m: float = Field(
        default=1.05, ge=0, description="Do gancho ao ponto de amarração das lingas (m)."
    )
    tandem: bool = Field(default=False, description="Içamento com dois guindastes.")
    load_over_occupied: bool = Field(
        default=False, description="Carga sobre pessoas ou estruturas ocupadas."
    )

    @field_validator("power_lines")
    @classmethod
    def _valid_lines(cls, lines: list[PowerLinePayload]) -> list[PowerLinePayload]:
        """As regras de faixa dos trechos são as do cenário (422 / `INVALID_MESSAGE`)."""
        for index, line in enumerate(lines):
            try:
                line.to_domain().validate(f"site.power_lines[{index}]")
            except InvalidScenarioError as error:
                raise ValueError(str(error)) from None
        return lines

    def to_context(self) -> SiteContext:
        """O `SiteContext` do caso de uso."""
        lines: tuple[PowerLineSpec, ...] = tuple(line.to_domain() for line in self.power_lines)
        return SiteContext(
            power_lines=lines,
            crane_x_m=self.crane_x_m,
            crane_z_m=self.crane_z_m,
            crane_heading_deg=self.crane_heading_deg,
            load_length_m=self.load_length_m,
            load_width_m=self.load_width_m,
            load_height_m=self.load_height_m,
            sling_angle_deg=self.sling_angle_deg,
            hook_attach_m=self.hook_attach_m,
            tandem=self.tandem,
            load_over_occupied=self.load_over_occupied,
        )


class PowerLineClearanceResponse(BaseModel):
    """Distância de um trecho de rede ao guindaste (D4; ADR-051)."""

    line_id: str
    label: str
    voltage_kv: float
    required_m: float = Field(description="Distância mínima exigida pela tabela para a tensão.")
    distance_m: float = Field(description="Menor distância 3D agora (lança, cabo ou carga).")
    swept_distance_m: float = Field(
        description="Menor distância 3D com o giro de 0° a 360° (lança, cabo e carga)."
    )
    status: Literal["OK", "ATTENTION", "VIOLATION"] = Field(
        description="Agora: abaixo da mínima = VIOLATION; abaixo de 1,5× = ATTENTION."
    )
    swept_status: Literal["OK", "ATTENTION", "VIOLATION"]
    nearest_part: Literal["boom", "cable", "load"] = Field(
        description="A parte do guindaste mais próxima da rede agora."
    )

    @classmethod
    def from_clearance(cls, item: LineClearance) -> PowerLineClearanceResponse:
        nearest: Literal["boom", "cable", "load"]
        if item.nearest_part == "boom":
            nearest = "boom"
        elif item.nearest_part == "cable":
            nearest = "cable"
        else:
            nearest = "load"
        return cls(
            line_id=item.line_id,
            label=item.label,
            voltage_kv=item.voltage_kv,
            required_m=item.required_m,
            distance_m=item.distance_m,
            swept_distance_m=item.swept_distance_m,
            status=item.status.value,
            swept_status=item.swept_status.value,
            nearest_part=nearest,
        )


class CriticalLiftTriggerResponse(BaseModel):
    code: str = Field(description="Gatilho, legível por máquina (ex.: `CAPACITY_75`).")
    message: str


class CriticalLiftResponse(BaseModel):
    """Classificação do içamento: crítico, com os gatilhos e o plano exigido (ADR-051)."""

    is_critical: bool
    triggers: list[CriticalLiftTriggerResponse]
    plan_items: list[str] = Field(
        description="O que o plano de içamento exigido precisa conter; vazio se não é crítico."
    )

    @classmethod
    def from_assessment(cls, item: CriticalLiftAssessment) -> CriticalLiftResponse:
        return cls(
            is_critical=item.is_critical,
            triggers=[
                CriticalLiftTriggerResponse(code=t.code, message=t.message) for t in item.triggers
            ],
            plan_items=list(item.plan_items),
        )
