"""Campo opcional `outriggers` da avaliação, REST e WebSocket (TASK-054; ADR-024).

Dados FICTÍCIOS (ADR-012). Por ora o backend só valida a forma: o campo não muda o resultado.
"""

from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.presentation.api.evaluations import EVALUATIONS_PATH
from tests.presentation.test_evaluations import body_ficticio, client_ficticio


@pytest.fixture
def client() -> TestClient:
    return client_ficticio()


def test_ficticio_outriggers_are_accepted_and_do_not_change_the_result(client: TestClient) -> None:
    without = client.post(EVALUATIONS_PATH, json=body_ficticio())
    with_outriggers = client.post(
        EVALUATIONS_PATH,
        json=body_ficticio(outriggers={"extension_percent": 100, "jacks_set": True}),
    )

    assert with_outriggers.status_code == 200
    assert with_outriggers.json() == without.json()


@pytest.mark.parametrize(
    "outriggers",
    [
        pytest.param({"extension_percent": 101, "jacks_set": True}, id="acima-de-100"),
        pytest.param({"extension_percent": -1, "jacks_set": True}, id="negativa"),
        pytest.param({"extension_percent": 50}, id="sem-macacos"),
        pytest.param({"extension_percent": 50, "jacks_set": "sim"}, id="macacos-em-texto"),
        pytest.param({"extension_percent": 50, "jacks_set": True, "x": 1}, id="campo-extra"),
    ],
)
def test_invalid_outriggers_are_rejected_with_422(
    client: TestClient, outriggers: dict[str, Any]
) -> None:
    response = client.post(EVALUATIONS_PATH, json=body_ficticio(outriggers=outriggers))

    assert response.status_code == 422
