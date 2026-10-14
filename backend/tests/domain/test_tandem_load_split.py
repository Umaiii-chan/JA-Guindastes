"""Divisão de carga do tandem pela alavanca do CG (RN-016; TASK-074). Dados FICTÍCIOS."""

import pytest

from app.domain.services.tandem_load_split import TANDEM_CAPACITY_FACTOR, split_tandem_load


def test_cg_no_meio_divide_meio_a_meio() -> None:
    split = split_tandem_load(10_000, (0, 0), (-3, 0), (3, 0))

    assert split.shares_kg == pytest.approx((5_000, 5_000))
    assert split.fractions == pytest.approx((0.5, 0.5))
    assert split.cg_between_points


def test_ponto_mais_perto_do_cg_carrega_mais() -> None:
    # CG a 1 m do ponto A e a 3 m do ponto B: A leva 3/4, B leva 1/4.
    split = split_tandem_load(8_000, (-2, 0), (-3, 0), (1, 0))

    assert split.shares_kg == pytest.approx((6_000, 2_000))


def test_partes_somam_o_peso_total() -> None:
    split = split_tandem_load(12_345.6, (0.7, 0.2), (-2, -0.1), (4, 0.4))

    assert sum(split.shares_kg) == pytest.approx(12_345.6)


def test_cg_fora_da_reta_e_projetado_sobre_ela() -> None:
    split = split_tandem_load(1_000, (0, 5), (-2, 0), (2, 0))

    assert split.shares_kg == pytest.approx((500, 500))
    assert split.cg_between_points


def test_cg_fora_do_segmento_limita_as_partes() -> None:
    split = split_tandem_load(1_000, (5, 0), (-1, 0), (1, 0))

    assert split.shares_kg == pytest.approx((0, 1_000))
    assert not split.cg_between_points


def test_pontos_coincidentes_sao_recusados() -> None:
    with pytest.raises(ValueError, match="coincidir"):
        split_tandem_load(1_000, (0, 0), (1, 1), (1, 1))


@pytest.mark.parametrize("weight", [-1.0, float("nan"), float("inf")])
def test_peso_invalido_e_recusado(weight: float) -> None:
    with pytest.raises(ValueError, match="peso"):
        split_tandem_load(weight, (0, 0), (-1, 0), (1, 0))


def test_fator_do_tandem_e_75_por_cento() -> None:
    assert TANDEM_CAPACITY_FACTOR == 0.75
