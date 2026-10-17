"""Gancho sobre o ponto de içamento no tandem (TASK-090; RN-016). Números FICTÍCIOS (ADR-012).

O rumo gira como o `rotation.y` do Three.js: os casos são os mesmos de `localToWorld` em
`frontend/tests/domain/tandem/tandem.test.ts` (frente +Z vai para +X com rumo de +90°).
"""

import math

import pytest

from app.domain.entities.scenario import CranePlacementSpec
from app.domain.services.tandem_hook_alignment import (
    TANDEM_HOOK_POINT_TOLERANCE_M,
    crane_point_to_world,
    hook_distance_to_point_m,
)
from app.domain.value_objects.operational_geometry import Point3D


@pytest.mark.parametrize(
    ("heading_deg", "local", "expected"),
    [
        (0.0, (0.0, 10.0), (5.0, 12.0)),
        (90.0, (0.0, 10.0), (15.0, 2.0)),
        (90.0, (1.0, 0.0), (5.0, 1.0)),
        (180.0, (2.0, 5.0), (3.0, -3.0)),
        (-90.0, (0.0, 10.0), (-5.0, 2.0)),
    ],
)
def test_ponto_do_guindaste_no_mundo_segue_o_rumo(
    heading_deg: float, local: tuple[float, float], expected: tuple[float, float]
) -> None:
    placement = CranePlacementSpec(x=5.0, z=2.0, heading_deg=heading_deg)

    x, z = crane_point_to_world(placement, *local)

    assert (x, z) == pytest.approx(expected)


def test_mesma_conta_do_frontend_com_rumo_qualquer() -> None:
    # localToWorld({x: 3, z: -2, headingDeg: 35}, 4, 7), à mão.
    heading = math.radians(35.0)
    expected = (
        3 + 4 * math.cos(heading) + 7 * math.sin(heading),
        -2 - 4 * math.sin(heading) + 7 * math.cos(heading),
    )

    assert crane_point_to_world(CranePlacementSpec(3.0, -2.0, 35.0), 4.0, 7.0) == pytest.approx(
        expected
    )


def test_distancia_do_gancho_soma_o_rumo_e_o_giro() -> None:
    # ψ = 30° e rumo 60°: a lança aponta para +X do mundo; R = 10 m.
    radius = 10.0
    psi = math.radians(30.0)
    hook = Point3D(radius * math.sin(psi), 4.0, radius * math.cos(psi))
    placement = CranePlacementSpec(x=-2.0, z=1.0, heading_deg=60.0)

    assert hook_distance_to_point_m(placement, hook, (8.0, 1.0)) == pytest.approx(0.0, abs=1e-9)
    assert hook_distance_to_point_m(placement, hook, (8.0, 2.0)) == pytest.approx(1.0)


def test_tolerancia_ficticia_de_meio_metro() -> None:
    assert TANDEM_HOOK_POINT_TOLERANCE_M == 0.5
