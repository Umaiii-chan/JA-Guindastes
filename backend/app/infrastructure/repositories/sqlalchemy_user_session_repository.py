"""Sessões de login no PostgreSQL via SQLAlchemy (ADR-016 § 3; TASK-038).

Implementa `SessionRepository`. Guarda só o SHA-256 do token. A sessão atual é lida numa consulta só
(sessão + usuário), a "uma consulta por requisição" do ADR-016.
"""

from datetime import datetime

from sqlalchemy import delete, select
from sqlalchemy.orm import Session, sessionmaker

from app.application.ports.session_repository import UserSession
from app.domain.entities.user import User
from app.infrastructure.database.models.user import AppUserModel, UserSessionModel
from app.infrastructure.repositories.sqlalchemy_user_repository import user_from_model


class SqlAlchemyUserSessionRepository:
    """Implementa `SessionRepository`."""

    def __init__(self, session_factory: sessionmaker[Session]) -> None:
        self._session_factory = session_factory

    def add(self, session: UserSession) -> None:
        with self._session_factory.begin() as db:
            db.add(
                UserSessionModel(
                    token_hash=session.token_hash,
                    user_id=session.user_id,
                    created_at=session.created_at,
                    expires_at=session.expires_at,
                )
            )

    def find_active_user(self, token_hash: str, now: datetime) -> User | None:
        statement = (
            select(AppUserModel)
            .join(UserSessionModel, UserSessionModel.user_id == AppUserModel.id)
            .where(
                UserSessionModel.token_hash == token_hash,
                UserSessionModel.expires_at > now,
                AppUserModel.active.is_(True),
            )
        )
        with self._session_factory() as db:
            model = db.scalars(statement).one_or_none()
            return None if model is None else user_from_model(model)

    def delete(self, token_hash: str) -> None:
        with self._session_factory.begin() as db:
            db.execute(delete(UserSessionModel).where(UserSessionModel.token_hash == token_hash))

    def delete_for_user(self, user_id: str) -> None:
        with self._session_factory.begin() as db:
            db.execute(delete(UserSessionModel).where(UserSessionModel.user_id == user_id))

    def delete_expired(self, now: datetime) -> None:
        with self._session_factory.begin() as db:
            db.execute(delete(UserSessionModel).where(UserSessionModel.expires_at <= now))
