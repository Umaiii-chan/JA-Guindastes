"""Risco de tombamento e alertas por regras (RN-013; ADR-025). Serviço puro, sem E/S.

Não há cálculo físico de estabilidade. O risco é **alto** com qualquer um destes:
- utilização acima do limite do modelo (RN-011);
- patolas não totalmente estendidas e apoiadas com carga suspensa;
- inclinação residual do terreno acima do máximo do modelo;
- operação fora da tabela com carga.

É **atenção** com a utilização na faixa de atenção. Entradas ausentes (patolas, inclinação) não
entram no risco e geram um alerta INFO de "não informado".

Fatores do ambiente (RN-015; TASK-067): inclinação acima do máximo, vento acima de 13,8 m/s e solo
que não suporta a pressão da sapata dão risco alto; vento entre 9,8 e 13,8 m/s, solo a mais de 80 %
do suporte e obstáculos no raio de giro dão atenção. Entradas ausentes não geram alerta.

Valores padrão FICTÍCIOS (ADR-012). As mensagens são em pt-BR.
"""

from collections.abc import Sequence
from dataclasses import dataclass
from enum import StrEnum

from app.domain.services.environment_factors import (
    PAD_LABELS,
    SOIL_ATTENTION_RATIO,
    SOIL_BEARING_CAPACITY_KPA,
    WIND_FREE_LIMIT_MS,
    SoilKind,
    pad_pressure_kpa,
    wind_blocks,
)
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


def limit_level(
    compared_kg: float, capacity_kg: float, profile: SafetyProfile, factor: float = 1.0
) -> LimitLevel:
    """Faixa do peso comparado em relação à capacidade efetiva (capacidade × limite × `factor`;
    RN-011, RN-015), com `factor` o produto dos fatores de inclinação e de vento.

    Capacidade zero: qualquer peso positivo é `OVER`; peso zero é `OK`.
    """
    effective_kg = capacity_kg * profile.capacity_limit_percent / 100 * factor
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
    compared_weight_kg: float = 0.0,
    soil_kinds: Sequence[SoilKind] = (),
    wind_speed_ms: float | None = None,
    obstacle_conflicts: Sequence[str] = (),
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
                "Terreno inclinado demais para operar: inclinação residual de "
                f"{ground_slope_deg:.1f}° acima do máximo do modelo "
                f"({profile.max_ground_slope_deg:.1f}°).",
            )
        )

    _assess_environment(
        profile=profile,
        compared_weight_kg=compared_weight_kg,
        soil_kinds=soil_kinds,
        wind_speed_ms=wind_speed_ms,
        obstacle_conflicts=obstacle_conflicts,
        high=high,
        attention=attention,
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


def _assess_environment(
    *,
    profile: SafetyProfile,
    compared_weight_kg: float,
    soil_kinds: Sequence[SoilKind],
    wind_speed_ms: float | None,
    obstacle_conflicts: Sequence[str],
    high: list[SafetyAlert],
    attention: list[SafetyAlert],
) -> None:
    """Vento, solo sob as sapatas e obstáculos (RN-015). Entrada ausente não gera alerta."""
    if wind_speed_ms is not None:
        if wind_blocks(wind_speed_ms):
            high.append(
                SafetyAlert(
                    "WIND_ABOVE_LIMIT",
                    AlertSeverity.CRITICAL,
                    "Vento acima do limite de operação.",
                )
            )
        elif wind_speed_ms > WIND_FREE_LIMIT_MS:
            attention.append(
                SafetyAlert(
                    "WIND_REDUCES_CAPACITY",
                    AlertSeverity.ATTENTION,
                    f"Vento de {wind_speed_ms:.1f} m/s reduz a capacidade de içamento.",
                )
            )

    if soil_kinds:
        pressure = pad_pressure_kpa(compared_weight_kg, profile)
        for label, kind in zip(PAD_LABELS, soil_kinds, strict=False):
            ratio = pressure / SOIL_BEARING_CAPACITY_KPA[kind]
            if ratio > 1:
                high.append(
                    SafetyAlert(
                        "SOIL_BEARING_EXCEEDED",
                        AlertSeverity.CRITICAL,
                        f"Solo não suporta a pressão da sapata {label} ({pressure:.0f} kPa).",
                    )
                )
            elif ratio > SOIL_ATTENTION_RATIO:
                attention.append(
                    SafetyAlert(
                        "SOIL_BEARING_NEAR_LIMIT",
                        AlertSeverity.ATTENTION,
                        f"Solo perto do limite sob a sapata {label} ({pressure:.0f} kPa).",
                    )
                )

    if obstacle_conflicts:
        attention.append(
            SafetyAlert(
                "OBSTACLE_IN_SWING_RADIUS",
                AlertSeverity.ATTENTION,
                f"Obstáculo no raio de giro: {', '.join(obstacle_conflicts)}",
            )
        )
