"""Estratégia `LinearInterpolationLookup` (ADR-030; ADR-043; TASK-096).

Interpola linearmente só no raio, dentro de uma coluna. Entre colunas de comprimento de lança (ou
abaixo da menor), vale a coluna da próxima lança mais longa (ADR-043): o comprimento não é
interpolado. Todos os números são FICTÍCIOS, montados no próprio teste.
"""

import pytest

from app.domain.entities.load_chart import LoadChart, LoadChartStatus
from app.domain.services.linear_interpolation_lookup import LinearInterpolationLookup
from app.domain.value_objects.capacity_query import CapacityQuery
from app.domain.value_objects.capacity_result import (
    CapacityResult,
    CapacityUnsupported,
    CapacityUnsupportedReason,
)
from app.domain.value_objects.conservative_capacity_result import CapacityLookupStrategy
from app.domain.value_objects.interpolated_capacity_result import InterpolatedCapacityFound
from app.domain.value_objects.length import Length
from tests.fixtures.load_chart_ficticio import point_ficticio

# (boom_length_m, working_radius_m, max_capacity_kg) — FICTÍCIO. A lança curta (30 m) levanta mais
# que a longa (40 m) no mesmo raio, como numa tabela real.
POINTS_FICTICIOS: tuple[tuple[float, float, float], ...] = (
    (30.0, 10.0, 12000.0),
    (30.0, 12.0, 10000.0),
    (30.0, 16.0, 7000.0),
    (40.0, 10.0, 10000.0),
    (40.0, 12.0, 8400.0),
    (40.0, 16.0, 6000.0),
    (40.0, 20.0, 4500.0),
)


def chart_ficticio() -> LoadChart:
    return LoadChart(
        id="LC-INTERPOLACAO-FICTICIA",
        version="FICTICIO-v1",
        configuration_id="CFG-INTERPOLACAO-FICTICIA",
        status=LoadChartStatus.ACTIVE,
        points=tuple(point_ficticio(*values) for values in POINTS_FICTICIOS),
    )


def lookup(boom_length_m: float, working_radius_m: float) -> CapacityResult:
    query = CapacityQuery(
        boom_length=Length(boom_length_m), working_radius=Length(working_radius_m)
    )
    return LinearInterpolationLookup().calculate_capacity(chart_ficticio(), query)


def found(result: CapacityResult) -> InterpolatedCapacityFound:
    assert isinstance(result, InterpolatedCapacityFound)
    assert result.strategy is CapacityLookupStrategy.LINEAR_INTERPOLATION_PROVISIONAL
    return result


def test_ponto_tabelado_devolve_a_capacidade_do_ponto() -> None:
    result = found(lookup(30.0, 12.0))
    assert result.max_capacity.kilograms == pytest.approx(10000.0)
    assert [p.working_radius.meters for p in result.points] == [12.0]


def test_entre_dois_raios_interpola_linearmente_na_coluna() -> None:
    # 11 m fica no meio de 10 m (12 000 kg) e 12 m (10 000 kg).
    result = found(lookup(30.0, 11.0))
    assert result.max_capacity.kilograms == pytest.approx(11000.0)
    assert {p.boom_length.meters for p in result.points} == {30.0}


def test_entre_colunas_usa_a_proxima_lanca_mais_longa_sem_interpolar_o_comprimento() -> None:
    # ADR-043: 35 m fica entre 30 m e 40 m → vale a coluna de 40 m. Interpolar o comprimento daria
    # 9 200 kg em 12 m, acima dos 8 400 kg da lança mais longa.
    result = found(lookup(35.0, 12.0))
    assert result.max_capacity.kilograms == pytest.approx(8400.0)
    assert {p.boom_length.meters for p in result.points} == {40.0}


def test_entre_colunas_interpola_o_raio_so_na_coluna_mais_longa() -> None:
    # Coluna de 40 m, 14 m no meio de 12 m (8 400 kg) e 16 m (6 000 kg).
    result = found(lookup(31.0, 14.0))
    assert result.max_capacity.kilograms == pytest.approx(7200.0)
    assert {p.boom_length.meters for p in result.points} == {40.0}


def test_entre_colunas_nunca_passa_da_capacidade_da_lanca_mais_longa() -> None:
    for radius in (10.0, 11.0, 12.0, 13.5, 16.0):
        between = found(lookup(36.5, radius)).max_capacity.kilograms
        longer = found(lookup(40.0, radius)).max_capacity.kilograms
        assert between == pytest.approx(longer)


def test_entre_colunas_o_raio_e_conferido_na_coluna_mais_longa() -> None:
    # 18 m passa do maior raio da coluna de 30 m (16 m), mas a de 40 m vai até 20 m: é avaliável.
    result = found(lookup(35.0, 18.0))
    assert result.max_capacity.kilograms == pytest.approx(5250.0)


def test_abaixo_da_menor_coluna_usa_a_menor_coluna() -> None:
    result = found(lookup(25.0, 11.0))
    assert result.max_capacity.kilograms == pytest.approx(11000.0)
    assert {p.boom_length.meters for p in result.points} == {30.0}


def test_acima_da_maior_coluna_nao_e_suportado() -> None:
    result = lookup(41.0, 12.0)
    assert isinstance(result, CapacityUnsupported)
    assert result.reason is CapacityUnsupportedReason.BOOM_LENGTH_ABOVE_CHART_MAX


@pytest.mark.parametrize(
    ("boom_length_m", "radius_m", "reason"),
    [
        (35.0, 9.0, CapacityUnsupportedReason.RADIUS_BELOW_CHART_MIN),
        (35.0, 21.0, CapacityUnsupportedReason.RADIUS_ABOVE_CHART_MAX),
        (30.0, 17.0, CapacityUnsupportedReason.RADIUS_ABOVE_CHART_MAX),
    ],
)
def test_raio_fora_da_coluna_escolhida_nao_e_suportado(
    boom_length_m: float, radius_m: float, reason: CapacityUnsupportedReason
) -> None:
    result = lookup(boom_length_m, radius_m)
    assert isinstance(result, CapacityUnsupported)
    assert result.reason is reason
