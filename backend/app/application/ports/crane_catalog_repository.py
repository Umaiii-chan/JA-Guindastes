"""Porta de gravação e consulta do catálogo de guindastes (doc-fonte §§ 10.2 e 19.1; TASK-022).

Fabricante (RF-001), modelo de guindaste (RF-002) e configuração operacional (RF-005). O domínio
ainda não tem entidades para eles (a modelagem fica para outra tarefa), então esta porta define
registros simples, só com o que a doc-fonte e o ADR-013 fixam:

- `Crane` é o modelo lógico e não guarda capacidade (doc-fonte § 10.2);
- `CraneConfiguration` é a que seleciona a tabela de carga (RN-001). Os atributos físicos que a
  distinguem (lança, jib, contrapeso, estabilizadores; RN-002) estão PENDENTES (PEND-005), então
  aqui ela só tem um nome livre;
- a ficha técnica geométrica (`CraneGeometry`, ADR-013 C-4) fica na configuração e é opcional:
  sem ela, o `CraneGeometryProvider` devolve `None`. Se a ficha é do guindaste ou da configuração
  ainda não foi decidido (ADR-013, G-2); guardá-la por configuração cobre os dois casos.
"""

from dataclasses import dataclass
from typing import Protocol

from app.domain.value_objects.crane_geometry import CraneGeometry


def _require_text(value: object, field_name: str) -> None:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{field_name} deve ser informado")


@dataclass(frozen=True)
class Manufacturer:
    """Fabricante de guindastes (RF-001)."""

    id: str
    name: str

    def __post_init__(self) -> None:
        _require_text(self.id, "id do fabricante")
        _require_text(self.name, "nome do fabricante")


@dataclass(frozen=True)
class Crane:
    """Modelo lógico de guindaste de um fabricante (RF-002), sem capacidade global."""

    id: str
    manufacturer_id: str
    model_name: str

    def __post_init__(self) -> None:
        _require_text(self.id, "id do guindaste")
        _require_text(self.manufacturer_id, "fabricante do guindaste")
        _require_text(self.model_name, "modelo do guindaste")


@dataclass(frozen=True)
class CraneConfiguration:
    """Configuração operacional de um guindaste (RF-005; RN-001, RN-002).

    `geometry` é a ficha técnica do ADR-013 C-4, ou `None` se ainda não foi cadastrada.
    """

    id: str
    crane_id: str
    name: str
    geometry: CraneGeometry | None = None

    def __post_init__(self) -> None:
        _require_text(self.id, "id da configuração")
        _require_text(self.crane_id, "guindaste da configuração")
        _require_text(self.name, "nome da configuração")
        if self.geometry is not None and not isinstance(self.geometry, CraneGeometry):
            raise ValueError(f"geometry deve ser CraneGeometry, recebido {self.geometry!r}")


class CatalogError(Exception):
    """Base dos erros da porta de catálogo."""


class CatalogEntryAlreadyExistsError(CatalogError):
    """Já existe um registro com o mesmo id."""

    def __init__(self, entity: str, entry_id: str) -> None:
        self.entity = entity
        self.entry_id = entry_id
        super().__init__(f"{entity} com id {entry_id!r} já existe")


class CatalogReferenceNotFoundError(CatalogError):
    """O registro referenciado (fabricante do guindaste, guindaste da configuração) não existe."""

    def __init__(self, entity: str, entry_id: str) -> None:
        self.entity = entity
        self.entry_id = entry_id
        super().__init__(f"{entity} com id {entry_id!r} não existe")


class CraneCatalogRepository(Protocol):
    """Grava e consulta fabricantes, guindastes e configurações.

    Contrato de toda implementação:
    - `add_*` grava um registro novo; id repetido levanta `CatalogEntryAlreadyExistsError`, e
      referência a registro inexistente levanta `CatalogReferenceNotFoundError`;
    - `get_*` devolve o registro ou `None` quando o id não existe, sem levantar exceção por isso;
    - cada chamada é atômica: ou grava tudo, ou nada.
    """

    def add_manufacturer(self, manufacturer: Manufacturer) -> None: ...

    def get_manufacturer(self, manufacturer_id: str) -> Manufacturer | None: ...

    def add_crane(self, crane: Crane) -> None: ...

    def get_crane(self, crane_id: str) -> Crane | None: ...

    def add_configuration(self, configuration: CraneConfiguration) -> None: ...

    def get_configuration(self, configuration_id: str) -> CraneConfiguration | None: ...
