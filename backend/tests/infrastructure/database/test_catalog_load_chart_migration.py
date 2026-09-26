"""Migration da TASK-022: SQL gerado sem banco e, com PostgreSQL, subida, descida e sincronia.

Os testes offline rodam o Alembic em subprocesso (o `env.py` reconfigura o logging) com uma URL
FICTÍCIA. Os de integração seguem o padrão de `test_postgres_integration.py`.
"""

import os
import subprocess
import sys
from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic.autogenerate import compare_metadata
from alembic.runtime.migration import MigrationContext
from sqlalchemy import Engine, func, inspect, select, table

import app.infrastructure.database.models  # noqa: F401  (registra as tabelas em Base.metadata)
from app.infrastructure.database.base import Base
from app.infrastructure.database.config import DATABASE_URL_ENV_VAR
from tests.infrastructure.database.postgres_integration_support import (
    TASK_022_TABLES,
    integration_engine,
    skip_or_fail,
)

BACKEND_DIR = Path(__file__).resolve().parents[3]
URL_FICTICIA = (
    "postgresql+psycopg://usuario_ficticio:senha_ficticia@host-ficticio.invalid:5432/banco"
)


def _run_alembic(*args: str, database_url: str | None) -> subprocess.CompletedProcess[str]:
    env = {key: value for key, value in os.environ.items() if key != DATABASE_URL_ENV_VAR}
    env["PYTHONIOENCODING"] = "utf-8"
    if database_url is not None:
        env[DATABASE_URL_ENV_VAR] = database_url
    return subprocess.run(
        [sys.executable, "-m", "alembic", *args],
        cwd=BACKEND_DIR,
        env=env,
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=120,
        check=False,
    )


# --- sem banco (modo offline) -------------------------------------------------------------


def test_offline_upgrade_sql_creates_the_tables_and_constraints() -> None:
    result = _run_alembic("upgrade", "head", "--sql", database_url=URL_FICTICIA)

    assert result.returncode == 0, result.stdout + result.stderr
    sql = result.stdout
    for name in TASK_022_TABLES:
        assert f"CREATE TABLE {name} (" in sql
    assert (
        "CREATE UNIQUE INDEX uq_load_charts_one_active_per_configuration "
        "ON load_charts (configuration_id) WHERE status = 'ACTIVE'"
    ) in sql
    assert (
        "CONSTRAINT uq_load_charts_configuration_id_version UNIQUE (configuration_id, version)"
        in (sql)
    )
    assert "REFERENCES load_charts (id) ON DELETE CASCADE" in sql
    assert sql.count("ON DELETE RESTRICT") == 3
    assert "max_capacity_kg DOUBLE PRECISION NOT NULL" in sql


def test_offline_downgrade_sql_drops_every_table() -> None:
    result = _run_alembic("downgrade", "head:base", "--sql", database_url=URL_FICTICIA)

    assert result.returncode == 0, result.stdout + result.stderr
    for name in TASK_022_TABLES:
        assert f"DROP TABLE {name};" in result.stdout


# --- com PostgreSQL -----------------------------------------------------------------------


@pytest.fixture
def engine() -> Iterator[Engine]:
    yield from integration_engine()


def _database_url(engine: Engine) -> str:
    return engine.url.render_as_string(hide_password=False)


def _existing_tables(engine: Engine) -> set[str]:
    return set(inspect(engine).get_table_names()) & set(TASK_022_TABLES)


def _model_differences(engine: Engine) -> list[object]:
    with engine.connect() as connection:
        context = MigrationContext.configure(connection)
        return list(compare_metadata(context, Base.metadata))


@pytest.mark.integration
def test_migration_goes_up_and_down_and_matches_the_models(engine: Engine) -> None:
    url = _database_url(engine)
    upgrade = _run_alembic("upgrade", "head", database_url=url)
    assert upgrade.returncode == 0, upgrade.stdout + upgrade.stderr

    # A descida apaga as tabelas: só roda com elas vazias, para não destruir um banco local com
    # dados (no CI o banco é descartável e os outros testes desfazem o que gravam).
    with engine.connect() as connection:
        rows = sum(
            connection.execute(select(func.count()).select_from(table(name))).scalar_one()
            for name in TASK_022_TABLES
        )
    if rows:
        skip_or_fail(f"as tabelas da TASK-022 têm {rows} linha(s): descida não testada")

    try:
        downgrade = _run_alembic("downgrade", "base", database_url=url)
        assert downgrade.returncode == 0, downgrade.stdout + downgrade.stderr
        assert _existing_tables(engine) == set()
    finally:
        # Deixa o banco em `head` mesmo se algo acima falhar: os outros testes dependem disso.
        upgrade_again = _run_alembic("upgrade", "head", database_url=url)

    assert upgrade_again.returncode == 0, upgrade_again.stdout + upgrade_again.stderr
    assert _existing_tables(engine) == set(TASK_022_TABLES)
    assert _model_differences(engine) == []
