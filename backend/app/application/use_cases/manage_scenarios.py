"""Casos de uso dos cenários (TASK-052; ADR-023; ADR-016).

Qualquer usuário logado lista e abre; só o **autor** ou um **admin** edita e apaga.
"""

from dataclasses import replace

from app.application.ports.scenario_repository import ScenarioNotFoundError, ScenarioRepository
from app.application.use_cases.authentication import Clock, utc_now
from app.application.use_cases.crane_catalog import IdGenerator, generate_uuid_id
from app.domain.entities.scenario import Scenario, ScenarioSpec, normalize_scenario_name
from app.domain.entities.user import User, UserRole


class ScenarioForbiddenError(Exception):
    """O usuário não é o autor do cenário nem admin."""

    def __init__(self) -> None:
        super().__init__("só o autor do cenário ou um admin pode alterá-lo ou apagá-lo")


class ManageScenarios:
    def __init__(
        self,
        scenarios: ScenarioRepository,
        *,
        clock: Clock = utc_now,
        id_generator: IdGenerator = generate_uuid_id,
    ) -> None:
        self._scenarios = scenarios
        self._clock = clock
        self._id_generator = id_generator

    def list_scenarios(self) -> list[Scenario]:
        return self._scenarios.list_scenarios()

    def get_scenario(self, scenario_id: str) -> Scenario:
        scenario = self._scenarios.get(scenario_id)
        if scenario is None:
            raise ScenarioNotFoundError(scenario_id)
        return scenario

    def create_scenario(self, actor: User, name: str, spec: ScenarioSpec) -> Scenario:
        now = self._clock()
        scenario = Scenario(
            id=self._id_generator(),
            name=normalize_scenario_name(name),
            author_user_id=actor.id,
            created_at=now,
            updated_at=now,
            spec=spec,
        )
        self._scenarios.add(scenario)
        return scenario

    def update_scenario(
        self, actor: User, scenario_id: str, name: str | None, spec: ScenarioSpec | None
    ) -> Scenario:
        current = self.get_scenario(scenario_id)
        self._check_can_change(actor, current)
        updated = replace(
            current,
            name=current.name if name is None else normalize_scenario_name(name),
            spec=current.spec if spec is None else spec,
            updated_at=max(self._clock(), current.created_at),
        )
        self._scenarios.update(updated)
        return updated

    def delete_scenario(self, actor: User, scenario_id: str) -> None:
        current = self.get_scenario(scenario_id)
        self._check_can_change(actor, current)
        self._scenarios.delete(scenario_id)

    @staticmethod
    def _check_can_change(actor: User, scenario: Scenario) -> None:
        if actor.role is not UserRole.ADMIN and actor.id != scenario.author_user_id:
            raise ScenarioForbiddenError()
