"""Acessório de içamento do catálogo (TASK-056; ADR-026; RN-014).

Peça entre o gancho e a carga (moitão/gancho, manilha, linga, cinta, balancim...). Entra no peso
comparado com a capacidade (RN-014) e na distância entre o gancho e a carga (`rigging_height_m`).
Jib e contrapeso **não** são acessórios: são configurações com tabela própria (RN-001, RN-002).

Valores numéricos cadastrados são FICTÍCIOS e configuráveis; nenhum dado oficial foi fornecido
(ADR-012).
"""

import re
from dataclasses import dataclass
from enum import StrEnum

from app.domain.exceptions.domain_errors import InvalidAccessoryError
from app.domain.value_objects.mass import Mass

ACCESSORY_WEIGHT_MAX_KG = 100_000.0
"""Limite de sanidade do peso de um acessório."""
ACCESSORY_RIGGING_HEIGHT_MAX_M = 50.0
"""Limite de sanidade da altura de aparelhamento de um acessório."""

_MODEL_FILE_PATTERN = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{0,99}\.(glb|gltf)")


class AccessoryType(StrEnum):
    """Tipos de acessório de içamento (ADR-026)."""

    HOOK_BLOCK = "HOOK_BLOCK"
    """Moitão/gancho."""
    OVERHAUL_BALL = "OVERHAUL_BALL"
    """Bola de peso."""
    SWIVEL_HOOK = "SWIVEL_HOOK"
    """Gancho giratório."""
    SHACKLE = "SHACKLE"
    """Manilha."""
    WIRE_ROPE_SLING = "WIRE_ROPE_SLING"
    """Linga de cabo de aço."""
    CHAIN_SLING = "CHAIN_SLING"
    """Linga de corrente."""
    POLYESTER_SLING = "POLYESTER_SLING"
    """Cinta de poliéster."""
    SPREADER_BEAM = "SPREADER_BEAM"
    """Balancim / viga espaçadora."""
    CRANE_MAT = "CRANE_MAT"
    """Tapete de patola."""


@dataclass(frozen=True)
class Accessory:
    """Acessório do catálogo.

    - `weight`: peso do acessório, somado ao peso comparado (RN-014);
    - `rigging_height_m`: quanto o acessório afasta a carga abaixo do gancho, em metros;
    - `model_file`: nome do arquivo GLB/glTF em `frontend/public/models/acessorios/`, ou `None`
      enquanto o modelo 3D estiver pendente (só o nome do arquivo, sem pasta);
    - `credit` e `license`: autoria e licença do modelo 3D de terceiros.
    """

    id: str
    type: AccessoryType
    name: str
    weight: Mass
    rigging_height_m: float = 0.0
    model_file: str | None = None
    credit: str | None = None
    license: str | None = None

    def __post_init__(self) -> None:
        if not isinstance(self.id, str) or not self.id.strip():
            raise InvalidAccessoryError("id do acessório deve ser informado")
        if not isinstance(self.name, str) or not self.name.strip():
            raise InvalidAccessoryError("nome do acessório deve ser informado")
        if not isinstance(self.type, AccessoryType):
            raise InvalidAccessoryError(f"tipo de acessório inválido: {self.type!r}")
        if not isinstance(self.weight, Mass):
            raise InvalidAccessoryError(
                f"peso do acessório deve ser Mass, recebido {self.weight!r}"
            )
        if self.weight.kilograms > ACCESSORY_WEIGHT_MAX_KG:
            raise InvalidAccessoryError(
                f"peso do acessório acima de {ACCESSORY_WEIGHT_MAX_KG:g} kg: {self.weight!r}"
            )
        height = self.rigging_height_m
        if (
            isinstance(height, bool)
            or not isinstance(height, int | float)
            or not 0 <= height <= ACCESSORY_RIGGING_HEIGHT_MAX_M
        ):
            raise InvalidAccessoryError(
                f"altura de aparelhamento deve estar entre 0 e "
                f"{ACCESSORY_RIGGING_HEIGHT_MAX_M:g} m, recebido {height!r}"
            )
        object.__setattr__(self, "rigging_height_m", float(height))
        if self.model_file is not None and not _MODEL_FILE_PATTERN.fullmatch(self.model_file):
            raise InvalidAccessoryError(
                "arquivo do modelo deve ser só o nome de um .glb ou .gltf, sem pasta: "
                f"{self.model_file!r}"
            )
