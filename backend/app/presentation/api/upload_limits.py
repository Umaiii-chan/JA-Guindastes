"""Limite de tamanho dos uploads da API (TASK-019; segurança mínima enquanto P-008 está aberta).

A VALIDAR (P-008): os requisitos de segurança dos uploads (tamanho máximo, número de linhas, zip
bomb, macros, path traversal) não foram definidos pela empresa nem pela pessoa responsável. O valor
padrão de 1 MiB é PROVISÓRIO, escolhido pela pessoa responsável só para a TASK-019.

O limite vale em dois pontos, porque o Starlette lê o formulário inteiro antes de o endpoint rodar e
guarda cada arquivo num `SpooledTemporaryFile`, que passa da memória para um arquivo temporário em
disco acima de 1 MiB:

1. `body_size_limited_route_class`: recusa com 413 o **corpo** da requisição maior que o limite do
   arquivo mais uma margem para o resto do formulário, antes de o formulário ser lido; olha o
   `Content-Length` declarado e também conta os bytes recebidos (vale para envio sem
   `Content-Length`, em blocos);
2. `read_upload_within_limit`: recusa com 413 o **arquivo** maior que o limite, com precisão de
   byte, depois de o formulário ser lido.
"""

from collections.abc import Callable, Coroutine
from dataclasses import dataclass
from typing import Any, BinaryIO

from fastapi import HTTPException, Request, Response, status
from fastapi.routing import APIRoute
from pydantic import BaseModel, Field
from starlette.types import Message, Receive

MIB = 1024 * 1024

DEFAULT_MAX_UPLOAD_FILE_BYTES = 1 * MIB
"""Tamanho máximo padrão do arquivo enviado: 1 MiB. PROVISÓRIO — A VALIDAR (P-008)."""

MULTIPART_FORM_ALLOWANCE_BYTES = 16 * 1024
"""Margem, além do arquivo, para os delimitadores do `multipart/form-data` e os campos de texto.

A VALIDAR (P-008). 16 KiB sobram para delimitadores, cabeçalhos das partes e identificadores
curtos. Um formulário com campos de texto maiores que isso, junto com um arquivo no limite, é
recusado com 413.
"""


@dataclass(frozen=True, slots=True)
class UploadLimits:
    """Limites de upload aplicados pelos endpoints que recebem arquivo."""

    max_file_bytes: int = DEFAULT_MAX_UPLOAD_FILE_BYTES

    def __post_init__(self) -> None:
        if (
            isinstance(self.max_file_bytes, bool)
            or not isinstance(self.max_file_bytes, int)
            or self.max_file_bytes <= 0
        ):
            raise ValueError(
                f"max_file_bytes deve ser um inteiro positivo; recebido {self.max_file_bytes!r}"
            )

    @property
    def max_request_bytes(self) -> int:
        """Tamanho máximo do corpo inteiro da requisição: o arquivo mais a margem do formulário."""
        return self.max_file_bytes + MULTIPART_FORM_ALLOWANCE_BYTES


class ErrorResponse(BaseModel):
    """Corpo das respostas de erro levantadas com `HTTPException` (mesmo formato do FastAPI)."""

    detail: str = Field(description="Motivo do erro, legível por pessoa.")


def body_size_limited_route_class(max_body_bytes: int) -> type[APIRoute]:
    """Classe de rota que recusa com 413 o corpo maior que `max_body_bytes` antes de lê-lo.

    Sem isso, um upload de qualquer tamanho seria lido inteiro pelo Starlette (e passaria para um
    arquivo temporário em disco acima de 1 MiB) antes de o endpoint poder recusá-lo.
    """

    class BodySizeLimitedRoute(APIRoute):
        def get_route_handler(self) -> Callable[[Request], Coroutine[Any, Any, Response]]:
            handler = super().get_route_handler()

            async def limited_handler(request: Request) -> Response:
                declared = _declared_content_length(request)
                if declared is not None and declared > max_body_bytes:
                    raise _request_too_large(max_body_bytes)
                limited = Request(
                    request.scope, receive=_limited_receive(request.receive, max_body_bytes)
                )
                return await handler(limited)

            return limited_handler

    return BodySizeLimitedRoute


def read_upload_within_limit(file: BinaryIO, max_file_bytes: int) -> bytes:
    """Lê o arquivo enviado para a memória, ou levanta 413 se ele passar de `max_file_bytes`.

    Lê no máximo `max_file_bytes + 1` bytes: o suficiente para saber que passou do limite.
    """
    content = file.read(max_file_bytes + 1)
    if len(content) > max_file_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail=f"o arquivo excede o tamanho máximo de {max_file_bytes} bytes",
        )
    return content


def _declared_content_length(request: Request) -> int | None:
    """`Content-Length` declarado, ou `None` se ausente ou ilegível (o servidor HTTP trata)."""
    raw = request.headers.get("content-length")
    if raw is None or not raw.strip().isdecimal():
        return None
    return int(raw)


def _limited_receive(receive: Receive, max_body_bytes: int) -> Receive:
    """Envolve o `receive` do ASGI contando os bytes do corpo; passa do limite → 413."""
    received = 0

    async def limited() -> Message:
        nonlocal received
        message = await receive()
        if message["type"] == "http.request":
            received += len(message.get("body", b""))
            if received > max_body_bytes:
                raise _request_too_large(max_body_bytes)
        return message

    return limited


def _request_too_large(max_body_bytes: int) -> HTTPException:
    # O FastAPI repassa `HTTPException` levantada durante a leitura do corpo, em vez de trocá-la
    # por "400 There was an error parsing the body" (fastapi/routing.py, leitura do corpo).
    return HTTPException(
        status_code=status.HTTP_413_CONTENT_TOO_LARGE,
        detail=f"a requisição excede o tamanho máximo de {max_body_bytes} bytes",
    )
