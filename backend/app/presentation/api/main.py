"""Aplicação FastAPI da camada de apresentação (ADR-006).

`create_app` monta a aplicação e registra os routers com os adapters que recebe. A apresentação
não pode importar a infraestrutura (contrato de camadas em `backend/pyproject.toml`), então quem
escolhe os adapters e chama `create_app` é a raiz de composição, `app.main` (TASK-019, TASK-024,
TASK-029). A aplicação completa, com os endpoints de negócio, é `app.main:app`.

O `app` deste módulo é só a base do contrato OpenAPI (e da rota de saúde), sem os endpoints que
dependem de um adapter da infraestrutura. Ele continua aqui porque `tests/test_openapi.py` ainda o
importa; a documentação já aponta para `app.main:app` (TASK-037). Remover este `app` é dívida
registrada em `docs/known-gaps.md` (D-001).
"""

from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.exceptions import RequestValidationError

from app.application.ports.crane_catalog_listing import CraneCatalogStore
from app.application.ports.load_chart_parser import LoadChartParser
from app.application.use_cases.authentication import GetCurrentUser
from app.application.use_cases.evaluate_operation import EvaluateOperation
from app.presentation.api.auth import create_auth_router
from app.presentation.api.authorization import (
    ApiError,
    AuthDependencies,
    AuthGuards,
    CsrfHeaderMiddleware,
    api_error_handler,
)
from app.presentation.api.catalog import create_catalog_router
from app.presentation.api.evaluations import (
    EvaluateOperationDependency,
    EvaluationDependencies,
    create_evaluations_router,
)
from app.presentation.api.health import DatabaseHealthCheck, create_health_router
from app.presentation.api.load_chart_persistence import (
    LoadChartPersistenceDependencies,
    create_load_chart_persistence_router,
)
from app.presentation.api.load_charts import create_load_charts_router
from app.presentation.api.upload_limits import UploadLimits
from app.presentation.api.users import create_users_router
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
    catalog_repository: CraneCatalogStore | None = None,
    load_chart_persistence: LoadChartPersistenceDependencies | None = None,
    auth: AuthDependencies | None = None,
) -> FastAPI:
    """Monta a aplicação com as rotas cujos adapters foram recebidos.

    - a rota de saúde entra sempre; sem `database_health_check`, o banco aparece como
      `NOT_CONFIGURED`;
    - as rotas de tabela de carga só entram quando há um `load_chart_parser`;
    - a rota REST de avaliação só entra com `evaluation` (provedores fixos ou dependência por
      requisição, ver `app.presentation.api.evaluations`);
    - o WebSocket de avaliação só entra com `evaluation_websocket` (o caso de uso pronto);
    - as rotas do catálogo só entram com `catalog_repository` (TASK-030);
    - importação com gravação, consulta e ativação de tabelas (TASK-031) só entram com
      `load_chart_persistence`;
    - `on_shutdown` roda quando a aplicação encerra (a composição libera o pool do banco);
    - `auth` (TASK-038, ADR-016) liga a autenticação: cabeçalho CSRF nos métodos inseguros, sessão
      exigida em toda rota exceto a saúde e `GET /auth/session`, perfil `ADMIN` nos cadastros, na
      importação e na ativação, rotas de login/logout e de usuários, e origem + sessão no WebSocket.
      Sem `auth` (sem banco, ADR-016 § 5), só `GET /auth/session` entra, com `authEnabled: false`,
      e as demais rotas ficam como antes, abertas.

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
    app.add_exception_handler(ApiError, api_error_handler)

    # --- Autenticação (TASK-038; ADR-016) --------------------------------------------------------
    guards = None if auth is None else AuthGuards(GetCurrentUser(auth.sessions, clock=auth.clock))
    if auth is not None:
        app.add_middleware(CsrfHeaderMiddleware)
    # Leitura (qualquer perfil) e escrita (ADMIN); vazias sem autenticação.
    session_required = [] if guards is None else [Depends(guards.current_user)]
    admin_required = [] if guards is None else [Depends(guards.require_admin)]

    # --- Registro dos routers (um bloco por router) ----------------------------------------------
    app.include_router(create_health_router(database_health_check))

    app.include_router(create_auth_router(auth, guards))

    if auth is not None and guards is not None:
        app.include_router(create_users_router(auth, guards))

    if load_chart_parser is not None:
        limits = upload_limits if upload_limits is not None else UploadLimits()
        app.include_router(
            create_load_charts_router(load_chart_parser, limits), dependencies=session_required
        )

    if evaluation is not None:
        app.include_router(create_evaluations_router(evaluation), dependencies=session_required)

    if evaluation_websocket is not None:
        app.include_router(
            create_evaluation_websocket_router(
                evaluation_websocket,
                connection_guard=None if guards is None else guards.check_websocket,
            )
        )

    if catalog_repository is not None:
        app.include_router(
            create_catalog_router(catalog_repository, write_dependencies=admin_required),
            dependencies=session_required,
        )

    if load_chart_persistence is not None:
        app.include_router(
            create_load_chart_persistence_router(
                load_chart_persistence, write_dependencies=admin_required
            ),
            dependencies=session_required,
        )

    return app


app = create_app()
