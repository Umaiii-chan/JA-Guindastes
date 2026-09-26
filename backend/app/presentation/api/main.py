"""Aplicação FastAPI da camada de apresentação (ADR-006).

`create_app` monta a aplicação e registra os routers com os adapters que recebe. A apresentação
não pode importar a infraestrutura (contrato de camadas em `backend/pyproject.toml`), então quem
escolhe os adapters e chama `create_app` é a raiz de composição, `app.main` (TASK-019, TASK-024,
TASK-029). A aplicação completa, com os endpoints de negócio, é `app.main:app`.

O `app` deste módulo é só a base do contrato OpenAPI (e da rota de saúde), sem os endpoints que
dependem de um adapter da infraestrutura. Ele continua aqui porque `tests/test_openapi.py`,
`docs/development-guide.md` § 3 e o `README.md` ainda apontam para `app.presentation.api.main:app`
(atualização pendente, ver `handoffs/TASK-019.md`).
"""

from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError

from app.application.ports.load_chart_parser import LoadChartParser
from app.application.use_cases.evaluate_operation import EvaluateOperation
from app.presentation.api.evaluations import (
    EvaluateOperationDependency,
    EvaluationDependencies,
    create_evaluations_router,
)
from app.presentation.api.health import DatabaseHealthCheck, create_health_router
from app.presentation.api.load_charts import create_load_charts_router
from app.presentation.api.upload_limits import UploadLimits
from app.presentation.api.validation_errors import request_validation_error_handler
from app.presentation.websocket.evaluation import create_evaluation_websocket_router


def create_app(
    *,
    load_chart_parser: LoadChartParser | None = None,
    upload_limits: UploadLimits | None = None,
    evaluation: EvaluationDependencies | EvaluateOperationDependency | None = None,
    evaluation_websocket: EvaluateOperation | None = None,
    database_health_check: DatabaseHealthCheck | None = None,
    on_shutdown: Callable[[], None] | None = None,
) -> FastAPI:
    """Monta a aplicação com as rotas cujos adapters foram recebidos.

    - a rota de saúde entra sempre; sem `database_health_check`, o banco aparece como
      `NOT_CONFIGURED`;
    - as rotas de tabela de carga só entram quando há um `load_chart_parser`;
    - a rota REST de avaliação só entra com `evaluation` (provedores fixos ou dependência por
      requisição, ver `app.presentation.api.evaluations`);
    - o WebSocket de avaliação só entra com `evaluation_websocket` (o caso de uso pronto);
    - `on_shutdown` roda quando a aplicação encerra (a composição libera o pool do banco).

    Cada router novo entra como um bloco próprio na lista de registros abaixo, com o parâmetro
    opcional correspondente, para que tarefas paralelas acrescentem rotas sem conflito.
    """

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        yield
        if on_shutdown is not None:
            on_shutdown()

    app = FastAPI(
        title="Crane Simulator API",
        version="0.1.0",
        description="API do Simulador Web 3D para Análise de Tabelas de Carga de Guindastes.",
        lifespan=lifespan,
    )
    app.add_exception_handler(RequestValidationError, request_validation_error_handler)

    # --- Registro dos routers (um bloco por router) ----------------------------------------------
    app.include_router(create_health_router(database_health_check))

    if load_chart_parser is not None:
        limits = upload_limits if upload_limits is not None else UploadLimits()
        app.include_router(create_load_charts_router(load_chart_parser, limits))

    if evaluation is not None:
        app.include_router(create_evaluations_router(evaluation))

    if evaluation_websocket is not None:
        app.include_router(create_evaluation_websocket_router(evaluation_websocket))

    return app


app = create_app()
