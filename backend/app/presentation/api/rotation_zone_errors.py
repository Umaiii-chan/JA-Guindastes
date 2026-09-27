"""Códigos de erro das zonas de giro (TASK-046; ADR-018).

Corpo das respostas: `{"detail": "<mensagem>", "code": "<CÓDIGO>"}`, o mesmo `{"detail": ...}` das
rotas de catálogo e de importação, com o código estável em `code` (como os erros da autenticação,
ADR-016 § 4). São levantados como `ApiError` e tratados pelo `api_error_handler`.
"""

from enum import StrEnum

from pydantic import BaseModel, Field

from app.presentation.api.authorization import ApiError


class RotationZoneErrorCode(StrEnum):
    INVALID_ROTATION_ZONES = "INVALID_ROTATION_ZONES"
    """422: zonas inválidas (código, nome, ângulo, menos de 2, códigos repetidos, buraco ou
    sobreposição)."""
    ROTATION_ZONE_IN_USE = "ROTATION_ZONE_IN_USE"
    """409: a edição remove ou renomeia uma zona que já tem tabelas de carga."""
    ROTATION_ZONE_REQUIRED = "ROTATION_ZONE_REQUIRED"
    """422: importação sem zona numa configuração com zonas."""
    UNKNOWN_ROTATION_ZONE = "UNKNOWN_ROTATION_ZONE"
    """422: importação numa zona que não existe na configuração."""
    ROTATION_ZONE_NOT_ALLOWED = "ROTATION_ZONE_NOT_ALLOWED"
    """422: importação com zona numa configuração sem zonas."""


class RotationZoneErrorResponse(BaseModel):
    """Corpo dos erros das zonas de giro."""

    detail: str = Field(description="Motivo do erro, legível por pessoa.")
    code: RotationZoneErrorCode = Field(description="Código estável do erro (TASK-046).")


def rotation_zone_error(status_code: int, code: RotationZoneErrorCode, message: str) -> ApiError:
    """`ApiError` com um código das zonas de giro (corpo `{"detail", "code"}`)."""
    return ApiError(status_code, code, message)


def rotation_zone_error_responses(
    *errors: tuple[int, RotationZoneErrorCode, str],
) -> dict[int | str, dict[str, object]]:
    """Entradas de `responses` do OpenAPI; códigos com o mesmo status vão numa só entrada."""
    grouped: dict[int, list[str]] = {}
    for status_code, code, text in errors:
        grouped.setdefault(status_code, []).append(f"`{code.value}`: {text}")
    return {
        status_code: {"model": RotationZoneErrorResponse, "description": " ".join(texts)}
        for status_code, texts in grouped.items()
    }
