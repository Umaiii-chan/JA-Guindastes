"""Porta `LoadChartInterpolator` e estratégia `ExactPointLookup` (doc-fonte § 14.4).

`ExactPointLookup` só devolve capacidade para combinações que existem exatamente na tabela. Toda
outra consulta é "não suportada": interpolação, arredondamento e valor conservador estão pendentes
(PEND-001, PEND-002, PEND-003), e consulta fora da tabela deve ser identificada (RN-007).
Todos os números vêm da tabela FICTÍCIA de `tests/fixtures/load_chart_ficticio.py`.
"""

import pytest

from app.domain.services.exact_point_lookup import ExactPointLookup
from app.domain.services.load_chart_interpolator import LoadChartInterpolator
from app.domain.value_objects.capacity_query import CapacityQuery
from app.domain.value_objects.capacity_result import (
    CapacityFound,
    CapacityResult,
    CapacityUnsupported,
    CapacityUnsupportedReason,
)
from app.domain.value_objects.length import Length
from app.domain.value_objects.mass import Mass
from tests.fixtures.load_chart_ficticio import (
    LOAD_CHART_FICTICIO_ID,
    LOAD_CHART_FICTICIO_VERSION,
    POINTS_FICTICIOS,
    build_load_chart_ficticio,
)


def lookup_ficticio(boom_length_m: float, working_radius_m: float) -> CapacityResult:
    interpolator: LoadChartInterpolator = ExactPointLookup()
    query = CapacityQuery(
        boom_length=Length(boom_length_m), working_radius=Length(working_radius_m)
    )
    return interpolator.calculate_capacity(build_load_chart_ficticio(), query)


@pytest.mark.parametrize(("boom_length_m", "working_radius_m", "capacity_kg"), POINTS_FICTICIOS)
def test_ficticio_chart_exact_point_returns_its_capacity(
    boom_length_m: float, working_radius_m: float, capacity_kg: float
) -> None:
    result = lookup_ficticio(boom_length_m, working_radius_m)

    assert isinstance(result, CapacityFound)
    assert result.max_capacity == Mass(capacity_kg)


@pytest.mark.parametrize(
    ("boom_length_m", "working_radius_m"),
    [
        pytest.param(10.0, 4.0, id="raio-entre-pontos"),
        pytest.param(15.0, 5.0, id="lanca-entre-colunas"),
        pytest.param(10.0, 2.0, id="raio-abaixo-do-menor"),
        pytest.param(10.0, 9.0, id="raio-acima-do-maior"),
        pytest.param(30.0, 5.0, id="lanca-acima-da-maior"),
        pytest.param(10.0, 15.0, id="raio-de-outra-lanca"),
    ],
)
def test_ficticio_chart_query_off_exact_points_is_unsupported_because_interpolation_is_pending(
    boom_length_m: float, working_radius_m: float
) -> None:
    # RN-007: fora da tabela, resultado explícito; PEND-001..003: sem interpolação nem vizinho.
    result = lookup_ficticio(boom_length_m, working_radius_m)

    assert isinstance(result, CapacityUnsupported)
    assert result.reason is CapacityUnsupportedReason.POINT_NOT_IN_CHART


def test_ficticio_chart_near_point_is_unsupported_because_rounding_is_pending() -> None:
    # PEND-002: sem política de arredondamento, 5.000001 m não é o ponto de 5.0 m.
    result = lookup_ficticio(10.0, 5.000001)

    assert isinstance(result, CapacityUnsupported)


def test_unsupported_result_has_no_capacity_to_read() -> None:
    result = lookup_ficticio(10.0, 4.0)

    assert not hasattr(result, "max_capacity")


def test_ficticio_chart_without_points_is_unsupported() -> None:
    query = CapacityQuery(boom_length=Length(10.0), working_radius=Length(5.0))

    result = ExactPointLookup().calculate_capacity(build_load_chart_ficticio(points=()), query)

    assert isinstance(result, CapacityUnsupported)


@pytest.mark.parametrize(
    ("boom_length_m", "working_radius_m"),
    [pytest.param(10.0, 5.0, id="suportado"), pytest.param(10.0, 4.0, id="nao-suportado")],
)
def test_ficticio_chart_result_carries_chart_id_and_version(
    boom_length_m: float, working_radius_m: float
) -> None:
    # RN-005: cada cálculo registra a versão da tabela usada.
    result = lookup_ficticio(boom_length_m, working_radius_m)

    assert result.load_chart_id == LOAD_CHART_FICTICIO_ID
    assert result.load_chart_version == LOAD_CHART_FICTICIO_VERSION
