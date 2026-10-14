"""Catálogo de acessórios de içamento no PostgreSQL via SQLAlchemy (TASK-056).

Implementa `AccessoryRepository` e `AccessoryProvider`. Cada método abre a própria sessão e a
própria transação, como o repositório do catálogo de guindastes (TASK-022).
"""

from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from app.application.ports.accessory_repository import AccessoryAlreadyExistsError
from app.domain.entities.accessory import Accessory, AccessoryType
from app.domain.value_objects.mass import Mass
from app.infrastructure.database.models.accessory import AccessoryModel
from app.infrastructure.repositories._integrity import violated_constraint

_PRIMARY_KEY = "pk_accessories"


def accessory_to_model(accessory: Accessory) -> AccessoryModel:
    return AccessoryModel(
        id=accessory.id,
        type=accessory.type.value,
        name=accessory.name,
        weight_kg=accessory.weight.kilograms,
        rigging_height_m=accessory.rigging_height_m,
        model_file=accessory.model_file,
        credit=accessory.credit,
        license=accessory.license,
    )


def accessory_from_model(model: AccessoryModel) -> Accessory:
    return Accessory(
        id=model.id,
        type=AccessoryType(model.type),
        name=model.name,
        weight=Mass(model.weight_kg),
        rigging_height_m=model.rigging_height_m,
        model_file=model.model_file,
        credit=model.credit,
        license=model.license,
    )


class SqlAlchemyAccessoryRepository:
    def __init__(self, session_factory: sessionmaker[Session]) -> None:
        self._session_factory = session_factory

    def add(self, accessory: Accessory) -> None:
        try:
            with self._session_factory.begin() as session:
                session.add(accessory_to_model(accessory))
        except IntegrityError as error:
            if violated_constraint(error) == _PRIMARY_KEY:
                raise AccessoryAlreadyExistsError(accessory.id) from error
            raise

    def get(self, accessory_id: str) -> Accessory | None:
        with self._session_factory() as session:
            model = session.get(AccessoryModel, accessory_id)
            return None if model is None else accessory_from_model(model)

    def get_accessories(self, accessory_ids: Sequence[str]) -> dict[str, Accessory]:
        if not accessory_ids:
            return {}
        with self._session_factory() as session:
            rows = session.scalars(
                select(AccessoryModel).where(AccessoryModel.id.in_(set(accessory_ids)))
            ).all()
            return {row.id: accessory_from_model(row) for row in rows}

    def list_all(self) -> list[Accessory]:
        with self._session_factory() as session:
            rows = session.scalars(
                select(AccessoryModel).order_by(AccessoryModel.name, AccessoryModel.id)
            ).all()
            return [accessory_from_model(row) for row in rows]

    def update(self, accessory: Accessory) -> bool:
        with self._session_factory.begin() as session:
            model = session.get(AccessoryModel, accessory.id)
            if model is None:
                return False
            model.type = accessory.type.value
            model.name = accessory.name
            model.weight_kg = accessory.weight.kilograms
            model.rigging_height_m = accessory.rigging_height_m
            model.model_file = accessory.model_file
            model.credit = accessory.credit
            model.license = accessory.license
            return True

    def delete(self, accessory_id: str) -> bool:
        with self._session_factory.begin() as session:
            model = session.get(AccessoryModel, accessory_id)
            if model is None:
                return False
            session.delete(model)
            return True
