"""Usuários no PostgreSQL via SQLAlchemy (ADR-016 § 2; TASK-038).

Implementa `UserRepository`. Cada método abre a própria sessão e a própria transação, como os
repositórios da TASK-022.
"""

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from app.application.ports.user_repository import (
    UserCredentials,
    UsernameTakenError,
    UserNotFoundError,
)
from app.domain.entities.user import User, UserRole
from app.infrastructure.database.models.user import USERNAME_UNIQUE_CONSTRAINT, AppUserModel
from app.infrastructure.repositories._integrity import violated_constraint


def user_from_model(model: AppUserModel) -> User:
    return User(
        id=model.id,
        username=model.username,
        display_name=model.display_name,
        role=UserRole(model.role),
        active=model.active,
        created_at=model.created_at,
    )


def user_to_model(user: User, password_hash: str) -> AppUserModel:
    return AppUserModel(
        id=user.id,
        username=user.username,
        display_name=user.display_name,
        role=user.role.value,
        active=user.active,
        password_hash=password_hash,
        created_at=user.created_at,
    )


class SqlAlchemyUserRepository:
    """Implementa `UserRepository`."""

    def __init__(self, session_factory: sessionmaker[Session]) -> None:
        self._session_factory = session_factory

    def add(self, user: User, password_hash: str) -> None:
        try:
            with self._session_factory.begin() as session:
                session.add(user_to_model(user, password_hash))
        except IntegrityError as error:
            if violated_constraint(error) == USERNAME_UNIQUE_CONSTRAINT:
                raise UsernameTakenError(user.username) from error
            raise

    def get_by_id(self, user_id: str) -> User | None:
        with self._session_factory() as session:
            model = session.get(AppUserModel, user_id)
            return None if model is None else user_from_model(model)

    def get_credentials_by_username(self, username: str) -> UserCredentials | None:
        statement = select(AppUserModel).where(AppUserModel.username == username)
        with self._session_factory() as session:
            model = session.scalars(statement).one_or_none()
            if model is None:
                return None
            return UserCredentials(user=user_from_model(model), password_hash=model.password_hash)

    def list_users(self) -> list[User]:
        statement = select(AppUserModel).order_by(AppUserModel.username)
        with self._session_factory() as session:
            return [user_from_model(model) for model in session.scalars(statement)]

    def update(self, user: User, password_hash: str | None = None) -> None:
        with self._session_factory.begin() as session:
            model = session.get(AppUserModel, user.id)
            if model is None:
                raise UserNotFoundError(user.id)
            model.display_name = user.display_name
            model.role = user.role.value
            model.active = user.active
            if password_hash is not None:
                model.password_hash = password_hash

    def count_active_admins(self) -> int:
        statement = (
            select(func.count())
            .select_from(AppUserModel)
            .where(AppUserModel.role == UserRole.ADMIN.value, AppUserModel.active.is_(True))
        )
        with self._session_factory() as session:
            return session.scalar(statement) or 0
