"""Rotas REST do catálogo de acessórios (TASK-056) e a avaliação com `accessory_ids`.

`TestClient` com repositório em memória e dados FICTÍCIOS (ADR-012).
"""

from typing import Any
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from starlette.testclient import WebSocketTestSession

from app.domain.services.conservative_tabulated_lookup import ConservativeTabulatedLookup
from app.presentation.api.evaluations import EvaluationDependencies
from app.presentation.api.main import create_app
from app.presentation.websocket.evaluation import EVALUATION_WEBSOCKET_PATH
from tests.fixtures.acessorios_ficticios import (
    GANCHO_ACESSORIO_FICTICIO,
    MANILHA_FICTICIA,
    InMemoryAccessories,
)
from tests.fixtures.avaliacao_operacional_ficticia import (
    CONFIGURATION_AVALIACAO_FICTICIA_ID,
    build_load_chart_avaliacao_ficticio,
)
from tests.fixtures.crane_geometry_ficticia import build_crane_geometry_ficticia
from tests.presentation.test_evaluations import (
    FakeActiveLoadChartProvider,
    FakeCraneGeometryProvider,
    body_ficticio,
)
from tests.presentation.websocket.test_evaluation_websocket import state_changed_ficticio

ACCESSORIES = "/api/v1/accessories"
EVALUATIONS = "/api/v1/evaluations"


@pytest.fixture
def repository() -> InMemoryAccessories:
    return InMemoryAccessories(GANCHO_ACESSORIO_FICTICIO, MANILHA_FICTICIA)


@pytest.fixture
def client(repository: InMemoryAccessories) -> TestClient:
    return TestClient(create_app(accessory_repository=repository))


def accessory_body(**overrides: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "type": "POLYESTER_SLING",
        "name": "Cinta FICTÍCIA",
        "weight_kg": 15.0,
        "rigging_height_m": 2.0,
    }
    body.update(overrides)
    return body


# --- CRUD ---------------------------------------------------------------------------------------


def test_list_returns_the_accessories_by_name(client: TestClient) -> None:
    response = client.get(ACCESSORIES)

    assert response.status_code == 200
    assert [item["name"] for item in response.json()] == ["Manilha FICTÍCIA", "Moitão FICTÍCIO"]


def test_get_returns_every_field(client: TestClient) -> None:
    response = client.get(f"{ACCESSORIES}/{MANILHA_FICTICIA.id}")

    assert response.status_code == 200
    assert response.json() == {
        "id": MANILHA_FICTICIA.id,
        "type": "SHACKLE",
        "name": "Manilha FICTÍCIA",
        "weight_kg": 20.0,
        "rigging_height_m": 0.3,
        "model_file": "manilha.glb",
        "credit": "Autor FICTÍCIO",
        "license": "CC0",
    }


def test_get_unknown_id_returns_404(client: TestClient) -> None:
    assert client.get(f"{ACCESSORIES}/nao-existe").status_code == 404


def test_post_creates_with_server_generated_uuid_and_pending_model(client: TestClient) -> None:
    response = client.post(ACCESSORIES, json=accessory_body())

    assert response.status_code == 201
    body = response.json()
    assert UUID(body["id"]).version == 4
    assert body["model_file"] is None
    assert client.get(f"{ACCESSORIES}/{body['id']}").json() == body


@pytest.mark.parametrize(
    "overrides",
    [
        {"type": "JIB"},
        {"name": "  "},
        {"weight_kg": -1.0},
        {"weight_kg": 100_001.0},
        {"rigging_height_m": 50.5},
        {"model_file": "../x.glb"},
        {"model_file": "pasta/x.glb"},
        {"model_file": "x.fbx"},
        {"id": "forcado"},
    ],
)
def test_post_invalid_body_returns_422(client: TestClient, overrides: dict[str, Any]) -> None:
    assert client.post(ACCESSORIES, json=accessory_body(**overrides)).status_code == 422


