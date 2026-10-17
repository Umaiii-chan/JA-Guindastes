"""Campo opcional `site` no WebSocket da avaliação: rede elétrica e içamento crítico (TASK-107).

Dados FICTÍCIOS. Lança de 20 m a 30° para +Z: a ponta fica a z = 18,82 m e y = 12,5 m.
"""

from typing import Any

from starlette.testclient import WebSocketTestSession

from tests.presentation.websocket.test_evaluation_websocket import (
    assert_connection_still_evaluates,
    assert_error,
    exchange,
    state_changed_ficticio,
    websocket,
)

__all__ = ["websocket"]


def rede(**overrides: Any) -> dict[str, Any]:
    line: dict[str, Any] = {
        "id": "R1",
        "label": "Rede FICTÍCIA",
        "x1_m": -30.0,
        "z1_m": 18.82,
        "x2_m": 30.0,
        "z2_m": 18.82,
        "height_m": 13.5,
        "voltage_kv": 13.8,
    }
    line.update(overrides)
    return line


def test_sem_site_a_resposta_nao_traz_rede_nem_classificacao(
    websocket: WebSocketTestSession,
) -> None:
    reply = exchange(websocket, state_changed_ficticio(41))

    assert reply["payload"]["power_lines"] == []
    assert reply["payload"]["critical_lift"] is None


def test_rede_perto_da_ponta_responde_com_a_distancia_e_o_alerta_critico(
    websocket: WebSocketTestSession,
) -> None:
    message = state_changed_ficticio(42)
    message["payload"]["site"] = {"power_lines": [rede()]}

    payload = exchange(websocket, message)["payload"]

    (line,) = payload["power_lines"]
    assert line["status"] == "VIOLATION" and line["required_m"] == 3.048
    assert abs(line["distance_m"] - 1.0) < 0.05
    codes = [alert["code"] for alert in payload["alerts"]]
    assert "POWER_LINE_CLEARANCE_VIOLATION" in codes
    assert payload["critical_lift"]["is_critical"] is True
    assert "POWER_LINE_CLOSE" in [t["code"] for t in payload["critical_lift"]["triggers"]]


def test_tensao_fora_da_tabela_e_mensagem_invalida(websocket: WebSocketTestSession) -> None:
    message = state_changed_ficticio(43)
    message["payload"]["site"] = {"power_lines": [rede(voltage_kv=1500.0)]}

    assert_error(exchange(websocket, message), "INVALID_MESSAGE", 43)
    assert_connection_still_evaluates(websocket)
