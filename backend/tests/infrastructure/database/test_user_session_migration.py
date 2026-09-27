"""Migration da TASK-038 (`app_user`, `user_session`): SQL gerado sem banco.

A subida, a descida e a sincronia com os modelos, com PostgreSQL, ficam no teste de integração de
`test_catalog_load_chart_migration.py`, que roda a cadeia inteira até `head` e compara
`Base.metadata` (que inclui os modelos de usuário) com o banco.
"""

from tests.infrastructure.database.test_catalog_load_chart_migration import (
    URL_FICTICIA,
    _run_alembic,
)

TASK_038_TABLES = ("app_user", "user_session")


def test_offline_upgrade_creates_the_user_and_session_tables() -> None:
    result = _run_alembic(
        "upgrade", "1f4cfaff16e8:7c2e9a4d1b36", "--sql", database_url=URL_FICTICIA
    )

    assert result.returncode == 0, result.stdout + result.stderr
    sql = result.stdout
    for name in TASK_038_TABLES:
        assert f"CREATE TABLE {name} (" in sql
    # Só as tabelas novas: a migration da TASK-022 não é repetida nem alterada.
    assert "CREATE TABLE manufacturers" not in sql
    assert "CONSTRAINT uq_app_user_username UNIQUE (username)" in sql
    assert "CONSTRAINT ck_app_user_role_valid CHECK (role IN ('ADMIN', 'OPERATOR'))" in sql
    assert "REFERENCES app_user (id) ON DELETE CASCADE" in sql
    assert "token_hash VARCHAR(64) NOT NULL" in sql
    assert "expires_at TIMESTAMP WITH TIME ZONE NOT NULL" in sql
    assert "CREATE INDEX ix_user_session_user_id ON user_session (user_id)" in sql
    # O token nunca é gravado, só o hash; a senha, só como hash.
    assert " token " not in sql
    assert "password_hash VARCHAR NOT NULL" in sql


def test_offline_downgrade_drops_only_the_new_tables() -> None:
    result = _run_alembic(
        "downgrade", "7c2e9a4d1b36:1f4cfaff16e8", "--sql", database_url=URL_FICTICIA
    )

    assert result.returncode == 0, result.stdout + result.stderr
    for name in TASK_038_TABLES:
        assert f"DROP TABLE {name};" in result.stdout
    assert "DROP TABLE manufacturers" not in result.stdout
