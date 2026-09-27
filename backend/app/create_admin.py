"""Cria o primeiro admin no servidor (ADR-016 § 2; TASK-038).

    python -m app.create_admin --username <nome> [--display-name <nome>]

- A senha vem da variável `ADMIN_PASSWORD` (se definida e não vazia) ou é pedida com `getpass`, duas
  vezes, sem eco. Nunca por argumento de linha de comando.
- **Idempotente**: se o `username` já existe (com qualquer perfil), mostra uma mensagem e sai com 0,
  sem trocar a senha nem mais nada. A existência é conferida antes de pedir a senha.
- Sem `--display-name`, o nome de exibição é o próprio `username`.
- Exit codes (como `app.demo_seed`): 0 criado ou já existia; 1 falha no banco; 2 configuração ou
  entrada inválida (sem `DATABASE_URL`, nome ou senha fora das regras, senhas diferentes).

Nenhuma mensagem repete a senha, a `DATABASE_URL` ou a mensagem do driver. É parte da raiz de
composição, como `app.main`: fica fora das camadas do import-linter.

No Docker Compose: `docker compose run --rm backend python -m app.create_admin --username admin`
(ver `docs/demo.md`).
"""

import argparse
import getpass
import os
import sys
from collections.abc import Callable, Mapping, Sequence
from typing import TextIO

from sqlalchemy.exc import SQLAlchemyError

from app.application.ports.session_repository import SessionRepository
from app.application.ports.user_repository import UsernameTakenError, UserRepository
from app.application.use_cases.manage_users import ManageUsers
from app.domain.entities.user import UserRole, normalize_username
from app.domain.exceptions.user_errors import InvalidUserError
from app.infrastructure.database.config import (
    DATABASE_URL_ENV_VAR,
    DatabaseConfigurationError,
    DatabaseSettings,
)
from app.infrastructure.database.engine import create_database_engine, create_session_factory
from app.infrastructure.repositories.sqlalchemy_user_repository import SqlAlchemyUserRepository
from app.infrastructure.repositories.sqlalchemy_user_session_repository import (
    SqlAlchemyUserSessionRepository,
)
from app.infrastructure.security.argon2_password_hasher import Argon2PasswordHasher

ADMIN_PASSWORD_ENV_VAR = "ADMIN_PASSWORD"

EXIT_OK = 0
EXIT_FAILURE = 1
EXIT_CONFIGURATION_ERROR = 2

type PasswordPrompt = Callable[[str], str]


class CreateAdminError(Exception):
    """Entrada inválida para o comando (vira exit 2)."""


def _parse_arguments(argv: Sequence[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="python -m app.create_admin",
        description=(
            "Cria o primeiro usuário ADMIN. A senha vem de ADMIN_PASSWORD ou é pedida sem eco. "
            "Se o usuário já existe, não altera nada."
        ),
    )
    parser.add_argument("--username", required=True, help="3–64 caracteres [a-z0-9._-]")
    parser.add_argument("--display-name", help="nome de exibição (padrão: o username)")
    return parser.parse_args(argv)


def _read_password(environ: Mapping[str, str], prompt: PasswordPrompt) -> str:
    from_environment = environ.get(ADMIN_PASSWORD_ENV_VAR, "")
    if from_environment:
        return from_environment
    try:
        password = prompt("Senha do admin: ")
        confirmation = prompt("Repita a senha: ")
    except EOFError:
        raise CreateAdminError(
            f"sem terminal para pedir a senha; defina {ADMIN_PASSWORD_ENV_VAR}"
        ) from None
    if password != confirmation:
        raise CreateAdminError("as senhas digitadas não conferem")
    return password


def create_admin(
    users: UserRepository,
    sessions: SessionRepository,
    *,
    username: str,
    display_name: str | None,
    environ: Mapping[str, str],
    prompt: PasswordPrompt,
    say: Callable[[str], None],
) -> None:
    """Cria o admin, ou avisa que o usuário já existe. Erros de entrada: `CreateAdminError`."""
    try:
        normalized = normalize_username(username)
    except InvalidUserError as error:
        raise CreateAdminError(str(error)) from None

    existing = users.get_credentials_by_username(normalized)
    if existing is not None:
        say(_already_exists_message(normalized, existing.user.role, existing.user.active))
        return

    password = _read_password(environ, prompt)
    manage = ManageUsers(users, sessions, Argon2PasswordHasher())
    try:
        user = manage.create_user(
            username=normalized,
            display_name=normalized if display_name is None else display_name,
            password=password,
            role=UserRole.ADMIN,
        )
    except InvalidUserError as error:
        raise CreateAdminError(str(error)) from None
    except UsernameTakenError:
        # Criado por outro processo entre a consulta e a gravação: segue idempotente.
        say(f"usuário {normalized!r} já existe; nada alterado (a senha não foi trocada).")
        return
    say(f"admin {user.username!r} criado (id {user.id}).")


def _already_exists_message(username: str, role: UserRole, active: bool) -> str:
    situation = "ativo" if active else "inativo"
    return (
        f"usuário {username!r} já existe (perfil {role.value}, {situation}); nada alterado "
        "(a senha não foi trocada)."
    )


def main(
    argv: Sequence[str] | None = None,
    *,
    environ: Mapping[str, str] | None = None,
    out: TextIO | None = None,
    prompt: PasswordPrompt = getpass.getpass,
) -> int:
    """Linha de comando: `python -m app.create_admin`. Devolve o exit code."""
    arguments = _parse_arguments(argv)
    source = os.environ if environ is None else environ
    stream = sys.stdout if out is None else out

    def say(text: str) -> None:
        print(text, file=stream)

    if not source.get(DATABASE_URL_ENV_VAR, "").strip():
        say(
            f"ERRO: defina {DATABASE_URL_ENV_VAR}: o admin é gravado no banco (ver .env.example). "
            "Sem banco a API não tem login (ADR-016 § 5)."
        )
        return EXIT_CONFIGURATION_ERROR
    try:
        settings = DatabaseSettings.from_environment(source)
    except DatabaseConfigurationError as error:
        say(f"ERRO: {error}")
        return EXIT_CONFIGURATION_ERROR

    engine = create_database_engine(settings)
    try:
        session_factory = create_session_factory(engine)
        create_admin(
            SqlAlchemyUserRepository(session_factory),
            SqlAlchemyUserSessionRepository(session_factory),
            username=arguments.username,
            display_name=arguments.display_name,
            environ=source,
            prompt=prompt,
            say=say,
        )
    except CreateAdminError as error:
        say(f"ERRO: {error}")
        return EXIT_CONFIGURATION_ERROR
    except SQLAlchemyError as error:
        say(
            f"ERRO: falha no banco ({type(error).__name__}). Confira se o PostgreSQL está no ar e "
            "se as migrations foram aplicadas (alembic upgrade head)."
        )
        return EXIT_FAILURE
    finally:
        engine.dispose()
    return EXIT_OK


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
