"""Risco de tombamento e alertas por regras (RN-013; ADR-025). Serviço puro, sem E/S.

Não há cálculo físico de estabilidade. O risco é **alto** com qualquer um destes:
- utilização acima do limite do modelo (RN-011);
- patolas não totalmente estendidas e apoiadas com carga suspensa;
- inclinação residual do terreno acima do máximo do modelo;
- operação fora da tabela com carga.

É **atenção** com a utilização na faixa de atenção. Entradas ausentes (patolas, inclinação) não
entram no risco e geram um alerta INFO de "não informado".

Valores padrão FICTÍCIOS (ADR-012). As mensagens são em pt-BR.
"""

from dataclasses import dataclass
from enum import StrEnum

from app.domain.value_objects.safety_profile import SafetyProfile


class TippingRisk(StrEnum):
    LOW = "LOW"
    ATTENTION = "ATTENTION"
    HIGH = "HIGH"


class AlertSeverity(StrEnum):
    INFO = "INFO"
    ATTENTION = "ATTENTION"
    CRITICAL = "CRITICAL"


class LimitLevel(StrEnum):
    """Faixa do peso comparado em relação ao limite do modelo (RN-011)."""

    OK = "OK"
    WARNING = "WARNING"
    OVER = "OVER"


@dataclass(frozen=True)
class OutriggerSetting:
    """Patolas informadas pelo cliente (contrato § 3 da leva E)."""

    extension_percent: float
    jacks_set: bool

    @property
    def ready(self) -> bool:
        return self.extension_percent >= 100 and self.jacks_set


@dataclass(frozen=True)
class SafetyAlert:
    code: str
    severity: AlertSeverity
    message: str


@dataclass(frozen=True)
class SafetyAssessmentResult:
    tipping_risk: TippingRisk | None
    alerts: tuple[SafetyAlert, ...]


def limit_level(compared_kg: float, capacity_kg: float, profile: SafetyProfile) -> LimitLevel:
    """Faixa do peso comparado em relação à capacidade efetiva (capacidade × limite; RN-011).

    Capacidade zero: qualquer peso positivo é `OVER`; peso zero é `OK`.
    """
    effective_kg = capacity_kg * profile.capacity_limit_percent / 100
    if effective_kg <= 0:
        return LimitLevel.OVER if compared_kg > 0 else LimitLevel.OK
    usage_percent = compared_kg / effective_kg * 100
    if usage_percent > 100:
        return LimitLevel.OVER
    if usage_percent >= profile.warning_band_percent:
        return LimitLevel.WARNING
    return LimitLevel.OK


def assess_safety(
    *,
    profile: SafetyProfile,
    load_weight_kg: float,
    level: LimitLevel | None,
    outside_chart: bool,
    outriggers: OutriggerSetting | None,
    ground_slope_deg: float | None,
) -> SafetyAssessmentResult:
    """Risco e alertas.

    - `level`: faixa do peso comparado (`None` quando não há capacidade para comparar);
    - `outside_chart`: a consulta caiu fora do domínio da tabela;
    - `load_weight_kg > 0` é "carga suspensa".
    """
    high: list[SafetyAlert] = []
    attention: list[SafetyAlert] = []
    info: list[SafetyAlert] = []
    loaded = load_weight_kg > 0

    if level is LimitLevel.OVER:
        high.append(
            SafetyAlert(
                "CAPACITY_LIMIT_EXCEEDED",
                AlertSeverity.CRITICAL,
                "Carga acima do limite de capacidade do modelo.",
            )
        )
    elif level is LimitLevel.WARNING:
        attention.append(
            SafetyAlert(
                "CAPACITY_LIMIT_WARNING",
                AlertSeverity.ATTENTION,
                f"Utilização na faixa de atenção (a partir de {profile.warning_band_percent:g} % "
                "do limite).",
            )
        )
    if outside_chart and loaded:
        high.append(
            SafetyAlert(
                "OUTSIDE_LOAD_CHART",
                AlertSeverity.CRITICAL,
                "Operação fora da tabela de carga com carga suspensa.",
            )
        )

    if outriggers is None:
        info.append(
            SafetyAlert(
                "OUTRIGGERS_NOT_INFORMED",
                AlertSeverity.INFO,
                "Estado das patolas não informado: não entrou na avaliação do risco.",
            )
        )
    elif loaded and not outriggers.ready:
        support = "apoiadas" if outriggers.jacks_set else "sem apoio"
        high.append(
            SafetyAlert(
                "OUTRIGGERS_NOT_READY",
                AlertSeverity.CRITICAL,
                f"Patolas a {outriggers.extension_percent:g} % e {support}: a tabela exige "
                "patolas totalmente estendidas e apoiadas.",
            )
        )

    if ground_slope_deg is None:
        info.append(
            SafetyAlert(
                "GROUND_SLOPE_NOT_INFORMED",
                AlertSeverity.INFO,
                "Inclinação do terreno não informada: não entrou na avaliação do risco.",
            )
        )
    elif ground_slope_deg > profile.max_ground_slope_deg:
        high.append(
            SafetyAlert(
                "GROUND_SLOPE_EXCEEDED",
                AlertSeverity.CRITICAL,
                f"Inclinação residual de {ground_slope_deg:.1f}° acima do máximo do modelo "
                f"({profile.max_ground_slope_deg:.1f}°).",
            )
        )

    alerts = (*high, *attention, *info)
    if high:
        risk: TippingRisk | None = TippingRisk.HIGH
    elif level is None:
        risk = None
    elif attention:
        risk = TippingRisk.ATTENTION
    else:
        risk = TippingRisk.LOW
    return SafetyAssessmentResult(tipping_risk=risk, alerts=alerts)
