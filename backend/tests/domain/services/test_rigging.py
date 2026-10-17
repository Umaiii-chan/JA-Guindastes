"""Geometria das lingas (F-19; ADR-051): a única fonte da altura das lingas.

A tabela `tests/fixtures/sling_geometry_cases.json` é a mesma que o frontend lê
(`frontend/tests/domain/rigging/slingGeometry.test.ts`): é a prova de paridade entre os dois lados.
"""

import json
import math
from pathlib import Path

import pytest

from app.domain.services import rigging
from app.domain.services.rigging import (
    InvalidSlingGeometryError,
    default_geometry,
    from_angle,
    from_length,
    reach_m,
    sling_drop_m,
)

_CASOS = json.loads(
    (Path(__file__).resolve().parents[2] / "fixtures" / "sling_geometry_cases.json").read_text(
        encoding="utf-8"
    )
)
_TOL = _CASOS["tolerancia"]


@pytest.mark.parametrize("caso", _CASOS["padrao"], ids=lambda c: c["nome"])
def test_tabela_unica_de_casos_padrao(caso: dict) -> None:
    entrada, esperado = caso["entrada"], caso["esperado"]
    geometria = default_geometry(
        entrada["length_m"],
        entrada["width_m"],
        angle_deg=entrada.get("angle_deg"),
        tandem=entrada.get("tandem", False),
    )
    assert geometria.reach_m == pytest.approx(esperado["reach_m"], abs=_TOL)
    assert geometria.length_m == pytest.approx(esperado["length_m"], abs=_TOL)
    assert geometria.angle_deg == pytest.approx(esperado["angle_deg"], abs=_TOL)
    assert geometria.drop_m == pytest.approx(esperado["drop_m"], abs=_TOL)
    assert geometria.below_recommended_angle is esperado["below_recommended_angle"]
    assert geometria.needs_spreader is esperado["needs_spreader"]
    assert sling_drop_m(
        entrada["length_m"],
        entrada["width_m"],
        angle_deg=entrada.get("angle_deg"),
        tandem=entrada.get("tandem", False),
    ) == pytest.approx(esperado["drop_m"], abs=_TOL)


@pytest.mark.parametrize("caso", _CASOS["por_comprimento"])
def test_tabela_unica_por_comprimento(caso: dict) -> None:
    entrada, esperado = caso["entrada"], caso["esperado"]
    geometria = from_length(entrada["reach_m"], entrada["length_m"])
    assert geometria.length_m == pytest.approx(esperado["length_m"], abs=_TOL)
    assert geometria.angle_deg == pytest.approx(esperado["angle_deg"], abs=_TOL)
    assert geometria.drop_m == pytest.approx(esperado["drop_m"], abs=_TOL)


@pytest.mark.parametrize("caso", _CASOS["recusas"], ids=lambda c: c["nome"])
def test_tabela_unica_de_recusas(caso: dict) -> None:
    entrada = caso["entrada"]
    with pytest.raises(InvalidSlingGeometryError):
        default_geometry(
            entrada["length_m"], entrada["width_m"], angle_deg=entrada.get("angle_deg")
        )


def test_a_queda_e_comprimento_vezes_seno_do_angulo() -> None:
    geometria = default_geometry(3.0, 2.0, angle_deg=50.0)
    assert geometria.drop_m == pytest.approx(
        geometria.length_m * math.sin(math.radians(geometria.angle_deg))
    )
    assert geometria.reach_m == pytest.approx(
        geometria.length_m * math.cos(math.radians(geometria.angle_deg))
    )


def test_alcance_e_a_meia_diagonal_da_pegada_e_no_tandem_a_da_metade() -> None:
    assert reach_m(3.0, 2.0) == pytest.approx(math.hypot(1.5, 1.0))
    assert reach_m(12.0, 2.4, tandem=True) == pytest.approx(math.hypot(3.0, 1.2))


def test_o_mesmo_angulo_com_carga_maior_da_linga_mais_alta() -> None:
    assert sling_drop_m(6.0, 2.0, angle_deg=60.0) > sling_drop_m(3.0, 2.0, angle_deg=60.0)


def test_angulo_menor_da_linga_mais_baixa_e_mais_comprida() -> None:
    a60 = from_angle(2.0, 60.0)
    a45 = from_angle(2.0, 45.0)
    assert a45.drop_m < a60.drop_m
    assert a45.length_m < a60.length_m * 1.0 + 1e-9 or a45.length_m > 0


def test_o_padrao_e_60_graus_e_cai_a_45_quando_a_linga_ficaria_longa() -> None:
    curta = default_geometry(3.0, 2.0)
    longa = default_geometry(12.0, 2.4)
    assert curta.angle_deg == pytest.approx(rigging.PREFERRED_ANGLE_DEG)
    assert longa.angle_deg == pytest.approx(rigging.FALLBACK_ANGLE_DEG)
    assert curta.length_m <= rigging.MAX_PREFERRED_LENGTH_M
    assert longa.needs_spreader


def test_angulo_informado_vence_o_padrao_e_abaixo_de_45_e_so_atencao() -> None:
    geometria = default_geometry(3.0, 2.0, angle_deg=35.0)
    assert geometria.angle_deg == pytest.approx(35.0)
    assert geometria.below_recommended_angle


def test_piso_da_altura_mantem_o_gancho_fora_da_carga() -> None:
    assert default_geometry(0.2, 0.2).drop_m == rigging.MIN_DROP_M


def test_linga_vertical_usa_o_piso_da_altura() -> None:
    assert from_angle(2.0, 90.0).drop_m == rigging.MIN_DROP_M


def test_linga_mais_curta_que_o_alcance_e_recusada() -> None:
    with pytest.raises(InvalidSlingGeometryError):
        from_length(3.0, 2.9)


@pytest.mark.parametrize("valor", [float("nan"), float("inf"), True, "3", None])
def test_medida_invalida_e_recusada(valor: object) -> None:
    with pytest.raises(InvalidSlingGeometryError):
        reach_m(valor, 2.0)  # type: ignore[arg-type]
