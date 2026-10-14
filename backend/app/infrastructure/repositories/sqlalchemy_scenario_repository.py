"""Cenários no PostgreSQL via SQLAlchemy (TASK-052; ADR-023).

Implementa `ScenarioRepository`. Cada método abre a própria sessão e a própria transação, como os
demais repositórios.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.application.ports.scenario_repository import ScenarioNotFoundError
from app.domain.entities.scenario import (
    Scenario,
    scenario_spec_from_dict,
    scenario_spec_to_dict,
)
from app.infrastructure.database.models.scenario import ScenarioModel


def scenario_from_model(model: ScenarioModel) -> Scenario:
    return Scenario(
        id=model.id,
        name=model.name,
        author_user_id=model.author_user_id,
        created_at=model.created_at,
        updated_at=model.updated_at,
        spec=scenario_spec_from_dict(model.spec),
    )


def scenario_to_model(scenario: Scenario) -> ScenarioModel:
    return ScenarioModel(
        id=scenario.id,
        name=scenario.name,
        author_user_id=scenario.author_user_id,
        created_at=scenario.created_at,
        updated_at=scenario.updated_at,
        spec=scenario_spec_to_dict(scenario.spec),
    )


class SqlAlchemyScenarioRepository:
    """Implementa `ScenarioRepository`."""

    def __init__(self, session_factory: sessionmaker[Session]) -> None:
        self._session_factory = session_factory

    def add(self, scenario: Scenario) -> None:
        with self._session_factory.begin() as session:
            session.add(scenario_to_model(scenario))

    def get(self, scenario_id: str) -> Scenario | None:
        with self._session_factory() as session:
            model = session.get(ScenarioModel, scenario_id)
            return None if model is None else scenario_from_model(model)

    def list_scenarios(self) -> list[Scenario]:
        statement = select(ScenarioModel).order_by(
            ScenarioModel.updated_at.desc(), ScenarioModel.name
        )
        with self._session_factory() as session:
            return [scenario_from_model(model) for model in session.scalars(statement)]

    def update(self, scenario: Scenario) -> None:
        with self._session_factory.begin() as session:
            model = session.get(ScenarioModel, scenario.id)
            if model is None:
                raise ScenarioNotFoundError(scenario.id)
            model.name = scenario.name
            model.updated_at = scenario.updated_at
            model.spec = scenario_spec_to_dict(scenario.spec)

    def delete(self, scenario_id: str) -> None:
        with self._session_factory.begin() as session:
            model = session.get(ScenarioModel, scenario_id)
            if model is None:
                raise ScenarioNotFoundError(scenario_id)
            session.delete(model)
