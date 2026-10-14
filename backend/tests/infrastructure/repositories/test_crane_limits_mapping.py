"""Mapeamento dos limites do modelo entre `Crane` e `CraneModel` (TASK-051). Sem banco; FICTÍCIO."""

from app.domain.value_objects.crane_limits import CraneLimits
from app.infrastructure.database.models.catalog import CraneModel
from app.infrastructure.repositories.sqlalchemy_crane_catalog_repository import (
    crane_from_model,
    crane_to_model,
    write_limit_columns,
)
from tests.infrastructure.repositories.catalog_ficticio import CRANE_FICTICIO


def test_limits_round_trip_through_the_model() -> None:
    limits = CraneLimits(
        capacity_limit_percent=85.0,
        warning_band_percent=75.0,
        max_ground_slope_deg=0.5,
        max_leveling_deg=2.0,
    )
    crane = CRANE_FICTICIO.__class__(
        id=CRANE_FICTICIO.id,
        manufacturer_id=CRANE_FICTICIO.manufacturer_id,
        model_name=CRANE_FICTICIO.model_name,
        limits=limits,
    )

    model = crane_to_model(crane)

    assert model.capacity_limit_percent == 85.0
    assert model.warning_band_percent == 75.0
    assert model.max_ground_slope_deg == 0.5
    assert model.max_leveling_deg == 2.0
    assert crane_from_model(model) == crane


def test_a_crane_without_limits_maps_the_defaults() -> None:
    model = crane_to_model(CRANE_FICTICIO)

    assert (
        model.capacity_limit_percent,
        model.warning_band_percent,
        model.max_ground_slope_deg,
        model.max_leveling_deg,
    ) == (100.0, 90.0, 1.0, 3.0)


def test_write_limit_columns_replaces_every_column() -> None:
    model = crane_to_model(CRANE_FICTICIO)

    write_limit_columns(model, CraneLimits(50.0, 40.0, 0.0, 0.0))

    assert crane_from_model(model).limits == CraneLimits(50.0, 40.0, 0.0, 0.0)


def test_the_orm_model_declares_the_range_checks_and_defaults() -> None:
    constraint_names = {
        str(constraint.name)
        for constraint in CraneModel.__table__.constraints
        if constraint.name is not None
    }

    assert {
        "ck_cranes_capacity_limit_percent_range",
        "ck_cranes_warning_band_percent_range",
        "ck_cranes_max_ground_slope_deg_range",
        "ck_cranes_max_leveling_deg_range",
    } <= constraint_names
    column = CraneModel.__table__.c.capacity_limit_percent
    assert column.nullable is False
    assert column.server_default is not None
