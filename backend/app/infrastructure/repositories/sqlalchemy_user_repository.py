"""Usuários no PostgreSQL via SQLAlchemy (ADR-016 § 2; TASK-038).

Implementa `UserRepository`. Cada método abre a própria sessão e a própria transação, como os
repositórios da TASK-022. `update` garante o "sempre resta um admin ativo" com trava de linhas.
"""

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from app.application.ports.user_repository import (
    UserCredentials,
    UsernameTakenError,
    UserNotFoundError,
)
from app.domain.entities.user import User, UserRole
from app.domain.exceptions.user_errors import LastAdminError
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
        statement = select(AppUserModel).order_by(AppUserModel.username.collate("C"))
        with self._session_factory() as session:
            return [user_from_model(model) for model in session.scalars(statement)]

    def update(self, user: User, password_hash: str | None = None) -> None:
        """Grava `user` garantindo, na mesma transação, que sempre resta um admin ativo.

        Quando o novo estado não é "admin ativo" (pode ser um rebaixamento ou uma desativação), as
        linhas de **todos** os admins ativos são travadas (`SELECT ... FOR UPDATE`, em ordem de id)
        antes de ler o alvo e contar. Uma segunda transação que tente o mesmo espera a primeira
        terminar; no `READ COMMITTED` do PostgreSQL, ao ganhar a trava ela reavalia o filtro nas
        versões já gravadas, deixa de ver o admin que a primeira rebaixou e conta só o que sobrou.
        Travar sempre o conjunto inteiro, na mesma ordem, antes do alvo evita impasse (deadlock)
        entre duas mudanças simultâneas. Sem risco de perder admin (o novo estado é admin ativo), só
        a linha do alvo é travada.
        """
        with self._session_factory.begin() as session:
            other_active_admins: list[str] | None = None
            if not user.is_active_admin:
                locked_admin_ids = session.scalars(
                    select(AppUserModel.id)
                    .where(AppUserModel.role == UserRole.ADMIN.value, AppUserModel.active.is_(True))
                    .order_by(AppUserModel.id)
                    .with_for_update()
                ).all()
                other_active_admins = [i for i in locked_admin_ids if i != user.id]

            model = session.get(AppUserModel, user.id, with_for_update=True)
            if model is None:
                raise UserNotFoundError(user.id)
            was_active_admin = model.role == UserRole.ADMIN.value and model.active
            if was_active_admin and other_active_admins is not None and not other_active_admins:
                raise LastAdminError()

            model.display_name = user.display_name
            model.role = user.role.value
            model.active = user.active
            if password_hash is not None:
                model.password_hash = password_hash
