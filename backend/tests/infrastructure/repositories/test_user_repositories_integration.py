"""Repositórios de usuários e sessões contra um PostgreSQL real (marcador `integration`; TASK-038).

Precisa do banco em `head` (`uv run alembic upgrade head`; o CI roda antes do pytest). Cada teste
roda numa transação desfeita no fim. Nomes, senhas e hashes são FICTÍCIOS.
"""

from collections.abc import Iterator
from dataclasses import replace
from datetime import timedelta

import pytest
from sqlalchemy import Engine, inspect, select, text
from sqlalchemy.orm import Session, sessionmaker

from app.application.ports.session_repository import SessionRepository, UserSession
from app.application.ports.user_repository import (
    UsernameTakenError,
    UserNotFoundError,
    UserRepository,
)
from app.application.use_cases.authentication import hash_session_token
from app.domain.entities.user import UserRole
from app.domain.exceptions.user_errors import LastAdminError
from app.infrastructure.database.models.user import UserSessionModel
from app.infrastructure.repositories.sqlalchemy_user_repository import SqlAlchemyUserRepository
from app.infrastructure.repositories.sqlalchemy_user_session_repository import (
    SqlAlchemyUserSessionRepository,
)
from tests.fixtures.auth_ficticia import INSTANTE_FICTICIO, user_ficticio
from tests.infrastructure.database.postgres_integration_support import (
    integration_engine,
    rolled_back_session_factory,
    skip_or_fail,
)

pytestmark = pytest.mark.integration

HASH_FICTICIO = "$argon2id$v=19$m=65536,t=3,p=4$c2FsLWZpY3RpY2lv$aGFzaC1maWN0aWNpbw"


@pytest.fixture
def engine() -> Iterator[Engine]:
    yield from integration_engine()


@pytest.fixture
def session_factory(engine: Engine) -> Iterator[sessionmaker[Session]]:
    if not all(inspect(engine).has_table(table) for table in ("app_user", "user_session")):
        skip_or_fail("tabelas da TASK-038 ausentes: rode `uv run alembic upgrade head` antes")
    yield from rolled_back_session_factory(engine)


@pytest.fixture
def users(session_factory: sessionmaker[Session]) -> SqlAlchemyUserRepository:
    return SqlAlchemyUserRepository(session_factory)


@pytest.fixture
def sessions(session_factory: sessionmaker[Session]) -> SqlAlchemyUserSessionRepository:
    return SqlAlchemyUserSessionRepository(session_factory)


def test_repositories_satisfy_the_ports(
    users: SqlAlchemyUserRepository, sessions: SqlAlchemyUserSessionRepository
) -> None:
    user_port: UserRepository = users
    session_port: SessionRepository = sessions
    assert user_port is users and session_port is sessions


def test_user_round_trip_with_credentials(users: SqlAlchemyUserRepository) -> None:
    admin = user_ficticio("admin.integracao", UserRole.ADMIN, user_id="id-admin-integracao")
    users.add(admin, HASH_FICTICIO)

    assert users.get_by_id(admin.id) == admin
    credentials = users.get_credentials_by_username("admin.integracao")
    assert credentials is not None
    assert credentials.user == admin
    assert credentials.password_hash == HASH_FICTICIO
    assert users.get_credentials_by_username("nao.existe") is None


def test_duplicate_username_is_rejected(users: SqlAlchemyUserRepository) -> None:
    users.add(user_ficticio("repetido.int", UserRole.OPERATOR, user_id="id-1"), HASH_FICTICIO)

    with pytest.raises(UsernameTakenError):
        users.add(user_ficticio("repetido.int", UserRole.ADMIN, user_id="id-2"), HASH_FICTICIO)


def test_list_and_update(users: SqlAlchemyUserRepository) -> None:
    # Um segundo admin garante que desativar o primeiro não esbarra no "último admin".
    admin = user_ficticio("zz.admin.int", UserRole.ADMIN, user_id="id-zz-admin")
    other_admin = user_ficticio("zz.admin2.int", UserRole.ADMIN, user_id="id-zz-admin2")
    operator = user_ficticio("zz.operador.int", UserRole.OPERATOR, user_id="id-zz-op")
    users.add(admin, HASH_FICTICIO)
    users.add(other_admin, HASH_FICTICIO)
    users.add(operator, HASH_FICTICIO)

    users.update(replace(admin, active=False, display_name="Renomeado FICTÍCIO"), "novo-hash")

    stored = users.get_credentials_by_username("zz.admin.int")
    assert stored is not None
    assert stored.user.active is False
    assert stored.user.display_name == "Renomeado FICTÍCIO"
    assert stored.password_hash == "novo-hash"
    names = [user.username for user in users.list_users()]
    assert names == sorted(names)
    assert {"zz.admin.int", "zz.operador.int"} <= set(names)


