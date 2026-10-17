"""`POST /evaluations/tandem` (TASK-074; RN-016). Dados FICTÍCIOS (ADR-012).

Capacidade da tabela fictícia: 4000 kg no ponto (L = 10 m, θ = 0°) e limite do modelo de 85 %; com
o fator 0,75 do tandem, cada guindaste aceita até 2550 kg (peso comparado, com o gancho).

Com a ficha FICTÍCIA (a = 1,5 m), L = 10 m e θ = 0°, o gancho fica a R = 11,5 m do eixo de giro.
Cada guindaste é posto a 11,5 m do ponto de içamento dele, para o gancho cair sobre o ponto
(TASK-090).
"""

from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.presentation.api.main import create_app
from tests.fixtures.avaliacao_operacional_ficticia import CONFIGURATION_AVALIACAO_FICTICIA_ID
from tests.presentation.test_evaluations_capacity_limit import build_dependencies

TANDEM = "/api/v1/evaluations/tandem"


RADIUS_M = 11.5


def crane(hook_x: float) -> dict[str, Any]:
    # Rumo 0 e ψ = 0: a lança aponta para +Z, e o gancho fica 11,5 m à frente do eixo de giro.
    return {
        "configuration_id": CONFIGURATION_AVALIACAO_FICTICIA_ID,
        "placement": {"x": hook_x, "z": -RADIUS_M, "heading_deg": 0.0},
        "state": {
            "boom_length_m": 10.0,
            "boom_angle_deg": 0.0,
            "turret_rotation_deg": 0.0,
            "cable_length_m": 1.0,
        },
        "hook_point": {"x": hook_x, "z": 0.0},
    }


def body(weight_kg: float, cg_x: float = 0.0, **overrides: Any) -> dict[str, Any]:
    data: dict[str, Any] = {
        "load_weight_kg": weight_kg,
        "load_cg": {"x": cg_x, "z": 0.0},
        "cranes": [crane(-3.0), crane(3.0)],
    }
    data.update(overrides)
    return data


@pytest.fixture
def client() -> TestClient:
    return TestClient(create_app(evaluation=build_dependencies()))


def test_carga_que_um_so_nao_levanta_passa_em_dois(client: TestClient) -> None:
    # 4000 kg passam dos 3400 kg do limite do modelo: sozinho não levanta. Em dois, 2000 kg cada.
    response = client.post(TANDEM, json=body(4_000))

    assert response.status_code == 200
    data = response.json()
    assert data["shares_kg"] == pytest.approx([2_000, 2_000])
    assert data["share_percent"] == pytest.approx([50, 50])
    assert data["tandem_ok"] is True
    assert [item["status"] for item in data["evaluations"]] == ["EVALUATED", "EVALUATED"]
    assert data["evaluations"][0]["capacity_limit"]["effective_capacity_kg"] == pytest.approx(2_550)
    assert [alert["code"] for alert in data["alerts"]] == ["TANDEM_WITHIN_LIMIT"]


def test_acima_de_75_por_cento_da_capacidade_reprova(client: TestClient) -> None:
    # 3500 kg para cada um passam de 2550 kg, o limite do tandem.
    response = client.post(TANDEM, json=body(7_000))

    data = response.json()
    assert data["tandem_ok"] is False
    assert data["evaluations"][0]["capacity_limit"]["level"] == "OVER"
    messages = [alert["message"] for alert in data["alerts"]]
    assert any("Guindaste 1" in text and "75 %" in text for text in messages)


def test_divisao_segue_a_alavanca(client: TestClient) -> None:
    # CG a 1 m do ponto A (x = -3) e a 5 m do ponto B (x = 3): A leva 5/6.
    response = client.post(TANDEM, json=body(6_000, cg_x=-2.0))

    assert response.json()["shares_kg"] == pytest.approx([5_000, 1_000])
    assert response.json()["tandem_ok"] is False


def test_cg_fora_dos_pontos_alerta(client: TestClient) -> None:
    response = client.post(TANDEM, json=body(1_000, cg_x=10.0))

    data = response.json()
    assert data["tandem_ok"] is False
    assert "TANDEM_CG_OUTSIDE_POINTS" in [alert["code"] for alert in data["alerts"]]


def test_pontos_iguais_sao_422(client: TestClient) -> None:
    payload = body(1_000)
    payload["cranes"] = [crane(1.0), crane(1.0)]

    assert client.post(TANDEM, json=payload).status_code == 422


def test_exige_dois_guindastes(client: TestClient) -> None:
    assert client.post(TANDEM, json=body(1_000, cranes=[crane(0.0)])).status_code == 422
