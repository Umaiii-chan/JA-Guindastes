"""WebSocket de avaliação em tempo real com `TestClient.websocket_connect` (TASK-025).

A aplicação FastAPI é montada **no teste** com o router da factory
`create_evaluation_websocket_router` e um `EvaluateOperation` real, com provedores falsos e dados
FICTÍCIOS (ADR-012): a ficha técnica de `tests/fixtures/crane_geometry_ficticia.py` (a = 1,5 m) e a
tabela de `tests/fixtures/avaliacao_operacional_ficticia.py` (para L = 20 m: 11,5 m → 5000 kg e
21,5 m → 2000 kg; para L = 30 m: 31,5 m → 0 kg). Nenhum número representa capacidade real.
"""

import json
import math
from collections.abc import Iterator, Mapping
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from starlette.testclient import WebSocketTestSession

from app.application.use_cases.evaluate_operation import EvaluateOperation
from app.domain.entities.load_chart import LoadChart
from app.domain.services.conservative_tabulated_lookup import ConservativeTabulatedLookup
from app.domain.services.exact_point_lookup import ExactPointLookup
from app.domain.services.load_chart_interpolator import LoadChartInterpolator
from app.domain.value_objects.crane_geometry import CraneGeometry
from app.presentation.websocket.evaluation import (
    DEFAULT_MAX_MESSAGE_BYTES,
    EVALUATION_WEBSOCKET_PATH,
    create_evaluation_websocket_router,
)
from tests.fixtures.avaliacao_operacional_ficticia import (
    CONFIGURATION_AVALIACAO_FICTICIA_ID,
    LOAD_CHART_AVALIACAO_FICTICIO_ID,
    LOAD_CHART_AVALIACAO_FICTICIO_VERSION,
    build_load_chart_avaliacao_ficticio,
)
from tests.fixtures.crane_geometry_ficticia import build_crane_geometry_ficticia

# Tolerância só para conferir contas à mão com ponto flutuante; não é o ε da consulta (ADR-015).
TOLERANCE = 1e-9

CONFIGURACAO_INEXISTENTE_FICTICIA_ID = "CFG-FICTICIA-INEXISTENTE"


class FakeCraneGeometryProvider:
    def __init__(self, geometries: Mapping[str, CraneGeometry]) -> None:
        self._geometries = dict(geometries)

    def get_crane_geometry(self, configuration_id: str) -> CraneGeometry | None:
        return self._geometries.get(configuration_id)


class FakeActiveLoadChartProvider:
    """Devolve a tabela mapeada, sem conferir status nem configuração (o caso de uso confere)."""

    def __init__(self, charts: Mapping[str, LoadChart]) -> None:
        self._charts = dict(charts)

    def get_active_load_chart(
        self, configuration_id: str, rotation_zone_code: str | None = None
    ) -> LoadChart | None:
        return self._charts.get(configuration_id)


def build_evaluate_operation_ficticio(
    *,
    interpolator: LoadChartInterpolator | None = None,
    charts: Mapping[str, LoadChart] | None = None,
) -> EvaluateOperation:
    return EvaluateOperation(
        crane_geometry_provider=FakeCraneGeometryProvider(
            {CONFIGURATION_AVALIACAO_FICTICIA_ID: build_crane_geometry_ficticia()}
        ),
        active_load_chart_provider=FakeActiveLoadChartProvider(
            charts
            if charts is not None
            else {CONFIGURATION_AVALIACAO_FICTICIA_ID: build_load_chart_avaliacao_ficticio()}
        ),
        load_chart_interpolator=(
            interpolator if interpolator is not None else ConservativeTabulatedLookup()
        ),
    )


def build_app(evaluate_operation: EvaluateOperation, **router_options: Any) -> FastAPI:
    app = FastAPI()
    app.include_router(create_evaluation_websocket_router(evaluate_operation, **router_options))
    return app


