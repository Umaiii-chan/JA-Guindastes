"""Migration da TASK-056 (catálogo de acessórios): SQL gerado sem banco. Dados FICTÍCIOS (ADR-012).

A subida até `head` e a sincronia com os modelos (`compare_metadata`) ficam no teste de integração
de `test_catalog_load_chart_migration.py`, que roda a cadeia inteira.
"""

from tests.infrastructure.database.test_catalog_load_chart_migration import (
    URL_FICTICIA,
    _run_alembic,
)

PREVIOUS = "b4e1d7c93a52"
TASK_056 = "03845e55f0a8"


def test_offline_upgrade_creates_only_the_accessories_table() -> None:
    result = _run_alembic("upgrade", f"{PREVIOUS}:{TASK_056}", "--sql", database_url=URL_FICTICIA)

    assert result.returncode == 0, result.stdout + result.stderr
    sql = result.stdout
    assert sql.count("CREATE TABLE") == 1
    assert "CREATE TABLE accessories" in sql
    assert "weight_kg DOUBLE PRECISION NOT NULL" in sql
    assert "rigging_height_m DOUBLE PRECISION NOT NULL" in sql
    assert "model_file VARCHAR" in sql
    assert "CONSTRAINT ck_accessories_weight_kg_range CHECK" in sql
    assert "ALTER TABLE" not in sql


def test_offline_downgrade_drops_the_accessories_table() -> None:
    result = _run_alembic("downgrade", f"{TASK_056}:{PREVIOUS}", "--sql", database_url=URL_FICTICIA)

    assert result.returncode == 0, result.stdout + result.stderr
    assert "DROP TABLE accessories" in result.stdout
