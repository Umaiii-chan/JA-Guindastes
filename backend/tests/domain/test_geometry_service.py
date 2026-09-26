"""`GeometryService`: fórmulas do ADR-013 C-5 com a ficha técnica FICTÍCIA (RF-015).

Os parâmetros vêm de `tests/fixtures/crane_geometry_ficticia.py` (FICTÍCIO: a = 1,5 m, h = 2,5 m,
L em [10, 30] m, θ em [0°, 90°], c em [0, 40] m, giro contínuo), salvo quando o teste diz outro.
Os valores esperados foram calculados à mão, em forma fechada (cos 30° = √3/2, cos 60° = 1/2,
sin 45° = √2/2...), e não repetindo as chamadas de `math` do código.
"""

import math
from collections.abc import Mapping

import pytest

from app.domain.exceptions.geometry_errors import (
    OperationalLimitViolation,
    OperationalStateOutOfLimitsError,
    OutsideGeometricDomainError,
)
from app.domain.services.geometry_service import calculate_operational_geometry
from app.domain.value_objects.operational_geometry import OperationalGeometry, Point3D
from tests.fixtures.crane_geometry_ficticia import build_crane_geometry_ficticia, state_ficticio

# Tolerância só para erro de ponto flutuante (ex.: cos 90° dá 6e-17, não 0). Não é tolerância de
# engenharia entre cálculo e campo, que é pergunta aberta (ADR-013 G-7; known-gaps P-007).
TOLERANCE_M = 1e-9

SQRT_2 = math.sqrt(2)
SQRT_3 = math.sqrt(3)

type Xyz = tuple[float, float, float]


def xyz(point: Point3D) -> Xyz:
    return (point.x_m, point.y_m, point.z_m)


def calculate_ficticio(
    geometry_changes: Mapping[str, float | None] | None = None, **state_changes: float
) -> OperationalGeometry:
    geometry = build_crane_geometry_ficticia(**(geometry_changes or {}))
    return calculate_operational_geometry(state_ficticio(**state_changes), geometry)


# --- Fórmulas (1) a (5), casos calculados à mão -----------------------------------------------


