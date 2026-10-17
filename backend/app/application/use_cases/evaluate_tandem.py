"""Caso de uso `EvaluateTandem`: içamento com dois guindastes (RN-016; TASK-074; ADR-037).

A carga se divide entre os dois guindastes pela alavanca dos pontos de içamento em relação ao
centro de gravidade (`split_tandem_load`). Cada guindaste é avaliado pelo `EvaluateOperation`
existente, com o peso que lhe coube (o gancho dele entra pelo próprio caso de uso), e com o fator
0,75 sobre a capacidade efetiva, além do limite do modelo. O tandem só é OK quando os dois são
avaliáveis, nenhum passa do limite do tandem e nenhum tem risco de tombamento alto.

Desde a TASK-090, cada guindaste também leva o próprio ambiente e os próprios acessórios (patolas,
inclinação, acessórios, solo e obstáculos; RN-014, RN-015), e o vento é comum aos dois. E o gancho
de cada um, calculado pela posição, pelo rumo e pelo estado, tem de estar sobre o ponto de içamento
dele (`tandem_hook_alignment`): fora da tolerância, o tandem não é OK.

Capacidade e segurança vêm só do cálculo determinístico (tabela, limites, RN-011..015).
"""

from collections.abc import Sequence
from dataclasses import dataclass

from app.application.use_cases.evaluate_operation import (
    EvaluatedOperation,
    EvaluateOperation,
    OperationEvaluation,
)
from app.domain.entities.scenario import CranePlacementSpec
from app.domain.services.capacity_limit import CapacityLimitLevel
from app.domain.services.environment_factors import SoilKind
from app.domain.services.safety_assessment import (
    AlertSeverity,
    OutriggerSetting,
    SafetyAlert,
    TippingRisk,
)
from app.domain.services.tandem_hook_alignment import (
    TANDEM_HOOK_POINT_TOLERANCE_M,
    hook_distance_to_point_m,
)
from app.domain.services.tandem_load_split import TANDEM_CAPACITY_FACTOR, split_tandem_load
from app.domain.value_objects.mass import Mass
from app.domain.value_objects.operational_state import OperationalState


@dataclass(frozen=True)
class TandemCraneInput:
    """Um guindaste do tandem: configuração, estado, ponto de içamento (plano x, z do mundo),
    posição do eixo de giro com o rumo do chassi e o ambiente dele.

    `outriggers`, `ground_slope_deg`, `accessory_ids`, `soil_kinds` e `obstacle_conflicts` têm o
    mesmo sentido da avaliação individual (`EvaluateOperation.execute`); os padrões não mudam nada.
    """

    configuration_id: str
    state: OperationalState
    hook_point: tuple[float, float]
    placement: CranePlacementSpec
    outriggers: OutriggerSetting | None = None
    ground_slope_deg: float | None = None
    accessory_ids: tuple[str, ...] = ()
    soil_kinds: tuple[SoilKind, ...] = ()
    obstacle_conflicts: tuple[str, ...] = ()


@dataclass(frozen=True)
class TandemEvaluation:
    """Resultado do tandem: divisão, avaliação de cada guindaste e alertas em pt-BR."""

    shares_kg: tuple[float, float]
    fractions: tuple[float, float]
    evaluations: tuple[OperationEvaluation, OperationEvaluation]
    tandem_ok: bool
    alerts: tuple[SafetyAlert, ...]


