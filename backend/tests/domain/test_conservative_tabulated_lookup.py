"""Estratégia `ConservativeTabulatedLookup`: consulta conservadora provisória (ADR-015).

Regras do ADR-015: ε = 1·10⁻⁶ m só para ruído de ponto flutuante; o comprimento de lança precisa
coincidir (±ε) com um comprimento tabelado; raio igual (±ε) usa o ponto; raio entre dois raios
tabelados usa a menor capacidade dos dois vizinhos; abaixo do menor ou acima do maior raio, "fora do
domínio" (RN-007). Todos os números vêm das tabelas FICTÍCIAS de
`tests/fixtures/consulta_conservadora_ficticia.py` ou são FICTÍCIOS montados no próprio teste.
"""

import pytest

from app.domain.entities.load_chart import LoadChart
from app.domain.entities.load_chart_point import LoadChartPoint
from app.domain.services.conservative_tabulated_lookup import (
    NUMERIC_TOLERANCE_M,
    ConservativeTabulatedLookup,
)
from app.domain.services.exact_point_lookup import ExactPointLookup
from app.domain.services.load_chart_interpolator import LoadChartInterpolator
from app.domain.value_objects.capacity_query import CapacityQuery
from app.domain.value_objects.capacity_result import (
    CapacityFound,
    CapacityResult,
    CapacityUnsupported,
    CapacityUnsupportedReason,
)
from app.domain.value_objects.conservative_capacity_result import (
    CapacityLookupStrategy,
    ConservativeCapacityFound,
)
from app.domain.value_objects.length import Length
from app.domain.value_objects.mass import Mass
from tests.fixtures.consulta_conservadora_ficticia import (
    LOAD_CHART_CONSERVADOR_FICTICIO_ID,
    LOAD_CHART_CONSERVADOR_FICTICIO_VERSION,
    POINTS_ATIPICOS_FICTICIOS,
    POINTS_TIPICOS_FICTICIOS,
    build_load_chart_conservador_ficticio,
)
from tests.fixtures.load_chart_ficticio import point_ficticio

# ADR-015: ε = 1·10⁻⁶ m. Ruído bem dentro de ε (0,5 µm) e diferença bem além dele (2 µm), escritos
# por extenso para que os testes falhem se ε mudar. Comparar exatamente em ±ε depende de como o
# ponto flutuante arredonda a soma (ex.: 11,5 + 1e-6 − 11,5 ≈ 9,99999999e-7), então os testes não
# usam a borda exata.
ADR_015_TOLERANCE_M = 1e-6
NOISE_M = 5e-7
BEYOND_TOLERANCE_M = 2e-6

# Raio calculado pela geometria FICTÍCIA da TASK-015 para L = 20 m e θ = 60°: 1,5 + 20·cos 60° dá
# 11,5 m na conta à mão e 11.500000000000002 m em ponto flutuante.
RADIUS_11_5_WITH_FLOAT_NOISE_M = 11.500000000000002


def query_ficticia(boom_length_m: float, working_radius_m: float) -> CapacityQuery:
    return CapacityQuery(boom_length=Length(boom_length_m), working_radius=Length(working_radius_m))


def lookup_ficticio(
    boom_length_m: float, working_radius_m: float, chart: LoadChart | None = None
) -> CapacityResult:
    interpolator: LoadChartInterpolator = ConservativeTabulatedLookup()
    if chart is None:
        chart = build_load_chart_conservador_ficticio()
    return interpolator.calculate_capacity(chart, query_ficticia(boom_length_m, working_radius_m))


def assert_found(result: CapacityResult) -> ConservativeCapacityFound:
    # Continua sendo um `CapacityFound`: cumpre a porta e cabe no `CapacityResult`.
    assert isinstance(result, CapacityFound)
    assert isinstance(result, ConservativeCapacityFound)
    return result


def assert_unsupported(result: CapacityResult) -> CapacityUnsupported:
    assert isinstance(result, CapacityUnsupported)
    assert not hasattr(result, "max_capacity")
    return result


