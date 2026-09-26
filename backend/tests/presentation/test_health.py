"""`GET /api/v1/health` com `TestClient` e verificações falsas do banco (TASK-029)."""

import pytest
from fastapi.testclient import TestClient

from app.presentation.api.health import HEALTH_PATH
from app.presentation.api.main import app as base_app
from app.presentation.api.main import create_app


def test_health_without_database_check_reports_not_configured() -> None:
    response = TestClient(create_app()).get(HEALTH_PATH)

    assert response.status_code == 200
    assert response.json() == {"status": "UP", "database": "NOT_CONFIGURED"}


@pytest.mark.parametrize(("database_up", "expected"), [(True, "UP"), (False, "DOWN")])
def test_health_reports_whether_the_database_answers_and_stays_200(
    database_up: bool, expected: str
) -> None:
    calls: list[None] = []

    def check() -> bool:
        calls.append(None)
        return database_up

    response = TestClient(create_app(database_health_check=check)).get(HEALTH_PATH)

    assert response.status_code == 200
    assert response.json() == {"status": "UP", "database": expected}
    assert len(calls) == 1  # verifica a cada chamada, sem cache


def test_health_is_in_the_openapi_contract_of_the_base_app() -> None:
    openapi = TestClient(base_app).get("/openapi.json").json()

    assert "get" in openapi["paths"][HEALTH_PATH]
