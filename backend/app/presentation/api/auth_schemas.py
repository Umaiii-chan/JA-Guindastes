"""Schemas Pydantic da autenticação e dos usuários (ADR-016 § 4; TASK-038).

JSON em camelCase, como o contrato do ADR-016 § 4 (`authEnabled`, `displayName`, `createdAt`): só
os campos com mais de uma palavra mudam. As rotas anteriores da API continuam em snake_case.

Entradas estritas (`strict`, `extra="forbid"`), como as do catálogo. As regras de nome e senha
(ADR-016 § 2) ficam no domínio; aqui só a forma. Nenhum schema de resposta tem senha ou hash.
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from app.domain.entities.user import User, UserRole

_CAMEL_OUTPUT = ConfigDict(alias_generator=to_camel, serialize_by_alias=True, validate_by_name=True)
_CAMEL_STRICT_INPUT = ConfigDict(
    alias_generator=to_camel, strict=True, extra="forbid", validate_by_name=False
)


class UserResponse(BaseModel):
    """`User` do contrato: sem senha nem hash."""

    model_config = _CAMEL_OUTPUT

    id: str = Field(description="Id do usuário (UUID em texto).")
    username: str = Field(description="Nome de usuário, em minúsculas.")
    display_name: str = Field(description="Nome de exibição.")
    role: UserRole = Field(description="Perfil: `ADMIN` ou `OPERATOR`.")
    active: bool = Field(description="`false` quando desativado: não entra mais.")
    created_at: datetime = Field(description="Criação, ISO-8601 com fuso horário.")

    @classmethod
    def from_user(cls, user: User) -> UserResponse:
        return cls(
            id=user.id,
            username=user.username,
            display_name=user.display_name,
            role=user.role,
            active=user.active,
            created_at=user.created_at,
        )


class SessionResponse(BaseModel):
    """`GET /auth/session`: se a autenticação está ligada e quem está logado (ou `null`)."""

    model_config = _CAMEL_OUTPUT

    auth_enabled: bool = Field(
        description="`false` sem banco (ADR-016 § 5): não há login e as rotas ficam abertas."
    )
    user: UserResponse | None = Field(description="Usuário da sessão do cookie, ou `null`.")


class LoginRequest(BaseModel):
    model_config = _CAMEL_STRICT_INPUT

    username: str = Field(description="Nome de usuário (maiúsculas são aceitas).")
    password: str = Field(description="Senha.")


class LoginResponse(BaseModel):
    model_config = _CAMEL_OUTPUT

    user: UserResponse


class UserListResponse(BaseModel):
    model_config = _CAMEL_OUTPUT

    items: list[UserResponse] = Field(description="Usuários, por nome de usuário.")


class UserCreateRequest(BaseModel):
    """Usuário novo (ADR-016 § 2): nasce ativo."""

    model_config = _CAMEL_STRICT_INPUT

    username: str = Field(description="3–64 caracteres `[a-z0-9._-]`; guardado em minúsculas.")
    display_name: str = Field(description="Nome de exibição; obrigatório.")
    password: str = Field(description="10 a 128 caracteres.")
    role: UserRole = Field(strict=False, description="`ADMIN` ou `OPERATOR`.")


class UserUpdateRequest(BaseModel):
    """Mudança parcial: só os campos enviados (e não nulos) mudam. O `username` não muda."""

    model_config = _CAMEL_STRICT_INPUT

    display_name: str | None = Field(default=None, description="Novo nome de exibição.")
    role: UserRole | None = Field(default=None, strict=False, description="Novo perfil.")
    active: bool | None = Field(
        default=None, description="`false` desativa e revoga as sessões do usuário."
    )
    password: str | None = Field(default=None, description="Nova senha, 10 a 128 caracteres.")
