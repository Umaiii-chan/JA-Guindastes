"""Migration da TASK-052 (`scenario`): SQL gerado sem banco.

A subida, a descida e a sincronia com os modelos, com PostgreSQL, ficam no teste de integração de
`test_catalog_load_chart_migration.py`, que roda a cadeia até `head` e compara `Base.metadata`.
"""

from tests.infrastructure.database.test_catalog_load_chart_migration import (
    URL_FICTICIA,
    _run_alembic,
)


def test_offline_upgrade_creates_the_scenario_table() -> None:
    result = _run_alembic(
        "upgrade", "b4e1d7c93a52:d3a8f1c25e70", "--sql", database_url=URL_FICTICIA
    )

    assert result.returncode == 0, result.stdout + result.stderr
    sql = result.stdout
    assert "CREATE TABLE scenario (" in sql
    assert "spec JSONB NOT NULL" in sql
    assert "REFERENCES app_user (id) ON DELETE CASCADE" in sql
    assert "CREATE INDEX ix_scenario_author_user_id ON scenario (author_user_id)" in sql
    assert "CREATE TABLE app_user" not in sql


def test_offline_downgrade_drops_the_scenario_table() -> None:
    result = _run_alembic(
        "downgrade", "d3a8f1c25e70:b4e1d7c93a52", "--sql", database_url=URL_FICTICIA
    )

    assert result.returncode == 0, result.stdout + result.stderr
    assert "DROP TABLE scenario;" in result.stdout
    assert "DROP TABLE app_user" not in result.stdout
