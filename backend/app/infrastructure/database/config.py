"""Configuração do banco de dados, lida da variável de ambiente `DATABASE_URL` (TASK-011).

A URL pode conter a senha do banco: nenhuma mensagem de erro deste módulo inclui o valor recebido
(docs/policies/security.md §§ 1 e 2). O `repr` de `sqlalchemy.engine.URL` já mascara a senha.
"""

import os
from collections.abc import Mapping
from dataclasses import dataclass

from sqlalchemy.engine import URL, make_url
from sqlalchemy.exc import ArgumentError

DATABASE_URL_ENV_VAR = "DATABASE_URL"

# PostgreSQL (ADR-007) com o driver psycopg 3. Com o esquema genérico "postgresql://" o SQLAlchemy
# escolheria outro driver, que não está instalado; exigir o nome completo dá um erro claro na hora.
SUPPORTED_DRIVERNAME = "postgresql+psycopg"
GENERIC_POSTGRESQL_DRIVERNAME = "postgresql"

_HOW_TO_CONFIGURE = (
    "Copie .env.example para .env, preencha os valores locais e exporte as variáveis no shell "
    "(ver docs/development-guide.md § 6)."
)


class DatabaseConfigurationError(Exception):
    """A configuração do banco está ausente ou inválida."""


@dataclass(frozen=True, slots=True)
class DatabaseSettings:
    """Configuração validada do banco."""

    url: URL

    @classmethod
    def from_environment(cls, environ: Mapping[str, str] | None = None) -> DatabaseSettings:
        """Lê e valida `DATABASE_URL` de `environ` (por padrão, `os.environ`)."""
        source = os.environ if environ is None else environ
        raw_url = source.get(DATABASE_URL_ENV_VAR, "").strip()
        if not raw_url:
            raise DatabaseConfigurationError(
                f"a variável de ambiente {DATABASE_URL_ENV_VAR} não está definida. "
                + _HOW_TO_CONFIGURE
            )

        try:
            url = make_url(raw_url)
        except ArgumentError:
            # `from None`: a exceção original pode citar o texto recebido, que pode ter senha.
            raise DatabaseConfigurationError(
                f"{DATABASE_URL_ENV_VAR} não é uma URL de banco válida. Formato esperado: "
                f"{SUPPORTED_DRIVERNAME}://<usuario>:<senha>@<host>:<porta>/<banco>."
            ) from None

        # O Render fornece `connectionString` com o esquema genérico `postgresql://`. Normalizamos
        # explicitamente para o único driver instalado, sem alterar usuário, senha, host ou query.
        if url.drivername == GENERIC_POSTGRESQL_DRIVERNAME:
            url = url.set(drivername=SUPPORTED_DRIVERNAME)
        elif url.drivername != SUPPORTED_DRIVERNAME:
            raise DatabaseConfigurationError(
                f"{DATABASE_URL_ENV_VAR} deve começar com '{SUPPORTED_DRIVERNAME}://' "
                f"(PostgreSQL com psycopg 3, ADR-007); recebido '{url.drivername}://'."
            )

        return cls(url=url)
