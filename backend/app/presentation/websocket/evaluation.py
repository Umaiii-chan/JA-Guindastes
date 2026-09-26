"""WebSocket de avaliação em tempo real (TASK-025; doc-fonte §§ 15.4 e 16.1; ADR-010).

Ciclo: o cliente envia `simulation.state.changed` com `sequence` e o estado operacional; o servidor
valida a mensagem (RN-008), chama o `EvaluateOperation` e responde `simulation.evaluated` com o
**mesmo** `sequence`. As mensagens de uma conexão são tratadas uma de cada vez, na ordem de
chegada, então as respostas saem na mesma ordem. O servidor não descarta mensagens antigas: é o
cliente que ignora respostas com `sequence` antigo (doc-fonte § 15.4).

Mensagem que não pode ser avaliada recebe `simulation.error` e a conexão **continua aberta**.

Rota provisória `/api/v1/ws/evaluation`, sem `simulation_id`: a doc-fonte § 15.4 prevê
`/api/v1/ws/simulations/{simulation_id}`, mas ainda não há simulação persistida. A configuração vem
em cada mensagem (`payload.configuration_id`; ver `handoffs/TASK-025.md` § 5).

Sem autenticação nem validação de `Origin`: P-009 está pendente (known-gaps L-003).

O router recebe o `EvaluateOperation` pronto porque a apresentação não importa a infraestrutura
(contrato de camadas em `backend/pyproject.toml`): quem monta o caso de uso com os adapters e
registra o router na aplicação é a raiz de composição (leva B).
"""

import json
import logging
from collections.abc import Mapping
from typing import Any

from fastapi import APIRouter, WebSocket
from pydantic import ValidationError
from starlette.concurrency import run_in_threadpool
from starlette.websockets import WebSocketDisconnect

from app.application.use_cases.evaluate_operation import EvaluateOperation, OperationEvaluation
from app.domain.exceptions.domain_errors import DomainError
from app.domain.value_objects.angle import Angle
from app.domain.value_objects.length import Length
from app.domain.value_objects.mass import Mass
from app.domain.value_objects.operational_state import OperationalState
from app.presentation.websocket.evaluation_messages import (
    INBOUND_MESSAGE_TYPES,
    ErrorCode,
    ErrorDetailMessage,
    ErrorPayload,
    OperationalStatePayload,
    SimulationErrorMessage,
    SimulationEvaluatedMessage,
    SimulationStateChangedMessage,
)

logger = logging.getLogger(__name__)

EVALUATION_WEBSOCKET_PATH = "/api/v1/ws/evaluation"
"""Rota provisória, sem `simulation_id` (doc-fonte § 15.4); muda quando a simulação existir."""

DEFAULT_MAX_MESSAGE_BYTES = 8 * 1024
"""Tamanho máximo de uma mensagem recebida: 8 KiB (UTF-8). PROVISÓRIO — A VALIDAR (P-008).

Uma `simulation.state.changed` típica tem menos de 300 bytes; 8 KiB deixam folga para ids longos
sem aceitar mensagens arbitrárias. O limite é conferido **depois** que o servidor ASGI já recebeu a
mensagem inteira: a proteção de memória de verdade é o limite de frame do servidor (no uvicorn,
`--ws-max-size`, padrão 16 MiB), a configurar na composição (pendência no handoff).
"""


class _MessageRejected(Exception):
    """Mensagem recusada antes da avaliação; vira `simulation.error`."""

    def __init__(
        self,
        code: ErrorCode,
        message: str,
        *,
        sequence: int | None = None,
        errors: list[ErrorDetailMessage] | None = None,
    ) -> None:
        super().__init__(message)
        self.error = SimulationErrorMessage(
            sequence=sequence,
            payload=ErrorPayload(code=code, message=message, errors=errors or []),
        )


def create_evaluation_websocket_router(
    evaluate_operation: EvaluateOperation,
    *,
    max_message_bytes: int = DEFAULT_MAX_MESSAGE_BYTES,
) -> APIRouter:
    """Monta o router do WebSocket de avaliação com o caso de uso montado pela composição.

    `max_message_bytes` é o limite de tamanho de cada mensagem recebida (padrão provisório de
    8 KiB, A VALIDAR em P-008).
    """
    if (
        isinstance(max_message_bytes, bool)
        or not isinstance(max_message_bytes, int)
        or max_message_bytes <= 0
    ):
        raise ValueError(
            f"max_message_bytes deve ser um inteiro positivo; recebido {max_message_bytes!r}"
        )

    router = APIRouter()

    @router.websocket(EVALUATION_WEBSOCKET_PATH)
    async def evaluation_websocket(websocket: WebSocket) -> None:
        await websocket.accept()
        try:
            while True:
                message = await websocket.receive()
                if message["type"] == "websocket.disconnect":
                    return
                reply = await _handle_message(message, evaluate_operation, max_message_bytes)
                await websocket.send_text(reply.model_dump_json())
        except WebSocketDisconnect:
            return

    return router


