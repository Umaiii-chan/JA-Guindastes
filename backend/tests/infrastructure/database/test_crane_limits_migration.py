"""Migration da TASK-051 (limites do modelo em `cranes`): SQL gerado sem banco. FICTÍCIO (ADR-012).

A subida até `head` e a sincronia com os modelos (`compare_metadata`) ficam em
`test_catalog_load_chart_migration.py`, que roda a cadeia inteira com PostgreSQL.
"""

from tests.infrastructure.database.test_catalog_load_chart_migration import (
    URL_FICTICIA,
    _run_alembic,
)

TASK_046 = "b4e1d7c93a52"
TASK_051 = "e7a3c915d2b8"


def test_offline_upgrade_adds_the_four_limits_with_defaults_and_checks() -> None:
    result = _run_alembic("upgrade", f"{TASK_046}:{TASK_051}", "--sql", database_url=URL_FICTICIA)

    assert result.returncode == 0, result.stdout + result.stderr
    sql = result.stdout
    assert "CREATE TABLE" not in sql
    assert (
        "ALTER TABLE cranes ADD COLUMN capacity_limit_percent DOUBLE PRECISION DEFAULT 100 NOT NULL"
    ) in sql
    assert (
        "ALTER TABLE cranes ADD COLUMN warning_band_percent DOUBLE PRECISION DEFAULT 90 NOT NULL"
    ) in sql
    assert (
        "ALTER TABLE cranes ADD COLUMN max_ground_slope_deg DOUBLE PRECISION DEFAULT 1.0 NOT NULL"
    ) in sql
    assert (
        "ALTER TABLE cranes ADD COLUMN max_leveling_deg DOUBLE PRECISION DEFAULT 3.0 NOT NULL"
    ) in sql
    assert "CHECK (capacity_limit_percent >= 1 AND capacity_limit_percent <= 100)" in sql
    assert "CHECK (warning_band_percent >= 1 AND warning_band_percent <= 100)" in sql
    assert "CHECK (max_ground_slope_deg >= 0 AND max_ground_slope_deg <= 45)" in sql
    assert "CHECK (max_leveling_deg >= 0 AND max_leveling_deg <= 45)" in sql


def test_offline_downgrade_drops_only_the_new_columns() -> None:
    result = _run_alembic("downgrade", f"{TASK_051}:{TASK_046}", "--sql", database_url=URL_FICTICIA)

    assert result.returncode == 0, result.stdout + result.stderr
    sql = result.stdout
    assert "DROP TABLE" not in sql
    for column in (
        "capacity_limit_percent",
        "warning_band_percent",
        "max_ground_slope_deg",
        "max_leveling_deg",
    ):
        assert f"ALTER TABLE cranes DROP COLUMN {column}" in sql