@pytest.mark.parametrize(
    ("geometry_changes", "state_changes", "radius_m", "pivot", "tip", "hook"),
    [
        # R = 1,5 + 10·cos 0° = 11,5; y_T = 2,5 + 10·sin 0° = 2,5; y_G = 2,5 − 2 = 0,5.
        pytest.param(
            {},
            {"boom_length_m": 10.0, "boom_angle_deg": 0.0, "cable_length_m": 2.0},
            11.5,
            (0.0, 2.5, 1.5),
            (0.0, 2.5, 11.5),
            (0.0, 0.5, 11.5),
            id="theta-0-lanca-horizontal",
        ),
        # R = 1,5 + 12·cos 90° = 1,5; y_T = 2,5 + 12 = 14,5; y_G = 14,5 − 4 = 10,5.
        pytest.param(
            {},
            {"boom_length_m": 12.0, "boom_angle_deg": 90.0, "cable_length_m": 4.0},
            1.5,
            (0.0, 2.5, 1.5),
            (0.0, 14.5, 1.5),
            (0.0, 10.5, 1.5),
            id="theta-90-lanca-vertical",
        ),
        # R = 1,5 + 20·(√3/2) = 1,5 + 10√3; y_T = 2,5 + 20·(1/2) = 12,5; y_G = 12,5 − 5 = 7,5.
        pytest.param(
            {},
            {"boom_length_m": 20.0, "boom_angle_deg": 30.0, "cable_length_m": 5.0},
            1.5 + 10 * SQRT_3,
            (0.0, 2.5, 1.5),
            (0.0, 12.5, 1.5 + 10 * SQRT_3),
            (0.0, 7.5, 1.5 + 10 * SQRT_3),
            id="theta-30",
        ),
        # R = 1,5 + 20·(1/2) = 11,5; y_T = 2,5 + 20·(√3/2) = 2,5 + 10√3; y_G = y_T − 5.
        pytest.param(
            {},
            {"boom_length_m": 20.0, "boom_angle_deg": 60.0, "cable_length_m": 5.0},
            11.5,
            (0.0, 2.5, 1.5),
            (0.0, 2.5 + 10 * SQRT_3, 11.5),
            (0.0, -2.5 + 10 * SQRT_3, 11.5),
            id="theta-60",
        ),
        # ψ = 90°: u = (1, 0, 0), a lança sobre o lado esquerdo do chassi (+X).
        pytest.param(
            {},
            {
                "boom_length_m": 10.0,
                "boom_angle_deg": 0.0,
                "turret_rotation_deg": 90.0,
                "cable_length_m": 2.0,
            },
            11.5,
            (1.5, 2.5, 0.0),
            (11.5, 2.5, 0.0),
            (11.5, 0.5, 0.0),
            id="psi-90-lado-esquerdo",
        ),
        # ψ = 180°: u = (0, 0, −1), a lança sobre a traseira (−Z).
        pytest.param(
            {},
            {
                "boom_length_m": 10.0,
                "boom_angle_deg": 0.0,
                "turret_rotation_deg": 180.0,
                "cable_length_m": 2.0,
            },
            11.5,
            (0.0, 2.5, -1.5),
            (0.0, 2.5, -11.5),
            (0.0, 0.5, -11.5),
            id="psi-180-traseira",
        ),
        # ψ = 270°: u = (−1, 0, 0), a lança sobre o lado direito do chassi (−X).
        pytest.param(
            {},
            {
                "boom_length_m": 10.0,
                "boom_angle_deg": 0.0,
                "turret_rotation_deg": 270.0,
                "cable_length_m": 2.0,
            },
            11.5,
            (-1.5, 2.5, 0.0),
            (-11.5, 2.5, 0.0),
            (-11.5, 0.5, 0.0),
            id="psi-270-lado-direito",
        ),
        # ψ = 45°: u = (√2/2, 0, √2/2).
        pytest.param(
            {},
            {
                "boom_length_m": 10.0,
                "boom_angle_deg": 0.0,
                "turret_rotation_deg": 45.0,
                "cable_length_m": 2.0,
            },
            11.5,
            (1.5 / SQRT_2, 2.5, 1.5 / SQRT_2),
            (11.5 / SQRT_2, 2.5, 11.5 / SQRT_2),
            (11.5 / SQRT_2, 0.5, 11.5 / SQRT_2),
            id="psi-45",
        ),
        # a = −2 (pino atrás do eixo): R = −2 + 10 = 8; P = (0, 2,5, −2).
        pytest.param(
            {"boom_pivot_offset_m": -2.0},
            {"boom_length_m": 10.0, "boom_angle_deg": 0.0, "cable_length_m": 2.0},
            8.0,
            (0.0, 2.5, -2.0),
            (0.0, 2.5, 8.0),
            (0.0, 0.5, 8.0),
            id="a-negativo-psi-0",
        ),
        # a = −2 e ψ = 90°: P = (−2, 2,5, 0); G = (8, 0,5, 0).
        pytest.param(
            {"boom_pivot_offset_m": -2.0},
            {
                "boom_length_m": 10.0,
                "boom_angle_deg": 0.0,
                "turret_rotation_deg": 90.0,
                "cable_length_m": 2.0,
            },
            8.0,
            (-2.0, 2.5, 0.0),
            (8.0, 2.5, 0.0),
            (8.0, 0.5, 0.0),
            id="a-negativo-psi-90",
        ),
        # Lança abaixo da horizontal (faixa FICTÍCIA com θ_min = −30°, h = 6):
        # R = 1,5 + 10·(√3/2) = 1,5 + 5√3; y_T = 6 − 10·(1/2) = 1; y_G = 1 − 0,5 = 0,5.
        pytest.param(
            {"boom_angle_min_deg": -30.0, "boom_pivot_height_m": 6.0},
            {"boom_length_m": 10.0, "boom_angle_deg": -30.0, "cable_length_m": 0.5},
            1.5 + 5 * SQRT_3,
            (0.0, 6.0, 1.5),
            (0.0, 1.0, 1.5 + 5 * SQRT_3),
            (0.0, 0.5, 1.5 + 5 * SQRT_3),
            id="theta-negativo",
        ),
    ],
)
def test_ficticio_geometry_matches_hand_calculated_values(
    geometry_changes: Mapping[str, float],
    state_changes: dict[str, float],
    radius_m: float,
    pivot: Xyz,
    tip: Xyz,
    hook: Xyz,
) -> None:
    result = calculate_ficticio(geometry_changes, **state_changes)

    assert result.working_radius.meters == pytest.approx(radius_m, abs=TOLERANCE_M)
    assert xyz(result.boom_pivot) == pytest.approx(pivot, abs=TOLERANCE_M)
    assert xyz(result.boom_tip) == pytest.approx(tip, abs=TOLERANCE_M)
    assert xyz(result.hook) == pytest.approx(hook, abs=TOLERANCE_M)
    assert result.tip_height_m == pytest.approx(tip[1], abs=TOLERANCE_M)
    assert result.hook_height_m == pytest.approx(hook[1], abs=TOLERANCE_M)


