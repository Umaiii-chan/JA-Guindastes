"""Caso de uso `EvaluateTandem`: içamento com dois guindastes (RN-016; TASK-074; ADR-037).

A carga se divide entre os dois guindastes pela alavanca dos pontos de içamento em relação ao
centro de gravidade (`split_tandem_load`). Cada guindaste é avaliado pelo `EvaluateOperation`
existente, com o peso que lhe coube (o gancho dele entra pelo próprio caso de uso), e com o fator
0,75 sobre a capacidade efetiva, além do limite do modelo. O tandem só é OK quando os dois são
avaliáveis, nenhum passa do limite do tandem e nenhum tem risco de tombamento alto.

Capacidade e segurança vêm só do cálculo determinístico (tabela, limites, RN-011..015).
"""

from collections.abc import Sequence
from dataclasses import dataclass

from app.application.use_cases.evaluate_operation import (
    EvaluatedOperation,
    EvaluateOperation,
    OperationEvaluation,
)
from app.domain.services.capacity_limit import CapacityLimitLevel
from app.domain.services.safety_assessment import AlertSeverity, SafetyAlert, TippingRisk
from app.domain.services.tandem_load_split import TANDEM_CAPACITY_FACTOR, split_tandem_load
from app.domain.value_objects.mass import Mass
from app.domain.value_objects.operational_state import OperationalState


@dataclass(frozen=True)
class TandemCraneInput:
    """Um guindaste do tandem: configuração, estado e ponto de içamento (plano x, z do mundo)."""

    configuration_id: str
    state: OperationalState
    hook_point: tuple[float, float]


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
    ) -> TandemEvaluation:
        """Avalia o içamento. Levanta `ValueError` com menos ou mais de 2 guindastes, pontos
        iguais ou peso inválido."""
        if len(cranes) != 2:
            raise ValueError("o tandem usa exatamente dois guindastes")
        first, second = cranes
        split = split_tandem_load(load_weight_kg, load_cg, first.hook_point, second.hook_point)
        evaluations = (
            self._evaluate(first, split.shares_kg[0]),
            self._evaluate(second, split.shares_kg[1]),
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
        for index, evaluation in enumerate(evaluations, start=1):
            ok = _assess_crane(index, evaluation, alerts) and ok
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

    def _evaluate(self, crane: TandemCraneInput, share_kg: float) -> OperationEvaluation:
        return self._evaluate_operation.execute(
            configuration_id=crane.configuration_id,
            state=crane.state,
            load_weight=Mass(share_kg),
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
