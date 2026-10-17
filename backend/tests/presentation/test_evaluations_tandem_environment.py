"""`POST /evaluations/tandem` com ambiente, acessórios e gancho no ponto (TASK-090; RN-014..016).

Dados FICTÍCIOS (ADR-012). Mesma tabela e ficha de `test_evaluations_tandem.py`: L = 10 m, θ = 0° e
a = 1,5 m dão R = 11,5 m e 4000 kg na tabela; limite do modelo de 85 % e fator 0,75 do tandem dão
2550 kg permitidos para cada guindaste. Com 4000 kg e o CG no meio, cada um leva 2000 kg.
"""

import math
from dataclasses import replace
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.presentation.api.main import create_app
from tests.fixtures.acessorios_ficticios import (
    CINTA_FICTICIA,
    MANILHA_FICTICIA,
    InMemoryAccessories,
)
from tests.fixtures.avaliacao_operacional_ficticia import CONFIGURATION_AVALIACAO_FICTICIA_ID
from tests.presentation.test_evaluations_capacity_limit import build_dependencies

TANDEM = "/api/v1/evaluations/tandem"
RADIUS_M = 11.5
READY_OUTRIGGERS = {"extension_percent": 100.0, "jacks_set": True}


def crane_at(
    hook_point: tuple[float, float],
    *,
    heading_deg: float = 0.0,
    turret_rotation_deg: float = 0.0,
    **extra: Any,
) -> dict[str, Any]:
    """Guindaste posto para o gancho cair sobre `hook_point`, com o rumo e o giro pedidos.

    O gancho fica a R do eixo de giro, na direção (sin(rumo + ψ), cos(rumo + ψ)) do mundo.
    """
    azimuth = math.radians(heading_deg + turret_rotation_deg)
    data: dict[str, Any] = {
        "configuration_id": CONFIGURATION_AVALIACAO_FICTICIA_ID,
        "placement": {
            "x": hook_point[0] - RADIUS_M * math.sin(azimuth),
            "z": hook_point[1] - RADIUS_M * math.cos(azimuth),
            "heading_deg": heading_deg,
        },
        "state": {
            "boom_length_m": 10.0,
            "boom_angle_deg": 0.0,
            "turret_rotation_deg": turret_rotation_deg,
            "cable_length_m": 1.0,
        },
        "hook_point": {"x": hook_point[0], "z": hook_point[1]},
    }
    data.update(extra)
    return data


def body(first: dict[str, Any], second: dict[str, Any], **extra: Any) -> dict[str, Any]:
    data: dict[str, Any] = {
        "load_weight_kg": 4_000.0,
        "load_cg": {"x": 0.0, "z": 0.0},
        "cranes": [first, second],
    }
    data.update(extra)
    return data


def side_by_side(**first_extra: Any) -> dict[str, Any]:
    return body(crane_at((-3.0, 0.0), **first_extra), crane_at((3.0, 0.0)))


def codes(alerts: list[dict[str, Any]]) -> list[str]:
    return [alert["code"] for alert in alerts]


@pytest.fixture
def client() -> TestClient:
    accessories = InMemoryAccessories(MANILHA_FICTICIA, CINTA_FICTICIA)
    dependencies = replace(build_dependencies(), accessory_provider=accessories)
    return TestClient(create_app(evaluation=dependencies))


def test_sem_ambiente_o_resultado_e_o_de_antes(client: TestClient) -> None:
    response = client.post(TANDEM, json=side_by_side())

    assert response.status_code == 200
    data = response.json()
    assert data["tandem_ok"] is True
    assert codes(data["alerts"]) == ["TANDEM_WITHIN_LIMIT"]
    for evaluation in data["evaluations"]:
        assert evaluation["compared_weight_kg"] == pytest.approx(2_000)
        assert codes(evaluation["alerts"]) == [
            "OUTRIGGERS_NOT_INFORMED",
            "GROUND_SLOPE_NOT_INFORMED",
        ]


