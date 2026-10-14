"""Mapeamento `Scenario` ↔ `ScenarioModel` sem banco (TASK-052). Dados FICTÍCIOS."""

from app.infrastructure.repositories.sqlalchemy_scenario_repository import (
    scenario_from_model,
    scenario_to_model,
)
from tests.fixtures.scenario_ficticio import scenario_ficticio, spec_json_ficticio


def test_scenario_round_trips_through_the_model() -> None:
    scenario = scenario_ficticio("autor-1")

    model = scenario_to_model(scenario)

    assert model.author_user_id == "autor-1"
    assert model.spec == spec_json_ficticio()
    assert scenario_from_model(model) == scenario
