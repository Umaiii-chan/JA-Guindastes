"""Login, logout e sessão atual sem banco (ADR-016 § 3; TASK-038). Dados FICTÍCIOS."""

import re
from dataclasses import replace
from datetime import timedelta

import pytest

from app.application.use_cases.authentication import (
    SESSION_DURATION,
    GetCurrentUser,
    InvalidCredentialsError,
    Login,
    Logout,
    TooManyLoginAttemptsError,
    generate_session_token,
    hash_session_token,
)
from tests.fixtures.auth_ficticia import (
    ADMIN_FICTICIO_SENHA,
    ADMIN_FICTICIO_USERNAME,
    OPERADOR_FICTICIO_SENHA,
    OPERADOR_FICTICIO_USERNAME,
    AuthFicticia,
)

TOKEN_FICTICIO = "token-ficticio-de-teste"


@pytest.fixture
def auth() -> AuthFicticia:
    return AuthFicticia()


def build_login(auth: AuthFicticia) -> Login:
    return Login(
        auth.users,
        auth.sessions,
        auth.hasher,
        auth.limiter,
        clock=auth.clock,
        token_generator=lambda: TOKEN_FICTICIO,
    )


def test_login_creates_a_session_that_stores_only_the_token_hash(auth: AuthFicticia) -> None:
    result = build_login(auth).execute(ADMIN_FICTICIO_USERNAME, ADMIN_FICTICIO_SENHA)

    assert result.user == auth.admin
    assert result.token == TOKEN_FICTICIO
    assert result.expires_at == auth.clock.now + timedelta(hours=8)
    [session] = auth.sessions.sessions.values()
    assert session.token_hash == hash_session_token(TOKEN_FICTICIO)
    assert TOKEN_FICTICIO not in session.token_hash
    assert session.user_id == auth.admin.id
    assert session.created_at == auth.clock.now
    assert session.expires_at == auth.clock.now + SESSION_DURATION


def test_login_accepts_the_username_in_any_case(auth: AuthFicticia) -> None:
    result = build_login(auth).execute(OPERADOR_FICTICIO_USERNAME.upper(), OPERADOR_FICTICIO_SENHA)

    assert result.user == auth.operator


@pytest.mark.parametrize(
    ("username", "password"),
    [
        (ADMIN_FICTICIO_USERNAME, "senha-errada-ficticia"),
        ("nao.existe", ADMIN_FICTICIO_SENHA),
        (ADMIN_FICTICIO_USERNAME, "x" * 129),
        ("u" * 65, ADMIN_FICTICIO_SENHA),
    ],
)
def test_wrong_credentials_are_the_same_generic_error(
    auth: AuthFicticia, username: str, password: str
) -> None:
    with pytest.raises(InvalidCredentialsError) as error:
        build_login(auth).execute(username, password)

    assert str(error.value) == "usuário ou senha inválidos"
    assert password not in str(error.value)
    assert auth.sessions.sessions == {}


def test_inactive_user_gets_the_same_generic_error(auth: AuthFicticia) -> None:
    auth.users.update(replace(auth.operator, active=False))

    with pytest.raises(InvalidCredentialsError):
        build_login(auth).execute(OPERADOR_FICTICIO_USERNAME, OPERADOR_FICTICIO_SENHA)


def test_unknown_user_still_runs_a_password_verification(auth: AuthFicticia) -> None:
    # Tempo constante: sem usuário, a senha é conferida contra um hash descartável.
    with pytest.raises(InvalidCredentialsError):
        build_login(auth).execute("nao.existe", ADMIN_FICTICIO_SENHA)

    assert auth.hasher.verify_calls == 1


def test_five_failures_block_the_username_even_with_the_right_password(
    auth: AuthFicticia,
) -> None:
    login = build_login(auth)
    for _ in range(5):
        with pytest.raises(InvalidCredentialsError):
            login.execute(ADMIN_FICTICIO_USERNAME, "senha-errada-ficticia")

    with pytest.raises(TooManyLoginAttemptsError):
        login.execute(ADMIN_FICTICIO_USERNAME.upper(), ADMIN_FICTICIO_SENHA)
    # Outro usuário continua podendo entrar.
    assert login.execute(OPERADOR_FICTICIO_USERNAME, OPERADOR_FICTICIO_SENHA).user == auth.operator


def test_successful_login_resets_the_failures(auth: AuthFicticia) -> None:
    login = build_login(auth)
    for _ in range(4):
        with pytest.raises(InvalidCredentialsError):
            login.execute(ADMIN_FICTICIO_USERNAME, "senha-errada-ficticia")

    login.execute(ADMIN_FICTICIO_USERNAME, ADMIN_FICTICIO_SENHA)

    assert auth.limiter.failures == {}


def test_login_removes_expired_sessions(auth: AuthFicticia) -> None:
    login = Login(auth.users, auth.sessions, auth.hasher, auth.limiter, clock=auth.clock)
    old = login.execute(ADMIN_FICTICIO_USERNAME, ADMIN_FICTICIO_SENHA)
    auth.clock.advance(SESSION_DURATION)

    new = login.execute(ADMIN_FICTICIO_USERNAME, ADMIN_FICTICIO_SENHA)

    assert set(auth.sessions.sessions) == {hash_session_token(new.token)}
    assert old.token != new.token


def test_current_user_follows_the_session_until_it_expires(auth: AuthFicticia) -> None:
    token = build_login(auth).execute(ADMIN_FICTICIO_USERNAME, ADMIN_FICTICIO_SENHA).token
    current = GetCurrentUser(auth.sessions, clock=auth.clock)

    assert current.execute(token) == auth.admin
    auth.clock.advance(SESSION_DURATION - timedelta(seconds=1))
    assert current.execute(token) == auth.admin
    auth.clock.advance(timedelta(seconds=1))
    assert current.execute(token) is None


@pytest.mark.parametrize("token", [None, "", "desconhecido", "x" * 300])
def test_current_user_is_none_without_a_valid_token(auth: AuthFicticia, token: str | None) -> None:
    assert GetCurrentUser(auth.sessions, clock=auth.clock).execute(token) is None


def test_deactivated_user_loses_the_session(auth: AuthFicticia) -> None:
    token = build_login(auth).execute(ADMIN_FICTICIO_USERNAME, ADMIN_FICTICIO_SENHA).token
    auth.users.update(replace(auth.admin, active=False))

    assert GetCurrentUser(auth.sessions, clock=auth.clock).execute(token) is None


def test_logout_revokes_the_session_and_is_idempotent(auth: AuthFicticia) -> None:
    token = build_login(auth).execute(ADMIN_FICTICIO_USERNAME, ADMIN_FICTICIO_SENHA).token
    logout = Logout(auth.sessions)

    logout.execute(token)
    logout.execute(token)
    logout.execute(None)

    assert auth.sessions.sessions == {}
    assert GetCurrentUser(auth.sessions, clock=auth.clock).execute(token) is None


def test_session_token_is_random_urlsafe_with_32_bytes() -> None:
    tokens = {generate_session_token() for _ in range(20)}

    assert len(tokens) == 20
    for token in tokens:
        assert re.fullmatch(r"[A-Za-z0-9_-]{43}", token)


def test_token_hash_is_sha256_hex() -> None:
    assert hash_session_token("abc") == (
        "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    )
