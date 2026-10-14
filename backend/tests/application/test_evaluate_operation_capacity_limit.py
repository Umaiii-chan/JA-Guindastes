"""`EvaluateOperation` com o limite de capacidade do modelo (RN-011; TASK-051). Dados FICTÍCIOS."""

from collections.abc import Mapping

import pytest

from app.application.use_cases.evaluate_operation import (
    EvaluatedOperation,
    EvaluateOperation,
    NotEvaluableOperation,
    OperationEvaluation,
)
from app.domain.services.capacity_limit import CapacityLimitLevel
from app.domain.services.exact_point_lookup import ExactPointLookup
from app.domain.value_objects.crane_limits import CraneLimits
from app.domain.value_objects.mass import Mass
from tests.application.test_evaluate_operation import (
    ON_CHART_POINT,
    ON_CHART_POINT_CAPACITY_KG,
    FakeActiveLoadChartProvider,
    FakeCraneGeometryProvider,
)
from tests.fixtures.avaliacao_operacional_ficticia import (
    CONFIGURATION_AVALIACAO_FICTICIA_ID,
    build_load_chart_avaliacao_ficticio,
)
from tests.fixtures.crane_geometry_ficticia import build_crane_geometry_ficticia, state_ficticio


class FakeCraneLimitsProvider:
    def __init__(self, limits: Mapping[str, CraneLimits]) -> None:
        self._limits = dict(limits)

    def get_crane_limits(self, configuration_id: str) -> CraneLimits | None:
        return self._limits.get(configuration_id)


def build_use_case(limits: CraneLimits | None) -> EvaluateOperation:
    provider = (
        None
        if limits is None
        else FakeCraneLimitsProvider({CONFIGURATION_AVALIACAO_FICTICIA_ID: limits})
    )
    return EvaluateOperation(
        crane_geometry_provider=FakeCraneGeometryProvider(
            {CONFIGURATION_AVALIACAO_FICTICIA_ID: build_crane_geometry_ficticia()}
        ),
        active_load_chart_provider=FakeActiveLoadChartProvider(
            {CONFIGURATION_AVALIACAO_FICTICIA_ID: build_load_chart_avaliacao_ficticio()}
        ),
        load_chart_interpolator=ExactPointLookup(),
        crane_limits_provider=provider,
    )


def evaluate(use_case: EvaluateOperation, load_kg: float, **state: float) -> OperationEvaluation:
    return use_case.execute(
        configuration_id=CONFIGURATION_AVALIACAO_FICTICIA_ID,
        state=state_ficticio(**(ON_CHART_POINT | state)),
        load_weight=Mass(load_kg),
    )


@pytest.mark.parametrize(
    ("load_kg", "level"),
    [
        (3_000.0, CapacityLimitLevel.OK),
        (3_200.0, CapacityLimitLevel.WARNING),
        (3_400.0, CapacityLimitLevel.WARNING),
        (3_500.0, CapacityLimitLevel.OVER),
    ],
)
def test_limit_of_85_percent_applies_to_the_table_capacity(
    load_kg: float, level: CapacityLimitLevel
) -> None:
    result = evaluate(build_use_case(CraneLimits(capacity_limit_percent=85.0)), load_kg)

    assert isinstance(result, EvaluatedOperation)
    assert result.capacity_limit is not None
    assert result.capacity_limit.effective_capacity_kg == pytest.approx(
        ON_CHART_POINT_CAPACITY_KG * 0.85
    )
    assert result.capacity_limit.limit_utilization_percent == pytest.approx(
        load_kg / (ON_CHART_POINT_CAPACITY_KG * 0.85) * 100
    )
    assert result.capacity_limit.level is level
    # A utilização contra a tabela continua a mesma.
    assert result.utilization_percent == pytest.approx(load_kg / ON_CHART_POINT_CAPACITY_KG * 100)


def test_without_a_provider_the_default_limit_applies() -> None:
    result = evaluate(build_use_case(None), 3_000.0)

    assert isinstance(result, EvaluatedOperation)
    assert result.capacity_limit is not None
    assert result.capacity_limit.limit_percent == 100.0
    assert result.capacity_limit.effective_capacity_kg == ON_CHART_POINT_CAPACITY_KG
    assert result.capacity_limit.level is CapacityLimitLevel.OK


def test_above_the_table_capacity_is_over_with_the_default_limit() -> None:
    result = evaluate(build_use_case(CraneLimits()), ON_CHART_POINT_CAPACITY_KG + 1.0)

    assert isinstance(result, EvaluatedOperation)
    assert result.capacity_limit is not None
    assert result.capacity_limit.level is CapacityLimitLevel.OVER


def test_an_unknown_configuration_in_the_provider_uses_the_default_limit() -> None:
    use_case = EvaluateOperation(
        crane_geometry_provider=FakeCraneGeometryProvider(
            {CONFIGURATION_AVALIACAO_FICTICIA_ID: build_crane_geometry_ficticia()}
        ),
        active_load_chart_provider=FakeActiveLoadChartProvider(
            {CONFIGURATION_AVALIACAO_FICTICIA_ID: build_load_chart_avaliacao_ficticio()}
        ),
        load_chart_interpolator=ExactPointLookup(),
        crane_limits_provider=FakeCraneLimitsProvider({}),
    )

    result = evaluate(use_case, 3_000.0)

    assert isinstance(result, EvaluatedOperation)
    assert result.capacity_limit is not None
    assert result.capacity_limit.limit_percent == 100.0


def test_a_not_evaluable_operation_has_no_capacity_limit() -> None:
    result = evaluate(build_use_case(CraneLimits()), 1_000.0, boom_length_m=500.0)

    assert isinstance(result, NotEvaluableOperation)
    assert not hasattr(result, "capacity_limit")