@pytest.mark.parametrize("changes", [{"active": False}, {"role": UserRole.OPERATOR}])
def test_the_last_active_admin_cannot_lose_access(
    users: SqlAlchemyUserRepository,
    session_factory: sessionmaker[Session],
    changes: dict[str, object],
) -> None:
    # Dentro da transação desfeita no fim: desativa os admins que já existirem no banco.
    with session_factory.begin() as db:
        db.execute(text("UPDATE app_user SET active = false WHERE role = 'ADMIN'"))
    last = user_ficticio("ultimo.admin.int", UserRole.ADMIN, user_id="id-ultimo-admin")
    users.add(last, HASH_FICTICIO)

    with pytest.raises(LastAdminError):
        users.update(replace(last, **changes), "hash-que-nao-deve-ser-gravado")  # type: ignore[arg-type]

    stored = users.get_credentials_by_username("ultimo.admin.int")
    assert stored is not None
    assert stored.user == last
    assert stored.password_hash == HASH_FICTICIO
    users.update(replace(last, display_name="Último admin renomeado"))
    assert users.get_by_id(last.id) == replace(last, display_name="Último admin renomeado")


def test_update_of_a_missing_user_fails(users: SqlAlchemyUserRepository) -> None:
    with pytest.raises(UserNotFoundError):
        users.update(user_ficticio("fantasma.int", UserRole.OPERATOR, user_id="id-fantasma"))


def test_sessions_find_the_active_user_until_expiry_and_revocation(
    users: SqlAlchemyUserRepository,
    sessions: SqlAlchemyUserSessionRepository,
    session_factory: sessionmaker[Session],
) -> None:
    operator = user_ficticio("sessao.int", UserRole.OPERATOR, user_id="id-sessao")
    users.add(operator, HASH_FICTICIO)
    token_hash = hash_session_token("token-ficticio-integracao")
    expires_at = INSTANTE_FICTICIO + timedelta(hours=8)
    sessions.add(UserSession(token_hash, operator.id, INSTANTE_FICTICIO, expires_at))

    assert sessions.find_active_user(token_hash, INSTANTE_FICTICIO) == operator
    assert sessions.find_active_user(token_hash, expires_at) is None
    assert sessions.find_active_user(hash_session_token("outro"), INSTANTE_FICTICIO) is None

    users.update(replace(operator, active=False))
    assert sessions.find_active_user(token_hash, INSTANTE_FICTICIO) is None
    users.update(operator)

    sessions.delete(token_hash)
    sessions.delete(token_hash)
    assert sessions.find_active_user(token_hash, INSTANTE_FICTICIO) is None
    with session_factory() as db:
        assert db.scalars(select(UserSessionModel.token_hash)).all() == []


def test_delete_for_user_and_delete_expired(
    users: SqlAlchemyUserRepository, sessions: SqlAlchemyUserSessionRepository
) -> None:
    first = user_ficticio("primeiro.int", UserRole.OPERATOR, user_id="id-primeiro")
    second = user_ficticio("segundo.int", UserRole.OPERATOR, user_id="id-segundo")
    users.add(first, HASH_FICTICIO)
    users.add(second, HASH_FICTICIO)
    later = INSTANTE_FICTICIO + timedelta(hours=8)
    sessions.add(UserSession(hash_session_token("a"), first.id, INSTANTE_FICTICIO, later))
    sessions.add(UserSession(hash_session_token("b"), first.id, INSTANTE_FICTICIO, later))
    sessions.add(
        UserSession(
            hash_session_token("c"), second.id, INSTANTE_FICTICIO, INSTANTE_FICTICIO + timedelta(1)
        )
    )
    sessions.add(
        UserSession(
            hash_session_token("d"),
            second.id,
            INSTANTE_FICTICIO,
            INSTANTE_FICTICIO + timedelta(minutes=1),
        )
    )

    sessions.delete_for_user(first.id)
    sessions.delete_expired(INSTANTE_FICTICIO + timedelta(minutes=1))

    assert sessions.find_active_user(hash_session_token("a"), INSTANTE_FICTICIO) is None
    assert sessions.find_active_user(hash_session_token("c"), INSTANTE_FICTICIO) == second
    assert sessions.find_active_user(hash_session_token("d"), INSTANTE_FICTICIO) is None
