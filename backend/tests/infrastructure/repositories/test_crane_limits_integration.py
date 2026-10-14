"""Limites do modelo no PostgreSQL (TASK-051; RN-011).

Marcador `integration`: precisa do banco em `head`. Cada teste roda numa transação desfeita no fim.
Dados FICTÍCIOS (ADR-012).
"""

from collections.abc import Iterator
from dataclasses import replace

import pytest
from sqlalchemy import Engine, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from app.domain.value_objects.crane_limits import CraneLimits
from app.infrastructure.repositories.sqlalchemy_crane_catalog_repository import (
    SqlAlchemyCraneCatalogRepository,
)
from tests.infrastructure.database.postgres_integration_support import (
    integration_engine,
    rolled_back_session_factory,
)
from tests.infrastructure.repositories.catalog_ficticio import (
    CRANE_FICTICIO,
    MANUFACTURER_FICTICIO,
    configuration_ficticia,
)

pytestmark = pytest.mark.integration


@pytest.fixture
def engine() -> Iterator[Engine]:
    yield from integration_engine()


@pytest.fixture
def session_factory(engine: Engine) -> Iterator[sessionmaker[Session]]:
    yield from rolled_back_session_factory(engine)


@pytest.fixture
def catalog(session_factory: sessionmaker[Session]) -> SqlAlchemyCraneCatalogRepository:
    repository = SqlAlchemyCraneCatalogRepository(session_factory)
    repository.add_manufacturer(MANUFACTURER_FICTICIO)
    return repository


def test_a_crane_without_limits_is_stored_with_the_defaults(
    catalog: SqlAlchemyCraneCatalogRepository,
) -> None:
    catalog.add_crane(CRANE_FICTICIO)

    assert catalog.get_crane(CRANE_FICTICIO.id) == CRANE_FICTICIO
    assert CRANE_FICTICIO.limits == CraneLimits(100.0, 90.0, 1.0, 3.0)


def test_limits_are_stored_updated_and_listed(catalog: SqlAlchemyCraneCatalogRepository) -> None:
    limits = CraneLimits(capacity_limit_percent=85.0, warning_band_percent=75.0)
    catalog.add_crane(replace(CRANE_FICTICIO, limits=limits))
    assert catalog.get_crane(CRANE_FICTICIO.id) == replace(CRANE_FICTICIO, limits=limits)

    new_limits = CraneLimits(60.0, 50.0, 0.5, 2.0)
    assert catalog.update_crane(replace(CRANE_FICTICIO, limits=new_limits)) is True

    assert catalog.get_crane(CRANE_FICTICIO.id) == replace(CRANE_FICTICIO, limits=new_limits)
    assert catalog.list_cranes() == [replace(CRANE_FICTICIO, limits=new_limits)]


def test_the_provider_returns_the_limits_of_the_crane_of_the_configuration(
    catalog: SqlAlchemyCraneCatalogRepository,
) -> None:
    limits = CraneLimits(capacity_limit_percent=70.0)
    catalog.add_crane(replace(CRANE_FICTICIO, limits=limits))
    catalog.add_configuration(configuration_ficticia())

    assert catalog.get_crane_limits(configuration_ficticia().id) == limits
    assert catalog.get_crane_limits("CFG-FICTICIA-INEXISTENTE") is None


def test_the_database_rejects_limits_out_of_range(
    catalog: SqlAlchemyCraneCatalogRepository, session_factory: sessionmaker[Session]
) -> None:
    catalog.add_crane(CRANE_FICTICIO)

    for column, value in (
        ("capacity_limit_percent", 0),
        ("capacity_limit_percent", 101),
        ("warning_band_percent", 0),
        ("max_ground_slope_deg", -1),
        ("max_leveling_deg", 46),
    ):
        with pytest.raises(IntegrityError), session_factory.begin() as session:
            session.execute(
                text(f"UPDATE cranes SET {column} = :value WHERE id = :id"),
                {"value": value, "id": CRANE_FICTICIO.id},
            )
