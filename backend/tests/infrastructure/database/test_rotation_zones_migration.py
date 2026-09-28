"""Migration da TASK-046 (zonas de giro e peso do gancho): SQL gerado sem banco e, com PostgreSQL,
a descida que não perde as tabelas sem zona.

A subida até `head` e a sincronia com os modelos (`compare_metadata`) ficam no teste de integração
de `test_catalog_load_chart_migration.py`, que roda a cadeia inteira. Dados FICTÍCIOS (ADR-012).
"""

from collections.abc import Iterator

import pytest
from sqlalchemy import Engine, text

from tests.infrastructure.database.postgres_integration_support import integration_engine
from tests.infrastructure.database.test_catalog_load_chart_migration import (
    URL_FICTICIA,
    _run_alembic,
)

PREVIOUS = "7c2e9a4d1b36"
TASK_046 = "b4e1d7c93a52"


def test_offline_upgrade_adds_zones_hook_block_and_the_index_per_zone() -> None:
    result = _run_alembic("upgrade", f"{PREVIOUS}:{TASK_046}", "--sql", database_url=URL_FICTICIA)

    assert result.returncode == 0, result.stdout + result.stderr
    sql = result.stdout
    # Só colunas novas: nenhuma tabela é recriada.
    assert "CREATE TABLE" not in sql
    assert "ALTER TABLE crane_configurations ADD COLUMN rotation_zones JSON" in sql
    assert (
        "ALTER TABLE crane_configurations ADD COLUMN hook_block_weight_kg DOUBLE PRECISION" in sql
    )
    assert "CHECK (hook_block_weight_kg >= 0 AND hook_block_weight_kg <= 100000)" in sql
    assert "ALTER TABLE load_charts ADD COLUMN rotation_zone_code VARCHAR(32)" in sql
    assert "CHECK (rotation_zone_code ~ '^[A-Z0-9_]{1,32}$')" in sql
    assert "DROP INDEX uq_load_charts_one_active_per_configuration;" in sql
    assert (
        "CREATE UNIQUE INDEX uq_load_charts_one_active_per_configuration_zone ON load_charts "
        "(configuration_id, coalesce(rotation_zone_code, '')) WHERE status = 'ACTIVE'"
    ) in sql


def test_offline_downgrade_keeps_charts_and_restores_one_active_per_configuration() -> None:
    result = _run_alembic("downgrade", f"{TASK_046}:{PREVIOUS}", "--sql", database_url=URL_FICTICIA)

    assert result.returncode == 0, result.stdout + result.stderr
    sql = result.stdout
    assert "DROP TABLE" not in sql
    assert "DELETE" not in sql
    assert (
        "UPDATE load_charts SET status = 'SUPERSEDED' "
        "WHERE status = 'ACTIVE' AND rotation_zone_code IS NOT NULL"
    ) in sql
    assert (
        "CREATE UNIQUE INDEX uq_load_charts_one_active_per_configuration ON load_charts "
        "(configuration_id) WHERE status = 'ACTIVE'"
    ) in sql
    assert "ALTER TABLE load_charts DROP COLUMN rotation_zone_code" in sql
    assert "ALTER TABLE crane_configurations DROP COLUMN rotation_zones" in sql
    assert "ALTER TABLE crane_configurations DROP COLUMN hook_block_weight_kg" in sql


# --- com PostgreSQL -----------------------------------------------------------------------

_IDS = {
    "manufacturer": "FAB-FICTICIO-MIGRACAO-046",
    "crane": "GUI-FICTICIO-MIGRACAO-046",
    "configuration": "CFG-FICTICIA-MIGRACAO-046",
}
_SHA = "0" * 64


@pytest.fixture
def engine() -> Iterator[Engine]:
    yield from integration_engine()


def _insert_fictitious_rows(engine: Engine) -> None:
    with engine.begin() as connection:
        connection.execute(
            text("INSERT INTO manufacturers (id, name) VALUES (:id, 'Fabricante FICTÍCIO')"),
            {"id": _IDS["manufacturer"]},
        )
        connection.execute(
            text(
                "INSERT INTO cranes (id, manufacturer_id, model_name) "
                "VALUES (:id, :manufacturer, 'Modelo FICTÍCIO')"
            ),
            {"id": _IDS["crane"], "manufacturer": _IDS["manufacturer"]},
        )
        connection.execute(
            text(
                "INSERT INTO crane_configurations (id, crane_id, name, hook_block_weight_kg) "
                "VALUES (:id, :crane, 'Configuração FICTÍCIA', 200)"
            ),
            {"id": _IDS["configuration"], "crane": _IDS["crane"]},
        )
        for chart_id, zone in (
            ("LC-FICTICIO-MIG-SEM-ZONA", None),
            ("LC-FICTICIO-MIG-FRONTAL", "FRONTAL"),
        ):
            connection.execute(
                text(
                    "INSERT INTO load_charts (id, configuration_id, version, status, "
                    "source_file_name, source_file_type, source_sha256, rotation_zone_code) "
                    "VALUES (:id, :configuration, :id, 'ACTIVE', 'ficticia.csv', 'text/csv', "
                    ":sha, :zone)"
                ),
                {
                    "id": chart_id,
                    "configuration": _IDS["configuration"],
                    "sha": _SHA,
                    "zone": zone,
                },
            )


def _delete_fictitious_rows(engine: Engine) -> None:
    with engine.begin() as connection:
        connection.execute(
            text("DELETE FROM load_charts WHERE configuration_id = :id"),
            {"id": _IDS["configuration"]},
        )
        connection.execute(
            text("DELETE FROM crane_configurations WHERE id = :id"), {"id": _IDS["configuration"]}
        )
        connection.execute(text("DELETE FROM cranes WHERE id = :id"), {"id": _IDS["crane"]})
        connection.execute(
            text("DELETE FROM manufacturers WHERE id = :id"), {"id": _IDS["manufacturer"]}
        )


@pytest.mark.integration
def test_downgrade_keeps_the_charts_without_zone(engine: Engine) -> None:
    url = engine.url.render_as_string(hide_password=False)
    upgrade = _run_alembic("upgrade", "head", database_url=url)
    assert upgrade.returncode == 0, upgrade.stdout + upgrade.stderr

    _insert_fictitious_rows(engine)
    try:
        downgrade = _run_alembic("downgrade", PREVIOUS, database_url=url)
        assert downgrade.returncode == 0, downgrade.stdout + downgrade.stderr
        with engine.connect() as connection:
            rows = dict(
                connection.execute(
                    text("SELECT id, status FROM load_charts WHERE configuration_id = :id"),
                    {"id": _IDS["configuration"]},
                ).all()
            )
        assert rows == {
            "LC-FICTICIO-MIG-SEM-ZONA": "ACTIVE",
            "LC-FICTICIO-MIG-FRONTAL": "SUPERSEDED",
        }
    finally:
        upgrade_again = _run_alembic("upgrade", "head", database_url=url)
        _delete_fictitious_rows(engine)

    assert upgrade_again.returncode == 0, upgrade_again.stdout + upgrade_again.stderr