def test_numeric_tolerance_is_the_adr_015_value() -> None:
    assert NUMERIC_TOLERANCE_M == ADR_015_TOLERANCE_M


# --- raio igual a um raio tabelado (CA-1) -------------------------------------------------------


@pytest.mark.parametrize(
    ("boom_length_m", "working_radius_m", "capacity_kg"), POINTS_TIPICOS_FICTICIOS
)
def test_ficticio_exact_point_returns_its_capacity_and_the_used_point(
    boom_length_m: float, working_radius_m: float, capacity_kg: float
) -> None:
    result = assert_found(lookup_ficticio(boom_length_m, working_radius_m))

    assert result.max_capacity == Mass(capacity_kg)
    assert result.used_point == point_ficticio(boom_length_m, working_radius_m, capacity_kg)
    assert result.queried_radius == Length(working_radius_m)
    assert result.query == query_ficticia(boom_length_m, working_radius_m)


# --- ruído de ponto flutuante até ε (CA-2) ------------------------------------------------------


@pytest.mark.parametrize(
    ("working_radius_m", "used_point"),
    [
        pytest.param(RADIUS_11_5_WITH_FLOAT_NOISE_M, (20.0, 11.5, 4500.0), id="raio-calculado"),
        pytest.param(11.5 + NOISE_M, (20.0, 11.5, 4500.0), id="acima-dentro-de-eps"),
        pytest.param(11.5 - NOISE_M, (20.0, 11.5, 4500.0), id="abaixo-dentro-de-eps"),
        pytest.param(5.0 - NOISE_M, (20.0, 5.0, 8000.0), id="menor-raio-menos-ruido"),
        pytest.param(15.0 + NOISE_M, (20.0, 15.0, 3000.0), id="maior-raio-mais-ruido"),
    ],
)
def test_ficticio_radius_with_float_noise_uses_the_tabulated_point(
    working_radius_m: float, used_point: tuple[float, float, float]
) -> None:
    result = assert_found(lookup_ficticio(20.0, working_radius_m))

    assert result.used_point == point_ficticio(*used_point)
    assert result.max_capacity == Mass(used_point[2])
    # O raio consultado é informado como veio; só o ponto usado é o tabelado.
    assert result.queried_radius == Length(working_radius_m)


def test_ficticio_calculated_radius_not_found_by_exact_lookup_is_found_by_conservative_lookup() -> (
    None
):
    # As duas estratégias convivem; a busca exata continua sem tolerância (TASK-008, TASK-015).
    chart = build_load_chart_conservador_ficticio()
    query = query_ficticia(20.0, RADIUS_11_5_WITH_FLOAT_NOISE_M)

    exact = ExactPointLookup().calculate_capacity(chart, query)
    conservative = ConservativeTabulatedLookup().calculate_capacity(chart, query)

    assert isinstance(exact, CapacityUnsupported)
    assert exact.reason is CapacityUnsupportedReason.POINT_NOT_IN_CHART
    assert assert_found(conservative).used_point == point_ficticio(20.0, 11.5, 4500.0)


@pytest.mark.parametrize(
    ("working_radius_m", "used_point"),
    [
        # 11,5 m + 2 µm fica entre 11,5 m (4500 kg) e 15 m (3000 kg): vale o menor, 3000 kg.
        pytest.param(11.5 + BEYOND_TOLERANCE_M, (20.0, 15.0, 3000.0), id="acima-alem-de-eps"),
        # 11,5 m − 2 µm fica entre 8 m (6000 kg) e 11,5 m (4500 kg): vale o menor, 4500 kg.
        pytest.param(11.5 - BEYOND_TOLERANCE_M, (20.0, 11.5, 4500.0), id="abaixo-alem-de-eps"),
    ],
)
def test_ficticio_radius_beyond_tolerance_is_a_different_radius(
    working_radius_m: float, used_point: tuple[float, float, float]
) -> None:
    # ADR-015: ε não é tolerância de engenharia; além dele, o raio é outro (aqui, entre pontos).
    result = assert_found(lookup_ficticio(20.0, working_radius_m))

    assert result.used_point == point_ficticio(*used_point)


