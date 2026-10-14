"""Rotas REST dos cenários `/api/v1/scenarios*` (TASK-052; ADR-023; ADR-016).

- `GET /api/v1/scenarios` → 200 `{items}` (resumo, sem o `spec`), qualquer usuário logado;
- `GET /api/v1/scenarios/{id}` → 200 com o `spec`; 404 `SCENARIO_NOT_FOUND`;
- `POST /api/v1/scenarios` `{name, spec}` → 201; o autor é o usuário da sessão; 422 validação;
- `PUT /api/v1/scenarios/{id}` `{name?, spec?}` → 200; só o autor ou um `ADMIN`
  (403 `FORBIDDEN`); 404; 422;
- `DELETE /api/v1/scenarios/{id}` → 204; só o autor ou um `ADMIN`.

JSON em `snake_case`, o mesmo do `ScenarioSpec` do frontend. Violar uma regra do domínio responde
422 no formato do FastAPI, com o caminho do campo em `loc`.
Campos opcionais ausentes (`direction_deg`, `width_m`) saem omitidos, não `null`. Só existem com
banco e autenticação.
"""

from collections.abc import Callable
from enum import StrEnum
from typing import Annotated

from fastapi import APIRouter, Depends, Response, status
from fastapi.exceptions import RequestValidationError

from app.application.ports.scenario_repository import ScenarioNotFoundError, ScenarioRepository
from app.application.use_cases.authentication import Clock, utc_now
from app.application.use_cases.crane_catalog import IdGenerator, generate_uuid_id
from app.application.use_cases.manage_scenarios import ManageScenarios, ScenarioForbiddenError
from app.domain.entities.user import User
from app.domain.exceptions.scenario_errors import InvalidScenarioError
from app.presentation.api.authorization import (
    SESSION_REQUIRED_RESPONSES,
    ApiError,
    AuthErrorCode,
    AuthGuards,
    error_responses,
)
from app.presentation.api.scenario_schemas import (
    ScenarioCreateRequest,
    ScenarioListResponse,
    ScenarioResponse,
    ScenarioSummaryResponse,
    ScenarioUpdateRequest,
)

SCENARIOS_PATH = "/api/v1/scenarios"


class ScenarioErrorCode(StrEnum):
    SCENARIO_NOT_FOUND = "SCENARIO_NOT_FOUND"


def _call[T](action: Callable[[], T]) -> T:
    """Roda o caso de uso e traduz os erros para 404, 403 e 422."""
    try:
        return action()
    except InvalidScenarioError as error:
        raise RequestValidationError(
            [{"loc": ("body", *error.field.split(".")), "msg": str(error), "type": "value_error"}]
        ) from None
    except ScenarioNotFoundError as error:
        raise ApiError(
            status.HTTP_404_NOT_FOUND, ScenarioErrorCode.SCENARIO_NOT_FOUND, str(error)
        ) from None
    except ScenarioForbiddenError as error:
        raise ApiError(status.HTTP_403_FORBIDDEN, AuthErrorCode.FORBIDDEN, str(error)) from None


_NOT_FOUND = error_responses((status.HTTP_404_NOT_FOUND, "`SCENARIO_NOT_FOUND`."))
_OWNER_ONLY = error_responses(
    (status.HTTP_403_FORBIDDEN, "`FORBIDDEN`: só o autor ou um admin altera ou apaga."),
    (status.HTTP_404_NOT_FOUND, "`SCENARIO_NOT_FOUND`."),
)


def create_scenarios_router(
    repository: ScenarioRepository,
    guards: AuthGuards,
    *,
    clock: Clock = utc_now,
    id_generator: IdGenerator = generate_uuid_id,
) -> APIRouter:
    manage = ManageScenarios(repository, clock=clock, id_generator=id_generator)
    router = APIRouter(
        prefix=SCENARIOS_PATH, tags=["scenarios"], responses=SESSION_REQUIRED_RESPONSES
    )
    Actor = Annotated[User, Depends(guards.current_user)]

    @router.get("", summary="Listar cenários (qualquer usuário logado)")
    def list_scenarios() -> ScenarioListResponse:
        return ScenarioListResponse(
            items=[ScenarioSummaryResponse.from_scenario(s) for s in manage.list_scenarios()]
        )

    @router.get(
        "/{scenario_id}",
        summary="Abrir um cenário",
        responses=_NOT_FOUND,
        response_model_exclude_none=True,
    )
    def get_scenario(scenario_id: str) -> ScenarioResponse:
        return ScenarioResponse.from_scenario(_call(lambda: manage.get_scenario(scenario_id)))

    @router.post(
        "",
        status_code=status.HTTP_201_CREATED,
        summary="Criar um cenário",
        response_model_exclude_none=True,
    )
    def create_scenario(body: ScenarioCreateRequest, actor: Actor) -> ScenarioResponse:
        def create() -> ScenarioResponse:
            return ScenarioResponse.from_scenario(
                manage.create_scenario(actor, body.name, body.spec.to_domain())
            )

        return _call(create)

    @router.put(
        "/{scenario_id}",
        summary="Atualizar nome e/ou spec (autor ou admin)",
        responses=_OWNER_ONLY,
        response_model_exclude_none=True,
    )
    def update_scenario(
        scenario_id: str, body: ScenarioUpdateRequest, actor: Actor
    ) -> ScenarioResponse:
        def update() -> ScenarioResponse:
            spec = None if body.spec is None else body.spec.to_domain()
            return ScenarioResponse.from_scenario(
                manage.update_scenario(actor, scenario_id, body.name, spec)
            )

        return _call(update)

    @router.delete(
        "/{scenario_id}",
        status_code=status.HTTP_204_NO_CONTENT,
        summary="Apagar um cenário (autor ou admin)",
        responses=_OWNER_ONLY,
    )
    def delete_scenario(scenario_id: str, actor: Actor) -> Response:
        _call(lambda: manage.delete_scenario(actor, scenario_id))
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    return router