def test_patch_changes_only_the_given_fields_and_can_clear_the_model(client: TestClient) -> None:
    response = client.patch(
        f"{ACCESSORIES}/{MANILHA_FICTICIA.id}", json={"weight_kg": 25.0, "model_file": None}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["weight_kg"] == 25.0
    assert body["model_file"] is None
    assert body["name"] == "Manilha FICTÍCIA"
    assert body["credit"] == "Autor FICTÍCIO"


@pytest.mark.parametrize(
    "body", [{}, {"name": None}, {"weight_kg": None}, {"model_file": "a/b.glb"}]
)
def test_patch_invalid_body_returns_422(client: TestClient, body: dict[str, Any]) -> None:
    assert client.patch(f"{ACCESSORIES}/{MANILHA_FICTICIA.id}", json=body).status_code == 422


def test_patch_unknown_id_returns_404(client: TestClient) -> None:
    assert client.patch(f"{ACCESSORIES}/nao-existe", json={"name": "X"}).status_code == 404


def test_delete_removes_and_second_delete_returns_404(client: TestClient) -> None:
    assert client.delete(f"{ACCESSORIES}/{MANILHA_FICTICIA.id}").status_code == 204
    assert client.get(f"{ACCESSORIES}/{MANILHA_FICTICIA.id}").status_code == 404
    assert client.delete(f"{ACCESSORIES}/{MANILHA_FICTICIA.id}").status_code == 404


# --- Avaliação REST -----------------------------------------------------------------------------


def evaluation_client(repository: InMemoryAccessories) -> TestClient:
    return TestClient(
        create_app(
            evaluation=EvaluationDependencies(
                crane_geometry_provider=FakeCraneGeometryProvider(
                    {CONFIGURATION_AVALIACAO_FICTICIA_ID: build_crane_geometry_ficticia()}
                ),
                active_load_chart_provider=FakeActiveLoadChartProvider(
                    {CONFIGURATION_AVALIACAO_FICTICIA_ID: build_load_chart_avaliacao_ficticio()}
                ),
                load_chart_interpolator=ConservativeTabulatedLookup(),
                accessory_provider=repository,
            )
        )
    )


def test_evaluation_sums_the_accessories_weight_in_the_compared_weight(
    repository: InMemoryAccessories,
) -> None:
    response = evaluation_client(repository).post(
        EVALUATIONS,
        json=body_ficticio(accessory_ids=[GANCHO_ACESSORIO_FICTICIO.id, MANILHA_FICTICIA.id]),
    )

    body = response.json()
    assert response.status_code == 200
    assert body["status"] == "EVALUATED"
    assert body["accessories_weight_kg"] == 220.0
    assert body["compared_weight_kg"] == 1720.0
    assert body["utilization_percent"] == pytest.approx(86.0)
    assert body["accessories"] == [
        {"id": GANCHO_ACESSORIO_FICTICIO.id, "name": "Moitão FICTÍCIO", "weight_kg": 200.0},
        {"id": MANILHA_FICTICIA.id, "name": "Manilha FICTÍCIA", "weight_kg": 20.0},
    ]


def test_evaluation_without_accessory_ids_has_null_weight_and_empty_list(
    repository: InMemoryAccessories,
) -> None:
    body = evaluation_client(repository).post(EVALUATIONS, json=body_ficticio()).json()

    assert body["accessories_weight_kg"] is None
    assert body["accessories"] == []
    assert body["compared_weight_kg"] == 1500.0


def test_evaluation_with_unknown_accessory_is_not_evaluable(
    repository: InMemoryAccessories,
) -> None:
    body = (
        evaluation_client(repository)
        .post(EVALUATIONS, json=body_ficticio(accessory_ids=["ACC-INEXISTENTE"]))
        .json()
    )

    assert body["status"] == "NOT_EVALUABLE"
    assert body["reasons"] == [{"code": "ACCESSORY_NOT_FOUND", "category": "EVALUATION"}]
    assert body["geometry"] is not None


@pytest.mark.parametrize("ids", [[""], [1], "x", ["a"] * 21])
def test_evaluation_malformed_accessory_ids_return_422(
    repository: InMemoryAccessories, ids: Any
) -> None:
    response = evaluation_client(repository).post(
        EVALUATIONS, json=body_ficticio(accessory_ids=ids)
    )

    assert response.status_code == 422


# --- WebSocket ----------------------------------------------------------------------------------


def test_websocket_evaluation_sums_the_accessories(repository: InMemoryAccessories) -> None:
    from fastapi import FastAPI

    from app.application.use_cases.evaluate_operation import EvaluateOperation
    from app.presentation.websocket.evaluation import create_evaluation_websocket_router

    operation = EvaluateOperation(
        crane_geometry_provider=FakeCraneGeometryProvider(
            {CONFIGURATION_AVALIACAO_FICTICIA_ID: build_crane_geometry_ficticia()}
        ),
        active_load_chart_provider=FakeActiveLoadChartProvider(
            {CONFIGURATION_AVALIACAO_FICTICIA_ID: build_load_chart_avaliacao_ficticio()}
        ),
        load_chart_interpolator=ConservativeTabulatedLookup(),
        accessory_provider=repository,
    )
    app = FastAPI()
    app.include_router(create_evaluation_websocket_router(operation))
    message = state_changed_ficticio()
    message["payload"]["accessory_ids"] = [MANILHA_FICTICIA.id]

    with TestClient(app).websocket_connect(EVALUATION_WEBSOCKET_PATH) as session:
        session: WebSocketTestSession
        session.send_json(message)
        payload = session.receive_json()["payload"]

    assert payload["result"] == "EVALUATED"
    assert payload["accessories_weight_kg"] == 20.0
    assert payload["compared_weight_kg"] == 1520.0
    assert payload["accessories"] == [
        {"id": MANILHA_FICTICIA.id, "name": "Manilha FICTÍCIA", "weight_kg": 20.0}
    ]
