"""Comando `python -m app.create_admin` (ADR-016 § 2; TASK-038). Senhas FICTÍCIAS.

`create_admin` com os repositórios em memória; `main` só nos caminhos sem banco (configuração). O
comando inteiro contra o PostgreSQL está em `tests/test_create_admin_integration.py`.
"""

import io
import os
import subprocess
import sys
from pathlib import Path

import pytest

from app.create_admin import (
    EXIT_CONFIGURATION_ERROR,
    CreateAdminError,
    create_admin,
    main,
)
from app.domain.entities.user import UserRole
from tests.fixtures.auth_ficticia import (
    ADMIN_FICTICIO_USERNAME,
    AuthFicticia,
)

SENHA_FICTICIA = "senha-ficticia-do-comando"
BACKEND_DIR = Path(__file__).resolve().parents[1]


def no_prompt(_: str) -> str:
    raise AssertionError("a senha não deveria ser pedida")


def run(
    auth: AuthFicticia,
    username: str,
    *,
    environ: dict[str, str] | None = None,
    answers: list[str] | None = None,
    display_name: str | None = None,
) -> list[str]:
    messages: list[str] = []
    pending = list(answers or [])

    def prompt(_: str) -> str:
        if not pending:
            raise EOFError
        return pending.pop(0)

    create_admin(
        auth.users,
        auth.sessions,
        username=username,
        display_name=display_name,
        environ=environ or {},
        prompt=prompt if answers is not None else no_prompt,
        say=messages.append,
    )
    return messages


def test_creates_the_admin_with_the_password_from_the_environment() -> None:
    auth = AuthFicticia()

    messages = run(auth, "Novo.Admin", environ={"ADMIN_PASSWORD": SENHA_FICTICIA})

    credentials = auth.users.get_credentials_by_username("novo.admin")
    assert credentials is not None
    assert credentials.user.role is UserRole.ADMIN
    assert credentials.user.active is True
    assert credentials.user.display_name == "novo.admin"
    assert credentials.password_hash.startswith("$argon2id$")
    assert len(messages) == 1 and "criado" in messages[0]
    assert SENHA_FICTICIA not in messages[0]


def test_asks_the_password_twice_without_the_environment() -> None:
    auth = AuthFicticia()

    run(auth, "outro.admin", answers=[SENHA_FICTICIA, SENHA_FICTICIA], display_name="Admin X")

    credentials = auth.users.get_credentials_by_username("outro.admin")
    assert credentials is not None
    assert credentials.user.display_name == "Admin X"


def test_is_idempotent_and_does_not_change_the_password() -> None:
    auth = AuthFicticia()
    before = auth.users.get_credentials_by_username(ADMIN_FICTICIO_USERNAME)

    messages = run(
        auth, ADMIN_FICTICIO_USERNAME.upper(), environ={"ADMIN_PASSWORD": "outra-senha-x"}
    )

    assert auth.users.get_credentials_by_username(ADMIN_FICTICIO_USERNAME) == before
    assert messages == [
        f"usuário {ADMIN_FICTICIO_USERNAME!r} já existe (perfil ADMIN, ativo); nada alterado "
        "(a senha não foi trocada)."
    ]


@pytest.mark.parametrize(
    ("username", "environ", "answers"),
    [
        ("ab", {"ADMIN_PASSWORD": SENHA_FICTICIA}, None),
        ("novo.admin", {"ADMIN_PASSWORD": "curta"}, None),
        ("novo.admin", {}, [SENHA_FICTICIA, "diferente-ficticia"]),
        ("novo.admin", {}, []),
    ],
)
def test_invalid_input_is_a_clear_error_without_the_password(
    username: str, environ: dict[str, str], answers: list[str] | None
) -> None:
    auth = AuthFicticia()

    with pytest.raises(CreateAdminError) as error:
        run(auth, username, environ=environ, answers=answers)

    assert SENHA_FICTICIA not in str(error.value)
    assert auth.users.get_credentials_by_username("novo.admin") is None


def test_main_without_database_url_is_a_configuration_error() -> None:
    out = io.StringIO()

    code = main(["--username", "admin"], environ={}, out=out, prompt=no_prompt)

    assert code == EXIT_CONFIGURATION_ERROR
    assert "ERRO: defina DATABASE_URL" in out.getvalue()


def test_main_with_an_invalid_database_url_does_not_echo_it() -> None:
    out = io.StringIO()
    # Desde a TASK-049, `postgresql://` é aceito (normalizado); outro esquema é inválido.
    url = "mysql://usuario_ficticio:senha-nao-vazar@localhost/banco"

    code = main(["--username", "admin"], environ={"DATABASE_URL": url}, out=out, prompt=no_prompt)

    assert code == EXIT_CONFIGURATION_ERROR
    assert "senha-nao-vazar" not in out.getvalue()


def test_password_is_not_accepted_as_a_command_line_argument() -> None:
    env = {key: value for key, value in os.environ.items() if key != "DATABASE_URL"}
    env["PYTHONIOENCODING"] = "utf-8"
    result = subprocess.run(
        [sys.executable, "-m", "app.create_admin", "--username", "admin", "--password", "x"],
        cwd=BACKEND_DIR,
        env=env,
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=60,
        check=False,
    )

    assert result.returncode == 2
    assert "unrecognized arguments: --password" in result.stderr
