"""Rotas REST dos cadastros do catálogo (TASK-030; doc-fonte § 15.1; RF-001, RF-002, RF-005).

- `GET/POST /api/v1/manufacturers` e `GET /api/v1/manufacturers/{manufacturer_id}`;
- `GET/POST /api/v1/cranes` (listagem com filtro opcional `manufacturer_id`) e
  `GET /api/v1/cranes/{crane_id}`;
- `GET/POST /api/v1/cranes/{crane_id}/configurations`;
- `GET /api/v1/configurations/{configuration_id}`;
- edição (TASK-044): `PATCH /api/v1/manufacturers/{manufacturer_id}` (`name`),
  `PATCH /api/v1/cranes/{crane_id}` (`model_name`) e
  `PATCH /api/v1/configurations/{configuration_id}` (`name`, `geometry`, `rotation_zones` e/ou
  `hook_block_weight_kg`), com os mesmos schemas de resposta da criação;
- zonas de giro e peso do gancho (TASK-046; ADR-018) na criação e na edição da configuração:
  zonas inválidas → 422 `{"detail", "code": "INVALID_ROTATION_ZONES"}`; remover ou renomear uma
  zona que já tem tabelas → 409 `{"detail", "code": "ROTATION_ZONE_IN_USE"}`.

Códigos HTTP:
- **201** ao criar (ids gerados pelo servidor, UUID em texto); **200** ao ler, listar e editar;
- **404** quando o registro da rota não existe, ou o fabricante/guindaste de que o novo registro
  depende não existe (inclusive o `manufacturer_id` do corpo e o do filtro da listagem);
- **409** quando o repositório recusa um id repetido (`CatalogEntryAlreadyExistsError`). Nomes
  repetidos são aceitos: não há regra de unicidade (pendência 2 da TASK-022), então a edição
  nunca responde 409;
- **422** para o corpo malformado, inclusive nome vazio e ficha técnica incoerente. O corpo é
  validado antes de procurar o registro: corpo inválido num id inexistente responde 422.

Sem excluir e sem paginação. Autorização (ADR-016; TASK-038): com banco, as leituras exigem sessão
(qualquer perfil) e os cadastros e as edições (`POST`, `PATCH`), o perfil `ADMIN` e o cabeçalho
CSRF; a composição passa as dependências em `write_dependencies` e na inclusão do router.

O router recebe o repositório pronto porque a apresentação não pode importar a infraestrutura
(contrato de camadas em `backend/pyproject.toml`): quem o escolhe é a raiz de composição,
`app.main`. As listagens atendem à seleção de guindaste e configuração (RF-010). Rotas síncronas:
o repositório é síncrono, e o FastAPI roda cada rota numa thread à parte.
"""

from collections.abc import Callable, Sequence
from typing import Any

from fastapi import APIRouter, HTTPException, Query, params, status

from app.application.ports.crane_catalog_listing import CraneCatalogStore
from app.application.ports.crane_catalog_repository import CatalogEntryAlreadyExistsError
from app.application.ports.load_chart_listing import LoadChartListing
from app.application.use_cases.crane_catalog import (
    UNCHANGED,
    CatalogEntryNotFoundError,
    IdGenerator,
    ManageCraneCatalog,
    RotationZoneInUseError,
    Unchanged,
    generate_uuid_id,
)
from app.domain.exceptions.domain_errors import InvalidRotationZonesError
from app.domain.value_objects.mass import Mass
from app.domain.value_objects.rotation_zone import RotationZones
from app.presentation.api.catalog_schemas import (
    CatalogErrorResponse,
    ConfigurationCreateRequest,
    ConfigurationResponse,
    ConfigurationUpdateRequest,
    CraneCreateRequest,
    CraneResponse,
    CraneUpdateRequest,
    ManufacturerCreateRequest,
    ManufacturerResponse,
    ManufacturerUpdateRequest,
    RotationZonePayload,
    hook_block_weight_to_domain,
    rotation_zones_to_domain,
)
from app.presentation.api.rotation_zone_errors import (
    RotationZoneErrorCode,
    rotation_zone_error,
    rotation_zone_error_responses,
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


_INVALID_ZONES = rotation_zone_error_responses(
    (
        status.HTTP_422_UNPROCESSABLE_CONTENT,
        RotationZoneErrorCode.INVALID_ROTATION_ZONES,
        "zonas de giro inválidas (corpo `{detail, code}`; os demais 422 seguem o formato padrão "
        "do FastAPI, com `detail` em lista).",
    ),
)
_ZONE_IN_USE = rotation_zone_error_responses(
    (
        status.HTTP_409_CONFLICT,
        RotationZoneErrorCode.ROTATION_ZONE_IN_USE,
        "a edição remove ou renomeia uma zona que já tem tabelas de carga.",
    ),
)


def _call[T](action: Callable[[], T]) -> T:
    """Roda o caso de uso e traduz os erros do catálogo para 404 e 409."""
    try:
        return action()
    except CatalogEntryNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except CatalogEntryAlreadyExistsError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except RotationZoneInUseError as error:
        raise rotation_zone_error(
            status.HTTP_409_CONFLICT, RotationZoneErrorCode.ROTATION_ZONE_IN_USE, str(error)
        ) from error


def _rotation_zones(zones: list[RotationZonePayload] | None) -> RotationZones | None:
    """Zonas do corpo no domínio, ou 422 `INVALID_ROTATION_ZONES` (antes de procurar o registro)."""
    try:
        return rotation_zones_to_domain(zones)
    except InvalidRotationZonesError as error:
        raise rotation_zone_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            RotationZoneErrorCode.INVALID_ROTATION_ZONES,
            str(error),
        ) from error


