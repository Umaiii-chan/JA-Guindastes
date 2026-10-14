"""Cenários FICTÍCIOS e repositório em memória (TASK-052; ADR-023)."""

from dataclasses import replace
from typing import Any

from app.application.ports.scenario_repository import ScenarioNotFoundError
from app.domain.entities.scenario import (
    CranePlacementSpec,
    FeatureKind,
    ObstacleKind,
    ObstacleSpec,
    Scenario,
    ScenarioSpec,
    TerrainFeatureSpec,
    TerrainSpec,
)
from tests.fixtures.auth_ficticia import INSTANTE_FICTICIO


def spec_ficticio() -> ScenarioSpec:
    return ScenarioSpec(
        terrain=TerrainSpec(
            slope_x_percent=2.0,
            slope_z_percent=-1.5,
            features=(
                TerrainFeatureSpec("f1", FeatureKind.MOUND, 5.0, 3.0, 4.0, 1.2),
                TerrainFeatureSpec(
                    "f2", FeatureKind.RAMP, -6.0, 0.0, 5.0, 1.0, direction_deg=90.0, width_m=3.0
                ),
            ),
        ),
        obstacles=(
            ObstacleSpec("o1", "Caixa FICTÍCIA", ObstacleKind.BOX, 8.0, 2.0, 3.0, 2.0, 2.5, 30.0),
            ObstacleSpec("o2", "Silo FICTÍCIO", ObstacleKind.CYLINDER, -4.0, 9.0, 2.0, 2.0, 6.0, 0),
        ),
        crane=CranePlacementSpec(x=1.0, z=-2.0, heading_deg=15.0),
    )


def spec_json_ficticio() -> dict[str, Any]:
    """O mesmo cenário de `spec_ficticio`, como JSON do contrato (`snake_case`)."""
    return {
        "terrain": {
            "slope_x_percent": 2.0,
            "slope_z_percent": -1.5,
            "features": [
                {
                    "id": "f1",
                    "kind": "mound",
                    "center_x": 5.0,
                    "center_z": 3.0,
                    "radius_m": 4.0,
                    "height_m": 1.2,
                },
                {
                    "id": "f2",
                    "kind": "ramp",
                    "center_x": -6.0,
                    "center_z": 0.0,
                    "radius_m": 5.0,
                    "height_m": 1.0,
                    "direction_deg": 90.0,
                    "width_m": 3.0,
                },
            ],
        },
        "obstacles": [
            {
                "id": "o1",
                "label": "Caixa FICTÍCIA",
                "kind": "box",
                "center_x": 8.0,
                "center_z": 2.0,
                "width_m": 3.0,
                "depth_m": 2.0,
                "height_m": 2.5,
                "rotation_y_deg": 30.0,
            },
            {
                "id": "o2",
                "label": "Silo FICTÍCIO",
                "kind": "cylinder",
                "center_x": -4.0,
                "center_z": 9.0,
                "width_m": 2.0,
                "depth_m": 2.0,
                "height_m": 6.0,
                "rotation_y_deg": 0.0,
            },
        ],
        "crane": {"x": 1.0, "z": -2.0, "heading_deg": 15.0},
    }


def scenario_ficticio(author_user_id: str, scenario_id: str = "cenario-1") -> Scenario:
    return Scenario(
        id=scenario_id,
        name="Pátio FICTÍCIO",
        author_user_id=author_user_id,
        created_at=INSTANTE_FICTICIO,
        updated_at=INSTANTE_FICTICIO,
        spec=spec_ficticio(),
    )


class InMemoryScenarioRepository:
    def __init__(self) -> None:
        self.scenarios: dict[str, Scenario] = {}

    def add(self, scenario: Scenario) -> None:
        self.scenarios[scenario.id] = scenario

    def get(self, scenario_id: str) -> Scenario | None:
        return self.scenarios.get(scenario_id)

    def list_scenarios(self) -> list[Scenario]:
        return sorted(self.scenarios.values(), key=lambda s: s.updated_at, reverse=True)

    def update(self, scenario: Scenario) -> None:
        current = self.scenarios.get(scenario.id)
        if current is None:
            raise ScenarioNotFoundError(scenario.id)
        self.scenarios[scenario.id] = replace(
            current, name=scenario.name, spec=scenario.spec, updated_at=scenario.updated_at
        )

    def delete(self, scenario_id: str) -> None:
        if scenario_id not in self.scenarios:
            raise ScenarioNotFoundError(scenario_id)
        del self.scenarios[scenario_id]
