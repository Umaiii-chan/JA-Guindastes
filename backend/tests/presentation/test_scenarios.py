"""Rotas `/api/v1/scenarios*` (TASK-052; ADR-023; ADR-016). Dados FICTÍCIOS, sem banco."""

from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.presentation.api.main import create_app
from app.presentation.api.scenarios import SCENARIOS_PATH
from tests.fixtures.auth_api_ficticia import (
    CSRF_HEADERS,
    auth_client,
    auth_dependencies,
    login_as_admin,
    login_as_operator,
)
from tests.fixtures.auth_ficticia import AuthFicticia
from tests.fixtures.scenario_ficticio import (
    InMemoryScenarioRepository,
    scenario_ficticio,
    spec_json_ficticio,
)


@pytest.fixture
def auth() -> AuthFicticia:
    return AuthFicticia()


@pytest.fixture
def repository() -> InMemoryScenarioRepository:
    return InMemoryScenarioRepository()


@pytest.fixture
def client(auth: AuthFicticia, repository: InMemoryScenarioRepository) -> TestClient:
    return auth_client(create_app(auth=auth_dependencies(auth), scenario_repository=repository))


def body(**changes: Any) -> dict[str, Any]:
    result: dict[str, Any] = {"name": "Pátio FICTÍCIO", "spec": spec_json_ficticio()}
    result.update(changes)
    return result


def test_routes_require_a_session(client: TestClient) -> None:
    assert client.get(SCENARIOS_PATH).status_code == 401
    assert client.get(f"{SCENARIOS_PATH}/x").status_code == 401
    assert client.post(SCENARIOS_PATH, json=body(), headers=CSRF_HEADERS).status_code == 401


def test_routes_are_absent_without_authentication(repository: InMemoryScenarioRepository) -> None:
    client = TestClient(create_app(scenario_repository=repository))

    assert client.get(SCENARIOS_PATH).status_code == 404


def test_operator_creates_lists_and_opens_a_scenario(
    client: TestClient, auth: AuthFicticia
) -> None:
    login_as_operator(client)

    created = client.post(SCENARIOS_PATH, json=body(), headers=CSRF_HEADERS)

    assert created.status_code == 201, created.text
    data = created.json()
    assert data["author_user_id"] == auth.operator.id
    assert data["name"] == "Pátio FICTÍCIO"
    assert data["spec"] == spec_json_ficticio()
    listed = client.get(SCENARIOS_PATH).json()["items"]
    assert [item["id"] for item in listed] == [data["id"]]
    assert "spec" not in listed[0]
    assert client.get(f"{SCENARIOS_PATH}/{data['id']}").json() == data


def test_everyone_logged_in_opens_scenarios_of_others(
    client: TestClient, auth: AuthFicticia, repository: InMemoryScenarioRepository
) -> None:
    repository.add(scenario_ficticio(auth.admin.id))
    login_as_operator(client)

    assert client.get(f"{SCENARIOS_PATH}/cenario-1").status_code == 200
    assert len(client.get(SCENARIOS_PATH).json()["items"]) == 1


def test_unknown_scenario_is_404_with_code(client: TestClient) -> None:
    login_as_admin(client)

    response = client.get(f"{SCENARIOS_PATH}/nao-existe")

    assert response.status_code == 404
    assert response.json()["code"] == "SCENARIO_NOT_FOUND"


def test_author_updates_name_and_spec(
    client: TestClient, auth: AuthFicticia, repository: InMemoryScenarioRepository
) -> None:
    repository.add(scenario_ficticio(auth.operator.id))
    login_as_operator(client)
    new_spec = spec_json_ficticio()
    new_spec["terrain"]["slope_x_percent"] = 5.0

    response = client.put(
        f"{SCENARIOS_PATH}/cenario-1",
        json={"name": " Outro nome ", "spec": new_spec},
        headers=CSRF_HEADERS,
    )

    assert response.status_code == 200, response.text
    assert response.json()["name"] == "Outro nome"
    assert response.json()["spec"]["terrain"]["slope_x_percent"] == 5.0
    assert repository.scenarios["cenario-1"].spec.terrain.slope_x_percent == 5.0


def test_partial_update_keeps_the_other_field(
    client: TestClient, auth: AuthFicticia, repository: InMemoryScenarioRepository
) -> None:
    repository.add(scenario_ficticio(auth.operator.id))
    login_as_operator(client)

    response = client.put(
        f"{SCENARIOS_PATH}/cenario-1", json={"name": "Só o nome"}, headers=CSRF_HEADERS
    )

    assert response.status_code == 200
    assert response.json()["spec"] == spec_json_ficticio()


def test_only_author_or_admin_changes_and_deletes(
    client: TestClient, auth: AuthFicticia, repository: InMemoryScenarioRepository
) -> None:
    repository.add(scenario_ficticio(auth.admin.id))
    login_as_operator(client)

    put = client.put(f"{SCENARIOS_PATH}/cenario-1", json={"name": "X"}, headers=CSRF_HEADERS)
    delete = client.delete(f"{SCENARIOS_PATH}/cenario-1", headers=CSRF_HEADERS)

    assert put.status_code == 403
    assert put.json()["code"] == "FORBIDDEN"
    assert delete.status_code == 403
    assert "cenario-1" in repository.scenarios


