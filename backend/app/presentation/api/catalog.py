"""Rotas REST dos cadastros do catálogo (TASK-030; doc-fonte § 15.1; RF-001, RF-002, RF-005).

- `GET/POST /api/v1/manufacturers` e `GET /api/v1/manufacturers/{manufacturer_id}`;
- `GET/POST /api/v1/cranes` (listagem com filtro opcional `manufacturer_id`) e
  `GET /api/v1/cranes/{crane_id}`;
- `GET/POST /api/v1/cranes/{crane_id}/configurations`;
- `GET /api/v1/configurations/{configuration_id}`.

Códigos HTTP:
- **201** ao criar (ids gerados pelo servidor, UUID em texto); **200** ao ler e listar;
- **404** quando o registro da rota não existe, ou o fabricante/guindaste de que o novo registro
  depende não existe (inclusive o `manufacturer_id` do corpo e o do filtro da listagem);
- **409** quando o repositório recusa um id repetido (`CatalogEntryAlreadyExistsError`). Nomes
  repetidos são aceitos: não há regra de unicidade (pendência 2 da TASK-022);
- **422** para o corpo malformado, inclusive nome vazio e ficha técnica incoerente.

Sem editar/excluir (fora do escopo da TASK-030), sem paginação e sem autenticação (P-009).

O router recebe o repositório pronto porque a apresentação não pode importar a infraestrutura
(contrato de camadas em `backend/pyproject.toml`): quem o escolhe é a raiz de composição,
`app.main`. As listagens atendem à seleção de guindaste e configuração (RF-010). Rotas síncronas:
o repositório é síncrono, e o FastAPI roda cada rota numa thread à parte.
"""

from collections.abc import Callable
from typing import Any

from fastapi import APIRouter, HTTPException, Query, status

from app.application.ports.crane_catalog_listing import CraneCatalogStore
from app.application.ports.crane_catalog_repository import CatalogEntryAlreadyExistsError
from app.application.use_cases.crane_catalog import (
    CatalogEntryNotFoundError,
    IdGenerator,
    ManageCraneCatalog,
    generate_uuid_id,
)
from app.presentation.api.catalog_schemas import (
    CatalogErrorResponse,
    ConfigurationCreateRequest,
    ConfigurationResponse,
    CraneCreateRequest,
    CraneResponse,
    ManufacturerCreateRequest,
    ManufacturerResponse,
)

API_PREFIX = "/api/v1"
MANUFACTURERS_PATH = f"{API_PREFIX}/manufacturers"
CRANES_PATH = f"{API_PREFIX}/cranes"
CONFIGURATIONS_PATH = f"{API_PREFIX}/configurations"

_NOT_FOUND: dict[int | str, dict[str, Any]] = {
    status.HTTP_404_NOT_FOUND: {
        "model": CatalogErrorResponse,
        "description": "Registro inexistente.",
    },
}
_CREATE_ERRORS: dict[int | str, dict[str, Any]] = {
    status.HTTP_409_CONFLICT: {
        "model": CatalogErrorResponse,
        "description": "O repositório recusou o registro por id repetido.",
    },
}


def _call[T](action: Callable[[], T]) -> T:
    """Roda o caso de uso e traduz os erros do catálogo para 404 e 409."""
    try:
        return action()
    except CatalogEntryNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except CatalogEntryAlreadyExistsError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error


def create_catalog_router(
    repository: CraneCatalogStore, id_generator: IdGenerator = generate_uuid_id
) -> APIRouter:
    """Monta o router do catálogo com o repositório escolhido pela composição."""
    catalog = ManageCraneCatalog(repository, id_generator)
    router = APIRouter(tags=["catalog"])

    @router.post(
        MANUFACTURERS_PATH,
        status_code=status.HTTP_201_CREATED,
        summary="Cadastrar fabricante (RF-001)",
        responses=_CREATE_ERRORS,
    )
    def create_manufacturer(request: ManufacturerCreateRequest) -> ManufacturerResponse:
        manufacturer = _call(lambda: catalog.create_manufacturer(request.name))
        return ManufacturerResponse.from_record(manufacturer)

    @router.get(MANUFACTURERS_PATH, summary="Listar fabricantes, por nome")
    def list_manufacturers() -> list[ManufacturerResponse]:
        return [ManufacturerResponse.from_record(item) for item in catalog.list_manufacturers()]

    @router.get(
        f"{MANUFACTURERS_PATH}/{{manufacturer_id}}",
        summary="Obter fabricante",
        responses=_NOT_FOUND,
    )
    def get_manufacturer(manufacturer_id: str) -> ManufacturerResponse:
        manufacturer = _call(lambda: catalog.get_manufacturer(manufacturer_id))
        return ManufacturerResponse.from_record(manufacturer)

    @router.post(
        CRANES_PATH,
        status_code=status.HTTP_201_CREATED,
        summary="Cadastrar modelo de guindaste de um fabricante (RF-002)",
        responses={**_NOT_FOUND, **_CREATE_ERRORS},
    )
    def create_crane(request: CraneCreateRequest) -> CraneResponse:
        crane = _call(lambda: catalog.create_crane(request.manufacturer_id, request.model_name))
        return CraneResponse.from_record(crane)

    @router.get(
        CRANES_PATH,
        summary="Listar guindastes, por modelo; opcionalmente só os de um fabricante",
        responses=_NOT_FOUND,
    )
    def list_cranes(
        manufacturer_id: str | None = Query(
            default=None,
            description="Só os guindastes deste fabricante; fabricante inexistente responde 404.",
        ),
    ) -> list[CraneResponse]:
        cranes = _call(lambda: catalog.list_cranes(manufacturer_id))
        return [CraneResponse.from_record(item) for item in cranes]

    @router.get(f"{CRANES_PATH}/{{crane_id}}", summary="Obter guindaste", responses=_NOT_FOUND)
    def get_crane(crane_id: str) -> CraneResponse:
        return CraneResponse.from_record(_call(lambda: catalog.get_crane(crane_id)))

    @router.post(
        f"{CRANES_PATH}/{{crane_id}}/configurations",
        status_code=status.HTTP_201_CREATED,
        summary="Cadastrar configuração operacional com ficha técnica (RF-005; ADR-013 C-4)",
        description=(
            "A ficha técnica geométrica é opcional e vem só deste cadastro, nunca do modelo 3D "
            "(RN-003). Valores em unidades internas (metros e graus; RN-006)."
        ),
        responses={**_NOT_FOUND, **_CREATE_ERRORS},
    )
    def create_configuration(
        crane_id: str, request: ConfigurationCreateRequest
    ) -> ConfigurationResponse:
        geometry = None if request.geometry is None else request.geometry.to_domain()
        configuration = _call(
            lambda: catalog.create_configuration(crane_id, request.name, geometry)
        )
        return ConfigurationResponse.from_record(configuration)

    @router.get(
        f"{CRANES_PATH}/{{crane_id}}/configurations",
        summary="Listar configurações de um guindaste, por nome",
        responses=_NOT_FOUND,
    )
    def list_configurations(crane_id: str) -> list[ConfigurationResponse]:
        configurations = _call(lambda: catalog.list_configurations(crane_id))
        return [ConfigurationResponse.from_record(item) for item in configurations]

    @router.get(
        f"{CONFIGURATIONS_PATH}/{{configuration_id}}",
        summary="Obter configuração, com a ficha técnica",
        responses=_NOT_FOUND,
    )
    def get_configuration(configuration_id: str) -> ConfigurationResponse:
        configuration = _call(lambda: catalog.get_configuration(configuration_id))
        return ConfigurationResponse.from_record(configuration)

    return router