def test_patolas_recolhidas_reprovam_o_guindaste_delas(client: TestClient) -> None:
    payload = side_by_side(outriggers={"extension_percent": 0.0, "jacks_set": False})

    data = client.post(TANDEM, json=payload).json()

    assert data["tandem_ok"] is False
    assert data["evaluations"][0]["tipping_risk"] == "HIGH"
    assert "OUTRIGGERS_NOT_READY" in codes(data["evaluations"][0]["alerts"])
    assert data["evaluations"][1]["tipping_risk"] == "LOW"
    assert "TANDEM_TIPPING_RISK_HIGH" in codes(data["alerts"])


def test_vento_acima_do_limite_vale_para_os_dois(client: TestClient) -> None:
    payload = side_by_side()
    payload["wind_speed_ms"] = 14.0

    data = client.post(TANDEM, json=payload).json()

    assert data["tandem_ok"] is False
    for evaluation in data["evaluations"]:
        assert evaluation["capacity_limit"]["level"] == "OVER"
        assert "WIND_ABOVE_LIMIT" in codes(evaluation["alerts"])


def test_vento_perto_do_limite_e_atencao_e_nao_reduz_a_capacidade(client: TestClient) -> None:
    # 8,5 m/s: entre 90 % (8,1) e 100 % (9,0) da velocidade da tabela (RN-017): atenção, e o vento
    # não é mais fator da capacidade (2550 kg continuam 2550 kg).
    payload = side_by_side()
    payload["wind_speed_ms"] = 8.5

    data = client.post(TANDEM, json=payload).json()

    evaluation = data["evaluations"][0]
    assert evaluation["capacity_limit"]["wind_factor"] == pytest.approx(1.0)
    assert evaluation["capacity_limit"]["effective_capacity_kg"] == pytest.approx(2_550)
    assert "WIND_NEAR_LIMIT" in codes(evaluation["alerts"])
    assert data["tandem_ok"] is True


def test_solo_fraco_sob_um_guindaste_reprova_o_tandem(client: TestClient) -> None:
    payload = side_by_side(soil_kinds=["clay", "clay", "rock", "rock"])

    data = client.post(TANDEM, json=payload).json()

    assert data["tandem_ok"] is False
    assert "SOIL_BEARING_EXCEEDED" in codes(data["evaluations"][0]["alerts"])
    assert data["evaluations"][1]["tipping_risk"] == "LOW"


def test_inclinacao_acima_do_maximo_reprova_o_guindaste(client: TestClient) -> None:
    data = client.post(TANDEM, json=side_by_side(ground_slope_deg=3.0)).json()

    assert data["tandem_ok"] is False
    assert data["evaluations"][0]["capacity_limit"]["level"] == "OVER"
    assert "GROUND_SLOPE_EXCEEDED" in codes(data["evaluations"][0]["alerts"])


def test_acessorios_somam_so_no_gancho_do_guindaste_deles(client: TestClient) -> None:
    payload = side_by_side(accessory_ids=[MANILHA_FICTICIA.id, CINTA_FICTICIA.id])

    data = client.post(TANDEM, json=payload).json()

    first, second = data["evaluations"]
    assert first["accessories_weight_kg"] == pytest.approx(35)
    assert first["compared_weight_kg"] == pytest.approx(2_035)
    assert second["accessories_weight_kg"] is None
    assert second["compared_weight_kg"] == pytest.approx(2_000)


def test_acessorio_desconhecido_deixa_o_tandem_nao_avaliavel(client: TestClient) -> None:
    data = client.post(TANDEM, json=side_by_side(accessory_ids=["ACC-NAO-EXISTE"])).json()

    assert data["evaluations"][0]["status"] == "NOT_EVALUABLE"
    assert data["tandem_ok"] is False
    assert "TANDEM_NOT_EVALUABLE" in codes(data["alerts"])