def test_admin_changes_and_deletes_scenarios_of_others(
    client: TestClient, auth: AuthFicticia, repository: InMemoryScenarioRepository
) -> None:
    repository.add(scenario_ficticio(auth.operator.id))
    login_as_admin(client)

    put = client.put(f"{SCENARIOS_PATH}/cenario-1", json={"name": "Do admin"}, headers=CSRF_HEADERS)
    delete = client.delete(f"{SCENARIOS_PATH}/cenario-1", headers=CSRF_HEADERS)

    assert put.status_code == 200
    assert put.json()["author_user_id"] == auth.operator.id
    assert delete.status_code == 204
    assert repository.scenarios == {}
    assert client.delete(f"{SCENARIOS_PATH}/cenario-1", headers=CSRF_HEADERS).status_code == 404


def test_writes_without_the_csrf_header_are_refused(client: TestClient) -> None:
    login_as_operator(client)

    assert client.post(SCENARIOS_PATH, json=body()).status_code == 403


@pytest.mark.parametrize(
    "mutation",
    [
        lambda b: b.update(name=""),
        lambda b: b["spec"]["terrain"].update(slope_x_percent=500.0),
        lambda b: b["spec"]["terrain"]["features"][0].update(radius_m=0),
        lambda b: b["spec"]["obstacles"][0].update(height_m=-1),
        lambda b: b["spec"]["obstacles"].append(dict(b["spec"]["obstacles"][0])),
        lambda b: b["spec"].update(extra=1),
        lambda b: b["spec"]["terrain"]["features"][0].update(kind="vulcao"),
        lambda b: b["spec"]["crane"].update(x="1"),
    ],
)
def test_invalid_bodies_answer_422(client: TestClient, mutation: Any) -> None:
    login_as_operator(client)
    invalid = body()
    mutation(invalid)

    response = client.post(SCENARIOS_PATH, json=invalid, headers=CSRF_HEADERS)

    assert response.status_code == 422


def test_domain_violation_reports_the_field_path(client: TestClient) -> None:
    login_as_operator(client)
    invalid = body()
    invalid["spec"]["terrain"]["features"][1]["radius_m"] = 0

    response = client.post(SCENARIOS_PATH, json=invalid, headers=CSRF_HEADERS)

    assert response.status_code == 422
    assert response.json()["detail"][0]["loc"] == [
        "body",
        "spec",
        "terrain",
        "features[1]",
        "radius_m",
    ]


def test_soil_zones_wind_and_flatten_are_saved_and_returned(client: TestClient) -> None:
    login_as_operator(client)
    payload = body()
    payload["spec"]["terrain"]["features"].append(
        {
            "id": "f3",
            "kind": "flatten",
            "center_x": 0.0,
            "center_z": 0.0,
            "radius_m": 5.0,
            "height_m": -0.5,
        }
    )
    payload["spec"]["soil_zones"] = [
        {"id": "s1", "kind": "loose_fill", "center_x": 1.0, "center_z": 2.0, "radius_m": 3.0}
    ]
    payload["spec"]["wind"] = {"speed_ms": 6.0, "direction_deg": 90.0}

    created = client.post(SCENARIOS_PATH, json=payload, headers=CSRF_HEADERS)

    assert created.status_code == 201, created.text
    reopened = client.get(f"{SCENARIOS_PATH}/{created.json()['id']}").json()["spec"]
    assert reopened["soil_zones"] == payload["spec"]["soil_zones"]
    assert reopened["wind"] == payload["spec"]["wind"]
    assert reopened["terrain"]["features"][-1]["kind"] == "flatten"


def test_unknown_soil_kind_answers_422(client: TestClient) -> None:
    login_as_operator(client)
    payload = body()
    payload["spec"]["soil_zones"] = [
        {"id": "s1", "kind": "lava", "center_x": 0.0, "center_z": 0.0, "radius_m": 1.0}
    ]

    assert client.post(SCENARIOS_PATH, json=payload, headers=CSRF_HEADERS).status_code == 422


def test_cargo_and_delivery_are_saved_and_returned(client: TestClient) -> None:
    login_as_operator(client)
    payload = body()
    payload["spec"]["cargo"] = {"x": -6.0, "z": 4.0, "rotation_y_deg": 30.0}
    payload["spec"]["delivery"] = {"x": 8.0, "z": -3.0, "rotation_y_deg": 0.0, "radius_m": 2.5}

    created = client.post(SCENARIOS_PATH, json=payload, headers=CSRF_HEADERS)

    assert created.status_code == 201, created.text
    reopened = client.get(f"{SCENARIOS_PATH}/{created.json()['id']}").json()["spec"]
    assert reopened["cargo"] == payload["spec"]["cargo"]
    assert reopened["delivery"] == payload["spec"]["delivery"]


def test_scenario_without_cargo_omits_the_new_fields(client: TestClient) -> None:
    login_as_operator(client)

    created = client.post(SCENARIOS_PATH, json=body(), headers=CSRF_HEADERS)

    reopened = client.get(f"{SCENARIOS_PATH}/{created.json()['id']}").json()["spec"]
    assert "cargo" not in reopened
    assert "delivery" not in reopened


def test_delivery_radius_out_of_range_answers_422(client: TestClient) -> None:
    login_as_operator(client)
    payload = body()
    payload["spec"]["delivery"] = {"x": 0.0, "z": 0.0, "rotation_y_deg": 0.0, "radius_m": 99.0}

    assert client.post(SCENARIOS_PATH, json=payload, headers=CSRF_HEADERS).status_code == 422
