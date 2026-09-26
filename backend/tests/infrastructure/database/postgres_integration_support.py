"""Apoio aos testes de integração com PostgreSQL da TASK-022.

Mesmo padrão de `test_postgres_integration.py`: pula quando `DATABASE_URL` não está definida ou o
banco não responde, exceto com `REQUIRE_INTEGRATION_DB=1` (CI), quando falha em vez de pular.
"""

import os
from collections.abc import Iterator
from typing import NoReturn

import pytest
from sqlalchemy import Engine, inspect
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session, sessionmaker

from app.infrastructure.database.config import DatabaseConfigurationError, DatabaseSettings
from app.infrastructure.database.engine import create_database_engine

TASK_022_TABLES = (
    "manufacturers",
    "cranes",
    "crane_configurations",
    "load_charts",
    "load_chart_points",
)


def skip_or_fail(reason: str) -> NoReturn:
    if os.environ.get("REQUIRE_INTEGRATION_DB") == "1":
        pytest.fail(f"{reason} (REQUIRE_INTEGRATION_DB=1)")
    pytest.skip(reason)


def integration_engine() -> Iterator[Engine]:
    """Engine do PostgreSQL de `DATABASE_URL`, ou pula/falha se ele não estiver disponível."""
    try:
        settings = DatabaseSettings.from_environment()
    except DatabaseConfigurationError:
        skip_or_fail("DATABASE_URL não definida: teste de integração com PostgreSQL pulado")

    probe_settings = DatabaseSettings(url=settings.url.update_query_dict({"connect_timeout": "3"}))
    engine = create_database_engine(probe_settings)
    try:
        with engine.connect():
            pass
    except OperationalError:
        engine.dispose()
        skip_or_fail("PostgreSQL de DATABASE_URL não respondeu: teste de integração pulado")

    yield engine
    engine.dispose()


def rolled_back_session_factory(engine: Engine) -> Iterator[sessionmaker[Session]]:
    """Fábrica de sessões dentro de uma transação que é desfeita no fim do teste.

    Cada `commit` do repositório vira um `SAVEPOINT` liberado (`create_savepoint`), e o
    `ROLLBACK` final apaga tudo o que o teste gravou, sem sujar o banco.
    """
    if not all(inspect(engine).has_table(table) for table in TASK_022_TABLES):
        skip_or_fail("tabelas da TASK-022 ausentes: rode `uv run alembic upgrade head` antes")

    connection = engine.connect()
    transaction = connection.begin()
    try:
        yield sessionmaker(bind=connection, join_transaction_mode="create_savepoint")
    finally:
        transaction.rollback()
        connection.close()