@pytest.fixture
def websocket() -> Iterator[WebSocketTestSession]:
    client = TestClient(build_app(build_evaluate_operation_ficticio()))
    with client.websocket_connect(EVALUATION_WEBSOCKET_PATH) as session:
        yield session


def state_changed_ficticio(
    sequence: Any = 1,
    *,
    configuration_id: str = CONFIGURATION_AVALIACAO_FICTICIA_ID,
    boom_length_m: float = 20.0,
    boom_angle_deg: float = 30.0,
    turret_rotation_deg: float = 0.0,
    cable_length_m: float = 1.0,
    load_weight_kg: float = 1500.0,
) -> dict[str, Any]:
    """Mensagem `simulation.state.changed` com estado e carga FICTÍCIOS."""
    return {
        "type": "simulation.state.changed",
        "sequence": sequence,
        "payload": {
            "configuration_id": configuration_id,
            "boom_length_m": boom_length_m,
            "boom_angle_deg": boom_angle_deg,
            "turret_rotation_deg": turret_rotation_deg,
            "cable_length_m": cable_length_m,
            "load_weight_kg": load_weight_kg,
        },
    }


def exchange(websocket: WebSocketTestSession, message: dict[str, Any]) -> dict[str, Any]:
    websocket.send_json(message)
    reply: dict[str, Any] = websocket.receive_json()
    return reply


def assert_connection_still_evaluates(websocket: WebSocketTestSession) -> None:
    """Prova que a conexão continua aberta: uma mensagem válida ainda é avaliada."""
    reply = exchange(websocket, state_changed_ficticio(999))
    assert reply["type"] == "simulation.evaluated"
    assert reply["sequence"] == 999


# --- Avaliação -----------------------------------------------------------------------------------


def test_ficticio_radius_between_points_is_evaluated_with_the_same_sequence(
    websocket: WebSocketTestSession,
) -> None:
    # L = 20 m, θ = 30° → R = 1,5 + 10√3 ≈ 18,82 m, entre 11,5 m (5000 kg) e 21,5 m (2000 kg):
    # vale o menor, 2000 kg (ADR-015). Carga FICTÍCIA de 1500 kg → 75 %.
    reply = exchange(websocket, state_changed_ficticio(101, cable_length_m=1.0))

    assert reply["type"] == "simulation.evaluated"
    assert reply["sequence"] == 101
    payload = reply["payload"]
    assert payload["result"] == "EVALUATED"
    geometry = payload["geometry"]
    assert geometry["working_radius_m"] == pytest.approx(1.5 + 10 * math.sqrt(3), abs=TOLERANCE)
    assert geometry["tip_height_m"] - geometry["hook_height_m"] == pytest.approx(1.0)
    assert set(geometry["hook"]) == {"x_m", "y_m", "z_m"}
    assert payload["capacity"] == {
        "maximum_capacity_kg": 2000.0,
        "strategy": "CONSERVATIVE_PROVISIONAL",
        "queried_radius_m": geometry["working_radius_m"],
        "used_point": {"boom_length_m": 20.0, "working_radius_m": 21.5, "max_capacity_kg": 2000.0},
    }
    assert payload["utilization_percent"] == 75.0
    assert payload["load_chart_id"] == LOAD_CHART_AVALIACAO_FICTICIO_ID
    assert payload["load_chart_version"] == LOAD_CHART_AVALIACAO_FICTICIO_VERSION
    assert payload["reasons"] == []


def test_ficticio_response_has_no_alert_status(websocket: WebSocketTestSession) -> None:
    # PEND-004: níveis de alerta pendentes; o `status: WARNING` da doc-fonte § 15.4 não existe.
    reply = exchange(websocket, state_changed_ficticio(1, load_weight_kg=1990.0))

    assert "status" not in reply
    assert "status" not in reply["payload"]
    assert not {"alert", "alert_level", "level"} & set(reply["payload"])


