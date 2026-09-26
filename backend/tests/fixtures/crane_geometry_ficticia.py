# FICTÍCIO — parâmetros geométricos inventados só para testar as fórmulas do ADR-013.
#
# Nenhum número deste arquivo vem de ficha técnica de fabricante nem da doc-fonte. Não use estes
# valores fora dos testes, em demonstração ou como dado de guindaste real (ADR-012; ADR-013 C-4,
# regra 2).
"""Ficha técnica geométrica e estado operacional FICTÍCIOS para os testes do `GeometryService`."""

from app.domain.value_objects.angle import Angle
from app.domain.value_objects.crane_geometry import CraneGeometry
from app.domain.value_objects.length import Length
from app.domain.value_objects.operational_state import OperationalState

# Ficha técnica FICTÍCIA (a, h e faixas), em metros e graus.
BOOM_PIVOT_OFFSET_FICTICIO_M = 1.5
BOOM_PIVOT_HEIGHT_FICTICIA_M = 2.5
BOOM_LENGTH_MIN_FICTICIO_M = 10.0
BOOM_LENGTH_MAX_FICTICIO_M = 30.0
BOOM_ANGLE_MIN_FICTICIO_DEG = 0.0
BOOM_ANGLE_MAX_FICTICIO_DEG = 90.0
CABLE_LENGTH_MIN_FICTICIO_M = 0.0
CABLE_LENGTH_MAX_FICTICIO_M = 40.0

# Estado operacional FICTÍCIO padrão, dentro das faixas acima.
BOOM_LENGTH_FICTICIO_M = 20.0
BOOM_ANGLE_FICTICIO_DEG = 30.0
TURRET_ROTATION_FICTICIO_DEG = 0.0
CABLE_LENGTH_FICTICIO_M = 5.0


def build_crane_geometry_ficticia(
    *,
    boom_pivot_offset_m: float = BOOM_PIVOT_OFFSET_FICTICIO_M,
    boom_pivot_height_m: float = BOOM_PIVOT_HEIGHT_FICTICIA_M,
    boom_length_min_m: float = BOOM_LENGTH_MIN_FICTICIO_M,
    boom_length_max_m: float = BOOM_LENGTH_MAX_FICTICIO_M,
    boom_angle_min_deg: float = BOOM_ANGLE_MIN_FICTICIO_DEG,
    boom_angle_max_deg: float = BOOM_ANGLE_MAX_FICTICIO_DEG,
    cable_length_min_m: float = CABLE_LENGTH_MIN_FICTICIO_M,
    cable_length_max_m: float | None = CABLE_LENGTH_MAX_FICTICIO_M,
    turret_rotation_min_deg: float | None = None,
    turret_rotation_max_deg: float | None = None,
) -> CraneGeometry:
    """Monta a `CraneGeometry` FICTÍCIA; cada argumento substitui um valor padrão.

    Sem limites de giro por padrão (giro contínuo).
    """
    return CraneGeometry(
        boom_pivot_offset_m=boom_pivot_offset_m,
        boom_pivot_height=Length(boom_pivot_height_m),
        boom_length_min=Length(boom_length_min_m),
        boom_length_max=Length(boom_length_max_m),
        boom_angle_min=Angle(boom_angle_min_deg),
        boom_angle_max=Angle(boom_angle_max_deg),
        cable_length_min=Length(cable_length_min_m),
        cable_length_max=None if cable_length_max_m is None else Length(cable_length_max_m),
        turret_rotation_min=(
            None if turret_rotation_min_deg is None else Angle(turret_rotation_min_deg)
        ),
        turret_rotation_max=(
            None if turret_rotation_max_deg is None else Angle(turret_rotation_max_deg)
        ),
    )


def state_ficticio(
    *,
    boom_length_m: float = BOOM_LENGTH_FICTICIO_M,
    boom_angle_deg: float = BOOM_ANGLE_FICTICIO_DEG,
    turret_rotation_deg: float = TURRET_ROTATION_FICTICIO_DEG,
    cable_length_m: float = CABLE_LENGTH_FICTICIO_M,
) -> OperationalState:
    """Monta um `OperationalState` FICTÍCIO; cada argumento substitui um valor padrão."""
    return OperationalState(
        boom_length=Length(boom_length_m),
        boom_angle=Angle(boom_angle_deg),
        turret_rotation=Angle(turret_rotation_deg),
        cable_length=Length(cable_length_m),
    )
