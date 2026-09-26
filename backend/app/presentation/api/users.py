"""Gestão de usuários `/api/v1/users*`, só para `ADMIN` (ADR-016 §§ 2 e 4; TASK-038).

- `GET /api/v1/users` → 200 `{items: User[]}`;
- `POST /api/v1/users` `{username, displayName, password, role}` → 201 `User`;
  409 `USERNAME_TAKEN`; 422 validação;
- `PATCH /api/v1/users/{id}` `{displayName?, role?, active?, password?}` → 200 `User`;
  404 `USER_NOT_FOUND`; 409 `LAST_ADMIN` (sem nenhum admin ativo) ou `OWN_ADMIN_ACCESS` (o admin
  tentou se desativar ou tirar o próprio perfil de admin); 422 validação.

As regras de nome e senha vêm do domínio; a violação responde 422 no formato do FastAPI, sem ecoar o
valor: `{"detail": [{"loc": ["body", "<campo>"], "msg": ..., "type": "value_error"}]}`.
Só existem com banco (ADR-016 § 5).
"""

from collections.abc import Callable
from typing import Annotated

from fastapi import APIRouter, Depends, status
from fastapi.exceptions import RequestValidationError

from app.application.ports.user_repository import UsernameTakenError, UserNotFoundError
from app.application.use_cases.manage_users import (
    LastAdminError,
    ManageUsers,
    OwnAdminAccessError,
)
from app.domain.entities.user import User
from app.domain.exceptions.user_errors import InvalidUserError
from app.presentation.api.auth_schemas import (
    UserCreateRequest,
    UserListResponse,
    UserResponse,
    UserUpdateRequest,
)
from app.presentation.api.authorization import (
    SESSION_REQUIRED_RESPONSES,
    ApiError,
    AuthDependencies,
    AuthErrorCode,
    AuthGuards,
    error_responses,
)

USERS_PATH = "/api/v1/users"

# Nome do campo do domínio → nome no contrato da API (camelCase).
_API_FIELD_NAMES = {"username": "username", "display_name": "displayName", "password": "password"}


def _call[T](action: Callable[[], T]) -> T:
    """Roda o caso de uso e traduz os erros para as respostas do ADR-016 § 4."""
    try:
        return action()
    except InvalidUserError as error:
        field = _API_FIELD_NAMES.get(error.field, error.field)
        raise RequestValidationError(
            [{"loc": ("body", field), "msg": str(error), "type": "value_error"}]
        ) from None
    except UsernameTakenError as error:
        raise ApiError(status.HTTP_409_CONFLICT, AuthErrorCode.USERNAME_TAKEN, str(error)) from None
    except UserNotFoundError as error:
        raise ApiError(
            status.HTTP_404_NOT_FOUND, AuthErrorCode.USER_NOT_FOUND, str(error)
        ) from None
    except LastAdminError as error:
        raise ApiError(status.HTTP_409_CONFLICT, AuthErrorCode.LAST_ADMIN, str(error)) from None
    except OwnAdminAccessError as error:
        raise ApiError(
            status.HTTP_409_CONFLICT, AuthErrorCode.OWN_ADMIN_ACCESS, str(error)
        ) from None


def create_users_router(deps: AuthDependencies, guards: AuthGuards) -> APIRouter:
    manage = ManageUsers(
        deps.users,
        deps.sessions,
        deps.password_hasher,
        clock=deps.clock,
        id_generator=deps.id_generator,
    )
    router = APIRouter(prefix=USERS_PATH, tags=["users"], responses=SESSION_REQUIRED_RESPONSES)
    Admin = Annotated[User, Depends(guards.require_admin)]

    @router.get("", summary="Listar usuários (ADMIN)")
    def list_users(_: Admin) -> UserListResponse:
        return UserListResponse(
            items=[UserResponse.from_user(user) for user in manage.list_users()]
        )

    @router.post(
        "",
        status_code=status.HTTP_201_CREATED,
        summary="Criar usuário (ADMIN); nasce ativo",
        responses=error_responses(
            (status.HTTP_409_CONFLICT, "`USERNAME_TAKEN`: o nome de usuário já existe.")
        ),
    )
    def create_user(body: UserCreateRequest, _: Admin) -> UserResponse:
        user = _call(
            lambda: manage.create_user(
                username=body.username,
                display_name=body.display_name,
                password=body.password,
                role=body.role,
            )
        )
        return UserResponse.from_user(user)

    @router.patch(
        "/{user_id}",
        summary="Alterar nome, perfil, situação ou senha de um usuário (ADMIN)",
        description=(
            "Só os campos enviados mudam. Desativar revoga as sessões do usuário. O admin não pode "
            "se desativar nem tirar o próprio perfil de admin (409 `OWN_ADMIN_ACCESS`), e o "
            "sistema nunca fica sem admin ativo (409 `LAST_ADMIN`)."
        ),
        responses=error_responses(
            (status.HTTP_404_NOT_FOUND, "`USER_NOT_FOUND`."),
            (status.HTTP_409_CONFLICT, "`LAST_ADMIN` ou `OWN_ADMIN_ACCESS`."),
        ),
    )
    def update_user(user_id: str, body: UserUpdateRequest, actor: Admin) -> UserResponse:
        user = _call(
            lambda: manage.update_user(
                actor=actor,
                user_id=user_id,
                display_name=body.display_name,
                role=body.role,
                active=body.active,
                password=body.password,
            )
        )
        return UserResponse.from_user(user)

    return router