def test_ficticio_working_radius_is_measured_from_slewing_axis_not_from_pivot() -> None:
    # ADR-013 C-3: raio a partir do eixo de giro, R = a + L·cos θ (e não L·cos θ, alternativa A-1).
    # a = 1,5; L = 20; θ = 60° → R = 1,5 + 10 = 11,5 (a partir do pino seria 10).
    result = calculate_ficticio(boom_length_m=20.0, boom_angle_deg=60.0)

    assert result.working_radius.meters == pytest.approx(11.5, abs=TOLERANCE_M)


def test_ficticio_working_radius_does_not_depend_on_turret_rotation() -> None:
    radii = [
        calculate_ficticio(turret_rotation_deg=psi).working_radius.meters
        for psi in (0.0, 45.0, 90.0, 180.0, 270.0)
    ]

    assert radii == pytest.approx([radii[0]] * len(radii), abs=TOLERANCE_M)


def test_ficticio_turret_rotation_of_90_puts_boom_over_left_side_of_chassis() -> None:
    # ADR-013 C-2: ψ = 90° deixa a lança sobre o lado esquerdo do chassi (+X).
    hook = calculate_ficticio(turret_rotation_deg=90.0).hook

    assert hook.x_m > 0
    assert hook.z_m == pytest.approx(0.0, abs=TOLERANCE_M)


def test_ficticio_positive_turret_rotation_is_counterclockwise_seen_from_above() -> None:
    # Regra da mão direita em torno de +Y (para cima): uma rotação é anti-horária vista de cima
    # quando a componente Y de (antes × depois) é positiva. Com antes = (x0, z0) e
    # depois = (x1, z1) no plano XZ, essa componente é z0·x1 − x0·z1.
    before = calculate_ficticio(turret_rotation_deg=0.0).hook
    after = calculate_ficticio(turret_rotation_deg=30.0).hook

    cross_y = before.z_m * after.x_m - before.x_m * after.z_m

    assert cross_y > 0


def test_ficticio_hook_hangs_vertically_below_tip_by_cable_length() -> None:
    # ADR-013 S-2: cabo vertical; G fica exatamente abaixo de T, a c metros (fórmula 3).
    result = calculate_ficticio(turret_rotation_deg=123.0, cable_length_m=7.0)

    assert result.hook.x_m == result.boom_tip.x_m
    assert result.hook.z_m == result.boom_tip.z_m
    assert result.tip_height_m - result.hook_height_m == pytest.approx(7.0, abs=TOLERANCE_M)


def test_ficticio_tip_directly_above_slewing_axis_has_zero_working_radius() -> None:
    # a = 0 e θ = 90°: R = 0 + L·cos 90° = 0 (no limite; não é R < 0).
    result = calculate_ficticio({"boom_pivot_offset_m": 0.0}, boom_angle_deg=90.0)

    assert result.working_radius.meters == pytest.approx(0.0, abs=TOLERANCE_M)


def test_ficticio_hook_below_support_plane_is_not_blocked() -> None:
    # ADR-013 C-5: y_G negativo não é bloqueado por este ADR (G-8).
    # y_G = 2,5 + 10·sin 0° − 5 = −2,5.
    result = calculate_ficticio(boom_length_m=10.0, boom_angle_deg=0.0, cable_length_m=5.0)

    assert result.hook_height_m == pytest.approx(-2.5, abs=TOLERANCE_M)


