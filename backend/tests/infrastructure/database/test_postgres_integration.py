"""Integração com um PostgreSQL real (TASK-011).

Pulado quando `DATABASE_URL` não está definida ou o banco não responde, exceto com
`REQUIRE_INTEGRATION_DB=1` (usado no CI, que tem um PostgreSQL de serviço desde a TASK-018): aí o
teste falha em vez de pular. Para rodar localmente, suba o banco e exporte as variáveis
(docs/development-guide.md §§ 3 e 6).
"""

import os
from collections.abc import Iterator

import pytest
from sqlalchemy import Engine, text
from sqlalchemy.exc import OperationalError

from app.infrastructure.database.config import DatabaseConfigurationError, DatabaseSettings
from app.infrastructure.database.engine import create_database_engine, create_session_factory

pytestmark = pytest.mark.integration


def _skip_or_fail(reason: str) -> None:
    if os.environ.get("REQUIRE_INTEGRATION_DB") == "1":
        pytest.fail(f"{reason} (REQUIRE_INTEGRATION_DB=1)")
    pytest.skip(reason)


@pytest.fixture
def engine() -> Iterator[Engine]:
    try:
        settings = DatabaseSettings.from_environment()
    except DatabaseConfigurationError:
        _skip_or_fail("DATABASE_URL não definida: teste de integração com PostgreSQL pulado")

    # Timeout curto só para decidir se o banco está no ar; não muda a configuração da aplicação.
    probe_settings = DatabaseSettings(url=settings.url.update_query_dict({"connect_timeout": "3"}))
    engine = create_database_engine(probe_settings)
    try:
        with engine.connect():
            pass
    except OperationalError:
        engine.dispose()
        _skip_or_fail("PostgreSQL de DATABASE_URL não respondeu: teste de integração pulado")

    yield engine
    engine.dispose()


def test_select_1_through_engine(engine: Engine) -> None:
    with engine.connect() as connection:
        assert connection.execute(text("SELECT 1")).scalar_one() == 1


def test_select_1_through_session(engine: Engine) -> None:
    session_factory = create_session_factory(engine)
    with session_factory() as session:
        assert session.execute(text("SELECT 1")).scalar_one() == 1
