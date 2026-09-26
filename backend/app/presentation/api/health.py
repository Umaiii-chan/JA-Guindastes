"""Rota de saúde `GET /api/v1/health` (TASK-029; pedida pela stack Docker da TASK-027).

Responde **200** sempre que o processo está de pé e atendendo requisições (`status: UP`). O campo
`database` diz se o banco responde, sem nunca expor a URL, o host ou a mensagem do driver:

- `NOT_CONFIGURED`: a composição subiu sem `DATABASE_URL` (a avaliação responde "não avaliável");
- `UP`: a verificação do banco passou;
- `DOWN`: a verificação do banco falhou.

Banco fora do ar não muda o código HTTP: a rota mede se o processo está vivo; o estado do banco é
informativo. Quem decide o que fazer com `DOWN` (por exemplo, um healthcheck mais rígido) é quem
consome a rota.

A verificação chega pronta da raiz de composição (`app.main`), porque a apresentação não importa a
infraestrutura (contrato de camadas em `backend/pyproject.toml`).
"""

from collections.abc import Callable
from enum import StrEnum
from typing import Literal

from fastapi import APIRouter, status
from pydantic import BaseModel, ConfigDict

HEALTH_PATH = "/api/v1/health"

type DatabaseHealthCheck = Callable[[], bool]
"""Verifica se o banco responde: `True` se sim, `False` se não. Não deve levantar exceção."""


class DatabaseHealth(StrEnum):
    NOT_CONFIGURED = "NOT_CONFIGURED"
    UP = "UP"
    DOWN = "DOWN"


class HealthResponse(BaseModel):
    """Corpo da rota de saúde. Não carrega URL, host, versão do banco nem mensagem de erro."""

    model_config = ConfigDict(extra="forbid")

    status: Literal["UP"]
    database: DatabaseHealth


def create_health_router(database_check: DatabaseHealthCheck | None) -> APIRouter:
    """Monta a rota de saúde; sem `database_check`, o banco aparece como `NOT_CONFIGURED`."""
    router = APIRouter(prefix=HEALTH_PATH, tags=["health"])

    @router.get(
        "",
        status_code=status.HTTP_200_OK,
        summary="Saúde do processo e do banco",
        description=(
            "Responde 200 enquanto o processo atende requisições. `database` informa se o banco "
            "responde (`UP`/`DOWN`) ou se a persistência não foi configurada (`NOT_CONFIGURED`); "
            "banco fora do ar não muda o código HTTP. Não expõe URL nem mensagens do driver."
        ),
    )
    def health() -> HealthResponse:
        # Rota síncrona: a verificação do banco bloqueia, e o FastAPI a roda numa thread à parte.
        if database_check is None:
            database = DatabaseHealth.NOT_CONFIGURED
        elif database_check():
            database = DatabaseHealth.UP
        else:
            database = DatabaseHealth.DOWN
        return HealthResponse(status="UP", database=database)

    return router
