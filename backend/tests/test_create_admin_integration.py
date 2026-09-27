"""`python -m app.create_admin` contra um PostgreSQL real (marcador `integration`; TASK-038).

Grava de verdade (o comando abre as próprias conexões) e apaga o usuário no fim. Senha FICTÍCIA.
"""

import io
import uuid
from collections.abc import Iterator

import pytest
from sqlalchemy import Engine, inspect, text

from app.create_admin import EXIT_OK, main
from app.infrastructure.database.engine import create_session_factory
from app.infrastructure.repositories.sqlalchemy_user_repository import SqlAlchemyUserRepository
from tests.infrastructure.database.postgres_integration_support import (
    integration_engine,
    skip_or_fail,
)

pytestmark = pytest.mark.integration

SENHA_FICTICIA = "senha-ficticia-create-admin"


def no_prompt(_: str) -> str:
    raise AssertionError("a senha não deveria ser pedida")


@pytest.fixture
def engine() -> Iterator[Engine]:
    for engine in integration_engine():
        if not inspect(engine).has_table("app_user"):
            skip_or_fail("tabelas da TASK-038 ausentes: rode `uv run alembic upgrade head` antes")
        yield engine


def test_creates_the_admin_once_and_keeps_the_password(engine: Engine) -> None:
    username = f"t038-cli-{uuid.uuid4().hex[:12]}"
    environ = {
        "DATABASE_URL": engine.url.render_as_string(hide_password=False),
        "ADMIN_PASSWORD": SENHA_FICTICIA,
    }
    users = SqlAlchemyUserRepository(create_session_factory(engine))
    try:
        first = io.StringIO()
        assert main(["--username", username], environ=environ, out=first) == EXIT_OK
        created = users.get_credentials_by_username(username)
        assert created is not None
        assert created.user.role.value == "ADMIN"
        assert SENHA_FICTICIA not in first.getvalue()

        second = io.StringIO()
        environ["ADMIN_PASSWORD"] = "outra-senha-ficticia"
        code = main(["--username", username], environ=environ, out=second, prompt=no_prompt)

        assert code == EXIT_OK
        assert "já existe" in second.getvalue()
        assert users.get_credentials_by_username(username) == created
    finally:
        with engine.begin() as connection:
            connection.execute(
                text("DELETE FROM app_user WHERE username = :username"), {"username": username}
            )