def create_catalog_router(
    repository: CraneCatalogStore,
    id_generator: IdGenerator = generate_uuid_id,
    *,
    write_dependencies: Sequence[params.Depends] = (),
    load_chart_listing: LoadChartListing | None = None,
) -> APIRouter:
    """Monta o router do catálogo com o repositório escolhido pela composição.

    `write_dependencies` entram só nas rotas de cadastro e de edição (`POST`, `PATCH`): a exigência
    do perfil `ADMIN`. `load_chart_listing` (TASK-046) confere as zonas em uso pelas tabelas na
    edição das zonas de giro (409 `ROTATION_ZONE_IN_USE`).
    """
    writes = list(write_dependencies)
    catalog = ManageCraneCatalog(repository, id_generator, load_chart_listing=load_chart_listing)
    router = APIRouter(tags=["catalog"])

    @router.post(
        MANUFACTURERS_PATH,
        status_code=status.HTTP_201_CREATED,
        dependencies=writes,
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
        dependencies=writes,
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
        dependencies=writes,
        summary="Cadastrar configuração operacional com ficha técnica (RF-005; ADR-013 C-4)",
        description=(
            "A ficha técnica geométrica é opcional e vem só deste cadastro, nunca do modelo 3D "
            "(RN-003). Valores em unidades internas (metros e graus; RN-006)."
        ),
        responses={**_NOT_FOUND, **_CREATE_ERRORS, **_INVALID_ZONES},
    )
    def create_configuration(
        crane_id: str, request: ConfigurationCreateRequest
    ) -> ConfigurationResponse:
        geometry = None if request.geometry is None else request.geometry.to_domain()
        zones = _rotation_zones(request.rotation_zones)
        hook = hook_block_weight_to_domain(request.hook_block_weight_kg)
        configuration = _call(
            lambda: catalog.create_configuration(
                crane_id, request.name, geometry, rotation_zones=zones, hook_block_weight=hook
            )
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

    @router.patch(
        f"{MANUFACTURERS_PATH}/{{manufacturer_id}}",
        dependencies=writes,
        summary="Editar o nome do fabricante (TASK-044)",
        responses=_NOT_FOUND,
    )
    def update_manufacturer(
        manufacturer_id: str, request: ManufacturerUpdateRequest
    ) -> ManufacturerResponse:
        manufacturer = _call(lambda: catalog.rename_manufacturer(manufacturer_id, request.name))
        return ManufacturerResponse.from_record(manufacturer)

    @router.patch(
        f"{CRANES_PATH}/{{crane_id}}",
        dependencies=writes,
        summary="Editar o nome do modelo do guindaste (TASK-044)",
        responses=_NOT_FOUND,
    )
    def update_crane(crane_id: str, request: CraneUpdateRequest) -> CraneResponse:
        crane = _call(lambda: catalog.rename_crane(crane_id, request.model_name))
        return CraneResponse.from_record(crane)

    @router.patch(
        f"{CONFIGURATIONS_PATH}/{{configuration_id}}",
        dependencies=writes,
        summary="Editar nome, ficha técnica, zonas de giro e/ou gancho da configuração",
        description=(
            "Campo ausente mantém o valor atual; pelo menos um campo é obrigatório. `name` e "
            "`geometry` não aceitam `null` (422). A `geometry`, quando vem, substitui a ficha "
            "inteira (RN-003). `rotation_zones` substitui a lista (`[]` ou `null` remove as zonas) "
            "e `hook_block_weight_kg: null` apaga o gancho (TASK-046). Ordem das validações: "
            "corpo (422 padrão) → zonas (422 `INVALID_ROTATION_ZONES`) → configuração (404) → "
            "zonas em uso (409 `ROTATION_ZONE_IN_USE`). Os valores novos valem para as próximas "
            "avaliações; as tabelas de carga não mudam."
        ),
        responses={**_NOT_FOUND, **_INVALID_ZONES, **_ZONE_IN_USE},
    )
    def update_configuration(
        configuration_id: str, request: ConfigurationUpdateRequest
    ) -> ConfigurationResponse:
        fields = request.model_fields_set
        geometry = None if request.geometry is None else request.geometry.to_domain()
        zones: RotationZones | None | Unchanged = (
            _rotation_zones(request.rotation_zones) if "rotation_zones" in fields else UNCHANGED
        )
        hook: Mass | None | Unchanged = (
            hook_block_weight_to_domain(request.hook_block_weight_kg)
            if "hook_block_weight_kg" in fields
            else UNCHANGED
        )
        configuration = _call(
            lambda: catalog.update_configuration(
                configuration_id,
                name=request.name,
                geometry=geometry,
                rotation_zones=zones,
                hook_block_weight=hook,
            )
        )
        return ConfigurationResponse.from_record(configuration)

    return router
