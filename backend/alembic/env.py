"""Ambiente do Alembic (TASK-011).

- A URL do banco vem de `DATABASE_URL`, validada por `DatabaseSettings`; `alembic.ini` não guarda
  URL nem credencial.
- O autogenerate compara o banco com `Base.metadata`. Os módulos com modelos ORM precisam estar
  importados quando este arquivo roda; ainda não há nenhum (as tabelas entram com cada caso de uso).
"""

from logging.config import fileConfig

from alembic import context
from alembic.util import CommandError
from sqlalchemy import URL, create_engine, pool

from app.infrastructure.database.base import Base
from app.infrastructure.database.config import DatabaseConfigurationError, DatabaseSettings

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def _database_url() -> URL:
    try:
        return DatabaseSettings.from_environment().url
    except DatabaseConfigurationError as error:
        # CommandError vira "FAILED: <mensagem>" no terminal, sem traceback.
        raise CommandError(str(error)) from None


def run_migrations_offline() -> None:
    """Gera o SQL das migrations sem conectar ao banco (`alembic upgrade head --sql`)."""
    context.configure(
        url=_database_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Aplica as migrations conectando ao banco de `DATABASE_URL`."""
    connectable = create_engine(_database_url(), poolclass=pool.NullPool)

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
