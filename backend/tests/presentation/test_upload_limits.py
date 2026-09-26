"""Limite de tamanho dos uploads (TASK-019; valor padrão PROVISÓRIO — A VALIDAR, P-008).

O envio sem `Content-Length` (em blocos) é simulado chamando a aplicação ASGI direto, porque o
`TestClient` junta o corpo inteiro numa mensagem só. Os bytes enviados são FICTÍCIOS (ADR-012).
"""

import asyncio
import json

import pytest
from starlette.types import Message

from app.application.ports.load_chart_parser import LoadChartParseResult
from app.presentation.api.load_charts import VALIDATE_PATH
from app.presentation.api.main import create_app
from app.presentation.api.upload_limits import (
    DEFAULT_MAX_UPLOAD_FILE_BYTES,
    MIB,
    MULTIPART_FORM_ALLOWANCE_BYTES,
    UploadLimits,
)

BOUNDARY = "limite-ficticio"
CHUNK_BYTES = 64 * 1024


class SpyParser:
    """Parser falso: guarda o conteúdo recebido e devolve uma leitura sem pontos."""

    def __init__(self) -> None:
        self.received: list[bytes] = []

    def parse(self, content: bytes) -> LoadChartParseResult:
        self.received.append(content)
        return LoadChartParseResult(points=(), issues=())


def multipart_body_ficticio(file_content: bytes) -> bytes:
    """Corpo `multipart/form-data` com os campos FICTÍCIOS e o arquivo."""
    fields = {"configuration_id": "CFG-FICTICIA-A", "chart_id": "LC-FICTICIO-001", "version": "v1"}
    parts = [
        f'--{BOUNDARY}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode()
        for name, value in fields.items()
    ]
    parts.append(
        f'--{BOUNDARY}\r\nContent-Disposition: form-data; name="file"; '
        'filename="ficticio.csv"\r\nContent-Type: text/csv\r\n\r\n'.encode()
        + file_content
        + b"\r\n"
    )
    parts.append(f"--{BOUNDARY}--\r\n".encode())
    return b"".join(parts)


def post_in_chunks_without_content_length(
    parser: SpyParser, body: bytes
) -> tuple[int, dict[str, object], int, int]:
    """Envia `body` em blocos, sem `Content-Length`; devolve status, JSON, blocos lidos e total."""
    app = create_app(load_chart_parser=parser)
    chunks = [body[start : start + CHUNK_BYTES] for start in range(0, len(body), CHUNK_BYTES)]
    consumed = 0
    sent: list[Message] = []

    async def receive() -> Message:
        nonlocal consumed
        if consumed == len(chunks):
            return {"type": "http.disconnect"}
        consumed += 1
        return {
            "type": "http.request",
            "body": chunks[consumed - 1],
            "more_body": consumed < len(chunks),
        }

    async def send(message: Message) -> None:
        sent.append(message)

    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "POST",
        "scheme": "http",
        "path": VALIDATE_PATH,
        "raw_path": VALIDATE_PATH.encode(),
        "query_string": b"",
        "root_path": "",
        "headers": [
            (b"host", b"testserver"),
            (b"content-type", f"multipart/form-data; boundary={BOUNDARY}".encode()),
            (b"transfer-encoding", b"chunked"),
        ],
        "client": ("testclient", 50000),
        "server": ("testserver", 80),
    }
    asyncio.run(app(scope, receive, send))

    status = next(message["status"] for message in sent if message["type"] == "http.response.start")
    body_out = b"".join(
        message.get("body", b"") for message in sent if message["type"] == "http.response.body"
    )
    return status, json.loads(body_out), consumed, len(chunks)


def test_default_file_limit_is_the_provisional_1_mib() -> None:
    # PROVISÓRIO — A VALIDAR (P-008): valor decidido pela pessoa responsável só para a TASK-019.
    assert DEFAULT_MAX_UPLOAD_FILE_BYTES == MIB == 1024 * 1024
    assert UploadLimits().max_file_bytes == MIB


def test_request_limit_is_the_file_limit_plus_the_form_allowance() -> None:
    limits = UploadLimits(max_file_bytes=1000)

    assert limits.max_request_bytes == 1000 + MULTIPART_FORM_ALLOWANCE_BYTES


@pytest.mark.parametrize("invalid", [0, -1, True, 1.5, "1048576"])
def test_file_limit_must_be_a_positive_integer(invalid: object) -> None:
    with pytest.raises(ValueError, match="max_file_bytes"):
        UploadLimits(max_file_bytes=invalid)  # type: ignore[arg-type]


def test_body_without_content_length_over_the_limit_is_cut_while_streaming() -> None:
    parser = SpyParser()
    max_request_bytes = UploadLimits().max_request_bytes
    body = multipart_body_ficticio(b"x" * (2 * MIB))

    status, payload, consumed, total = post_in_chunks_without_content_length(parser, body)

    assert status == 413
    assert payload == {
        "detail": f"a requisição excede o tamanho máximo de {max_request_bytes} bytes"
    }
    # Parou de ler logo depois de passar do limite: o resto do corpo nem foi recebido.
    assert consumed * CHUNK_BYTES <= max_request_bytes + CHUNK_BYTES
    assert consumed < total
    assert parser.received == []


def test_body_without_content_length_within_the_limit_is_accepted() -> None:
    parser = SpyParser()
    body = multipart_body_ficticio(b"x" * MIB)

    status, payload, consumed, total = post_in_chunks_without_content_length(parser, body)

    assert status == 200
    assert payload["status"] == "INVALID"  # o parser espião não devolve pontos
    assert consumed == total
    assert [len(content) for content in parser.received] == [MIB]
