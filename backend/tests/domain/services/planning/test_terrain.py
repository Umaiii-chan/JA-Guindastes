"""Paridade do terreno, solo e sapatas com o frontend (TASK-075).

Os valores esperados foram calculados pelo código TypeScript (`terrainHeightAt`,
`terrainSlopeDegAt`, `groundSlopeUnderCraneDeg`, `shoePoints` e `soilAt`) para o mesmo cenário
FICTÍCIO; o teste espelho do frontend, em
`frontend/tests/domain/environment/terrainParity.test.ts`, confere os mesmos números.
Se uma das pontas mudar a fórmula, as duas falham.
"""

import pytest

from app.domain.entities.scenario import (
    CranePlacementSpec,
    FeatureKind,
    ScenarioSpec,
    SoilKind,
    SoilZoneSpec,
    TerrainFeatureSpec,
    TerrainSpec,
)
from app.domain.services.planning.terrain import (
    ground_slope_under_crane_deg,
    shoe_points,
    soil_at,
    soil_kinds_under_shoes,
    terrain_height_at,
    terrain_slope_deg_at,
)

TERRAIN = TerrainSpec(
    slope_x_percent=2.0,
    slope_z_percent=-1.5,
    features=(
        TerrainFeatureSpec("m", FeatureKind.MOUND, 5, 3, 6, 2),
        TerrainFeatureSpec("p", FeatureKind.PIT, -6, 2, 4, 1.5),
        TerrainFeatureSpec("pl", FeatureKind.PLATEAU, 0, -8, 7, 1),
        TerrainFeatureSpec("r", FeatureKind.RAMP, 10, -4, 5, 2, direction_deg=30, width_m=4),
        TerrainFeatureSpec("f", FeatureKind.FLATTEN, -2, 6, 5, 0.5),
    ),
)
SPEC = ScenarioSpec(
    terrain=TERRAIN,
    soil_zones=(
        SoilZoneSpec("s1", SoilKind.ROCK, 4, 3, 5),
        SoilZoneSpec("s2", SoilKind.CLAY, 6, 3, 2),
    ),
)

# (x, z, altura, inclinação em graus) calculados pelo TypeScript.
GROUND_CASES = [
    (0, 0, 0.0039147524128687605, 3.894080314239896),
    (5, 3, 2.055, 1.4320961841646513),
    (-6, 2, -1.65, 1.4320961841646338),
    (0, -8, 1.12, 1.4320961841646338),
    (10, -4, 1.26, 12.671679144815876),
    (12, -6, 1.8764101615137752, 12.671679144815858),
    (-2, 6, 0.5, 0.0),
    (-1, 5, 0.5, 0.0),
    (7.5, -3.2, 0.6849872981077807, 12.671679144815872),
    (20, 20, 0.10000000000000003, 1.4320961841646476),
]


@pytest.mark.parametrize(("x", "z", "height", "_slope"), GROUND_CASES)
def test_altura_do_terreno_igual_ao_frontend(
    x: float, z: float, height: float, _slope: float
) -> None:
    assert terrain_height_at(TERRAIN, x, z) == pytest.approx(height, abs=1e-9)


@pytest.mark.parametrize(("x", "z", "_height", "slope"), GROUND_CASES)
def test_inclinacao_do_terreno_igual_ao_frontend(
    x: float, z: float, _height: float, slope: float
) -> None:
    assert terrain_slope_deg_at(TERRAIN, x, z) == pytest.approx(slope, abs=1e-9)


@pytest.mark.parametrize(
    ("placement", "slope"),
    [
        (CranePlacementSpec(0, 0, 0), 5.8555710313747555),
        (CranePlacementSpec(5, 3, 35), 1.4320961841646465),
        (CranePlacementSpec(9, -3, -120), 11.652861830383388),
    ],
)
def test_inclinacao_sob_as_sapatas_igual_ao_frontend(
    placement: CranePlacementSpec, slope: float
) -> None:
    assert ground_slope_under_crane_deg(TERRAIN, placement) == pytest.approx(slope, abs=1e-9)


def test_sapatas_na_ordem_e_posicao_do_frontend() -> None:
    shoes = shoe_points(TERRAIN, CranePlacementSpec(5, 3, 35))

    expected = [
        ("fl", 4.672849198330659, 6.89139722374459, 0.5337062729325283),
        ("fr", 8.768609419775618, 4.02351504198936, 0.6586397100877555),
        ("rl", 1.2313905802243825, 1.9764849580106403, 0.5386007845564119),
        ("rr", 5.327150801669341, -0.8913972237445904, 0.6635342217116396),
    ]
    assert [(s.position, s.x, s.z, s.y) for s in shoes] == [
        (name, pytest.approx(x), pytest.approx(z), pytest.approx(y)) for name, x, z, y in expected
    ]


@pytest.mark.parametrize(
    ("x", "z", "kind"),
    [
        (0, 0, SoilKind.ROCK),
        (5, 3, SoilKind.CLAY),  # a zona mais recente vale onde há sobreposição
        (-6, 2, SoilKind.COMPACTED),
        (20, 20, SoilKind.COMPACTED),
    ],
)
def test_solo_igual_ao_frontend(x: float, z: float, kind: SoilKind) -> None:
    assert soil_at(SPEC, x, z) is kind


def test_solo_sob_as_sapatas_so_existe_com_zonas_pintadas() -> None:
    placement = CranePlacementSpec(5, 3, 0)

    assert soil_kinds_under_shoes(ScenarioSpec(terrain=TERRAIN), placement) == ()
    assert len(soil_kinds_under_shoes(SPEC, placement)) == 4


def test_terreno_plano_tem_altura_e_inclinacao_zero() -> None:
    flat = TerrainSpec()

    assert terrain_height_at(flat, 3.0, -4.0) == 0.0
    assert ground_slope_under_crane_deg(flat, CranePlacementSpec(1, 2, 45)) == 0.0
