"""Configuração do banco lida de `DATABASE_URL` (TASK-011). Não precisa de banco.

A senha abaixo é FICTÍCIA: só serve para verificar que ela nunca aparece em mensagens.
"""

import pytest

from app.infrastructure.database.config import (
    DATABASE_URL_ENV_VAR,
    DatabaseConfigurationError,
    DatabaseSettings,
)

SENHA_FICTICIA = "senha-ficticia-nao-usar"
URL_FICTICIA = (
    f"postgresql+psycopg://usuario_ficticio:{SENHA_FICTICIA}@localhost:5432/banco_ficticio"
)


@pytest.mark.parametrize("environ", [{}, {DATABASE_URL_ENV_VAR: ""}, {DATABASE_URL_ENV_VAR: "   "}])
def test_missing_database_url_raises_clear_error(environ: dict[str, str]) -> None:
    with pytest.raises(DatabaseConfigurationError, match="DATABASE_URL não está definida"):
        DatabaseSettings.from_environment(environ)


def test_reads_os_environ_when_no_mapping_is_given(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv(DATABASE_URL_ENV_VAR, raising=False)
    with pytest.raises(DatabaseConfigurationError, match="DATABASE_URL"):
        DatabaseSettings.from_environment()

    monkeypatch.setenv(DATABASE_URL_ENV_VAR, URL_FICTICIA)
    assert DatabaseSettings.from_environment().url.database == "banco_ficticio"


def test_valid_url_is_parsed() -> None:
    settings = DatabaseSettings.from_environment({DATABASE_URL_ENV_VAR: f"  {URL_FICTICIA}  "})

    assert settings.url.drivername == "postgresql+psycopg"
    assert settings.url.username == "usuario_ficticio"
    assert settings.url.host == "localhost"
    assert settings.url.port == 5432
    assert settings.url.database == "banco_ficticio"


def test_unparseable_url_raises_without_echoing_the_value() -> None:
    invalid = f"isto-nao-e-uma-url-{SENHA_FICTICIA}"

    with pytest.raises(DatabaseConfigurationError, match="não é uma URL de banco válida") as info:
        DatabaseSettings.from_environment({DATABASE_URL_ENV_VAR: invalid})

    assert SENHA_FICTICIA not in str(info.value)
    assert info.value.__cause__ is None
    assert info.value.__suppress_context__ is True


@pytest.mark.parametrize(
    "url",
    [
        f"postgresql://usuario_ficticio:{SENHA_FICTICIA}@localhost:5432/banco_ficticio",
        f"postgresql+psycopg2://usuario_ficticio:{SENHA_FICTICIA}@localhost/banco_ficticio",
        "sqlite:///banco_ficticio.db",
    ],
)
def test_url_with_other_driver_is_rejected(url: str) -> None:
    with pytest.raises(DatabaseConfigurationError, match=r"postgresql\+psycopg://") as info:
        DatabaseSettings.from_environment({DATABASE_URL_ENV_VAR: url})

    assert SENHA_FICTICIA not in str(info.value)


def test_settings_repr_hides_the_password() -> None:
    settings = DatabaseSettings.from_environment({DATABASE_URL_ENV_VAR: URL_FICTICIA})

    assert SENHA_FICTICIA not in repr(settings)
    assert SENHA_FICTICIA not in str(settings)
