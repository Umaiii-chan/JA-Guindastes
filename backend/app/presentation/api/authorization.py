"""Autenticação e autorização da API (ADR-016; TASK-038).

- **Cookie** `crane_session`: `HttpOnly`, `SameSite=Strict`, `Path=/`, `Secure` conforme
  `SESSION_COOKIE_SECURE` (lida pela raiz de composição; padrão `true`). Leva o token opaco.
- **CSRF**: com a autenticação ligada, todo `POST`, `PUT`, `PATCH` e `DELETE` exige o cabeçalho
  `X-Requested-With: crane-simulator` (`CsrfHeaderMiddleware`); sem ele, `403 CSRF_HEADER_MISSING`,
  antes de qualquer outra verificação.
- **Guardas** (`AuthGuards`): dependências FastAPI. `current_user` exige sessão válida
  (`401 NOT_AUTHENTICATED`); `require_admin` exige o perfil `ADMIN` (`403 FORBIDDEN`).
- **WebSocket**: `check_websocket` confere que o `Origin` bate com o `Host` (senão `4403`) e que o
  cookie tem sessão válida (senão `4401`).
- **Erros**: `ApiError` vira `{"detail": "<mensagem>", "code": "<CÓDIGO>"}`: o `detail` em texto do
  formato que a API já usa, mais o código do ADR-016 § 4 em `code`.

Sem `DATABASE_URL` não há autenticação (ADR-016 § 5): a composição não passa `AuthDependencies`, e
nada deste módulo é ligado além do tratador de `ApiError`.
"""

from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from typing import Annotated
from urllib.parse import urlsplit

from fastapi import Depends, Request, WebSocket, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from starlette.datastructures import Headers
from starlette.types import ASGIApp, Receive, Scope, Send

from app.application.ports.login_attempt_limiter import LoginAttemptLimiter
from app.application.ports.password_hasher import PasswordHasher
from app.application.ports.session_repository import SessionRepository
from app.application.ports.user_repository import UserRepository
from app.application.use_cases.authentication import (
    Clock,
    GetCurrentUser,
    TokenGenerator,
    generate_session_token,
    utc_now,
)
from app.application.use_cases.crane_catalog import IdGenerator, generate_uuid_id
from app.domain.entities.user import User, UserRole

SESSION_COOKIE_NAME = "crane_session"
CSRF_HEADER_NAME = "X-Requested-With"
CSRF_HEADER_VALUE = "crane-simulator"
UNSAFE_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})

WEBSOCKET_CLOSE_NOT_AUTHENTICATED = 4401
WEBSOCKET_CLOSE_FORBIDDEN_ORIGIN = 4403


class AuthErrorCode(StrEnum):
    """Códigos de erro do ADR-016 § 4 (e o da proteção de acesso do próprio admin)."""

    NOT_AUTHENTICATED = "NOT_AUTHENTICATED"
    FORBIDDEN = "FORBIDDEN"
    CSRF_HEADER_MISSING = "CSRF_HEADER_MISSING"
    INVALID_CREDENTIALS = "INVALID_CREDENTIALS"
    TOO_MANY_ATTEMPTS = "TOO_MANY_ATTEMPTS"
    USERNAME_TAKEN = "USERNAME_TAKEN"
    USER_NOT_FOUND = "USER_NOT_FOUND"
    LAST_ADMIN = "LAST_ADMIN"
    OWN_ADMIN_ACCESS = "OWN_ADMIN_ACCESS"


class ApiErrorResponse(BaseModel):
    """Corpo das respostas de erro da autenticação e da gestão de usuários."""

    detail: str = Field(description="Motivo do erro, legível por pessoa.")
    code: AuthErrorCode = Field(description="Código estável do erro (ADR-016 § 4).")


class ApiError(Exception):
    """Erro com status HTTP e código; tratado por `api_error_handler`."""

    def __init__(self, status_code: int, code: AuthErrorCode, message: str) -> None:
        self.status_code = status_code
        self.code = code
        self.message = message
        super().__init__(message)


def api_error_response(status_code: int, code: AuthErrorCode, message: str) -> JSONResponse:
    body = ApiErrorResponse(detail=message, code=code)
    return JSONResponse(status_code=status_code, content=body.model_dump(mode="json"))


async def api_error_handler(request: Request, exc: Exception) -> JSONResponse:
    if not isinstance(exc, ApiError):  # pragma: no cover - o FastAPI só entrega ApiError aqui
        raise exc
    return api_error_response(exc.status_code, exc.code, exc.message)