# --- Exemplo da doc-fonte (§§ 14.2 e 14.3) --------------------------------------------------------


def test_ficticio_reproduces_working_radius_of_source_doc_example_with_pivot_on_axis() -> None:
    # ADR-013 "Verificação numérica": L = 18,2 m, θ = 42°, a = 0 → R = 18,2·cos 42° = 13,5252 m,
    # que a doc-fonte mostra como 13,5 m (1 casa decimal).
    # A altura do gancho do exemplo (11,7 m) NÃO é testada: o ADR-013 mostra que ela é
    # inconsistente com as fórmulas (risco R-4). O h usado aqui é o FICTÍCIO da fixture.
    result = calculate_ficticio(
        {"boom_pivot_offset_m": 0.0},
        boom_length_m=18.2,
        boom_angle_deg=42.0,
        turret_rotation_deg=120.0,
        cable_length_m=8.4,
    )

    assert result.working_radius.meters == pytest.approx(13.5252, abs=1e-4)
    assert round(result.working_radius.meters, 1) == 13.5
    # Coordenadas horizontais do gancho, também da verificação do ADR: x = 11,713; z = −6,763.
    assert result.hook.x_m == pytest.approx(11.713, abs=1e-3)
    assert result.hook.z_m == pytest.approx(-6.763, abs=1e-3)


# --- Faixas da ficha técnica: sinaliza, não corrige ---------------------------------------------


@pytest.mark.parametrize(
    ("state_changes", "expected"),
    [
        pytest.param(
            {"boom_length_m": 9.99},
            OperationalLimitViolation.BOOM_LENGTH_BELOW_MIN,
            id="L-abaixo-do-minimo",
        ),
        pytest.param(
            {"boom_length_m": 30.01},
            OperationalLimitViolation.BOOM_LENGTH_ABOVE_MAX,
            id="L-acima-do-maximo",
        ),
        pytest.param(
            {"boom_angle_deg": -0.5},
            OperationalLimitViolation.BOOM_ANGLE_BELOW_MIN,
            id="theta-abaixo-do-minimo",
        ),
        pytest.param(
            {"boom_angle_deg": 90.5},
            OperationalLimitViolation.BOOM_ANGLE_ABOVE_MAX,
            id="theta-acima-do-maximo",
        ),
        pytest.param(
            {"cable_length_m": 40.5},
            OperationalLimitViolation.CABLE_LENGTH_ABOVE_MAX,
            id="c-acima-do-maximo",
        ),
    ],
)
def test_ficticio_state_outside_limits_is_signaled_not_corrected(
    state_changes: dict[str, float], expected: OperationalLimitViolation
) -> None:
    # ADR-013 C-5: o GeometryService sinaliza, e não corrige, estados fora das faixas de C-4.
    with pytest.raises(OperationalStateOutOfLimitsError) as error:
        calculate_ficticio(**state_changes)

    assert error.value.violations == (expected,)


def test_ficticio_cable_shorter_than_minimum_is_signaled() -> None:
    with pytest.raises(OperationalStateOutOfLimitsError) as error:
        calculate_ficticio({"cable_length_min_m": 1.0}, cable_length_m=0.5)

    assert error.value.violations == (OperationalLimitViolation.CABLE_LENGTH_BELOW_MIN,)


def test_ficticio_all_violated_limits_are_reported_together() -> None:
    with pytest.raises(OperationalStateOutOfLimitsError) as error:
        calculate_ficticio(boom_length_m=5.0, boom_angle_deg=95.0, cable_length_m=50.0)

    assert error.value.violations == (
        OperationalLimitViolation.BOOM_LENGTH_BELOW_MIN,
        OperationalLimitViolation.BOOM_ANGLE_ABOVE_MAX,
        OperationalLimitViolation.CABLE_LENGTH_ABOVE_MAX,
    )


