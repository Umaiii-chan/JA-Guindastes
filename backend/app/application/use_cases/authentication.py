"""Casos de uso de login, logout e sessão atual (ADR-016 § 3; TASK-038).

- **Login**: confere a senha (Argon2id, pela porta `PasswordHasher`) e cria uma sessão opaca com
  token aleatório de 32 bytes (`secrets.token_urlsafe`); grava só o SHA-256 do token. Expira em 8 h
  desde o login (absoluto). Qualquer falha (usuário inexistente, inativo ou senha errada) é o mesmo
  `InvalidCredentialsError`, sem dizer qual foi o caso; a senha é conferida mesmo quando o usuário
  não existe (contra um hash descartável), para o tempo de resposta não revelar isso.
- **Limite**: 5 falhas por `username` em 15 min → `TooManyLoginAttemptsError` (a porta
  `LoginAttemptLimiter`; o adapter em memória vale por processo, dívida registrada no ADR-016).
- **Logout**: revoga a sessão do token; idempotente.
- **Sessão atual**: o dono de um token válido (sessão não expirada e usuário ativo), ou `None`.

Nenhuma senha nem token vai para exceção ou log.
"""

import hashlib
import secrets
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from app.application.ports.login_attempt_limiter import LoginAttemptLimiter
from app.application.ports.password_hasher import PasswordHasher
from app.application.ports.session_repository import SessionRepository, UserSession
from app.application.ports.user_repository import UserRepository
from app.domain.entities.user import PASSWORD_MAX_LENGTH, USERNAME_MAX_LENGTH, User

SESSION_DURATION = timedelta(hours=8)
"""Validade absoluta da sessão desde o login (ADR-016 § 3)."""

SESSION_TOKEN_BYTES = 32
MAX_SESSION_TOKEN_LENGTH = 256
"""Token maior que isto nem é procurado (o de 32 bytes em base64url tem 43 caracteres)."""

# Senha descartável só para gerar o hash usado quando o usuário não existe (tempo constante).
_DUMMY_PASSWORD = "senha-descartavel-so-para-igualar-o-tempo"

type Clock = Callable[[], datetime]
type TokenGenerator = Callable[[], str]


def utc_now() -> datetime:
    return datetime.now(UTC)


def generate_session_token() -> str:
    """Token opaco: 32 bytes aleatórios em base64url (ADR-016 § 3)."""
    return secrets.token_urlsafe(SESSION_TOKEN_BYTES)


def hash_session_token(token: str) -> str:
    """SHA-256 do token em 64 dígitos hexadecimais: o que o banco guarda."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


class InvalidCredentialsError(Exception):
    """Usuário inexistente, inativo ou senha errada (a mensagem não diz qual)."""

    def __init__(self) -> None:
        super().__init__("usuário ou senha inválidos")


class TooManyLoginAttemptsError(Exception):
    """O `username` atingiu o limite de falhas de login na janela."""

    def __init__(self) -> None:
        super().__init__("muitas tentativas de login; aguarde alguns minutos")


@dataclass(frozen=True)
class LoginResult:
    """Usuário autenticado, o token a entregar no cookie e quando a sessão expira."""

    user: User
    token: str
    expires_at: datetime


class Login:
    def __init__(
        self,
        users: UserRepository,
        sessions: SessionRepository,
        password_hasher: PasswordHasher,
        attempt_limiter: LoginAttemptLimiter,
        *,
        clock: Clock = utc_now,
        token_generator: TokenGenerator = generate_session_token,
        session_duration: timedelta = SESSION_DURATION,
    ) -> None:
        self._users = users
        self._sessions = sessions
        self._hasher = password_hasher
        self._limiter = attempt_limiter
        self._clock = clock
        self._token_generator = token_generator
        self._session_duration = session_duration
        self._dummy_hash: str | None = None

    def execute(self, username: str, password: str) -> LoginResult:
        key = username.lower()
        if self._limiter.is_blocked(key):
            raise TooManyLoginAttemptsError()

        user = self._authenticate(key, password)
        if user is None:
            self._limiter.register_failure(key)
            raise InvalidCredentialsError()

        self._limiter.reset(key)
        now = self._clock()
        self._sessions.delete_expired(now)
        token = self._token_generator()
        expires_at = now + self._session_duration
        self._sessions.add(
            UserSession(
                token_hash=hash_session_token(token),
                user_id=user.id,
                created_at=now,
                expires_at=expires_at,
            )
        )
        return LoginResult(user=user, token=token, expires_at=expires_at)

    def _authenticate(self, username: str, password: str) -> User | None:
        # Entradas acima dos limites do ADR-016 § 2 nem chegam ao banco nem ao Argon2.
        if len(username) > USERNAME_MAX_LENGTH or len(password) > PASSWORD_MAX_LENGTH:
            return None
        credentials = self._users.get_credentials_by_username(username)
        if credentials is None:
            self._hasher.verify(self._dummy_password_hash(), password)
            return None
        if not self._hasher.verify(credentials.password_hash, password):
            return None
        if not credentials.user.active:
            return None
        return credentials.user

    def _dummy_password_hash(self) -> str:
        if self._dummy_hash is None:
            self._dummy_hash = self._hasher.hash(_DUMMY_PASSWORD)
        return self._dummy_hash


class Logout:
    def __init__(self, sessions: SessionRepository) -> None:
        self._sessions = sessions

    def execute(self, token: str | None) -> None:
        if token and len(token) <= MAX_SESSION_TOKEN_LENGTH:
            self._sessions.delete(hash_session_token(token))


class GetCurrentUser:
    def __init__(self, sessions: SessionRepository, *, clock: Clock = utc_now) -> None:
        self._sessions = sessions
        self._clock = clock

    def execute(self, token: str | None) -> User | None:
        if not token or len(token) > MAX_SESSION_TOKEN_LENGTH:
            return None
        return self._sessions.find_active_user(hash_session_token(token), self._clock())
