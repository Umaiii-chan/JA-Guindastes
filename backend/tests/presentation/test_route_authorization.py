"""Autorização aplicada às rotas existentes e ao WebSocket (ADR-016 §§ 1 e 3; TASK-038).

Matriz do CA-3: `health` pública; leituras do catálogo e das tabelas, `load-charts/validate` e
avaliação REST para qualquer perfil; cadastros do catálogo, `load-charts/import` e `activate` só
para `ADMIN`. WebSocket (CA-5): `4403` com `Origin` diferente do `Host`, `4401` sem sessão.
Adapters em memória e dados FICTÍCIOS.
"""

from functools import partial
from typing import Any

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.infrastructure.importers.csv_load_chart_parser import CsvLoadChartParser
from app.infrastructure.importers.xlsx_resource_limits import (
    XlsxLimits,
    select_limited_load_chart_parser,
)
from app.presentation.api.evaluations import EVALUATIONS_PATH, shared_evaluate_operation
from app.presentation.api.health import HEALTH_PATH
from app.presentation.api.load_chart_persistence import (
    IMPORT_PATH,
    LoadChartPersistenceDependencies,
)
from app.presentation.api.load_charts import LOAD_CHARTS_PREFIX, VALIDATE_PATH
from app.presentation.api.main import create_app
from app.presentation.websocket.evaluation import EVALUATION_WEBSOCKET_PATH
from tests.fixtures.auth_api_ficticia import (
    CSRF_HEADERS,
    SAME_ORIGIN,
    auth_client,
    auth_dependencies,
    login_as_admin,
    login_as_operator,
)
from tests.fixtures.auth_ficticia import AuthFicticia
from tests.fixtures.avaliacao_operacional_ficticia import CONFIGURATION_AVALIACAO_FICTICIA_ID
from tests.fixtures.crane_catalog_ficticio import InMemoryCraneCatalog
from tests.fixtures.load_chart_ficticio import CONFIGURATION_FICTICIA_ID
from tests.fixtures.load_chart_persistence_fakes import InMemoryFileStorage, InMemoryLoadChartStore
from tests.presentation.websocket.test_evaluation_websocket import (
    build_evaluate_operation_ficticio,
)

EVALUATION_BODY = {
    "configuration_id": CONFIGURATION_AVALIACAO_FICTICIA_ID,
    "boom_length_m": 20.0,
    "boom_angle_deg": 30.0,
    "turret_rotation_deg": 0.0,
    "cable_length_m": 1.0,
    "load_weight_kg": 1500.0,
}
STATE_CHANGED = {"type": "simulation.state.changed", "sequence": 1, "payload": EVALUATION_BODY}

READ_ROUTES: list[tuple[str, str, dict[str, Any]]] = [
    ("GET", "/api/v1/manufacturers", {}),
    ("GET", "/api/v1/manufacturers/fab-inexistente", {}),
    ("GET", "/api/v1/cranes", {}),
    ("GET", "/api/v1/cranes/gui-inexistente", {}),
    ("GET", "/api/v1/cranes/gui-inexistente/configurations", {}),
    ("GET", "/api/v1/configurations/cfg-inexistente", {}),
    ("GET", f"{LOAD_CHARTS_PREFIX}/tabela-inexistente", {}),
    ("POST", VALIDATE_PATH, {}),
    ("POST", EVALUATIONS_PATH, {"json": EVALUATION_BODY}),
]
WRITE_ROUTES: list[tuple[str, str, dict[str, Any]]] = [
    ("POST", "/api/v1/manufacturers", {"json": {"name": "Fabricante FICTÍCIO"}}),
    ("POST", "/api/v1/cranes", {"json": {"manufacturer_id": "x", "model_name": "FICTÍCIO"}}),
    ("POST", "/api/v1/cranes/gui-inexistente/configurations", {"json": {"name": "FICTÍCIA"}}),
    ("POST", IMPORT_PATH, {}),
    ("POST", f"{LOAD_CHARTS_PREFIX}/tabela-inexistente/activate", {}),
]


@pytest.fixture
def auth() -> AuthFicticia:
    return AuthFicticia()


@pytest.fixture
def client(auth: AuthFicticia) -> TestClient:
    store = InMemoryLoadChartStore({CONFIGURATION_FICTICIA_ID})
    app = create_app(
        load_chart_parser=CsvLoadChartParser(),
        evaluation=shared_evaluate_operation(build_evaluate_operation_ficticio()),
        evaluation_websocket=build_evaluate_operation_ficticio(),
        catalog_repository=InMemoryCraneCatalog(),
        load_chart_persistence=LoadChartPersistenceDependencies(
            parser_selector=partial(select_limited_load_chart_parser, limits=XlsxLimits()),
            repository=store,
            activation=store,
            file_storage=InMemoryFileStorage(),
        ),
        auth=auth_dependencies(auth),
    )
    return auth_client(app)


def call(client: TestClient, method: str, path: str, options: dict[str, Any]) -> Any:
    headers = CSRF_HEADERS if method != "GET" else {}
    return client.request(method, path, headers=headers, **options)


def test_health_and_openapi_stay_public(client: TestClient) -> None:
    assert client.get(HEALTH_PATH).status_code == 200
    assert client.get("/openapi.json").status_code == 200


