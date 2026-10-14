"""Rotas REST do catálogo de acessórios de içamento (TASK-056; ADR-026; RN-014).

- `GET /api/v1/accessories` e `GET /api/v1/accessories/{accessory_id}`: qualquer perfil logado;
- `POST`, `PATCH /{id}` e `DELETE /{id}`: perfil `ADMIN` e cabeçalho CSRF (a composição passa as
  dependências em `write_dependencies`).

Códigos: **201** ao criar (id UUID gerado pelo servidor); **200** ao ler e editar; **204** ao
excluir; **404** id inexistente; **409** id repetido; **422** corpo malformado ou dado inválido
(inclusive `model_file` com pasta ou extensão diferente de `.glb`/`.gltf`).

O arquivo do modelo 3D não é enviado por aqui: ele fica em `frontend/public/models/acessorios/` e o
cadastro só guarda o nome (ADR-026).
"""

from collections.abc import Callable, Sequence
from typing import Any

from fastapi import APIRouter, HTTPException, Response, params, status

from app.application.ports.accessory_repository import (
    AccessoryAlreadyExistsError,
    AccessoryRepository,
)
from app.application.use_cases.crane_catalog import generate_uuid_id
from app.application.use_cases.manage_accessories import (
    AccessoryNotFoundError,
    IdGenerator,
    ManageAccessories,
)
from app.domain.exceptions.domain_errors import InvalidAccessoryError
from app.presentation.api.accessory_schemas import (
    AccessoryCreateRequest,
    AccessoryErrorResponse,
    AccessoryResponse,
    AccessoryUpdateRequest,
)

ACCESSORIES_PATH = "/api/v1/accessories"

_NOT_FOUND: dict[int | str, dict[str, Any]] = {
    status.HTTP_404_NOT_FOUND: {"model": AccessoryErrorResponse, "description": "Id inexistente."}
}


def _call[T](action: Callable[[], T]) -> T:
    try:
        return action()
    except AccessoryNotFoundError as error:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except AccessoryAlreadyExistsError as error:
        raise HTTPException(status.HTTP_409_CONFLICT, detail=str(error)) from error
    except InvalidAccessoryError as error:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(error)) from error


def create_accessories_router(
    repository: AccessoryRepository,
    id_generator: IdGenerator = generate_uuid_id,
    *,
    write_dependencies: Sequence[params.Depends] = (),
) -> APIRouter:
    """Monta o router dos acessórios com o repositório escolhido pela composição."""
    writes = list(write_dependencies)
    accessories = ManageAccessories(repository, id_generator)
    router = APIRouter(prefix=ACCESSORIES_PATH, tags=["accessories"])

    @router.get("", summary="Listar acessórios de içamento, por nome")
    def list_accessories() -> list[AccessoryResponse]:
        return [AccessoryResponse.from_entity(item) for item in accessories.list_all()]

    @router.get("/{accessory_id}", summary="Obter acessório", responses=_NOT_FOUND)
    def get_accessory(accessory_id: str) -> AccessoryResponse:
        return AccessoryResponse.from_entity(_call(lambda: accessories.get(accessory_id)))

    @router.post(
        "",
        status_code=status.HTTP_201_CREATED,
        dependencies=writes,
        summary="Cadastrar acessório de içamento (RN-014)",
    )
    def create_accessory(request: AccessoryCreateRequest) -> AccessoryResponse:
        created = _call(
            lambda: accessories.create(
                type=request.type,
                name=request.name,
                weight_kg=request.weight_kg,
                rigging_height_m=request.rigging_height_m,
                model_file=request.model_file,
                credit=request.credit,
                license=request.license,
            )
        )
        return AccessoryResponse.from_entity(created)

    @router.patch(
        "/{accessory_id}",
        dependencies=writes,
        summary="Editar acessório de içamento",
        responses=_NOT_FOUND,
    )
    def update_accessory(accessory_id: str, request: AccessoryUpdateRequest) -> AccessoryResponse:
        changes = {name: getattr(request, name) for name in request.model_fields_set}
        updated = _call(lambda: accessories.update(accessory_id, **changes))
        return AccessoryResponse.from_entity(updated)

    @router.delete(
        "/{accessory_id}",
        status_code=status.HTTP_204_NO_CONTENT,
        dependencies=writes,
        summary="Excluir acessório de içamento",
        responses=_NOT_FOUND,
    )
    def delete_accessory(accessory_id: str) -> Response:
        _call(lambda: accessories.delete(accessory_id))
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    return router