def test_ficticio_several_messages_on_one_connection_are_answered_in_order(
    websocket: WebSocketTestSession,
) -> None:
    messages = [
        state_changed_ficticio(1, boom_angle_deg=30.0, load_weight_kg=1500.0),  # 2000 kg → 75 %
        state_changed_ficticio(2, boom_angle_deg=60.0, load_weight_kg=2500.0),  # 5000 kg → 50 %
        state_changed_ficticio(3, boom_length_m=15.0, boom_angle_deg=0.0),  # sem coluna de 15 m
    ]
    for message in messages:
        websocket.send_json(message)
    replies = [websocket.receive_json() for _ in messages]

    assert [reply["sequence"] for reply in replies] == [1, 2, 3]
    assert [reply["payload"]["result"] for reply in replies] == [
        "EVALUATED",
        "EVALUATED",
        "NOT_EVALUABLE",
    ]
    assert replies[0]["payload"]["utilization_percent"] == 75.0
    assert replies[1]["payload"]["utilization_percent"] == 50.0


def test_ficticio_sequence_is_echoed_as_sent_without_order_requirement(
    websocket: WebSocketTestSession,
) -> None:
    # O servidor não exige ordem nem faixa: quem ignora respostas antigas é o cliente.
    for sequence in (50, 7, -3, 0, 2**63):
        assert exchange(websocket, state_changed_ficticio(sequence))["sequence"] == sequence


def test_ficticio_boom_length_outside_the_chart_is_not_evaluable_with_geometry(
    websocket: WebSocketTestSession,
) -> None:
    reply = exchange(websocket, state_changed_ficticio(8, boom_length_m=15.0, boom_angle_deg=0.0))

    payload = reply["payload"]
    assert reply["sequence"] == 8
    assert payload["result"] == "NOT_EVALUABLE"
    assert payload["reasons"] == ["BOOM_LENGTH_NOT_IN_CHART"]
    assert payload["geometry"]["working_radius_m"] == 16.5  # 1,5 + 15·cos 0°
    assert payload["capacity"] is None
    assert payload["load_chart_id"] == LOAD_CHART_AVALIACAO_FICTICIO_ID
    assert payload["load_chart_version"] == LOAD_CHART_AVALIACAO_FICTICIO_VERSION
    assert "utilization_percent" not in payload


def test_ficticio_state_outside_the_crane_limits_is_not_evaluable_without_geometry(
    websocket: WebSocketTestSession,
) -> None:
    # A ficha técnica FICTÍCIA vai até L = 30 m: fora da faixa não é erro de mensagem (ADR-013 C-5).
    reply = exchange(websocket, state_changed_ficticio(9, boom_length_m=35.0))

    payload = reply["payload"]
    assert reply["type"] == "simulation.evaluated"
    assert payload["result"] == "NOT_EVALUABLE"
    assert payload["reasons"] == ["BOOM_LENGTH_ABOVE_MAX"]
    assert payload["geometry"] is None
    assert payload["load_chart_id"] is None


def test_ficticio_unknown_configuration_lists_every_reason(
    websocket: WebSocketTestSession,
) -> None:
    reply = exchange(
        websocket,
        state_changed_ficticio(10, configuration_id=CONFIGURACAO_INEXISTENTE_FICTICIA_ID),
    )

    payload = reply["payload"]
    assert payload["result"] == "NOT_EVALUABLE"
    assert payload["reasons"] == ["CRANE_GEOMETRY_NOT_FOUND", "ACTIVE_LOAD_CHART_NOT_FOUND"]
    assert payload["geometry"] is None
    assert payload["capacity"] is None
    assert payload["load_chart_version"] is None


def test_ficticio_zero_capacity_is_not_evaluable_and_shows_the_capacity(
    websocket: WebSocketTestSession,
) -> None:
    # L = 30 m, θ = 0° → R = 31,5 m, ponto FICTÍCIO de 0 kg: utilização indefinida.
    reply = exchange(websocket, state_changed_ficticio(11, boom_length_m=30.0, boom_angle_deg=0.0))

    payload = reply["payload"]
    assert payload["result"] == "NOT_EVALUABLE"
    assert payload["reasons"] == ["UTILIZATION_UNDEFINED"]
    assert payload["capacity"]["maximum_capacity_kg"] == 0.0
    assert payload["capacity"]["strategy"] == "CONSERVATIVE_PROVISIONAL"
    assert "utilization_percent" not in payload