# --- raio entre dois raios tabelados: menor capacidade dos vizinhos (CA-3) ----------------------


@pytest.mark.parametrize(
    ("boom_length_m", "working_radius_m", "used_point"),
    [
        pytest.param(20.0, 6.5, (20.0, 8.0, 6000.0), id="entre-5-e-8"),
        pytest.param(20.0, 10.0, (20.0, 11.5, 4500.0), id="entre-8-e-11_5"),
        pytest.param(20.0, 14.99, (20.0, 15.0, 3000.0), id="perto-do-maior"),
        pytest.param(20.0, 5.01, (20.0, 8.0, 6000.0), id="perto-do-menor"),
        pytest.param(30.0, 16.0, (30.0, 20.0, 2000.0), id="outro-comprimento"),
    ],
)
def test_ficticio_typical_chart_radius_between_points_uses_the_next_larger_radius(
    boom_length_m: float, working_radius_m: float, used_point: tuple[float, float, float]
) -> None:
    # Tabela típica: a menor capacidade dos vizinhos é a do próximo raio maior (ADR-015, item 3).
    result = assert_found(lookup_ficticio(boom_length_m, working_radius_m))

    assert result.used_point == point_ficticio(*used_point)
    assert result.max_capacity == Mass(used_point[2])
    assert result.queried_radius == Length(working_radius_m)


def test_ficticio_atypical_chart_radius_between_points_uses_the_lower_capacity_neighbor() -> None:
    # Tabela atípica: 10 m fica entre 8 m (5000 kg) e 11,5 m (6500 kg). O vizinho de raio maior tem
    # capacidade maior, e vale o menor valor, 5000 kg, do vizinho de raio menor (lado seguro).
    chart = build_load_chart_conservador_ficticio(POINTS_ATIPICOS_FICTICIOS)

    result = assert_found(lookup_ficticio(20.0, 10.0, chart))

    assert result.used_point == point_ficticio(20.0, 8.0, 5000.0)
    assert result.max_capacity == Mass(5000.0)


def test_ficticio_atypical_chart_elsewhere_still_uses_the_lower_capacity_neighbor() -> None:
    # Na mesma tabela atípica, 12 m fica entre 11,5 m (6500 kg) e 15 m (3000 kg): vale 3000 kg.
    chart = build_load_chart_conservador_ficticio(POINTS_ATIPICOS_FICTICIOS)

    result = assert_found(lookup_ficticio(20.0, 12.0, chart))

    assert result.used_point == point_ficticio(20.0, 15.0, 3000.0)


def test_ficticio_neighbors_with_the_same_capacity_report_the_larger_radius_point() -> None:
    chart = build_load_chart_conservador_ficticio(((20.0, 5.0, 4000.0), (20.0, 8.0, 4000.0)))

    result = assert_found(lookup_ficticio(20.0, 6.0, chart))

    assert result.used_point == point_ficticio(20.0, 8.0, 4000.0)


# --- raio fora da faixa tabelada do comprimento (CA-4) ------------------------------------------


@pytest.mark.parametrize(
    ("boom_length_m", "working_radius_m", "reason"),
    [
        pytest.param(
            20.0, 4.0, CapacityUnsupportedReason.RADIUS_BELOW_CHART_MIN, id="abaixo-do-menor"
        ),
        pytest.param(
            20.0,
            5.0 - BEYOND_TOLERANCE_M,
            CapacityUnsupportedReason.RADIUS_BELOW_CHART_MIN,
            id="abaixo-do-menor-alem-de-eps",
        ),
        pytest.param(20.0, 0.0, CapacityUnsupportedReason.RADIUS_BELOW_CHART_MIN, id="raio-zero"),
        pytest.param(
            30.0,
            7.9,
            CapacityUnsupportedReason.RADIUS_BELOW_CHART_MIN,
            id="abaixo-do-menor-deste-comprimento",  # 20 m tem 5 m, mas 30 m começa em 8 m
        ),
        pytest.param(
            20.0, 16.0, CapacityUnsupportedReason.RADIUS_ABOVE_CHART_MAX, id="acima-do-maior"
        ),
        pytest.param(
            20.0,
            15.0 + BEYOND_TOLERANCE_M,
            CapacityUnsupportedReason.RADIUS_ABOVE_CHART_MAX,
            id="acima-do-maior-alem-de-eps",
        ),
        pytest.param(
            20.0,
            18.0,
            CapacityUnsupportedReason.RADIUS_ABOVE_CHART_MAX,
            id="acima-do-maior-deste-comprimento",  # 30 m vai até 20 m, mas 20 m só até 15 m
        ),
    ],
)
def test_ficticio_radius_outside_the_chart_range_is_unsupported_with_its_reason(
    boom_length_m: float, working_radius_m: float, reason: CapacityUnsupportedReason
) -> None:
    # RN-007: fora do domínio, resultado explícito com motivo; nada é extrapolado.
    result = assert_unsupported(lookup_ficticio(boom_length_m, working_radius_m))

    assert result.reason is reason


