"""Hash Argon2id e limite de tentativas em memória (ADR-016 § 3; TASK-038). Senhas FICTÍCIAS."""

import pytest

from app.infrastructure.security.argon2_password_hasher import Argon2PasswordHasher
from app.infrastructure.security.login_attempt_limiter import InMemoryLoginAttemptLimiter

SENHA_FICTICIA = "senha-ficticia-argon2"


@pytest.fixture(scope="module")
def hasher() -> Argon2PasswordHasher:
    return Argon2PasswordHasher()


def test_hash_is_argon2id_with_salt(hasher: Argon2PasswordHasher) -> None:
    first = hasher.hash(SENHA_FICTICIA)
    second = hasher.hash(SENHA_FICTICIA)

    assert first.startswith("$argon2id$")
    assert SENHA_FICTICIA not in first
    assert first != second


def test_verify_accepts_the_right_password_only(hasher: Argon2PasswordHasher) -> None:
    password_hash = hasher.hash(SENHA_FICTICIA)

    assert hasher.verify(password_hash, SENHA_FICTICIA) is True
    assert hasher.verify(password_hash, "outra-senha-ficticia") is False


@pytest.mark.parametrize("malformed", ["", "nao-e-hash", "$argon2id$v=19$quebrado"])
def test_verify_returns_false_for_a_malformed_hash(
    hasher: Argon2PasswordHasher, malformed: str
) -> None:
    assert hasher.verify(malformed, SENHA_FICTICIA) is False


class ManualClock:
    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now


def test_limiter_blocks_after_five_failures_within_15_minutes() -> None:
    clock = ManualClock()
    limiter = InMemoryLoginAttemptLimiter(clock=clock)

    for _ in range(4):
        limiter.register_failure("usuario.ficticio")
        clock.now += 60
    assert not limiter.is_blocked("usuario.ficticio")

    limiter.register_failure("usuario.ficticio")
    assert limiter.is_blocked("usuario.ficticio")
    assert not limiter.is_blocked("outro.ficticio")


def test_limiter_releases_when_the_oldest_failure_leaves_the_window() -> None:
    clock = ManualClock()
    limiter = InMemoryLoginAttemptLimiter(clock=clock)
    for _ in range(5):
        limiter.register_failure("usuario.ficticio")
    assert limiter.is_blocked("usuario.ficticio")

    clock.now += 15 * 60
    assert not limiter.is_blocked("usuario.ficticio")


def test_limiter_reset_forgets_the_failures() -> None:
    limiter = InMemoryLoginAttemptLimiter(clock=ManualClock())
    for _ in range(5):
        limiter.register_failure("usuario.ficticio")

    limiter.reset("usuario.ficticio")

    assert not limiter.is_blocked("usuario.ficticio")


def test_limiter_discards_stale_keys_when_it_tracks_too_many() -> None:
    clock = ManualClock()
    limiter = InMemoryLoginAttemptLimiter(clock=clock, max_tracked_keys=2)
    limiter.register_failure("a.ficticio")
    limiter.register_failure("b.ficticio")
    clock.now += 15 * 60

    limiter.register_failure("c.ficticio")

    assert set(limiter._failures) == {"c.ficticio"}
