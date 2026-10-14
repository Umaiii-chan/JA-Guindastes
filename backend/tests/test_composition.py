"""Raiz de composição `app.main` sem PostgreSQL (TASK-029; vinda de `test_evaluations.py`).

- sem `DATABASE_URL`: a API sobe, avalia como "não avaliável" sem inventar dados, registra o
  WebSocket e a saúde mostra `NOT_CONFIGURED`, com aviso no log;
- `DATABASE_URL` inválida: a aplicação não sobe, e o erro não repete a URL;
- `DATABASE_URL` apontando para um banco que não responde: a aplicação sobe (criar o engine não
  conecta), a saúde mostra `DOWN` sem vazar URL, e a avaliação REST dá 500;
- ciclo de vida da conexão por requisição, com um SQLite em arquivo **só como dublê do pool** (o
  SQLite não cria as tabelas da TASK-022, que usam funções do PostgreSQL; ADR-007 continua valendo).

A avaliação com dados gravados no PostgreSQL está em `tests/test_composition_integration.py`.
Todos os ids, nomes e senhas daqui são FICTÍCIOS (ADR-012).
"""

import logging
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine, event

from app.application.use_cases.evaluate_operation import EvaluateOperation
from app.auth_composition import (
    SESSION_COOKIE_SECURE_ENV_VAR,
    AuthConfigurationError,
    session_cookie_secure,
)
from app.domain.services.conservative_tabulated_lookup import ConservativeTabulatedLookup
from app.infrastructure.database.config import DatabaseConfigurationError
from app.main import (
    compose_app,
    create_database_app,
    evaluate_operation_per_request,
    load_chart_interpolator,
)
from app.presentation.api.auth import LOGIN_PATH, LOGOUT_PATH, SESSION_PATH
from app.presentation.api.evaluations import EVALUATIONS_PATH
from app.presentation.api.health import HEALTH_PATH
from app.presentation.api.main import create_app
from app.presentation.api.users import USERS_PATH
from app.presentation.websocket.evaluation import EVALUATION_WEBSOCKET_PATH
from tests.fixtures.auth_api_ficticia import CSRF_HEADERS
from tests.fixtures.avaliacao_operacional_ficticia import CONFIGURATION_AVALIACAO_FICTICIA_ID

SENHA_FICTICIA = "senha-FICTICIA-nao-vazar"
# Porta 1 em 127.0.0.1: nada escuta ali, a conexão é recusada na hora (sem rede externa).
UNREACHABLE_DATABASE_URL = (
    f"postgresql+psycopg://usuario_ficticio:{SENHA_FICTICIA}@127.0.0.1:1/banco_ficticio"
    "?connect_timeout=2"
)

NOT_EVALUABLE_WITHOUT_DATA = {
    "status": "NOT_EVALUABLE",
    "configuration_id": CONFIGURATION_AVALIACAO_FICTICIA_ID,
    "geometry": None,
    "capacity": None,
    "utilization_percent": None,
    "load_chart_id": None,
    "load_chart_version": None,
    # Sem banco não há zonas nem gancho (TASK-046): o peso comparado é o da carga.
    "rotation_zone_code": None,
    "rotation_zone_name": None,
    "hook_block_weight_kg": 0.0,
    "compared_weight_kg": 1500.0,
    "reasons": [
        {"code": "CRANE_GEOMETRY_NOT_FOUND", "category": "EVALUATION"},
        {"code": "ACTIVE_LOAD_CHART_NOT_FOUND", "category": "EVALUATION"},
    ],
    # Leva E (TASK-055): sem capacidade nem regra, não há risco; entradas ausentes viram INFO.
    "tipping_risk": None,
    "alerts": [
        {
            "code": "OUTRIGGERS_NOT_INFORMED",
            "severity": "INFO",
            "message": "Estado das patolas não informado: não entrou na avaliação do risco.",
        },
        {
            "code": "GROUND_SLOPE_NOT_INFORMED",
            "severity": "INFO",
            "message": "Inclinação do terreno não informada: não entrou na avaliação do risco.",
        },
    ],
}


def evaluation_body_ficticio() -> dict[str, Any]:
    return {
        "configuration_id": CONFIGURATION_AVALIACAO_FICTICIA_ID,
        "boom_length_m": 20.0,
        "boom_angle_deg": 30.0,
        "turret_rotation_deg": 0.0,
        "cable_length_m": 1.0,
        "load_weight_kg": 1500.0,
    }


def state_changed_ficticio(sequence: int) -> dict[str, Any]:
    return {
        "type": "simulation.state.changed",
        "sequence": sequence,
        "payload": evaluation_body_ficticio(),
    }


