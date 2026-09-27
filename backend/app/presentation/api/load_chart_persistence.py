"""Rotas de importação com gravação, consulta e ativação de tabelas de carga (TASK-031).

Doc-fonte § 15.2:

- `POST /api/v1/load-charts/import` (multipart: `file`, `configuration_id`, `chart_id`, `version`):
  CSV ou XLSX, escolhido pelo seletor da composição (TASK-023). Válida → **201** com a tabela em
  `DRAFT` gravada e o arquivo-fonte preservado. Inválida → **422** com o relatório
  (`status: INVALID`, mesmo corpo do `/validate`) e nada gravado (RNF-006). Formato não reconhecido
  → 415; arquivo grande demais, ou XLSX acima dos limites de recurso (P-008) → 413; versão ou id já
  existentes → 409; configuração inexistente → 404;
- `GET /api/v1/load-charts/{chart_id}`: 200 com a tabela, os pontos e a origem; 404;
- `POST /api/v1/load-charts/{chart_id}/activate`: `DRAFT`/`VALIDATED` → `ACTIVE`, e a `ACTIVE`
  anterior da mesma configuração **e zona de giro** → `SUPERSEDED`, na mesma transação (TASK-046;
  as outras zonas não mudam). 200; 404; 409 quando o status não permite ativar ou houve mudança
  concorrente.

Zona de giro (TASK-046; ADR-018): a importação aceita o campo `rotation_zone_code`, conferido
contra as zonas da configuração antes de ler o arquivo. Ordem das respostas da importação: nome do
arquivo vazio (422 padrão) → formato (415) → tamanho (413) → configuração inexistente (404) → zona
(422 `{detail, code}`: `ROTATION_ZONE_REQUIRED`, `UNKNOWN_ROTATION_ZONE`,
`ROTATION_ZONE_NOT_ALLOWED`) → conteúdo (422 com o relatório) → versão ou id repetidos (409).

`POST /{chart_id}/validate` (doc-fonte § 15.2) não existe: a validação acontece na importação, e a
tabela gravada em `DRAFT` já passou por ela (handoffs/TASK-031.md § 8).

Autorização (ADR-016; TASK-038): com banco, a consulta exige sessão (qualquer perfil) e a importação
e a ativação, o perfil `ADMIN` (`write_dependencies`). A apresentação não importa a infraestrutura:
o seletor de parser, os repositórios e o armazenamento vêm prontos da raiz de composição.
"""

from collections.abc import Callable, Sequence
from dataclasses import dataclass, field
from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, params, status
from fastapi.responses import JSONResponse

from app.application.ports.crane_catalog_repository import CraneCatalogRepository
from app.application.ports.file_storage import FileStoragePort
from app.application.ports.load_chart_activation import (
    LoadChartActivationRepository,
    LoadChartStatusChangedError,
)
from app.application.ports.load_chart_file_limits import LoadChartFileLimitExceededError
from app.application.ports.load_chart_parser import LoadChartParser
from app.application.ports.load_chart_repository import (
    ActiveLoadChartConflictError,
    DuplicateLoadChartVersionError,
    LoadChartAlreadyExistsError,
    LoadChartConfigurationNotFoundError,
    LoadChartNotFoundError,
    LoadChartRepository,
)
from app.application.use_cases.activate_load_chart import (
    ActivateLoadChart,
    LoadChartNotActivatableError,
)
from app.application.use_cases.import_load_chart import (
    ImportedLoadChart,
    ImportLoadChart,
    RotationZoneImportError,
    RotationZoneNotAllowedError,
    RotationZoneRequiredError,
    UnknownRotationZoneError,
)
from app.application.use_cases.validate_load_chart_import import InvalidLoadChartImport
from app.presentation.api.load_chart_persistence_schemas import (
    LoadChartActivationResponse,
    LoadChartResponse,
)
from app.presentation.api.load_chart_schemas import LoadChartValidationResponse
from app.presentation.api.load_charts import LOAD_CHARTS_PREFIX
from app.presentation.api.rotation_zone_errors import RotationZoneErrorCode, rotation_zone_error
from app.presentation.api.upload_limits import (
    ErrorResponse,
    UploadLimits,
    body_size_limited_route_class,
    read_upload_within_limit,
)

IMPORT_PATH = f"{LOAD_CHARTS_PREFIX}/import"
UNKNOWN_FILE_TYPE = "application/octet-stream"

