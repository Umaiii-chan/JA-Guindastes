"""Composição da autenticação (TASK-038; ADR-016).

Parte da raiz de composição (`app.main`, `app.create_admin`): fica fora das camadas do
import-linter, como `app.main`, e nenhum módulo das camadas deve importá-la.

- Repositórios SQLAlchemy de usuários e sessões no mesmo engine da aplicação (um pool só);
- hash Argon2id (`argon2-cffi`) e limite de tentativas de login em memória (por processo);
- `SESSION_COOKIE_SECURE`: `true` (padrão, também quando vazia) ou `false`, sem diferenciar
  maiúsculas. `false` só em desenvolvimento local sem HTTPS: em produção o cookie trafegaria sem
  criptografia (`docs/security.md`). Outro valor impede a aplicação de subir.
"""

import os
from collections.abc import Mapping

from sqlalchemy import Engine

from app.infrastructure.database.engine import create_session_factory
from app.infrastructure.repositories.sqlalchemy_user_repository import SqlAlchemyUserRepository
from app.infrastructure.repositories.sqlalchemy_user_session_repository import (
    SqlAlchemyUserSessionRepository,
)
from app.infrastructure.security.argon2_password_hasher import Argon2PasswordHasher
from app.infrastructure.security.login_attempt_limiter import InMemoryLoginAttemptLimiter
from app.presentation.api.authorization import AuthDependencies

SESSION_COOKIE_SECURE_ENV_VAR = "SESSION_COOKIE_SECURE"


class AuthConfigurationError(Exception):
    """Configuração da autenticação inválida."""


def session_cookie_secure(environ: Mapping[str, str] | None = None) -> bool:
    """Lê `SESSION_COOKIE_SECURE`: ausente ou vazia → `True`; `true`/`false`; outro valor → erro."""
    source = os.environ if environ is None else environ
    raw = source.get(SESSION_COOKIE_SECURE_ENV_VAR, "").strip().lower()
    if raw in ("", "true"):
        return True
    if raw == "false":
        return False
    raise AuthConfigurationError(
        f"{SESSION_COOKIE_SECURE_ENV_VAR} deve ser 'true' ou 'false' (ver .env.example)."
    )


def build_auth(engine: Engine, environ: Mapping[str, str] | None = None) -> AuthDependencies:
    """Adapters da autenticação sobre `engine`. Não conecta ao banco."""
    session_factory = create_session_factory(engine)
    return AuthDependencies(
        users=SqlAlchemyUserRepository(session_factory),
        sessions=SqlAlchemyUserSessionRepository(session_factory),
        password_hasher=Argon2PasswordHasher(),
        attempt_limiter=InMemoryLoginAttemptLimiter(),
        cookie_secure=session_cookie_secure(environ),
    )