@pytest.mark.parametrize(("method", "path", "options"), READ_ROUTES + WRITE_ROUTES)
def test_every_business_route_requires_a_session(
    client: TestClient, method: str, path: str, options: dict[str, Any]
) -> None:
    response = call(client, method, path, options)

    assert response.status_code == 401
    assert response.json()["code"] == "NOT_AUTHENTICATED"


@pytest.mark.parametrize(("method", "path", "options"), READ_ROUTES)
def test_operator_can_read_validate_and_evaluate(
    client: TestClient, method: str, path: str, options: dict[str, Any]
) -> None:
    login_as_operator(client)

    response = call(client, method, path, options)

    assert response.status_code not in (401, 403), response.text


@pytest.mark.parametrize(("method", "path", "options"), WRITE_ROUTES)
def test_operator_cannot_write(
    client: TestClient, method: str, path: str, options: dict[str, Any]
) -> None:
    login_as_operator(client)

    response = call(client, method, path, options)

    assert response.status_code == 403
    assert response.json() == {"detail": "esta ação exige o perfil ADMIN", "code": "FORBIDDEN"}


@pytest.mark.parametrize(("method", "path", "options"), READ_ROUTES + WRITE_ROUTES)
def test_admin_can_do_everything(
    client: TestClient, method: str, path: str, options: dict[str, Any]
) -> None:
    login_as_admin(client)

    response = call(client, method, path, options)

    assert response.status_code not in (401, 403), response.text


def test_admin_creates_a_manufacturer_and_the_operator_reads_it(
    client: TestClient, auth: AuthFicticia
) -> None:
    login_as_admin(client)
    created = client.post(
        "/api/v1/manufacturers", json={"name": "Fabricante FICTÍCIO"}, headers=CSRF_HEADERS
    )
    assert created.status_code == 201

    login_as_operator(client)
    listed = client.get("/api/v1/manufacturers")

    assert [item["name"] for item in listed.json()] == ["Fabricante FICTÍCIO"]


def test_write_route_without_csrf_header_is_refused_before_authorization(
    client: TestClient,
) -> None:
    login_as_admin(client)

    response = client.post("/api/v1/manufacturers", json={"name": "Fabricante FICTÍCIO"})

    assert response.status_code == 403
    assert response.json()["code"] == "CSRF_HEADER_MISSING"


# --- WebSocket (CA-5) --------------------------------------------------------------------------


def with_session_cookie(client: TestClient, headers: dict[str, str]) -> dict[str, str]:
    # O `TestClient` abre o WebSocket em `ws://` e não reenvia o cookie `Secure`: vai à mão.
    return {**headers, "Cookie": f"crane_session={client.cookies['crane_session']}"}


def test_websocket_with_session_and_same_origin_evaluates(client: TestClient) -> None:
    login_as_operator(client)
    headers = with_session_cookie(client, SAME_ORIGIN)

    with client.websocket_connect(EVALUATION_WEBSOCKET_PATH, headers=headers) as websocket:
        websocket.send_json(STATE_CHANGED)
        reply = websocket.receive_json()

    assert reply["type"] == "simulation.evaluated"


def test_websocket_without_session_is_closed_with_4401(client: TestClient) -> None:
    with client.websocket_connect(EVALUATION_WEBSOCKET_PATH, headers=SAME_ORIGIN) as websocket:
        with pytest.raises(WebSocketDisconnect) as closed:
            websocket.receive_json()

    assert closed.value.code == 4401


@pytest.mark.parametrize(
    "headers",
    [
        {"Origin": "https://site-malicioso.invalid"},
        {"Origin": "https://testserver.site-malicioso.invalid"},
        {"Origin": "null"},
        {},
    ],
)
def test_websocket_from_another_origin_is_closed_with_4403(
    client: TestClient, headers: dict[str, str]
) -> None:
    login_as_admin(client)
    headers = with_session_cookie(client, headers)

    with client.websocket_connect(EVALUATION_WEBSOCKET_PATH, headers=headers) as websocket:
        with pytest.raises(WebSocketDisconnect) as closed:
            websocket.receive_json()

    assert closed.value.code == 4403


def test_websocket_origin_check_ignores_the_port_changed_by_proxies(client: TestClient) -> None:
    # nginx repassa `Host` sem a porta; o proxy do Vite troca a porta pela do backend.
    login_as_admin(client)
    headers = with_session_cookie(
        client, {"Origin": "http://testserver:8080", "Host": "testserver"}
    )

    with client.websocket_connect(EVALUATION_WEBSOCKET_PATH, headers=headers) as websocket:
        websocket.send_json(STATE_CHANGED)
        assert websocket.receive_json()["type"] == "simulation.evaluated"


def test_websocket_without_auth_stays_open_without_origin() -> None:
    # Sem banco (ADR-016 § 5): nada muda no WebSocket.
    client = TestClient(create_app(evaluation_websocket=build_evaluate_operation_ficticio()))

    with client.websocket_connect(EVALUATION_WEBSOCKET_PATH) as websocket:
        websocket.send_json(STATE_CHANGED)
        assert websocket.receive_json()["type"] == "simulation.evaluated"


def test_without_auth_unsafe_methods_do_not_need_the_csrf_header() -> None:
    client = TestClient(create_app(catalog_repository=InMemoryCraneCatalog()))

    response = client.post("/api/v1/manufacturers", json={"name": "Fabricante FICTÍCIO"})

    assert response.status_code == 201
