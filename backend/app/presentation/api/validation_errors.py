"""Resposta 422 que continua sendo JSON válido quando a entrada tem `NaN` ou infinito (TASK-024).

O FastAPI aceita `NaN`, `Infinity` e `1e400` no corpo JSON (o `json` do Python os lê), e o 422
padrão devolve o valor recebido em `detail[].input`. Com um número não finito ali, a serialização da
resposta falha (`ValueError: Out of range float values are not JSON compliant`), e o cliente
receberia 500 em vez do 422. Este handler devolve o mesmo corpo do padrão (`{"detail": [...]}`),
trocando só os números não finitos pelo texto `"NaN"`, `"Infinity"` ou `"-Infinity"`.
"""

import math

from fastapi import Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


async def request_validation_error_handler(request: Request, exc: Exception) -> JSONResponse:
    """Mesmo 422 do FastAPI, com os números não finitos trocados por texto."""
    errors = exc.errors() if isinstance(exc, RequestValidationError) else []
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        content={"detail": _replace_non_finite(jsonable_encoder(errors))},
    )


def _replace_non_finite(value: object) -> object:
    if isinstance(value, float) and not math.isfinite(value):
        if math.isnan(value):
            return "NaN"
        return "Infinity" if value > 0 else "-Infinity"
    if isinstance(value, dict):
        return {key: _replace_non_finite(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_replace_non_finite(item) for item in value]
    return value