# --- sem DATABASE_URL -----------------------------------------------------------------------


@pytest.fixture
def app_without_database() -> TestClient:
    return TestClient(compose_app({}))


def test_composition_uses_the_conservative_provisional_strategy() -> None:
    assert isinstance(load_chart_interpolator, ConservativeTabulatedLookup)


def test_without_database_url_the_evaluation_is_not_evaluable_without_inventing_data(
    app_without_database: TestClient,
) -> None:
    response = app_without_database.post(EVALUATIONS_PATH, json=evaluation_body_ficticio())

    assert response.status_code == 200
    assert response.json() == NOT_EVALUABLE_WITHOUT_DATA


def test_without_database_url_the_websocket_is_registered_and_answers(
    app_without_database: TestClient,
) -> None:
    with app_without_database.websocket_connect(EVALUATION_WEBSOCKET_PATH) as websocket:
        websocket.send_json(state_changed_ficticio(7))
        reply = websocket.receive_json()

    assert reply["type"] == "simulation.evaluated"
    assert reply["sequence"] == 7
    assert reply["payload"]["result"] == "NOT_EVALUABLE"


def test_without_database_url_health_reports_not_configured(
    app_without_database: TestClient,
) -> None:
    response = app_without_database.get(HEALTH_PATH)

    assert response.status_code == 200
    assert response.json() == {"status": "UP", "database": "NOT_CONFIGURED"}


@pytest.mark.parametrize("environ", [{}, {"DATABASE_URL": ""}, {"DATABASE_URL": "   "}])
def test_without_database_url_the_log_says_persistence_is_not_configured(
    environ: dict[str, str], caplog: pytest.LogCaptureFixture
) -> None:
    with caplog.at_level(logging.WARNING, logger="app.main"):
        compose_app(environ)

    assert any("persistência não configurada" in record.getMessage() for record in caplog.records)


# --- DATABASE_URL inválida ou banco fora do ar ----------------------------------------------


@pytest.mark.parametrize(
    "database_url",
    [
        f"mysql://usuario_ficticio:{SENHA_FICTICIA}@localhost/banco_ficticio",
        f"isto nao e uma url {SENHA_FICTICIA}",
    ],
)
def test_invalid_database_url_prevents_startup_without_echoing_it(database_url: str) -> None:
    with pytest.raises(DatabaseConfigurationError) as error:
        compose_app({"DATABASE_URL": database_url})

    assert SENHA_FICTICIA not in str(error.value)


def test_unreachable_database_starts_and_health_reports_down_without_leaking_the_url(
    caplog: pytest.LogCaptureFixture,
) -> None:
    app = compose_app({"DATABASE_URL": UNREACHABLE_DATABASE_URL})

    with caplog.at_level(logging.WARNING, logger="app.main"), TestClient(app) as client:
        response = client.get(HEALTH_PATH)

    assert response.status_code == 200
    assert response.json() == {"status": "UP", "database": "DOWN"}
    for text in (response.text, caplog.text):
        assert SENHA_FICTICIA not in text
        assert "127.0.0.1" not in text
        assert "usuario_ficticio" not in text


def test_unreachable_database_makes_the_rest_evaluation_fail_with_500() -> None:
    # Com banco configurado a rota exige sessão (TASK-038): a consulta da sessão já falha com 500.
    app = compose_app({"DATABASE_URL": UNREACHABLE_DATABASE_URL})

    with TestClient(app, raise_server_exceptions=False) as client:
        client.cookies.set("crane_session", "token-ficticio")
        response = client.post(
            EVALUATIONS_PATH, json=evaluation_body_ficticio(), headers=CSRF_HEADERS
        )

    assert response.status_code == 500
    assert SENHA_FICTICIA not in response.text


# --- ciclo de vida da conexão por requisição (SQLite só como dublê do pool) ------------------


class PoolCounter:
    def __init__(self, engine: Engine) -> None:
        self.checkouts = 0
        self.checkins = 0
        event.listen(engine, "checkout", self._on_checkout)
        event.listen(engine, "checkin", self._on_checkin)

    def _on_checkout(self, *_: object) -> None:
        self.checkouts += 1

    def _on_checkin(self, *_: object) -> None:
        self.checkins += 1


@pytest.fixture
def sqlite_engine(tmp_path: Path) -> Iterator[Engine]:
    engine = create_engine(f"sqlite:///{tmp_path / 'dubla_do_pool.db'}")
    yield engine
    engine.dispose()


