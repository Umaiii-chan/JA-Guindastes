"""`EvaluateOperation` com acessórios de içamento (TASK-056; RN-014). Dados FICTÍCIOS.

Com a ficha FICTÍCIA (a = 1,5 m), L = 20 m e θ = 30°, o raio fica entre 11,5 m (5000 kg) e 21,5 m
(2000 kg) da tabela FICTÍCIA, e a consulta conservadora dá 2000 kg.
"""

from app.application.use_cases.evaluate_operation import (
    EvaluatedOperation,
    EvaluateOperation,
    NotEvaluableOperation,
    NotEvaluableReason,
    OperationEvaluation,
)
from app.domain.entities.load_chart import LoadChart
from app.domain.services.conservative_tabulated_lookup import ConservativeTabulatedLookup
from app.domain.value_objects.crane_geometry import CraneGeometry
from app.domain.value_objects.mass import Mass
from tests.fixtures.acessorios_ficticios import (
    GANCHO_ACESSORIO_FICTICIO,
    MANILHA_FICTICIA,
    InMemoryAccessories,
)
from tests.fixtures.avaliacao_operacional_ficticia import (
    CONFIGURATION_AVALIACAO_FICTICIA_ID,
    build_load_chart_avaliacao_ficticio,
)
from tests.fixtures.crane_geometry_ficticia import build_crane_geometry_ficticia, state_ficticio


class _Geometry:
    def get_crane_geometry(self, configuration_id: str) -> CraneGeometry | None:
        return build_crane_geometry_ficticia()


class _Charts:
    def get_active_load_chart(
        self, configuration_id: str, rotation_zone_code: str | None = None
    ) -> LoadChart | None:
        return build_load_chart_avaliacao_ficticio()


def use_case(accessories: InMemoryAccessories | None) -> EvaluateOperation:
    return EvaluateOperation(
        crane_geometry_provider=_Geometry(),
        active_load_chart_provider=_Charts(),
        load_chart_interpolator=ConservativeTabulatedLookup(),
        accessory_provider=accessories,
    )


def evaluate(operation: EvaluateOperation, accessory_ids: tuple[str, ...]) -> OperationEvaluation:
    return operation.execute(
        configuration_id=CONFIGURATION_AVALIACAO_FICTICIA_ID,
        state=state_ficticio(boom_length_m=20.0, boom_angle_deg=30.0, cable_length_m=1.0),
        load_weight=Mass(1500.0),
        accessory_ids=accessory_ids,
    )


def test_accessories_weight_enters_the_compared_weight_and_the_utilization() -> None:
    operation = use_case(InMemoryAccessories(GANCHO_ACESSORIO_FICTICIO, MANILHA_FICTICIA))

    result = evaluate(operation, (GANCHO_ACESSORIO_FICTICIO.id, MANILHA_FICTICIA.id))

    assert isinstance(result, EvaluatedOperation)
    assert result.compared_weight == Mass(1720.0)
    assert result.utilization_percent == 1720.0 / 2000.0 * 100
    assert [item.id for item in result.accessories] == [
        GANCHO_ACESSORIO_FICTICIO.id,
        MANILHA_FICTICIA.id,
    ]


def test_without_accessory_ids_the_result_is_the_same_as_before() -> None:
    result = evaluate(use_case(InMemoryAccessories(MANILHA_FICTICIA)), ())

    assert isinstance(result, EvaluatedOperation)
    assert result.compared_weight == Mass(1500.0)
    assert result.accessories == ()


def test_unknown_accessory_id_is_not_evaluable_and_keeps_the_geometry() -> None:
    operation = use_case(InMemoryAccessories(MANILHA_FICTICIA))

    result = evaluate(operation, (MANILHA_FICTICIA.id, "ACC-INEXISTENTE"))

    assert isinstance(result, NotEvaluableOperation)
    assert result.reasons == (NotEvaluableReason.ACCESSORY_NOT_FOUND,)
    assert result.geometry is not None
    assert result.compared_weight == Mass(1520.0)


def test_accessory_ids_without_a_catalog_are_not_evaluable() -> None:
    result = evaluate(use_case(None), (MANILHA_FICTICIA.id,))

    assert isinstance(result, NotEvaluableOperation)
    assert result.reasons == (NotEvaluableReason.ACCESSORY_NOT_FOUND,)
