"""Engine, fábrica de sessões e `Base` declarativa (TASK-011). Não precisa de banco.

A URL é FICTÍCIA e aponta para um host inexistente: se algo tentasse conectar, o teste falharia.
"""

import psycopg
import pytest
from sqlalchemy.orm import Session

from app.infrastructure.database.base import NAMING_CONVENTION, Base
from app.infrastructure.database.config import DATABASE_URL_ENV_VAR, DatabaseSettings
from app.infrastructure.database.engine import create_database_engine, create_session_factory

URL_FICTICIA = (
    "postgresql+psycopg://usuario_ficticio:senha_ficticia@host-ficticio.invalid:5432/banco"
)


@pytest.fixture
def settings() -> DatabaseSettings:
    return DatabaseSettings.from_environment({DATABASE_URL_ENV_VAR: URL_FICTICIA})


@pytest.fixture
def forbid_connections(monkeypatch: pytest.MonkeyPatch) -> None:
    def fail_connect(*args: object, **kwargs: object) -> None:
        raise AssertionError("nenhuma conexão com o banco deveria ser aberta")

    monkeypatch.setattr(psycopg, "connect", fail_connect)
    monkeypatch.setattr(psycopg.Connection, "connect", fail_connect)


@pytest.mark.usefixtures("forbid_connections")
def test_valid_url_creates_engine_without_connecting(settings: DatabaseSettings) -> None:
    engine = create_database_engine(settings)
    try:
        assert engine.url.drivername == "postgresql+psycopg"
        assert engine.url.host == "host-ficticio.invalid"
        assert engine.pool.checkedout() == 0
    finally:
        engine.dispose()


@pytest.mark.usefixtures("forbid_connections")
def test_session_factory_creates_sessions_bound_to_engine_without_connecting(
    settings: DatabaseSettings,
) -> None:
    engine = create_database_engine(settings)
    try:
        session_factory = create_session_factory(engine)
        with session_factory() as session:
            assert isinstance(session, Session)
            assert session.get_bind() is engine
        assert engine.pool.checkedout() == 0
    finally:
        engine.dispose()


def test_base_metadata_uses_the_naming_convention() -> None:
    for key, template in NAMING_CONVENTION.items():
        assert Base.metadata.naming_convention[key] == template
