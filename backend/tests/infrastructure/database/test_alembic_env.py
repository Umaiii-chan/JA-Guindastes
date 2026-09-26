"""Ambiente do Alembic lê `DATABASE_URL` (TASK-011). Não precisa de banco.

Usa o modo offline (`alembic upgrade head --sql`), que gera SQL sem conectar. Roda o Alembic em
subprocesso porque o `env.py` reconfigura o logging do processo (`fileConfig`).
A URL é FICTÍCIA.
"""

import os
import subprocess
import sys
from pathlib import Path

from app.infrastructure.database.config import DATABASE_URL_ENV_VAR

BACKEND_DIR = Path(__file__).resolve().parents[3]
URL_FICTICIA = (
    "postgresql+psycopg://usuario_ficticio:senha_ficticia@host-ficticio.invalid:5432/banco"
)


def _run_alembic_offline(database_url: str | None) -> subprocess.CompletedProcess[str]:
    env = {key: value for key, value in os.environ.items() if key != DATABASE_URL_ENV_VAR}
    env["PYTHONIOENCODING"] = "utf-8"
    if database_url is not None:
        env[DATABASE_URL_ENV_VAR] = database_url
    return subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head", "--sql"],
        cwd=BACKEND_DIR,
        env=env,
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=60,
        check=False,
    )


def test_alembic_fails_with_clear_message_without_database_url() -> None:
    result = _run_alembic_offline(None)

    assert result.returncode != 0
    assert "FAILED" in result.stdout
    assert "DATABASE_URL não está definida" in result.stdout


def test_alembic_uses_database_url_in_offline_mode() -> None:
    result = _run_alembic_offline(URL_FICTICIA)

    assert result.returncode == 0, result.stdout + result.stderr
    assert "PostgresqlImpl" in result.stderr
    assert "BEGIN;" in result.stdout
    assert "COMMIT;" in result.stdout