def test_ficticio_strategy_without_provisional_mark_sends_null_mark_fields() -> None:
    # Com a `ExactPointLookup` (L = 20 m, θ = 0° → R = 21,5 m, ponto exato), não há marca.
    client = TestClient(
        build_app(build_evaluate_operation_ficticio(interpolator=ExactPointLookup()))
    )
    with client.websocket_connect(EVALUATION_WEBSOCKET_PATH) as websocket:
        reply = exchange(websocket, state_changed_ficticio(12, boom_angle_deg=0.0))

    assert reply["payload"]["result"] == "EVALUATED"
    assert reply["payload"]["capacity"] == {
        "maximum_capacity_kg": 2000.0,
        "strategy": None,
        "queried_radius_m": None,
        "used_point": None,
    }


# --- Erros de validação (a conexão continua aberta) ----------------------------------------------


def assert_error(reply: dict[str, Any], code: str, sequence: int | None) -> list[dict[str, Any]]:
    assert reply["type"] == "simulation.error"
    assert reply["sequence"] == sequence
    assert reply["payload"]["code"] == code
    assert reply["payload"]["message"]
    errors: list[dict[str, Any]] = reply["payload"]["errors"]
    return errors


@pytest.mark.parametrize(
    "raw",
    [
        pytest.param("isto não é JSON", id="texto"),
        pytest.param('{"type": "simulation.state.changed", "sequence": 1', id="json-truncado"),
        pytest.param("[1, 2, 3]", id="lista"),
        pytest.param("42", id="numero"),
        pytest.param('"simulation.state.changed"', id="string"),
        pytest.param("", id="vazio"),
        pytest.param(
            json.dumps(state_changed_ficticio(5)).replace("20.0", "NaN"), id="nan-nao-e-json"
        ),
        pytest.param("[" * 8000, id="aninhamento-profundo"),
    ],
)
def test_malformed_text_gets_an_error_without_sequence_and_keeps_the_connection(
    websocket: WebSocketTestSession, raw: str
) -> None:
    websocket.send_text(raw)

    assert_error(websocket.receive_json(), "MALFORMED_MESSAGE", None)
    assert_connection_still_evaluates(websocket)


def test_binary_frame_gets_an_error_and_keeps_the_connection(
    websocket: WebSocketTestSession,
) -> None:
    websocket.send_bytes(json.dumps(state_changed_ficticio(5)).encode())

    assert_error(websocket.receive_json(), "MALFORMED_MESSAGE", None)
    assert_connection_still_evaluates(websocket)


@pytest.mark.parametrize(
    "message_type", ["simulation.evaluated", "simulation.error", "simulation.foo", ""]
)
def test_unknown_type_gets_an_error_with_the_sequence(
    websocket: WebSocketTestSession, message_type: str
) -> None:
    message = state_changed_ficticio(7)
    message["type"] = message_type

    assert_error(exchange(websocket, message), "UNKNOWN_MESSAGE_TYPE", 7)
    assert_connection_still_evaluates(websocket)


@pytest.mark.parametrize(
    ("sequence", "error_type"),
    [
        pytest.param("7", "int_type", id="texto"),
        pytest.param(7.0, "int_type", id="float"),
        pytest.param(7.5, "int_type", id="fracionario"),
        pytest.param(True, "int_type", id="booleano"),
        pytest.param(None, "int_type", id="null"),
    ],
)
def test_non_integer_sequence_gets_an_error_without_sequence(
    websocket: WebSocketTestSession, sequence: Any, error_type: str
) -> None:
    errors = assert_error(
        exchange(websocket, state_changed_ficticio(sequence)), "INVALID_MESSAGE", None
    )

    assert {"location": ["sequence"], "error_type": error_type}.items() <= errors[0].items()
    assert_connection_still_evaluates(websocket)