type LoadChartParserSelector = Callable[[str | None, str | None], LoadChartParser | None]
"""Escolhe o parser pelo nome do arquivo e pelo tipo de conteúdo; `None` = formato não suportado."""


@dataclass(frozen=True)
class LoadChartPersistenceDependencies:
    """Adapters das rotas de importação com gravação, montados pela raiz de composição.

    `catalog` (TASK-046) confere a zona de giro na importação contra as zonas da configuração; sem
    ele, toda configuração é tratada como sem zonas (só em composições de teste).
    """

    parser_selector: LoadChartParserSelector
    repository: LoadChartRepository
    activation: LoadChartActivationRepository
    file_storage: FileStoragePort
    upload_limits: UploadLimits = field(default_factory=UploadLimits)
    catalog: CraneCatalogRepository | None = None


_ZONE_ERROR_CODES: dict[type[RotationZoneImportError], RotationZoneErrorCode] = {
    RotationZoneRequiredError: RotationZoneErrorCode.ROTATION_ZONE_REQUIRED,
    UnknownRotationZoneError: RotationZoneErrorCode.UNKNOWN_ROTATION_ZONE,
    RotationZoneNotAllowedError: RotationZoneErrorCode.ROTATION_ZONE_NOT_ALLOWED,
}


def _error(status_code: int, description: str) -> dict[int | str, dict[str, object]]:
    return {status_code: {"model": ErrorResponse, "description": description}}