# --- comprimento de lança (CA-5) ----------------------------------------------------------------


@pytest.mark.parametrize(
    ("boom_length_m", "expected_point"),
    [
        # 25 m usa a coluna de 30 m; 10 m fica entre 8 m (5000 kg) e 12 m (3500 kg).
        pytest.param(25.0, point_ficticio(30.0, 12.0, 3500.0), id="entre-colunas"),
        # 10 m usa a coluna de 20 m; 10 m fica entre 8 m (6000 kg) e 11,5 m (4500 kg).
        pytest.param(10.0, point_ficticio(20.0, 11.5, 4500.0), id="abaixo-da-menor-coluna"),
        pytest.param(
            20.0 + BEYOND_TOLERANCE_M, point_ficticio(30.0, 12.0, 3500.0), id="alem-de-eps"
        ),
    ],
)
def test_ficticio_boom_length_between_columns_uses_the_next_longer_column(
    boom_length_m: float, expected_point: LoadChartPoint
) -> None:
    # ADR-029: nota padrão das tabelas de fabricante; o comprimento não é interpolado.
    result = assert_found(lookup_ficticio(boom_length_m, 10.0))

    assert result.used_point == expected_point
    assert result.query.boom_length == Length(boom_length_m)


def test_ficticio_boom_length_above_the_longest_column_is_unsupported() -> None:
    result = assert_unsupported(lookup_ficticio(40.0, 10.0))

    assert result.reason is CapacityUnsupportedReason.BOOM_LENGTH_ABOVE_CHART_MAX


@pytest.mark.parametrize(
    "boom_length_m",
    [pytest.param(20.0 + NOISE_M, id="mais-ruido"), pytest.param(20.0 - NOISE_M, id="menos-ruido")],
)
def test_ficticio_boom_length_with_float_noise_uses_the_tabulated_column(
    boom_length_m: float,
) -> None:
    # 10 m fica entre 8 m (6000 kg) e 11,5 m (4500 kg) da coluna de 20 m.
    result = assert_found(lookup_ficticio(boom_length_m, 10.0))

    assert result.used_point == point_ficticio(20.0, 11.5, 4500.0)
    assert result.query.boom_length == Length(boom_length_m)


def test_ficticio_chart_without_points_is_unsupported() -> None:
    result = assert_unsupported(
        lookup_ficticio(20.0, 10.0, build_load_chart_conservador_ficticio(()))
    )

    assert result.reason is CapacityUnsupportedReason.BOOM_LENGTH_NOT_IN_CHART


# --- id e versão da tabela, marca de estratégia e capacidade da tabela (CA-6) -------------------


