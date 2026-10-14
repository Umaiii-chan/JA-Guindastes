"""Rotas `/api/v1/simulations*` (ADR-027; TASK-057). Dados FICTÍCIOS, sem banco."""

import pytest
from fastapi.testclient import TestClient

from app.domain.entities.simulation_recording import MAX_RECORDING_DURATION_MS
from app.domain.entities.user import UserRole
from app.presentation.api.main import create_app
from app.presentation.api.simulations import SIMULATIONS_PATH
from tests.fixtures.auth_api_ficticia import (
    CSRF_HEADERS,
    auth_client,
    auth_dependencies,
    login,
    login_as_admin,
    login_as_operator,
)
from tests.fixtures.auth_ficticia import AuthFicticia, user_ficticio
from tests.fixtures.simulation_recording_fakes import (
    InMemorySimulationRecordingRepository,
    new_recording_body,
)

OUTRO_USERNAME = "outro.ficticio"
OUTRA_SENHA = "senha-ficticia-outro-123"


@pytest.fixture
def auth() -> AuthFicticia:
    result = AuthFicticia()
    other = user_ficticio(OUTRO_USERNAME, UserRole.OPERATOR)
    result.users.add(other, result.hasher.hash(OUTRA_SENHA))
    return result


@pytest.fixture
def repository() -> InMemorySimulationRecordingRepository:
    return InMemorySimulationRecordingRepository()


@pytest.fixture
def client(auth: AuthFicticia, repository: InMemorySimulationRecordingRepository) -> TestClient:
    app = create_app(auth=auth_dependencies(auth), simulation_recordings=repository)
    return auth_client(app)


def create(client: TestClient, **changes: object) -> dict[str, object]:
    response = client.post(
        SIMULATIONS_PATH, json=new_recording_body(**changes), headers=CSRF_HEADERS
    )
    assert response.status_code == 201, response.text
    body: dict[str, object] = response.json()
    return body


def test_routes_require_a_session(client: TestClient) -> None:
    responses = [
        client.get(SIMULATIONS_PATH),
        client.get(f"{SIMULATIONS_PATH}/x"),
        client.post(SIMULATIONS_PATH, json=new_recording_body(), headers=CSRF_HEADERS),
        client.delete(f"{SIMULATIONS_PATH}/x", headers=CSRF_HEADERS),
    ]

    for response in responses:
        assert response.status_code == 401
        assert response.json()["code"] == "NOT_AUTHENTICATED"


def test_operator_creates_lists_and_opens_a_recording(
    client: TestClient, auth: AuthFicticia
) -> None:
    login_as_operator(client)

    created = create(client)
    listing = client.get(SIMULATIONS_PATH).json()
    opened = client.get(f"{SIMULATIONS_PATH}/{created['id']}").json()

    assert created["author_user_id"] == auth.operator.id
    assert created["author_display_name"] == auth.operator.display_name
    assert created["frame_count"] == 3
    assert created["load_chart_refs"] == [{"load_chart_id": "LC-FICTICIA", "version": "v1"}]
    assert [item["id"] for item in listing["items"]] == [created["id"]]
    # A lista não leva o conteúdo; abrir leva os quadros e o cenário.
    assert "frames" not in listing["items"][0]
    assert opened["frames"] == new_recording_body()["frames"]
    assert opened["scenario"] is None


def test_any_logged_user_lists_and_opens_recordings_of_others(client: TestClient) -> None:
    login_as_operator(client)
    created = create(client)
    client.cookies.clear()
    login(client, OUTRO_USERNAME, OUTRA_SENHA)

    assert len(client.get(SIMULATIONS_PATH).json()["items"]) == 1
    assert client.get(f"{SIMULATIONS_PATH}/{created['id']}").status_code == 200


def test_scenario_is_stored_as_sent(client: TestClient) -> None:
    login_as_operator(client)
    scenario = {"terrain": {"slopeXPercent": 1}, "obstacles": [], "crane": {"x": 0}}

    created = create(client, scenario=scenario)

    assert client.get(f"{SIMULATIONS_PATH}/{created['id']}").json()["scenario"] == scenario


def test_open_unknown_recording_is_404(client: TestClient) -> None:
    login_as_operator(client)

    response = client.get(f"{SIMULATIONS_PATH}/nao-existe")

    assert response.status_code == 404
    assert response.json()["code"] == "RECORDING_NOT_FOUND"


@pytest.mark.parametrize(
    "changes",
    [{"name": "   "}, {"name": "x" * 121}, {"frames": []}, {"configuration_id": " "}],
)
def test_invalid_body_is_422(client: TestClient, changes: dict[str, object]) -> None:
    login_as_operator(client)

    response = client.post(
        SIMULATIONS_PATH, json=new_recording_body(**changes), headers=CSRF_HEADERS
    )

    assert response.status_code == 422


def test_recording_longer_than_the_limit_is_422(client: TestClient) -> None:
    login_as_operator(client)

    response = client.post(
        SIMULATIONS_PATH,
        json=new_recording_body(duration_ms=MAX_RECORDING_DURATION_MS + 1),
        headers=CSRF_HEADERS,
    )

    assert response.status_code == 422
    assert response.json()["code"] == "RECORDING_TOO_LONG"


def test_recording_larger_than_the_limit_is_413(client: TestClient) -> None:
    login_as_operator(client)
    big_frame = {"tMs": 0, "padding": "x" * (5 * 1024 * 1024)}

    response = client.post(
        SIMULATIONS_PATH, json=new_recording_body(frames=[big_frame]), headers=CSRF_HEADERS
    )

    assert response.status_code == 413
    assert response.json()["code"] == "RECORDING_TOO_LARGE"


def test_only_the_author_or_an_admin_deletes(
    client: TestClient, repository: InMemorySimulationRecordingRepository
) -> None:
    login_as_operator(client)
    first = create(client)
    second = create(client)

    client.cookies.clear()
    login(client, OUTRO_USERNAME, OUTRA_SENHA)
    forbidden = client.delete(f"{SIMULATIONS_PATH}/{first['id']}", headers=CSRF_HEADERS)

    client.cookies.clear()
    login_as_operator(client)
    by_author = client.delete(f"{SIMULATIONS_PATH}/{first['id']}", headers=CSRF_HEADERS)

    client.cookies.clear()
    login_as_admin(client)
    by_admin = client.delete(f"{SIMULATIONS_PATH}/{second['id']}", headers=CSRF_HEADERS)
    again = client.delete(f"{SIMULATIONS_PATH}/{second['id']}", headers=CSRF_HEADERS)

    assert forbidden.status_code == 403
    assert forbidden.json()["code"] == "FORBIDDEN"
    assert by_author.status_code == 204
    assert by_admin.status_code == 204
    assert again.status_code == 404
    assert repository.recordings == {}


def test_recording_routes_are_absent_without_auth(
    repository: InMemorySimulationRecordingRepository,
) -> None:
    app = create_app(simulation_recordings=repository)

    assert SIMULATIONS_PATH not in app.openapi()["paths"]