def create_load_chart_persistence_router(
    deps: LoadChartPersistenceDependencies,
    *,
    write_dependencies: Sequence[params.Depends] = (),
) -> APIRouter:
    """Monta o router com os adapters recebidos da composição.

    `write_dependencies` entram só na importação e na ativação: a exigência do perfil `ADMIN`.
    """
    writes = list(write_dependencies)
    limits = deps.upload_limits
    router = APIRouter(
        prefix=LOAD_CHARTS_PREFIX,
        tags=["load-charts"],
        route_class=body_size_limited_route_class(limits.max_request_bytes),
    )

    @router.post(
        "/import",
        status_code=status.HTTP_201_CREATED,
        dependencies=writes,
        response_model=LoadChartResponse,
        summary="Importar uma tabela de carga (CSV ou XLSX) e gravá-la em DRAFT",
        description=(
            "Valida o arquivo (formato canônico **provisório**, known-gaps P-006) e, se não houver "
            "inconsistência, guarda o arquivo-fonte e grava a tabela em `DRAFT` com os metadados "
            "de origem. Não ativa a tabela. Inválida → 422 com o relatório, sem gravar nada. "
            f"Arquivo acima de {limits.max_file_bytes} bytes → 413; XLSX acima dos limites de "
            "tamanho descompactado ou de linhas → 413 (limites provisórios, A VALIDAR P-008). "
            "Com banco, exige o perfil ADMIN (ADR-016)."
        ),
        responses={
            status.HTTP_422_UNPROCESSABLE_CONTENT: {
                "model": LoadChartValidationResponse,
                "description": "Importação inválida: relatório com `status: INVALID`; nada foi "
                "gravado. Zona de giro incompatível com a configuração: `{detail, code}` com "
                "`code` `ROTATION_ZONE_REQUIRED`, `UNKNOWN_ROTATION_ZONE` ou "
                "`ROTATION_ZONE_NOT_ALLOWED` (conferida antes de ler o arquivo). (Requisição "
                "malformada também responde 422, no formato padrão do FastAPI, com `detail`.)",
            },
            **_error(status.HTTP_404_NOT_FOUND, "A configuração informada não existe."),
            **_error(
                status.HTTP_409_CONFLICT,
                "A configuração já tem uma tabela nessa versão (RN-005), ou o id já existe.",
            ),
            **_error(
                status.HTTP_413_CONTENT_TOO_LARGE,
                "Arquivo, corpo ou XLSX descompactado/linhas acima do limite.",
            ),
            **_error(
                status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                "Formato não reconhecido pela extensão nem pelo tipo (aceitos: CSV e XLSX).",
            ),
        },
    )
    def import_load_chart(
        file: Annotated[UploadFile, File(description="Arquivo CSV (UTF-8) ou XLSX da tabela.")],
        configuration_id: Annotated[
            str, Form(description="Configuração do guindaste à qual a tabela pertence (RN-001).")
        ],
        chart_id: Annotated[str, Form(description="Id da tabela de carga.")],
        version: Annotated[str, Form(description="Versão da tabela de carga (RN-005).")],
        rotation_zone_code: Annotated[
            str | None,
            Form(
                description="Zona de giro da tabela (TASK-046; ADR-018): obrigatória se a "
                "configuração tem zonas (senão 422 `ROTATION_ZONE_REQUIRED`), precisa existir nela "
                "(senão 422 `UNKNOWN_ROTATION_ZONE`) e precisa estar ausente numa configuração sem "
                "zonas (senão 422 `ROTATION_ZONE_NOT_ALLOWED`). Vazio ou só espaços = ausente."
            ),
        ] = None,
    ) -> LoadChartResponse | JSONResponse:
        file_name = (file.filename or "").strip()
        if not file_name:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="o arquivo enviado deve ter nome",
            )
        parser = deps.parser_selector(file.filename, file.content_type)
        if parser is None:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="formato de arquivo não suportado; envie CSV (.csv) ou XLSX (.xlsx)",
            )
        content = read_upload_within_limit(file.file, limits.max_file_bytes)
        zone = (rotation_zone_code or "").strip() or None
        try:
            result = ImportLoadChart(deps.repository, deps.file_storage, deps.catalog).execute(
                content,
                parser=parser,
                file_name=file_name,
                file_type=_media_type(file.content_type),
                load_chart_id=chart_id,
                version=version,
                configuration_id=configuration_id,
                rotation_zone_code=zone,
            )
        except RotationZoneImportError as error:
            raise rotation_zone_error(
                status.HTTP_422_UNPROCESSABLE_CONTENT, _ZONE_ERROR_CODES[type(error)], str(error)
            ) from error
        except LoadChartFileLimitExceededError as error:
            raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, detail=str(error)) from error
        except (DuplicateLoadChartVersionError, LoadChartAlreadyExistsError) as error:
            raise HTTPException(status.HTTP_409_CONFLICT, detail=str(error)) from error
        except LoadChartConfigurationNotFoundError as error:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(error)) from error

        match result:
            case InvalidLoadChartImport():
                report = LoadChartValidationResponse.from_result(result)
                return JSONResponse(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    content=report.model_dump(mode="json"),
                )
            case ImportedLoadChart(stored=stored):
                return LoadChartResponse.from_stored(stored)

    @router.get(
        "/{chart_id}",
        summary="Consultar uma tabela de carga gravada",
        responses=_error(status.HTTP_404_NOT_FOUND, "Não existe tabela com esse id."),
    )
    def get_load_chart(chart_id: str) -> LoadChartResponse:
        stored = deps.repository.get_by_id(chart_id)
        if stored is None:
            raise HTTPException(
                status.HTTP_404_NOT_FOUND, detail=str(LoadChartNotFoundError(chart_id))
            )
        return LoadChartResponse.from_stored(stored)

    @router.post(
        "/{chart_id}/activate",
        dependencies=writes,
        summary="Ativar uma tabela de carga (a ACTIVE anterior vira SUPERSEDED)",
        description=(
            "`DRAFT` → `VALIDATED` → `ACTIVE` (doc-fonte § 13.2); `VALIDATED` → `ACTIVE`. A tabela "
            "`ACTIVE` anterior da mesma configuração passa a `SUPERSEDED` na mesma transação "
            "(interpretação a confirmar). `INVALID`, `ACTIVE` e `SUPERSEDED` → 409."
        ),
        responses={
            **_error(status.HTTP_404_NOT_FOUND, "Não existe tabela com esse id."),
            **_error(
                status.HTTP_409_CONFLICT,
                "O status da tabela não permite ativar, ou houve mudança concorrente.",
            ),
        },
    )
    def activate_load_chart(chart_id: str) -> LoadChartActivationResponse:
        try:
            activation = ActivateLoadChart(deps.repository, deps.activation).execute(chart_id)
        except LoadChartNotFoundError as error:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(error)) from error
        except (
            LoadChartNotActivatableError,
            LoadChartStatusChangedError,
            ActiveLoadChartConflictError,
        ) as error:
            raise HTTPException(status.HTTP_409_CONFLICT, detail=str(error)) from error
        return LoadChartActivationResponse.from_activation(activation)

    return router


def _media_type(content_type: str | None) -> str:
    """Tipo de conteúdo sem parâmetros (ex.: `charset`), em minúsculas; desconhecido se vazio."""
    media_type = content_type.split(";", 1)[0].strip().lower() if content_type else ""
    return media_type or UNKNOWN_FILE_TYPE
