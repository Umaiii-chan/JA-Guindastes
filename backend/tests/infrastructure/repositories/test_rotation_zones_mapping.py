"""Mapeamento modelo ↔ domínio das zonas de giro, do gancho e da zona da tabela (TASK-046). Sem
banco. Dados FICTÍCIOS (ADR-012)."""

import dataclasses

import pytest

from app.domain.entities.load_chart import LoadChartStatus
from app.domain.exceptions.domain_errors import InvalidRotationZonesError
from app.domain.value_objects.mass import Mass
from app.infrastructure.repositories.sqlalchemy_crane_catalog_repository import (
    configuration_from_model,
    configuration_to_model,
    rotation_zones_from_json,
    rotation_zones_to_json,
)
from app.infrastructure.repositories.sqlalchemy_load_chart_repository import (
    load_chart_from_model,
    load_chart_to_model,
)
from tests.fixtures.load_chart_ficticio import build_load_chart_ficticio
from tests.fixtures.rotation_zones_ficticias import (
    GANCHO_FICTICIO_KG,
    ZONA_FRONTAL_FICTICIA,
    zonas_ficticias,
    zonas_payload_ficticio,
)
from tests.infrastructure.repositories.catalog_ficticio import (
    SOURCE_FICTICIA,
    configuration_ficticia,
)


def test_zones_become_a_json_list_in_declared_order() -> None:
    assert rotation_zones_to_json(zonas_ficticias()) == zonas_payload_ficticio()
    assert rotation_zones_from_json(zonas_payload_ficticio()) == zonas_ficticias()
    assert rotation_zones_to_json(None) is None
    assert rotation_zones_from_json(None) is None


def test_incoherent_zones_in_the_database_are_not_accepted_silently() -> None:
    overlapping = zonas_payload_ficticio()
    overlapping[0]["end_deg"] = 90.0

    with pytest.raises(InvalidRotationZonesError):
        rotation_zones_from_json(overlapping)


def test_configuration_round_trip_keeps_zones_and_hook_block() -> None:
    configuration = dataclasses.replace(
        configuration_ficticia(),
        rotation_zones=zonas_ficticias(),
        hook_block_weight=Mass(GANCHO_FICTICIO_KG),
    )

    model = configuration_to_model(configuration)

    assert model.hook_block_weight_kg == GANCHO_FICTICIO_KG
    assert configuration_from_model(model) == configuration


def test_configuration_without_zones_and_hook_block_maps_to_nulls() -> None:
    model = configuration_to_model(configuration_ficticia())

    assert model.rotation_zones is None
    assert model.hook_block_weight_kg is None
    assert configuration_from_model(model) == configuration_ficticia()


def test_load_chart_round_trip_keeps_the_zone() -> None:
    chart = dataclasses.replace(
        build_load_chart_ficticio(status=LoadChartStatus.DRAFT),
        rotation_zone_code=ZONA_FRONTAL_FICTICIA,
    )

    model = load_chart_to_model(chart, SOURCE_FICTICIA)

    assert model.rotation_zone_code == ZONA_FRONTAL_FICTICIA
    assert load_chart_from_model(model) == chart