async def _handle_message(
    message: Mapping[str, Any], evaluate_operation: EvaluateOperation, max_message_bytes: int
) -> SimulationEvaluatedMessage | SimulationErrorMessage:
    try:
        request = _parse_state_changed(message, max_message_bytes)
    except _MessageRejected as rejected:
        return rejected.error

    try:
        evaluation = await run_in_threadpool(_evaluate, evaluate_operation, request.payload)
    except _MessageRejected as rejected:
        rejected.error.sequence = request.sequence
        return rejected.error
    except Exception:
        # Erro de programação (ex.: `InconsistentActiveLoadChartError`): registra no log e avisa o
        # cliente sem detalhes internos, mantendo a conexão para as próximas mensagens.
        logger.exception("falha ao avaliar a mensagem de sequence %s", request.sequence)
        return SimulationErrorMessage(
            sequence=request.sequence,
            payload=ErrorPayload(
                code=ErrorCode.INTERNAL_ERROR,
                message="falha interna ao avaliar a operação",
            ),
        )
    return SimulationEvaluatedMessage.from_evaluation(request.sequence, evaluation)


def _parse_state_changed(
    message: Mapping[str, Any], max_message_bytes: int
) -> SimulationStateChangedMessage:
    text = message.get("text")
    if text is None:
        raise _MessageRejected(
            ErrorCode.MALFORMED_MESSAGE, "a mensagem deve ser um objeto JSON enviado como texto"
        )

    size = len(text.encode("utf-8"))
    if size > max_message_bytes:
        raise _MessageRejected(
            ErrorCode.MESSAGE_TOO_LARGE,
            f"a mensagem tem {size} bytes e excede o tamanho máximo de {max_message_bytes} bytes",
        )

    try:
        data = json.loads(text, parse_constant=_reject_non_standard_constant)
    except ValueError, RecursionError:
        raise _MessageRejected(
            ErrorCode.MALFORMED_MESSAGE, "a mensagem não é JSON válido"
        ) from None
    if not isinstance(data, dict):
        raise _MessageRejected(ErrorCode.MALFORMED_MESSAGE, "a mensagem deve ser um objeto JSON")

    sequence = _readable_sequence(data)
    message_type = data.get("type")
    if isinstance(message_type, str) and message_type not in INBOUND_MESSAGE_TYPES:
        raise _MessageRejected(
            ErrorCode.UNKNOWN_MESSAGE_TYPE,
            f"tipo de mensagem desconhecido: {message_type!r}",
            sequence=sequence,
        )

    try:
        return SimulationStateChangedMessage.model_validate(data)
    except ValidationError as error:
        raise _MessageRejected(
            ErrorCode.INVALID_MESSAGE,
            "a mensagem tem campos ausentes, desconhecidos ou inválidos",
            sequence=sequence,
            errors=[
                ErrorDetailMessage(
                    location=list(detail["loc"]), message=detail["msg"], error_type=detail["type"]
                )
                for detail in error.errors()
            ],
        ) from None


def _reject_non_standard_constant(constant: str) -> Any:
    # `NaN`, `Infinity` e `-Infinity` não são JSON (RFC 8259), mas o `json` do Python os aceita.
    raise ValueError(f"constante não permitida em JSON: {constant}")


def _readable_sequence(data: dict[str, Any]) -> int | None:
    """O `sequence` da mensagem, se for inteiro (não booleano), para ecoar no erro."""
    sequence = data.get("sequence")
    if isinstance(sequence, int) and not isinstance(sequence, bool):
        return sequence
    return None


def _evaluate(
    evaluate_operation: EvaluateOperation, payload: OperationalStatePayload
) -> OperationEvaluation:
    # Roda numa thread à parte: os adapters dos provedores podem fazer E/S síncrona (banco).
    try:
        state = OperationalState(
            boom_length=Length(payload.boom_length_m),
            boom_angle=Angle(payload.boom_angle_deg),
            turret_rotation=Angle(payload.turret_rotation_deg),
            cable_length=Length(payload.cable_length_m),
        )
        load_weight = Mass(payload.load_weight_kg)
    except DomainError as error:
        # O schema já recusa o que os value objects recusam; isto é só defesa em profundidade.
        raise _MessageRejected(ErrorCode.INVALID_MESSAGE, str(error)) from None
    return evaluate_operation.execute(
        configuration_id=payload.configuration_id, state=state, load_weight=load_weight
    )
