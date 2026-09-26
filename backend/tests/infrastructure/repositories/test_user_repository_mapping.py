"""Mapeamento `User` ↔ `AppUserModel` sem banco (TASK-038). Dados FICTÍCIOS."""

from app.domain.entities.user import UserRole
from app.infrastructure.repositories.sqlalchemy_user_repository import (
    user_from_model,
    user_to_model,
)
from tests.fixtures.auth_ficticia import user_ficticio


def test_user_round_trips_through_the_model_with_the_hash_apart() -> None:
    user = user_ficticio("mapa.ficticio", UserRole.ADMIN)

    model = user_to_model(user, "hash-ficticio")

    assert model.role == "ADMIN"
    assert model.password_hash == "hash-ficticio"
    assert user_from_model(model) == user
