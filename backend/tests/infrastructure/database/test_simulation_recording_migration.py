"""Migration da TASK-057 (`simulation_recordings`): SQL gerado sem banco.

A subida, a descida e a sincronia com os modelos, com PostgreSQL, ficam no teste de integração de
`test_catalog_load_chart_migration.py` (a cadeia até `head`, comparando `Base.metadata`).
"""

from tests.infrastructure.database.test_catalog_load_chart_migration import (
    URL_FICTICIA,
    _run_alembic,
)


def test_offline_upgrade_creates_the_recordings_table() -> None:
    result = _run_alembic(
        "upgrade", "b4e1d7c93a52:d7a3c5e8f1b4", "--sql", database_url=URL_FICTICIA
    )

    assert result.returncode == 0, result.stdout + result.stderr
    sql = result.stdout
    assert "CREATE TABLE simulation_recordings (" in sql
    assert "frames_gzip BYTEA NOT NULL" in sql
    assert "REFERENCES app_user (id)" in sql
    assert "CREATE TABLE app_user" not in sql


def test_offline_downgrade_drops_only_the_recordings_table() -> None:
    result = _run_alembic(
        "downgrade", "d7a3c5e8f1b4:b4e1d7c93a52", "--sql", database_url=URL_FICTICIA
    )

    assert result.returncode == 0, result.stdout + result.stderr
    assert "DROP TABLE simulation_recordings;" in result.stdout
