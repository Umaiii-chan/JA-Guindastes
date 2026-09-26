"""Dublês e dados FICTÍCIOS da autenticação (TASK-038; ADR-016).

- `InMemoryUserRepository` e `InMemorySessionRepository`: cumprem as portas sem banco;
- `FakePasswordHasher`: "hash" reversível e rápido (NÃO é seguro; só para testes), com contagem de
  verificações para conferir o tempo constante do login;
- `CountingAttemptLimiter`: limite de tentativas simples, sem relógio;
- `FakeClock`: relógio controlável;
- `AuthFicticia`: tudo junto, com um admin e um operador já gravados.

Os apoios da API (montar a aplicação com autenticação e fazer login) estão em
`tests/fixtures/auth_api_ficticia.py`.

Nomes e senhas são FICTÍCIOS e só valem nestes testes.
"""

from dataclasses import dataclass, field, replace
from datetime import UTC, datetime, timedelta

from app.application.ports.session_repository import UserSession
from app.application.ports.user_repository import (
    UserCredentials,
    UsernameTakenError,
    UserNotFoundError,
)
from app.domain.entities.user import User, UserRole

INSTANTE_FICTICIO = datetime(2026, 9, 26, 12, 0, tzinfo=UTC)

ADMIN_FICTICIO_USERNAME = "admin.ficticio"
ADMIN_FICTICIO_SENHA = "senha-ficticia-admin-123"
OPERADOR_FICTICIO_USERNAME = "operador.ficticio"
OPERADOR_FICTICIO_SENHA = "senha-ficticia-operador-123"


class FakeClock:
    def __init__(self, now: datetime = INSTANTE_FICTICIO) -> None:
        self.now = now

    def __call__(self) -> datetime:
        return self.now

    def advance(self, delta: timedelta) -> None:
        self.now += delta


class FakePasswordHasher:
    """Hash reversível só para testes: `fake$<senha invertida>`."""

    def __init__(self) -> None:
        self.verify_calls = 0

    def hash(self, password: str) -> str:
        return "fake$" + password[::-1]

    def verify(self, password_hash: str, password: str) -> bool:
        self.verify_calls += 1
        return password_hash == self.hash(password)


class CountingAttemptLimiter:
    def __init__(self, max_failures: int = 5) -> None:
        self.max_failures = max_failures
        self.failures: dict[str, int] = {}

    def is_blocked(self, key: str) -> bool:
        return self.failures.get(key, 0) >= self.max_failures

    def register_failure(self, key: str) -> None:
        self.failures[key] = self.failures.get(key, 0) + 1

    def reset(self, key: str) -> None:
        self.failures.pop(key, None)


class InMemoryUserRepository:
    def __init__(self) -> None:
        self.users: dict[str, User] = {}
        self.password_hashes: dict[str, str] = {}

    def add(self, user: User, password_hash: str) -> None:
        if any(existing.username == user.username for existing in self.users.values()):
            raise UsernameTakenError(user.username)
        self.users[user.id] = user
        self.password_hashes[user.id] = password_hash

    def get_by_id(self, user_id: str) -> User | None:
        return self.users.get(user_id)

    def get_credentials_by_username(self, username: str) -> UserCredentials | None:
        for user in self.users.values():
            if user.username == username:
                return UserCredentials(user=user, password_hash=self.password_hashes[user.id])
        return None

    def list_users(self) -> list[User]:
        return sorted(self.users.values(), key=lambda user: user.username)

    def update(self, user: User, password_hash: str | None = None) -> None:
        current = self.users.get(user.id)
        if current is None:
            raise UserNotFoundError(user.id)
        self.users[user.id] = replace(
            current, display_name=user.display_name, role=user.role, active=user.active
        )
        if password_hash is not None:
            self.password_hashes[user.id] = password_hash

    def count_active_admins(self) -> int:
        return sum(1 for user in self.users.values() if user.is_active_admin)


class InMemorySessionRepository:
    def __init__(self, users: InMemoryUserRepository) -> None:
        self._users = users
        self.sessions: dict[str, UserSession] = {}

    def add(self, session: UserSession) -> None:
        self.sessions[session.token_hash] = session

    def find_active_user(self, token_hash: str, now: datetime) -> User | None:
        session = self.sessions.get(token_hash)
        if session is None or session.expires_at <= now:
            return None
        user = self._users.get_by_id(session.user_id)
        return user if user is not None and user.active else None

    def delete(self, token_hash: str) -> None:
        self.sessions.pop(token_hash, None)

    def delete_for_user(self, user_id: str) -> None:
        for token_hash in [h for h, s in self.sessions.items() if s.user_id == user_id]:
            del self.sessions[token_hash]

    def delete_expired(self, now: datetime) -> None:
        for token_hash in [h for h, s in self.sessions.items() if s.expires_at <= now]:
            del self.sessions[token_hash]


def user_ficticio(
    username: str,
    role: UserRole,
    *,
    user_id: str | None = None,
    active: bool = True,
    display_name: str | None = None,
) -> User:
    return User(
        id=user_id or f"id-{username}",
        username=username,
        display_name=display_name or f"Usuário FICTÍCIO {username}",
        role=role,
        active=active,
        created_at=INSTANTE_FICTICIO,
    )


@dataclass
class AuthFicticia:
    """Adapters em memória, com um admin e um operador FICTÍCIOS já gravados."""

    clock: FakeClock = field(default_factory=FakeClock)
    hasher: FakePasswordHasher = field(default_factory=FakePasswordHasher)
    limiter: CountingAttemptLimiter = field(default_factory=CountingAttemptLimiter)
    users: InMemoryUserRepository = field(default_factory=InMemoryUserRepository)
    sessions: InMemorySessionRepository = field(init=False)
    admin: User = field(init=False)
    operator: User = field(init=False)
    _next_id: int = 0

    def __post_init__(self) -> None:
        self.sessions = InMemorySessionRepository(self.users)
        self.admin = user_ficticio(ADMIN_FICTICIO_USERNAME, UserRole.ADMIN)
        self.operator = user_ficticio(OPERADOR_FICTICIO_USERNAME, UserRole.OPERATOR)
        self.users.add(self.admin, self.hasher.hash(ADMIN_FICTICIO_SENHA))
        self.users.add(self.operator, self.hasher.hash(OPERADOR_FICTICIO_SENHA))

    def generate_id(self) -> str:
        self._next_id += 1
        return f"id-gerado-{self._next_id}"
