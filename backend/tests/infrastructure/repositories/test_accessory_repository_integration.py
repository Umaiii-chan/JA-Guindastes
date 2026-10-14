"""Repositório de acessórios (TASK-056) contra um PostgreSQL real (marcador `integration`).

Precisa do banco em `head`; cada teste roda numa transação desfeita no fim. Dados FICTÍCIOS.
"""

import dataclasses
from collections.abc import Iterator

import pytest
from sqlalchemy import Engine, inspect
from sqlalchemy.orm import Session, sessionmaker

from app.application.ports.accessory_repository import (
    AccessoryAlreadyExistsError,
    AccessoryRepository,
)
from app.domain.value_objects.mass import Mass
from app.infrastructure.repositories.sqlalchemy_accessory_repository import (
    SqlAlchemyAccessoryRepository,
)
from tests.fixtures.acessorios_ficticios import (
    CINTA_FICTICIA,
    GANCHO_ACESSORIO_FICTICIO,
    MANILHA_FICTICIA,
)
from tests.infrastructure.database.postgres_integration_support import (
    integration_engine,
    rolled_back_session_factory,
    skip_or_fail,
)

pytestmark = pytest.mark.integration


@pytest.fixture
def engine() -> Iterator[Engine]:
    yield from integration_engine()


@pytest.fixture
def repository(engine: Engine) -> Iterator[AccessoryRepository]:
    if not inspect(engine).has_table("accessories"):
        skip_or_fail("tabela accessories ausente: rode `uv run alembic upgrade head`")
    factory: sessionmaker[Session]
    for factory in rolled_back_session_factory(engine):
        yield SqlAlchemyAccessoryRepository(factory)


def test_round_trip_keeps_every_field(repository: AccessoryRepository) -> None:
    repository.add(MANILHA_FICTICIA)

    assert repository.get(MANILHA_FICTICIA.id) == MANILHA_FICTICIA


def test_duplicate_id_is_refused(repository: AccessoryRepository) -> None:
    repository.add(MANILHA_FICTICIA)

    with pytest.raises(AccessoryAlreadyExistsError):
        repository.add(MANILHA_FICTICIA)


def test_get_accessories_returns_only_the_existing_ids(repository: AccessoryRepository) -> None:
    repository.add(MANILHA_FICTICIA)
    repository.add(CINTA_FICTICIA)

    found = repository.get_accessories([MANILHA_FICTICIA.id, "ACC-INEXISTENTE"])

    assert found == {MANILHA_FICTICIA.id: MANILHA_FICTICIA}


def test_list_all_orders_by_name(repository: AccessoryRepository) -> None:
    for accessory in (MANILHA_FICTICIA, GANCHO_ACESSORIO_FICTICIO, CINTA_FICTICIA):
        repository.add(accessory)

    assert [item.name for item in repository.list_all()] == [
        "Cinta FICTÍCIA",
        "Manilha FICTÍCIA",
        "Moitão FICTÍCIO",
    ]


def test_update_and_delete_report_whether_the_id_exists(repository: AccessoryRepository) -> None:
    repository.add(MANILHA_FICTICIA)
    changed = dataclasses.replace(MANILHA_FICTICIA, weight=Mass(25.0), model_file=None)

    assert repository.update(changed) is True
    assert repository.get(MANILHA_FICTICIA.id) == changed
    assert repository.update(dataclasses.replace(changed, id="ACC-INEXISTENTE")) is False
    assert repository.delete(MANILHA_FICTICIA.id) is True
    assert repository.delete(MANILHA_FICTICIA.id) is False
