"""Campo opcional `outriggers` no WebSocket da avaliação (TASK-054; ADR-024). Dados FICTÍCIOS."""

from starlette.testclient import WebSocketTestSession

from tests.presentation.websocket.test_evaluation_websocket import (
    assert_connection_still_evaluates,
    assert_error,
    exchange,
    state_changed_ficticio,
    websocket,
)

__all__ = ["websocket"]


def test_ficticio_outriggers_are_accepted_and_do_not_change_the_result(
    websocket: WebSocketTestSession,
) -> None:
    message = state_changed_ficticio(31)
    message["payload"]["outriggers"] = {"extension_percent": 100, "jacks_set": True}

    reply = exchange(websocket, message)

    assert reply["type"] == "simulation.evaluated"
    assert reply["sequence"] == 31
    assert reply["payload"]["result"] == "EVALUATED"
    assert reply["payload"]["utilization_percent"] == 75.0


def test_invalid_outriggers_get_an_error_with_the_sequence(
    websocket: WebSocketTestSession,
) -> None:
    message = state_changed_ficticio(32)
    message["payload"]["outriggers"] = {"extension_percent": 101, "jacks_set": True}

    assert_error(exchange(websocket, message), "INVALID_MESSAGE", 32)
    assert_connection_still_evaluates(websocket)
