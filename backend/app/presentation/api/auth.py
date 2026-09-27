"""Rotas de autenticação `/api/v1/auth/*` (ADR-016 § 4; TASK-038).

- `GET /api/v1/auth/session` → 200 `{authEnabled, user}`. Com banco: `user` é o dono da sessão do
  cookie, ou `null`; sem banco (ADR-016 § 5): `{authEnabled: false, user: null}`.
- `POST /api/v1/auth/login` `{username, password}` → 200 `{user}` + `Set-Cookie: crane_session=...`;
  401 `INVALID_CREDENTIALS` (sempre a mesma resposta, sem dizer se o usuário existe ou está
  inativo); 429 `TOO_MANY_ATTEMPTS` (5 falhas por `username` em 15 min).
- `POST /api/v1/auth/logout` → 204, idempotente; revoga a sessão e limpa o cookie.

Login e logout só existem com banco. Como todo método inseguro, exigem o cabeçalho CSRF
(`CsrfHeaderMiddleware`). O log nunca recebe senha nem token.
"""

import logging
from typing import Literal

from fastapi import APIRouter, Request, Response, status

from app.application.use_cases.authentication import (
    InvalidCredentialsError,
    Login,
    Logout,
    TooManyLoginAttemptsError,
)
from app.presentation.api.auth_schemas import (
    LoginRequest,
    LoginResponse,
    SessionResponse,
    UserResponse,
)
from app.presentation.api.authorization import (
    SESSION_COOKIE_NAME,
    ApiError,
    AuthDependencies,
    AuthErrorCode,
    AuthGuards,
    cookie_max_age_seconds,
    error_responses,
)

logger = logging.getLogger(__name__)

AUTH_PREFIX = "/api/v1/auth"
SESSION_PATH = f"{AUTH_PREFIX}/session"
LOGIN_PATH = f"{AUTH_PREFIX}/login"
LOGOUT_PATH = f"{AUTH_PREFIX}/logout"

_SAME_SITE: Literal["strict"] = "strict"
_COOKIE_PATH = "/"


def create_auth_router(deps: AuthDependencies | None, guards: AuthGuards | None) -> APIRouter:
    """Monta as rotas; sem `deps` (sem banco), só a sessão, respondendo `authEnabled: false`."""
    router = APIRouter(prefix=AUTH_PREFIX, tags=["auth"])

    @router.get(
        "/session",
        summary="Sessão atual e se a autenticação está ligada",
        description=(
            "Não exige sessão: responde `user: null` quando não há sessão válida. Sem banco "
            "(ADR-016 § 5), `authEnabled: false` e as rotas ficam abertas (só desenvolvimento)."
        ),
    )
    def get_session(request: Request) -> SessionResponse:
        if guards is None:
            return SessionResponse(auth_enabled=False, user=None)
        user = guards.optional_user(request.cookies.get(SESSION_COOKIE_NAME))
        return SessionResponse(
            auth_enabled=True, user=None if user is None else UserResponse.from_user(user)
        )

    if deps is None:
        return router

    login_use_case = Login(
        deps.users,
        deps.sessions,
        deps.password_hasher,
        deps.attempt_limiter,
        clock=deps.clock,
        token_generator=deps.token_generator,
    )
    logout_use_case = Logout(deps.sessions)

    @router.post(
        "/login",
        summary="Entrar: cria a sessão e grava o cookie `crane_session`",
        responses=error_responses(
            (status.HTTP_401_UNAUTHORIZED, "`INVALID_CREDENTIALS`: usuário ou senha inválidos."),
            (status.HTTP_403_FORBIDDEN, "`CSRF_HEADER_MISSING`."),
            (status.HTTP_429_TOO_MANY_REQUESTS, "`TOO_MANY_ATTEMPTS`: 5 falhas em 15 min."),
        ),
    )
    def login(body: LoginRequest, response: Response) -> LoginResponse:
        try:
            result = login_use_case.execute(body.username, body.password)
        except TooManyLoginAttemptsError as error:
            logger.warning("login recusado: limite de tentativas atingido")
            raise ApiError(
                status.HTTP_429_TOO_MANY_REQUESTS, AuthErrorCode.TOO_MANY_ATTEMPTS, str(error)
            ) from None
        except InvalidCredentialsError as error:
            logger.info("login recusado: credenciais inválidas")
            raise ApiError(
                status.HTTP_401_UNAUTHORIZED, AuthErrorCode.INVALID_CREDENTIALS, str(error)
            ) from None

        response.set_cookie(
            SESSION_COOKIE_NAME,
            result.token,
            max_age=cookie_max_age_seconds(result.expires_at, deps.clock()),
            path=_COOKIE_PATH,
            secure=deps.cookie_secure,
            httponly=True,
            samesite=_SAME_SITE,
        )
        logger.info("login do usuário %s", result.user.id)
        return LoginResponse(user=UserResponse.from_user(result.user))

    @router.post(
        "/logout",
        status_code=status.HTTP_204_NO_CONTENT,
        summary="Sair: revoga a sessão e limpa o cookie (idempotente)",
        responses=error_responses((status.HTTP_403_FORBIDDEN, "`CSRF_HEADER_MISSING`.")),
    )
    def logout(request: Request) -> Response:
        logout_use_case.execute(request.cookies.get(SESSION_COOKIE_NAME))
        response = Response(status_code=status.HTTP_204_NO_CONTENT)
        response.delete_cookie(
            SESSION_COOKIE_NAME,
            path=_COOKIE_PATH,
            secure=deps.cookie_secure,
            httponly=True,
            samesite=_SAME_SITE,
        )
        return response

    return router
