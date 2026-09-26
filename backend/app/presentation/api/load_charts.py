"""Rotas REST das tabelas de carga (TASK-019; doc-fonte § 15.2; ADR-010).

Só a validação de importação existe por enquanto: `POST /api/v1/load-charts/validate` lê o CSV
enviado com o caso de uso `ValidateLoadChartImport` e devolve `DRAFT` com os pontos, ou `INVALID`
com o relatório (RF-006, RF-009, RNF-006). Nada é gravado, nem o arquivo (nem em disco), nem a
tabela, nem o relatório, e nenhuma tabela é ativada.

A doc-fonte § 15.2 prevê `POST /import` e `POST /{load_chart_id}/validate` como etapas de uma tabela
já persistida; sem persistência, esta rota valida o arquivo sem criar tabela e, por isso, não tem id
na rota. `/import` com persistência fica para quando houver as tabelas no banco.

Uma tabela inválida responde **200** com `status: INVALID`: a requisição estava bem formada e o
relatório é o resultado pedido. O 422 fica para o que o FastAPI já usa, a requisição malformada
(arquivo ou campo obrigatório faltando). O 413 é o arquivo ou o corpo grande demais
(`upload_limits`).

Autorização (ADR-016; TASK-038): com banco, exige sessão de qualquer perfil (o Operador pode validar
sem gravar); a composição liga a dependência na inclusão do router.

O router recebe o `LoadChartParser` pronto porque a apresentação não pode importar a infraestrutura
(contrato de camadas em `backend/pyproject.toml`): quem escolhe o adapter é a raiz de composição,
`app.main`.
"""

from typing import Annotated

from fastapi import APIRouter, File, Form, UploadFile, status

from app.application.ports.load_chart_parser import LoadChartParser
from app.application.use_cases.validate_load_chart_import import ValidateLoadChartImport
from app.presentation.api.load_chart_schemas import LoadChartValidationResponse
from app.presentation.api.upload_limits import (
    ErrorResponse,
    UploadLimits,
    body_size_limited_route_class,
    read_upload_within_limit,
)

LOAD_CHARTS_PREFIX = "/api/v1/load-charts"
VALIDATE_PATH = f"{LOAD_CHARTS_PREFIX}/validate"


def create_load_charts_router(parser: LoadChartParser, upload_limits: UploadLimits) -> APIRouter:
    """Monta o router das tabelas de carga com o adapter de leitura escolhido pela composição."""
    router = APIRouter(
        prefix=LOAD_CHARTS_PREFIX,
        tags=["load-charts"],
        route_class=body_size_limited_route_class(upload_limits.max_request_bytes),
    )

    @router.post(
        "/validate",
        status_code=status.HTTP_200_OK,
        response_description=(
            "Validação concluída: `DRAFT` com os pontos, ou `INVALID` com o relatório."
        ),
        summary="Validar a importação de uma tabela de carga em CSV (sem gravar)",
        description=(
            "Lê o CSV no formato canônico interno **provisório** (known-gaps P-006; colunas "
            "`boom_length_m,working_radius_m,max_capacity_kg`, UTF-8, vírgula e ponto decimal) e "
            "devolve `DRAFT` com os pontos, ou `INVALID` com o relatório de inconsistências. "
            "Tabela inválida responde 200 com `status: INVALID`. Nada é gravado e a tabela não "
            f"é ativada. Arquivo acima de {upload_limits.max_file_bytes} bytes responde 413 "
            "(o limite padrão de 1 MiB é provisório, a validar em P-008). "
            "Com banco, exige sessão de qualquer perfil (ADR-016)."
        ),
        responses={
            status.HTTP_413_CONTENT_TOO_LARGE: {
                "model": ErrorResponse,
                "description": "O arquivo, ou o corpo da requisição, excede o tamanho máximo.",
            },
        },
    )
    def validate_load_chart_import(
        file: Annotated[
            UploadFile,
            File(description="Arquivo CSV da tabela de carga (UTF-8). Não é gravado."),
        ],
        configuration_id: Annotated[
            str, Form(description="Configuração do guindaste à qual a tabela pertence (RN-001).")
        ],
        chart_id: Annotated[str, Form(description="Id da tabela de carga.")],
        version: Annotated[str, Form(description="Versão da tabela de carga (RN-005).")],
    ) -> LoadChartValidationResponse:
        # Rota síncrona: o FastAPI a roda numa thread à parte, então ler o arquivo e validar a
        # tabela não travam o laço de eventos.
        content = read_upload_within_limit(file.file, upload_limits.max_file_bytes)
        result = ValidateLoadChartImport(parser).execute(
            content,
            load_chart_id=chart_id,
            version=version,
            configuration_id=configuration_id,
        )
        return LoadChartValidationResponse.from_result(result)

    return router