def not_authenticated() -> ApiError:
    return ApiError(
        status.HTTP_401_UNAUTHORIZED, AuthErrorCode.NOT_AUTHENTICATED, "sessão ausente ou expirada"
    )


def error_responses(*errors: tuple[int, str]) -> dict[int | str, dict[str, object]]:
    """Entradas de `responses` do OpenAPI com o corpo `ApiErrorResponse`."""
    return {code: {"model": ApiErrorResponse, "description": text} for code, text in errors}


SESSION_REQUIRED_RESPONSES = error_responses(
    (status.HTTP_401_UNAUTHORIZED, "`NOT_AUTHENTICATED`: sem sessão válida."),
    (status.HTTP_403_FORBIDDEN, "`CSRF_HEADER_MISSING` (métodos inseguros) ou `FORBIDDEN`."),
)


class CsrfHeaderMiddleware:
    """Recusa com 403 os métodos inseguros sem `X-Requested-With: crane-simulator` (ADR-016 § 3)."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if (
            scope["type"] == "http"
            and scope["method"] in UNSAFE_METHODS
            and Headers(scope=scope).get(CSRF_HEADER_NAME) != CSRF_HEADER_VALUE
        ):
            response = api_error_response(
                status.HTTP_403_FORBIDDEN,
                AuthErrorCode.CSRF_HEADER_MISSING,
                f"envie o cabeçalho {CSRF_HEADER_NAME}: {CSRF_HEADER_VALUE}",
            )
            await response(scope, receive, send)
            return
        await self.app(scope, receive, send)


@dataclass(frozen=True)
class AuthDependencies:
    """Adapters da autenticação, montados pela raiz de composição (com `DATABASE_URL`)."""

    users: UserRepository
    sessions: SessionRepository
    password_hasher: PasswordHasher
    attempt_limiter: LoginAttemptLimiter
    cookie_secure: bool = True
    clock: Clock = utc_now
    token_generator: TokenGenerator = generate_session_token
    id_generator: IdGenerator = generate_uuid_id


def origin_matches_host(headers: Headers) -> bool:
    """`True` se o nome do host do `Origin` é o mesmo do `Host` (sem diferenciar maiúsculas).

    A porta não entra na comparação: o nginx do container repassa `Host` sem a porta
    (`proxy_set_header Host $host`) e o proxy do Vite troca o `Host` pelo do backend
    (`changeOrigin`), mas nos dois o nome do host é o da página. Sem `Origin`, ou com `Origin`
    ilegível, a origem não bate.
    """
    origin = headers.get("origin")
    host = headers.get("host")
    if not origin or not host:
        return False
    try:
        origin_host = urlsplit(origin).hostname
        request_host = urlsplit(f"//{host}").hostname
    except ValueError:
        return False
    return origin_host is not None and origin_host == request_host


class AuthGuards:
    """Dependências de autorização ligadas à consulta da sessão atual."""

    def __init__(self, get_current_user: GetCurrentUser) -> None:
        self._get_current_user = get_current_user

        def current_user(request: Request) -> User:
            # Síncrona: a consulta ao banco roda numa thread à parte (FastAPI).
            user = get_current_user.execute(request.cookies.get(SESSION_COOKIE_NAME))
            if user is None:
                raise not_authenticated()
            return user

        def require_admin(user: Annotated[User, Depends(current_user)]) -> User:
            if user.role is not UserRole.ADMIN:
                raise ApiError(
                    status.HTTP_403_FORBIDDEN,
                    AuthErrorCode.FORBIDDEN,
                    "esta ação exige o perfil ADMIN",
                )
            return user

        self.current_user: Callable[..., User] = current_user
        self.require_admin: Callable[..., User] = require_admin

    def optional_user(self, token: str | None) -> User | None:
        return self._get_current_user.execute(token)

    def check_websocket(self, websocket: WebSocket) -> int | None:
        """Código de fechamento do WebSocket (`4403`/`4401`), ou `None` se a conexão pode seguir."""
        if not origin_matches_host(websocket.headers):
            return WEBSOCKET_CLOSE_FORBIDDEN_ORIGIN
        if self.optional_user(websocket.cookies.get(SESSION_COOKIE_NAME)) is None:
            return WEBSOCKET_CLOSE_NOT_AUTHENTICATED
        return None


def cookie_max_age_seconds(expires_at: datetime, now: datetime) -> int:
    """Segundos até a expiração absoluta da sessão (nunca negativo)."""
    return max(0, int((expires_at - now).total_seconds()))
