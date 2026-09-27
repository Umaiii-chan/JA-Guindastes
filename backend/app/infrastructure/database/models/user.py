"""Modelos ORM de usuários e sessões (ADR-016 §§ 2 e 3; TASK-038).

- `app_user`: conta de acesso com perfil, situação e o hash Argon2id da senha. `username` é único e
  guardado em minúsculas (a normalização é do domínio; o banco garante a unicidade).
- `user_session`: sessão opaca. A chave é o SHA-256 do token (64 dígitos hexadecimais): o token em
  si nunca é gravado. Apagar o usuário apaga as sessões dele (`CASCADE`).

Datas com fuso horário (`timestamptz`).
"""

from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.domain.entities.user import UserRole
from app.infrastructure.database.base import Base

USERNAME_UNIQUE_CONSTRAINT = "uq_app_user_username"

_ROLE_VALUES = ", ".join(f"'{role.value}'" for role in UserRole)


class AppUserModel(Base):
    """Linha de `app_user`."""

    __tablename__ = "app_user"
    __table_args__ = (
        CheckConstraint(f"role IN ({_ROLE_VALUES})", name="role_valid"),
        CheckConstraint("username = lower(username)", name="username_lowercase"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True)
    username: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    display_name: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[str] = mapped_column(String(16), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class UserSessionModel(Base):
    """Linha de `user_session`."""

    __tablename__ = "user_session"
    __table_args__ = (CheckConstraint("token_hash ~ '^[0-9a-f]{64}$'", name="token_hash_hex"),)

    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("app_user.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