@pytest.mark.parametrize(
    ("boom_length_m", "working_radius_m"),
    [
        pytest.param(20.0, 8.0, id="ponto-exato"),
        pytest.param(20.0, 10.0, id="entre-pontos"),
        pytest.param(20.0, 4.0, id="raio-abaixo"),
        pytest.param(20.0, 16.0, id="raio-acima"),
        pytest.param(25.0, 10.0, id="comprimento-nao-tabelado"),
    ],
)
@pytest.mark.parametrize("version", [LOAD_CHART_CONSERVADOR_FICTICIO_VERSION, "FICTICIO-v2"])
def test_ficticio_every_result_carries_the_chart_id_and_version(
    boom_length_m: float, working_radius_m: float, version: str
) -> None:
    # RN-005: cada cálculo registra a versão da tabela usada, com ou sem capacidade.
    chart = build_load_chart_conservador_ficticio(version=version)

    result = lookup_ficticio(boom_length_m, working_radius_m, chart)

    assert result.load_chart_id == LOAD_CHART_CONSERVADOR_FICTICIO_ID
    assert result.load_chart_version == version


@pytest.mark.parametrize(
    "working_radius_m", [pytest.param(8.0, id="ponto-exato"), pytest.param(10.0, id="entre-pontos")]
)
def test_ficticio_found_result_is_marked_as_provisional_conservative(
    working_radius_m: float,
) -> None:
    # ADR-015, item 4: nenhuma tela deve apresentar o valor como definitivo.
    result = assert_found(lookup_ficticio(20.0, working_radius_m))

    assert result.strategy is CapacityLookupStrategy.CONSERVATIVE_PROVISIONAL
    assert result.strategy.value == "CONSERVATIVE_PROVISIONAL"


@pytest.mark.parametrize("boom_length_m", [20.0, 30.0])
def test_ficticio_capacity_always_comes_from_a_point_of_the_chart(boom_length_m: float) -> None:
    # RN-004: varre raios de 0 a 22 m (passo 0,1 m) e confere cada capacidade devolvida.
    chart = build_load_chart_conservador_ficticio()
    found_count = 0
    for step in range(221):
        result = lookup_ficticio(boom_length_m, step / 10, chart)
        if isinstance(result, CapacityUnsupported):
            continue
        found = assert_found(result)
        found_count += 1
        assert found.used_point in chart.points
        assert found.used_point.boom_length == Length(boom_length_m)
        assert found.max_capacity == found.used_point.max_capacity
    assert found_count > 0


def test_conservative_result_rejects_a_capacity_other_than_the_used_point() -> None:
    # Invariante do tipo (RN-004): a capacidade é a do ponto tabelado usado.
    used_point: LoadChartPoint = point_ficticio(20.0, 8.0, 6000.0)

    with pytest.raises(ValueError, match="RN-004"):
        ConservativeCapacityFound(
            max_capacity=Mass(6500.0),
            load_chart_id=LOAD_CHART_CONSERVADOR_FICTICIO_ID,
            load_chart_version=LOAD_CHART_CONSERVADOR_FICTICIO_VERSION,
            query=query_ficticia(20.0, 7.0),
            used_point=used_point,
        )


# --- tabela com valores distintos a menos de ε (não esperado; handoffs/TASK-020.md § 8) --------


def test_ficticio_radii_closer_than_tolerance_use_the_lowest_capacity() -> None:
    # Dois raios FICTÍCIOS a 0,5 µm um do outro: os dois coincidem (±ε) com a consulta.
    chart = build_load_chart_conservador_ficticio(
        ((20.0, 8.0, 6000.0), (20.0, 8.0 + NOISE_M, 5500.0), (20.0, 12.0, 4000.0))
    )

    result = assert_found(lookup_ficticio(20.0, 8.0 + NOISE_M / 2, chart))

    assert result.used_point == point_ficticio(20.0, 8.0 + NOISE_M, 5500.0)


def test_ficticio_boom_lengths_closer_than_tolerance_are_one_column_with_the_lowest_capacity() -> (
    None
):
    # Dois comprimentos FICTÍCIOS a 0,5 µm um do outro, com o mesmo raio: vale o menor valor.
    chart = build_load_chart_conservador_ficticio(
        ((20.0, 8.0, 6000.0), (20.0 + NOISE_M, 8.0, 5800.0))
    )

    result = assert_found(lookup_ficticio(20.0 + NOISE_M / 2, 8.0, chart))

    assert result.used_point == point_ficticio(20.0 + NOISE_M, 8.0, 5800.0)