class EvaluateTandem:
    def __init__(self, evaluate_operation: EvaluateOperation) -> None:
        self._evaluate_operation = evaluate_operation

    def execute(
        self,
        *,
        load_weight_kg: float,
        load_cg: tuple[float, float],
        cranes: Sequence[TandemCraneInput],
        wind_speed_ms: float | None = None,
    ) -> TandemEvaluation:
        """Avalia o içamento. Levanta `ValueError` com menos ou mais de 2 guindastes, pontos
        iguais ou peso inválido. `wind_speed_ms` vale para os dois guindastes (RN-015)."""
        if len(cranes) != 2:
            raise ValueError("o tandem usa exatamente dois guindastes")
        first, second = cranes
        split = split_tandem_load(load_weight_kg, load_cg, first.hook_point, second.hook_point)
        evaluations = (
            self._evaluate(first, split.shares_kg[0], wind_speed_ms),
            self._evaluate(second, split.shares_kg[1], wind_speed_ms),
        )
        alerts: list[SafetyAlert] = []
        if not split.cg_between_points:
            alerts.append(
                SafetyAlert(
                    "TANDEM_CG_OUTSIDE_POINTS",
                    AlertSeverity.CRITICAL,
                    "O centro de gravidade da carga está fora do trecho entre os dois pontos de "
                    "içamento: um dos guindastes não consegue sustentar a carga.",
                )
            )
        ok = split.cg_between_points
        for index, (crane, evaluation) in enumerate(zip(cranes, evaluations, strict=True), start=1):
            ok = _assess_crane(index, evaluation, alerts) and ok
            ok = _assess_hook_over_point(index, crane, evaluation, alerts) and ok
        if ok:
            alerts.append(
                SafetyAlert(
                    "TANDEM_WITHIN_LIMIT",
                    AlertSeverity.INFO,
                    "Içamento em tandem dentro do limite de "
                    f"{TANDEM_CAPACITY_FACTOR * 100:g} % da capacidade de cada guindaste.",
                )
            )
        return TandemEvaluation(
            shares_kg=split.shares_kg,
            fractions=split.fractions,
            evaluations=evaluations,
            tandem_ok=ok,
            alerts=tuple(alerts),
        )

    def _evaluate(
        self, crane: TandemCraneInput, share_kg: float, wind_speed_ms: float | None
    ) -> OperationEvaluation:
        return self._evaluate_operation.execute(
            configuration_id=crane.configuration_id,
            state=crane.state,
            load_weight=Mass(share_kg),
            outriggers=crane.outriggers,
            ground_slope_deg=crane.ground_slope_deg,
            accessory_ids=crane.accessory_ids,
            soil_kinds=crane.soil_kinds,
            wind_speed_ms=wind_speed_ms,
            obstacle_conflicts=crane.obstacle_conflicts,
            capacity_factor=TANDEM_CAPACITY_FACTOR,
        )


def _assess_crane(index: int, evaluation: OperationEvaluation, alerts: list[SafetyAlert]) -> bool:
    """Acrescenta os alertas do guindaste `index` e diz se ele está OK no tandem."""
    name = f"Guindaste {index}"
    limit_percent = f"{TANDEM_CAPACITY_FACTOR * 100:g} %"
    if not isinstance(evaluation, EvaluatedOperation) or evaluation.capacity_limit is None:
        alerts.append(
            SafetyAlert(
                "TANDEM_NOT_EVALUABLE",
                AlertSeverity.CRITICAL,
                f"{name}: não foi possível avaliar a operação com a parte da carga dele "
                "(posição fora da tabela de carga ou do alcance do guindaste).",
            )
        )
        return False
    limit = evaluation.capacity_limit
    ok = True
    if limit.level is CapacityLimitLevel.OVER:
        alerts.append(
            SafetyAlert(
                "TANDEM_LIMIT_EXCEEDED",
                AlertSeverity.CRITICAL,
                f"{name}: a parte da carga passa de {limit_percent} da capacidade dele "
                f"({limit.limit_utilization_percent:.0f} % do permitido no tandem).",
            )
        )
        ok = False
    elif limit.level is CapacityLimitLevel.WARNING:
        alerts.append(
            SafetyAlert(
                "TANDEM_LIMIT_WARNING",
                AlertSeverity.ATTENTION,
                f"{name}: perto do limite de {limit_percent} da capacidade "
                f"({limit.limit_utilization_percent:.0f} % do permitido no tandem).",
            )
        )
    if evaluation.tipping_risk is TippingRisk.HIGH:
        alerts.append(
            SafetyAlert(
                "TANDEM_TIPPING_RISK_HIGH",
                AlertSeverity.CRITICAL,
                f"{name}: risco de tombamento alto.",
            )
        )
        ok = False
    return ok


def _assess_hook_over_point(
    index: int,
    crane: TandemCraneInput,
    evaluation: OperationEvaluation,
    alerts: list[SafetyAlert],
) -> bool:
    """Acrescenta o alerta do gancho fora do ponto de içamento e diz se o cabo está a prumo.

    Sem geometria (sem ficha técnica ou estado fora das faixas), não há gancho para conferir; o
    guindaste já sai como não avaliável.
    """
    geometry = evaluation.geometry
    if geometry is None:
        return True
    distance_m = hook_distance_to_point_m(crane.placement, geometry.hook, crane.hook_point)
    if distance_m <= TANDEM_HOOK_POINT_TOLERANCE_M:
        return True
    alerts.append(
        SafetyAlert(
            "TANDEM_HOOK_OFF_POINT",
            AlertSeverity.CRITICAL,
            f"Guindaste {index}: o gancho está a {_decimal(distance_m)} m do ponto de içamento "
            f"(tolerância de {_decimal(TANDEM_HOOK_POINT_TOLERANCE_M)} m); o cabo ficaria fora "
            "de prumo.",
        )
    )
    return False


def _decimal(value: float) -> str:
    return f"{value:.2f}".replace(".", ",")