def test_obstaculo_no_raio_de_giro_e_atencao_e_continua_permitido(client: TestClient) -> None:
    payload = side_by_side(outriggers=READY_OUTRIGGERS, obstacle_conflicts=["Poste"])

    data = client.post(TANDEM, json=payload).json()

    assert data["tandem_ok"] is True
    assert data["evaluations"][0]["tipping_risk"] == "ATTENTION"
    assert "OBSTACLE_IN_SWING_RADIUS" in codes(data["evaluations"][0]["alerts"])


def test_gancho_fora_do_ponto_de_icamento_reprova(client: TestClient) -> None:
    # O guindaste 2 fica 1 m mais longe: o gancho dele cai 1 m antes do ponto.
    second = crane_at((3.0, 0.0))
    second["placement"]["z"] -= 1.0

    data = client.post(TANDEM, json=body(crane_at((-3.0, 0.0)), second)).json()

    assert data["tandem_ok"] is False
    off = [alert for alert in data["alerts"] if alert["code"] == "TANDEM_HOOK_OFF_POINT"]
    assert len(off) == 1
    assert off[0]["severity"] == "CRITICAL"
    assert off[0]["message"].startswith("Guindaste 2: o gancho está a 1,00 m")
    assert "TANDEM_WITHIN_LIMIT" not in codes(data["alerts"])


def test_dentro_da_tolerancia_o_gancho_conta_como_no_ponto(client: TestClient) -> None:
    second = crane_at((3.0, 0.0))
    second["placement"]["x"] += 0.4

    data = client.post(TANDEM, json=body(crane_at((-3.0, 0.0)), second)).json()

    assert data["tandem_ok"] is True
    assert "TANDEM_HOOK_OFF_POINT" not in codes(data["alerts"])


@pytest.mark.parametrize(
    ("heading_deg", "turret_rotation_deg"),
    [(90.0, 0.0), (0.0, 90.0), (45.0, 45.0), (-120.0, 30.0), (200.0, -35.0)],
)
def test_gancho_no_ponto_com_rumo_e_giro(
    client: TestClient, heading_deg: float, turret_rotation_deg: float
) -> None:
    first = crane_at((-3.0, 0.0), heading_deg=heading_deg, turret_rotation_deg=turret_rotation_deg)
    second = crane_at((3.0, 0.0), heading_deg=-heading_deg, turret_rotation_deg=15.0)

    data = client.post(TANDEM, json=body(first, second)).json()

    assert data["tandem_ok"] is True
    assert "TANDEM_HOOK_OFF_POINT" not in codes(data["alerts"])


def test_rumo_com_o_sinal_trocado_tira_o_gancho_do_ponto(client: TestClient) -> None:
    # Posto para rumo +45° e ψ = 45° (gancho na direção +X), mas enviado com rumo −45°: o gancho
    # aponta para +Z e fica longe do ponto. Confere o sentido do rumo (o mesmo da cena).
    first = crane_at((-3.0, 0.0), heading_deg=45.0, turret_rotation_deg=45.0)
    first["placement"]["heading_deg"] = -45.0

    data = client.post(TANDEM, json=body(first, crane_at((3.0, 0.0)))).json()

    assert data["tandem_ok"] is False
    off = [alert for alert in data["alerts"] if alert["code"] == "TANDEM_HOOK_OFF_POINT"]
    assert [alert["message"][:12] for alert in off] == ["Guindaste 1:"]


def test_solo_com_tres_sapatas_e_422(client: TestClient) -> None:
    payload = side_by_side(soil_kinds=["rock", "rock", "rock"])

    assert client.post(TANDEM, json=payload).status_code == 422


def test_vento_negativo_e_422(client: TestClient) -> None:
    payload = side_by_side()
    payload["wind_speed_ms"] = -1.0

    assert client.post(TANDEM, json=payload).status_code == 422


def test_vento_por_guindaste_nao_existe(client: TestClient) -> None:
    # O vento é do local: só no corpo, não em cada guindaste (campo desconhecido é 422).
    assert client.post(TANDEM, json=side_by_side(wind_speed_ms=5.0)).status_code == 422