def test_request_dependency_holds_one_connection_and_returns_it_at_the_end(
    sqlite_engine: Engine,
) -> None:
    counter = PoolCounter(sqlite_engine)
    dependency = evaluate_operation_per_request(sqlite_engine)

    generator = dependency()
    use_case = next(generator)
    assert isinstance(use_case, EvaluateOperation)
    assert (counter.checkouts, counter.checkins) == (1, 0)

    with pytest.raises(StopIteration):
        next(generator)
    assert (counter.checkouts, counter.checkins) == (1, 1)


def test_request_connection_is_returned_when_the_evaluation_fails(sqlite_engine: Engine) -> None:
    # Sem as tabelas, a primeira consulta do repositório falha: a rota dá 500 e a conexão volta.
    # Só a rota de avaliação com a dependência por requisição, sem a autenticação da TASK-038 (a
    # consulta da sessão falharia antes, pelo mesmo motivo, e o teste não chegaria à dependência).
    counter = PoolCounter(sqlite_engine)
    client = TestClient(
        create_app(evaluation=evaluate_operation_per_request(sqlite_engine)),
        raise_server_exceptions=False,
    )

    response = client.post(EVALUATIONS_PATH, json=evaluation_body_ficticio())

    assert response.status_code == 500
    assert counter.checkouts == 1
    assert counter.checkins == counter.checkouts


def test_database_health_check_reports_up_when_select_1_works(sqlite_engine: Engine) -> None:
    response = TestClient(create_database_app(sqlite_engine)).get(HEALTH_PATH)

    assert response.json() == {"status": "UP", "database": "UP"}


# --- autenticação (TASK-038; ADR-016) ---------------------------------------------------------


def test_without_database_url_auth_is_disabled_and_routes_stay_open(
    app_without_database: TestClient,
) -> None:
    assert app_without_database.get(SESSION_PATH).json() == {"authEnabled": False, "user": None}
    assert app_without_database.post(LOGIN_PATH, json={}).status_code == 404
    assert app_without_database.get(USERS_PATH).status_code == 404


def test_with_database_url_the_api_requires_a_session(sqlite_engine: Engine) -> None:
    client = TestClient(create_database_app(sqlite_engine, {}), raise_server_exceptions=False)

    csrf = client.post(EVALUATIONS_PATH, json=evaluation_body_ficticio())
    no_session = client.post(
        EVALUATIONS_PATH, json=evaluation_body_ficticio(), headers=CSRF_HEADERS
    )
    paths = client.get("/openapi.json").json()["paths"]

    assert csrf.status_code == 403
    assert csrf.json()["code"] == "CSRF_HEADER_MISSING"
    # Sem cookie não há consulta ao banco: 401 direto.
    assert no_session.status_code == 401
    assert no_session.json()["code"] == "NOT_AUTHENTICATED"
    assert {LOGIN_PATH, LOGOUT_PATH, SESSION_PATH, USERS_PATH} <= set(paths)


def test_with_database_url_the_task_044_routes_are_registered(sqlite_engine: Engine) -> None:
    # A listagem de tabelas da configuração só depende do banco, não de FILE_STORAGE_DIR.
    client = TestClient(create_database_app(sqlite_engine, {}), raise_server_exceptions=False)

    paths = client.get("/openapi.json").json()["paths"]

    assert "get" in paths["/api/v1/configurations/{configuration_id}/load-charts"]
    assert "patch" in paths["/api/v1/manufacturers/{manufacturer_id}"]
    assert "patch" in paths["/api/v1/cranes/{crane_id}"]
    assert "patch" in paths["/api/v1/configurations/{configuration_id}"]


@pytest.mark.parametrize(
    ("value", "secure"),
    [
        (None, True),
        ("", True),
        ("true", True),
        ("TRUE", True),
        ("false", False),
        (" False ", False),
    ],
)
def test_session_cookie_secure_setting(value: str | None, secure: bool) -> None:
    environ = {} if value is None else {SESSION_COOKIE_SECURE_ENV_VAR: value}

    assert session_cookie_secure(environ) is secure


def test_invalid_session_cookie_secure_prevents_startup(sqlite_engine: Engine) -> None:
    with pytest.raises(AuthConfigurationError):
        create_database_app(sqlite_engine, {SESSION_COOKIE_SECURE_ENV_VAR: "talvez"})


def test_shutdown_hook_runs_when_the_application_stops() -> None:
    calls: list[None] = []

    with TestClient(create_app(on_shutdown=lambda: calls.append(None))):
        assert calls == []

    assert calls == [None]
