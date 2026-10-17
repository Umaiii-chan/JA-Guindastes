"""Risco de tombamento e alertas (RN-013 e RN-015, substituídas pela RN-017; ADR-050). Serviço puro.

O risco é **alto** com qualquer um destes:
- utilização acima do limite do modelo (RN-011);
- estabilidade esgotada: o momento de tombamento chega ao estabilizante com a margem da norma
  (`stability.assess_stability`, RN-017), ou as sapatas perdem o apoio;
- patolas não totalmente estendidas e apoiadas com carga suspensa (a tabela exige as patolas
  estendidas: regra de validade da tabela, mantida);
- inclinação residual do terreno acima do máximo do modelo (limite duro, mantido);
- operação fora da tabela com carga;
- rajada de vento acima da velocidade máxima da EN 13000 (`stability.wind_limit_ms`);
- solo que não suporta a pressão da sapata (a reação de CADA sapata por estática do polígono).

É **atenção** com a utilização na faixa de atenção, a estabilidade a 90 % do limite, a rajada a 90 %
da velocidade máxima, o solo a mais de 80 % do suporte e obstáculos no raio de giro. Entradas
ausentes (patolas, inclinação) não entram no risco e geram um alerta INFO de "não informado".

Valores padrão FICTÍCIOS (ADR-012). As mensagens são em pt-BR.
"""

from collections.abc import Sequence
from dataclasses import dataclass
from enum import StrEnum

from app.domain.services.environment_factors import (
    PAD_LABELS,
    SOIL_ATTENTION_RATIO,
    SOIL_BEARING_CAPACITY_KPA,
    SoilKind,
    pad_pressures_kpa,
    wind_blocks,
    wind_near_limit,
)
from app.domain.services.stability import StabilityResult
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
    soil_kinds: Sequence[SoilKind] = (),
    wind_speed_ms: float | None = None,
    obstacle_conflicts: Sequence[str] = (),
    stability: StabilityResult | None = None,
    wind_limit_ms: float | None = None,
) -> SafetyAssessmentResult:
    """Risco e alertas.

    - `level`: faixa do peso comparado (`None` quando não há capacidade para comparar);
    - `outside_chart`: a consulta caiu fora do domínio da tabela;
    - `load_weight_kg > 0` é "carga suspensa";
    - `stability`: a estática da operação (RN-017; `None` sem geometria: sem tombamento por física
      nem solo por reação);
    - `wind_limit_ms`: a velocidade máxima de rajada (EN 13000); `None` = a da tabela do perfil.
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

    _assess_stability(profile=profile, stability=stability, high=high, attention=attention)
    _assess_environment(
        profile=profile,
        stability=stability,
        soil_kinds=soil_kinds,
        wind_speed_ms=wind_speed_ms,
        wind_limit_ms=(
            profile.stability.wind_table_speed_ms if wind_limit_ms is None else wind_limit_ms
        ),
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


def _assess_stability(
    *,
    profile: SafetyProfile,
    stability: StabilityResult | None,
    high: list[SafetyAlert],
    attention: list[SafetyAlert],
) -> None:
    """Estabilidade por momentos (RN-017): `ρ = O / S` do lado crítico do polígono de apoio."""
    if stability is None:
        return
    percent = stability.tipping_ratio * 100
    if stability.tipped:
        high.append(
            SafetyAlert(
                "OUTRIGGERS_LIFT_OFF",
                AlertSeverity.CRITICAL,
                "Sapatas sem apoio: o guindaste tomba nesta operação.",
            )
        )
    elif stability.tipping_ratio >= 1.0:
        high.append(
            SafetyAlert(
                "TIPPING_MARGIN_EXCEEDED",
                AlertSeverity.CRITICAL,
                f"Margem de estabilidade esgotada no lado {stability.critical_edge} "
                f"({percent:.0f} % do limite; a carga passa de "
                f"{profile.stability.tipping_load_limit_ratio * 100:g} % da carga de tombamento).",
            )
        )
    elif stability.tipping_ratio >= profile.stability.attention_ratio:
        attention.append(
            SafetyAlert(
                "STABILITY_NEAR_LIMIT",
                AlertSeverity.ATTENTION,
                f"Estabilidade em {percent:.0f} % do limite no lado {stability.critical_edge}.",
            )
        )


def _assess_environment(
    *,
    profile: SafetyProfile,
    stability: StabilityResult | None,
    soil_kinds: Sequence[SoilKind],
    wind_speed_ms: float | None,
    wind_limit_ms: float,
    obstacle_conflicts: Sequence[str],
    high: list[SafetyAlert],
    attention: list[SafetyAlert],
) -> None:
    """Vento, solo sob as sapatas e obstáculos (RN-017). Entrada ausente não gera alerta."""
    if wind_speed_ms is not None:
        if wind_blocks(wind_speed_ms, wind_limit_ms):
            high.append(
                SafetyAlert(
                    "WIND_ABOVE_LIMIT",
                    AlertSeverity.CRITICAL,
                    f"Rajada de {wind_speed_ms:.1f} m/s acima do limite de {wind_limit_ms:.1f} m/s "
                    "para esta carga (EN 13000).",
                )
            )
        elif wind_near_limit(wind_speed_ms, wind_limit_ms):
            attention.append(
                SafetyAlert(
                    "WIND_NEAR_LIMIT",
                    AlertSeverity.ATTENTION,
                    f"Rajada de {wind_speed_ms:.1f} m/s perto do limite de {wind_limit_ms:.1f} m/s "
                    "para esta carga (EN 13000).",
                )
            )

    if soil_kinds and stability is not None:
        pressures = pad_pressures_kpa(stability.reactions_kg, profile)
        for label, kind, pressure in zip(PAD_LABELS, soil_kinds, pressures, strict=False):
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
