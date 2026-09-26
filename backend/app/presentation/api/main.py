"""Aplicação FastAPI da camada de apresentação (ADR-006).

`create_app` monta a aplicação e registra os routers com os adapters que recebe. A apresentação
não pode importar a infraestrutura (contrato de camadas em `backend/pyproject.toml`), então quem
escolhe os adapters e chama `create_app` é a raiz de composição, `app.main` (TASK-019). A aplicação
completa, com os endpoints de negócio, é `app.main:app`.

O `app` deste módulo é só a base do contrato OpenAPI, sem os endpoints que dependem de um adapter
da infraestrutura. Ele continua aqui porque `tests/test_openapi.py`, `docs/development-guide.md`
§ 3 e o `README.md` ainda apontam para `app.presentation.api.main:app` (atualização pendente, ver
`handoffs/TASK-019.md`).
"""

from fastapi import FastAPI

from app.application.ports.load_chart_parser import LoadChartParser
from app.presentation.api.load_charts import create_load_charts_router
from app.presentation.api.upload_limits import UploadLimits


def create_app(
    *,
    load_chart_parser: LoadChartParser | None = None,
    upload_limits: UploadLimits | None = None,
) -> FastAPI:
    """Monta a aplicação; as rotas de tabela de carga só entram quando há um `load_chart_parser`."""
    app = FastAPI(
        title="Crane Simulator API",
        version="0.1.0",
        description="API do Simulador Web 3D para Análise de Tabelas de Carga de Guindastes.",
    )
    if load_chart_parser is not None:
        limits = upload_limits if upload_limits is not None else UploadLimits()
        app.include_router(create_load_charts_router(load_chart_parser, limits))
    return app


app = create_app()