def test_missing_sequence_gets_an_error_without_sequence(websocket: WebSocketTestSession) -> None:
    message = state_changed_ficticio()
    del message["sequence"]

    errors = assert_error(exchange(websocket, message), "INVALID_MESSAGE", None)

    assert [error["location"] for error in errors] == [["sequence"]]
    assert errors[0]["error_type"] == "missing"
    assert_connection_still_evaluates(websocket)


def test_missing_type_gets_an_invalid_message_error(websocket: WebSocketTestSession) -> None:
    message = state_changed_ficticio(3)
    del message["type"]

    errors = assert_error(exchange(websocket, message), "INVALID_MESSAGE", 3)

    assert [error["location"] for error in errors] == [["type"]]
    assert_connection_still_evaluates(websocket)


@pytest.mark.parametrize(
    ("field", "value"),
    [
        pytest.param("boom_length_m", -1.0, id="lanca-negativa"),
        pytest.param("cable_length_m", -0.5, id="cabo-negativo"),
        pytest.param("load_weight_kg", -10.0, id="carga-negativa"),
        pytest.param("boom_length_m", "20", id="numero-em-texto"),
        pytest.param("boom_angle_deg", True, id="booleano"),
        pytest.param("turret_rotation_deg", None, id="null"),
        pytest.param("configuration_id", "", id="configuracao-vazia"),
        pytest.param("configuration_id", 123, id="configuracao-numerica"),
    ],
)
def test_invalid_payload_value_gets_an_error_with_the_sequence_and_location(
    websocket: WebSocketTestSession, field: str, value: Any
) -> None:
    message = state_changed_ficticio(21)
    message["payload"][field] = value

    errors = assert_error(exchange(websocket, message), "INVALID_MESSAGE", 21)

    assert [error["location"] for error in errors] == [["payload", field]]
    assert_connection_still_evaluates(websocket)


def test_non_finite_number_from_json_overflow_is_invalid(websocket: WebSocketTestSession) -> None:
    # `1e400` é JSON válido, mas vira infinito em ponto flutuante.
    raw = json.dumps(state_changed_ficticio(22)).replace(
        '"load_weight_kg": 1500.0', '"load_weight_kg": 1e400'
    )
    websocket.send_text(raw)

    errors = assert_error(websocket.receive_json(), "INVALID_MESSAGE", 22)

    assert errors[0]["location"] == ["payload", "load_weight_kg"]
    assert errors[0]["error_type"] == "finite_number"
    assert_connection_still_evaluates(websocket)


def test_missing_and_unknown_payload_fields_are_all_reported(
    websocket: WebSocketTestSession,
) -> None:
    message = state_changed_ficticio(23)
    del message["payload"]["load_weight_kg"]
    message["payload"]["radius_m"] = 10.0  # raio nunca é entrada (ADR-013 C-7)
    message["extra"] = "x"

    errors = assert_error(exchange(websocket, message), "INVALID_MESSAGE", 23)

    assert sorted(tuple(error["location"]) for error in errors) == [
        ("extra",),
        ("payload", "load_weight_kg"),
        ("payload", "radius_m"),
    ]
    assert_connection_still_evaluates(websocket)


def test_missing_payload_gets_an_error(websocket: WebSocketTestSession) -> None:
    errors = assert_error(
        exchange(websocket, {"type": "simulation.state.changed", "sequence": 24}),
        "INVALID_MESSAGE",
        24,
    )

    assert [error["location"] for error in errors] == [["payload"]]


# --- Limite de tamanho (PROVISÓRIO, A VALIDAR em P-008) ------------------------------------------


def test_default_message_size_limit_is_8_kib() -> None:
    assert DEFAULT_MAX_MESSAGE_BYTES == 8 * 1024


