"""Içamento CRÍTICO: gatilhos e plano de içamento exigido (D4; TASK-107; ADR-051). Serviço puro.

Um içamento é crítico quando qualquer um dos gatilhos vale (limiares do ADR-051, decididos pelo
dono do produto; FICTÍCIOS e configuráveis até haver norma interna da empresa):

- carga a 75 % ou mais da capacidade efetiva (`CAPACITY_RATIO_TRIGGER`);
- içamento em tandem (dois guindastes);
- carga sobre pessoas ou estruturas ocupadas;
- distância à rede elétrica abaixo de 1,5× a mínima (inclui a violação da mínima);
- vento acima de 70 % do limite de bloqueio (`WIND_RATIO_TRIGGER`);
- solo sob as sapatas em atenção, ou inclinação do terreno a 70 % ou mais do máximo do modelo
  (`SLOPE_RATIO_TRIGGER`).

"Crítico" não é "proibido": é a exigência de um plano de içamento formal. A violação da distância
mínima da rede tem o seu próprio alerta crítico (`power_line.py`). A NR-11 (movimentação de
materiais) é o contexto do plano de içamento; a NR-10, o da rede elétrica (ADR-051).
"""

from dataclasses import dataclass

from app.domain.services.environment_factors import WIND_BLOCK_LIMIT_MS
from app.domain.services.power_line import ATTENTION_FACTOR

CAPACITY_RATIO_TRIGGER = 0.75
WIND_RATIO_TRIGGER = 0.70
SLOPE_RATIO_TRIGGER = 0.70

_BASE_PLAN: tuple[str, ...] = (
    "Plano de içamento escrito, assinado pelo responsável técnico",
    "Memória de cálculo: capacidade no raio, peso comparado, ângulo e comprimento das lingas",
    "Supervisor de içamento e sinaleiro designados, com comunicação definida",
    "Análise de risco e permissão de trabalho antes do içamento",
)
_PLAN_BY_CODE: dict[str, tuple[str, ...]] = {
    "TANDEM": (
        "Plano de tandem: sequência de manobra, repartição da carga e parada de emergência",
    ),
    "LOAD_OVER_OCCUPIED": ("Isolar e evacuar a área sob a carga e o seu trajeto",),
    "POWER_LINE_CLOSE": (
        "Rede elétrica: confirmar a tensão com a concessionária e, se a distância não puder ser "
        "mantida, desenergizar ou isolar a rede (NR-10)",
        "Sinaleiro dedicado e limite de curso da lança perto da rede",
    ),
    "WIND_NEAR_LIMIT": ("Anemômetro no local e critério de parada por vento no plano",),
    "GROUND_CONDITIONS": ("Laudo ou verificação do solo e do nivelamento sob as sapatas",),
}


@dataclass(frozen=True, slots=True)
class CriticalLiftTrigger:
    code: str
    message: str


@dataclass(frozen=True, slots=True)
class CriticalLiftAssessment:
    """`triggers` vazio = içamento comum; senão, crítico, com o plano exigido em `plan_items`."""

    triggers: tuple[CriticalLiftTrigger, ...]
    plan_items: tuple[str, ...]

    @property
    def is_critical(self) -> bool:
        return bool(self.triggers)

    @property
    def reasons(self) -> tuple[str, ...]:
        return tuple(trigger.message for trigger in self.triggers)


def assess_critical_lift(
    *,
    capacity_usage_ratio: float | None,
    tandem: bool,
    load_over_occupied: bool,
    min_clearance_ratio: float | None,
    wind_speed_ms: float | None,
    ground_slope_deg: float | None,
    max_ground_slope_deg: float,
    soil_attention: bool,
) -> CriticalLiftAssessment:
    """Gatilhos de içamento crítico.

    - `capacity_usage_ratio`: peso comparado ÷ capacidade efetiva (0,75 = 75 %); `None` sem
      capacidade;
    - `min_clearance_ratio`: a menor razão distância ÷ mínima entre os trechos de rede (varrida pelo
      giro); `None` sem rede no cenário;
    - `soil_attention`: algum apoio com solo em atenção ou acima do suporte.
    """
    triggers: list[CriticalLiftTrigger] = []
    if capacity_usage_ratio is not None and capacity_usage_ratio >= CAPACITY_RATIO_TRIGGER - 1e-9:
        triggers.append(
            CriticalLiftTrigger(
                "CAPACITY_75",
                f"carga a {capacity_usage_ratio * 100:.0f} % da capacidade efetiva "
                f"(crítico a partir de {CAPACITY_RATIO_TRIGGER * 100:.0f} %)",
            )
        )
    if tandem:
        triggers.append(CriticalLiftTrigger("TANDEM", "içamento com dois guindastes (tandem)"))
    if load_over_occupied:
        triggers.append(
            CriticalLiftTrigger("LOAD_OVER_OCCUPIED", "carga sobre pessoas ou estruturas ocupadas")
        )
    if min_clearance_ratio is not None and min_clearance_ratio < ATTENTION_FACTOR:
        triggers.append(
            CriticalLiftTrigger(
                "POWER_LINE_CLOSE",
                f"distância à rede elétrica a {min_clearance_ratio:.2f}× a mínima "
                f"(crítico abaixo de {ATTENTION_FACTOR:g}×)",
            )
        )
    if wind_speed_ms is not None and wind_speed_ms > WIND_BLOCK_LIMIT_MS * WIND_RATIO_TRIGGER:
        triggers.append(
            CriticalLiftTrigger(
                "WIND_NEAR_LIMIT",
                f"vento de {wind_speed_ms:.1f} m/s, acima de {WIND_RATIO_TRIGGER * 100:.0f} % do "
                f"limite ({WIND_BLOCK_LIMIT_MS:g} m/s)",
            )
        )
    slope_near = (
        ground_slope_deg is not None
        and max_ground_slope_deg > 0
        and ground_slope_deg >= max_ground_slope_deg * SLOPE_RATIO_TRIGGER - 1e-9
    )
    if soil_attention or slope_near:
        reasons = []
        if soil_attention:
            reasons.append("solo em atenção sob as sapatas")
        if slope_near:
            reasons.append(
                f"inclinação de {ground_slope_deg:.1f}° a {SLOPE_RATIO_TRIGGER * 100:.0f} % ou "
                f"mais do máximo ({max_ground_slope_deg:.1f}°)"
            )
        triggers.append(CriticalLiftTrigger("GROUND_CONDITIONS", " e ".join(reasons)))
    if not triggers:
        return CriticalLiftAssessment((), ())
    items = list(_BASE_PLAN)
    for trigger in triggers:
        for item in _PLAN_BY_CODE.get(trigger.code, ()):
            if item not in items:
                items.append(item)
    return CriticalLiftAssessment(tuple(triggers), tuple(items))
