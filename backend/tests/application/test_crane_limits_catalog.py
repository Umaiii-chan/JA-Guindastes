"""Limites do modelo no catálogo (TASK-051; RN-011, RN-013). Dados FICTÍCIOS (ADR-012)."""

import pytest

from app.application.use_cases.crane_catalog import CatalogEntryNotFoundError, ManageCraneCatalog
from app.domain.value_objects.crane_limits import CraneLimits
from tests.fixtures.crane_catalog_ficticio import (
    MODELO_FICTICIO_NOME,
    InMemoryCraneCatalog,
    SequentialIds,
)


def make_catalog() -> tuple[ManageCraneCatalog, str]:
    catalog = ManageCraneCatalog(InMemoryCraneCatalog(), SequentialIds())
    manufacturer = catalog.create_manufacturer("Fabricante FICTÍCIO")
    return catalog, manufacturer.id


def test_a_new_crane_gets_the_default_limits() -> None:
    catalog, manufacturer_id = make_catalog()

    crane = catalog.create_crane(manufacturer_id, MODELO_FICTICIO_NOME)

    assert crane.limits == CraneLimits(100.0, 90.0, 1.0, 3.0)
    assert catalog.get_crane(crane.id).limits == crane.limits


def test_a_new_crane_keeps_the_limits_informed() -> None:
    catalog, manufacturer_id = make_catalog()
    limits = CraneLimits(capacity_limit_percent=85.0, warning_band_percent=80.0)

    crane = catalog.create_crane(manufacturer_id, MODELO_FICTICIO_NOME, limits)

    assert catalog.get_crane(crane.id).limits == limits


def test_update_crane_changes_only_the_limits_when_no_name_comes() -> None:
    catalog, manufacturer_id = make_catalog()
    crane = catalog.create_crane(manufacturer_id, MODELO_FICTICIO_NOME)
    limits = CraneLimits(capacity_limit_percent=70.0, max_ground_slope_deg=2.0)

    updated = catalog.update_crane(crane.id, limits=limits)

    assert updated.model_name == MODELO_FICTICIO_NOME
    assert updated.limits == limits
    assert catalog.get_crane(crane.id) == updated


def test_update_crane_changes_only_the_name_when_no_limits_come() -> None:
    catalog, manufacturer_id = make_catalog()
    limits = CraneLimits(capacity_limit_percent=70.0)
    crane = catalog.create_crane(manufacturer_id, MODELO_FICTICIO_NOME, limits)

    updated = catalog.update_crane(crane.id, model_name="Modelo FICTÍCIO B")

    assert updated.model_name == "Modelo FICTÍCIO B"
    assert updated.limits == limits


def test_update_crane_needs_at_least_one_field() -> None:
    catalog, manufacturer_id = make_catalog()
    crane = catalog.create_crane(manufacturer_id, MODELO_FICTICIO_NOME)

    with pytest.raises(ValueError):
        catalog.update_crane(crane.id)


def test_update_crane_of_an_unknown_id_is_not_found() -> None:
    catalog, _ = make_catalog()

    with pytest.raises(CatalogEntryNotFoundError):
        catalog.update_crane("GUI-INEXISTENTE", limits=CraneLimits())