def test_message_at_the_limit_is_evaluated_and_one_byte_above_is_rejected() -> None:
    raw = json.dumps(state_changed_ficticio(30))
    limit = len(raw.encode()) + 10
    client = TestClient(build_app(build_evaluate_operation_ficticio(), max_message_bytes=limit))
    with client.websocket_connect(EVALUATION_WEBSOCKET_PATH) as websocket:
        websocket.send_text(raw + " " * 10)  # espaços no fim: JSON válido com `limit` bytes
        at_limit = websocket.receive_json()
        websocket.send_text(raw + " " * 11)
        above_limit = websocket.receive_json()
        websocket.send_text(raw)
        after = websocket.receive_json()

    assert at_limit["type"] == "simulation.evaluated"
    assert at_limit["sequence"] == 30
    # A mensagem grande demais não é lida, então o `sequence` não é ecoado.
    assert_error(above_limit, "MESSAGE_TOO_LARGE", None)
    assert after["type"] == "simulation.evaluated"


def test_message_size_is_counted_in_utf8_bytes() -> None:
    # "ç" ocupa 2 bytes em UTF-8: 1 caractere a mais no id pode passar do limite em bytes.
    raw = json.dumps(
        state_changed_ficticio(31, configuration_id="CFG-FICTÍCIA"), ensure_ascii=False
    )
    limit = len(raw.encode("utf-8")) - 1
    assert len(raw) <= limit  # em caracteres caberia
    client = TestClient(build_app(build_evaluate_operation_ficticio(), max_message_bytes=limit))
    with client.websocket_connect(EVALUATION_WEBSOCKET_PATH) as websocket:
        websocket.send_text(raw)

        assert_error(websocket.receive_json(), "MESSAGE_TOO_LARGE", None)


def test_default_limit_rejects_a_large_message(websocket: WebSocketTestSession) -> None:
    message = state_changed_ficticio(32, configuration_id="C" * DEFAULT_MAX_MESSAGE_BYTES)

    assert_error(exchange(websocket, message), "MESSAGE_TOO_LARGE", None)
    assert_connection_still_evaluates(websocket)


@pytest.mark.parametrize("value", [0, -1, True, 1.5, "8192"])
def test_factory_rejects_an_invalid_message_limit(value: Any) -> None:
    with pytest.raises(ValueError, match="max_message_bytes"):
        create_evaluation_websocket_router(
            build_evaluate_operation_ficticio(), max_message_bytes=value
        )


# --- Falha interna ------------------------------------------------------------------------------


def test_internal_failure_gets_a_generic_error_and_keeps_the_connection(
    caplog: pytest.LogCaptureFixture,
) -> None:
    # Tabela FICTÍCIA de outra configuração: o provedor quebra o contrato e o caso de uso levanta
    # `InconsistentActiveLoadChartError` (erro de programação, não "não avaliável").
    inconsistent_chart = build_load_chart_avaliacao_ficticio(configuration_id="CFG-FICTICIA-OUTRA")
    evaluate_operation = build_evaluate_operation_ficticio(
        charts={CONFIGURATION_AVALIACAO_FICTICIA_ID: inconsistent_chart}
    )
    client = TestClient(build_app(evaluate_operation))
    with client.websocket_connect(EVALUATION_WEBSOCKET_PATH) as websocket:
        first = exchange(websocket, state_changed_ficticio(40))
        second = exchange(websocket, state_changed_ficticio(41))

    for reply, sequence in ((first, 40), (second, 41)):
        assert_error(reply, "INTERNAL_ERROR", sequence)
        assert "CFG-FICTICIA-OUTRA" not in reply["payload"]["message"]  # sem detalhe interno
    assert "InconsistentActiveLoadChartError" in caplog.text


def test_client_can_close_the_connection_cleanly(websocket: WebSocketTestSession) -> None:
    exchange(websocket, state_changed_ficticio(50))
    websocket.close()
