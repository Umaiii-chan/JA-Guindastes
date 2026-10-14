"""Porta de gravação e consulta de cenários (TASK-052; ADR-023)."""

from typing import Protocol

from app.domain.entities.scenario import Scenario


class ScenarioNotFoundError(Exception):
    """Não existe cenário com esse id."""

    def __init__(self, scenario_id: str) -> None:
        self.scenario_id = scenario_id
        super().__init__(f"cenário com id {scenario_id!r} não existe")


class ScenarioRepository(Protocol):
    def add(self, scenario: Scenario) -> None: ...

    def get(self, scenario_id: str) -> Scenario | None: ...

    def list_scenarios(self) -> list[Scenario]:
        """Todos os cenários, do mais recentemente alterado ao mais antigo."""
        ...

    def update(self, scenario: Scenario) -> None:
        """Grava nome, spec e `updated_at`; autor e criação não mudam. `ScenarioNotFoundError`."""
        ...

    def delete(self, scenario_id: str) -> None:
        """Apaga o cenário. `ScenarioNotFoundError` se não existe."""
        ...