@pytest.mark.parametrize(
    "state_changes",
    [
        pytest.param({"boom_length_m": 10.0}, id="L-igual-ao-minimo"),
        pytest.param({"boom_length_m": 30.0}, id="L-igual-ao-maximo"),
        pytest.param({"boom_angle_deg": 0.0}, id="theta-igual-ao-minimo"),
        pytest.param({"boom_angle_deg": 90.0}, id="theta-igual-ao-maximo"),
        pytest.param({"cable_length_m": 0.0}, id="c-igual-ao-minimo"),
        pytest.param({"cable_length_m": 40.0}, id="c-igual-ao-maximo"),
    ],
)
def test_ficticio_limits_are_inclusive(state_changes: dict[str, float]) -> None:
    # ADR-013 C-5: fora de [L_min, L_max] e de [θ_min, θ_max]; c < c_min ou c > c_max.
    calculate_ficticio(**state_changes)


def test_ficticio_cable_without_maximum_accepts_any_length_above_minimum() -> None:
    # ADR-013 C-4: c_max é opcional.
    result = calculate_ficticio({"cable_length_max_m": None}, cable_length_m=1000.0)

    assert result.hook_height_m < 0


@pytest.mark.parametrize("turret_rotation_deg", [0.0, 90.0, 179.9, 270.0, 359.9, -45.0, 725.0])
def test_ficticio_continuous_turret_rotation_accepts_any_angle(turret_rotation_deg: float) -> None:
    # ADR-013 C-4: sem limites de giro, o giro é contínuo.
    calculate_ficticio(turret_rotation_deg=turret_rotation_deg)


@pytest.mark.parametrize(
    ("limits_deg", "turret_rotation_deg", "allowed"),
    [
        pytest.param((-30.0, 30.0), 0.0, True, id="frente-centro"),
        pytest.param((-30.0, 30.0), 30.0, True, id="frente-limite-maximo"),
        pytest.param((-30.0, 30.0), -30.0, True, id="frente-limite-minimo-negativo"),
        pytest.param((-30.0, 30.0), 330.0, True, id="frente-limite-minimo-normalizado"),
        pytest.param((-30.0, 30.0), 350.0, True, id="frente-350"),
        pytest.param((-30.0, 30.0), 31.0, False, id="frente-acima"),
        pytest.param((-30.0, 30.0), 329.0, False, id="frente-abaixo"),
        pytest.param((-30.0, 30.0), 180.0, False, id="frente-traseira"),
        pytest.param((90.0, 270.0), 180.0, True, id="tras-centro"),
        pytest.param((90.0, 270.0), 90.0, True, id="tras-limite-minimo"),
        pytest.param((90.0, 270.0), 0.0, False, id="tras-frente"),
        pytest.param((90.0, 270.0), 89.0, False, id="tras-abaixo"),
        pytest.param((90.0, 270.0), 271.0, False, id="tras-acima"),
    ],
)
def test_ficticio_turret_rotation_limits_are_an_arc_from_min_to_max(
    limits_deg: tuple[float, float], turret_rotation_deg: float, allowed: bool
) -> None:
    minimum, maximum = limits_deg
    geometry_changes = {"turret_rotation_min_deg": minimum, "turret_rotation_max_deg": maximum}

    if allowed:
        calculate_ficticio(geometry_changes, turret_rotation_deg=turret_rotation_deg)
    else:
        with pytest.raises(OperationalStateOutOfLimitsError) as error:
            calculate_ficticio(geometry_changes, turret_rotation_deg=turret_rotation_deg)
        assert error.value.violations == (OperationalLimitViolation.TURRET_ROTATION_OUTSIDE_LIMITS,)


# --- Ponta atrás do eixo de giro (R < 0) ----------------------------------------------------------


def test_ficticio_tip_behind_slewing_axis_is_outside_geometric_domain() -> None:
    # ADR-013 C-5: se R < 0, o raio não vira |R|; o estado é sinalizado.
    # a = −2; L = 12; θ = 90° → R = −2 + 12·cos 90° = −2.
    with pytest.raises(OutsideGeometricDomainError) as error:
        calculate_ficticio({"boom_pivot_offset_m": -2.0}, boom_length_m=12.0, boom_angle_deg=90.0)

    assert error.value.horizontal_reach_m == pytest.approx(-2.0, abs=TOLERANCE_M)
