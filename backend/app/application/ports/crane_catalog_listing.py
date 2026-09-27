"""Porta de listagem do catálogo de guindastes (RF-010; doc-fonte § 15.1; TASK-030).

A `CraneCatalogRepository` (TASK-022) só grava e lê por id. Os cadastros REST precisam também
listar, para a pessoa escolher fabricante, guindaste e configuração (RF-010). A listagem fica numa
porta à parte, e não na `CraneCatalogRepository`, para não obrigar outros adapters e fakes que já
cumprem aquela porta a implementar métodos que não usam.

`CraneCatalogStore` junta as duas e a `CraneCatalogEditing` (TASK-044): é o que os casos de uso do
catálogo recebem.
"""

from typing import Protocol

from app.application.ports.crane_catalog_editing import CraneCatalogEditing
from app.application.ports.crane_catalog_repository import (
    Crane,
    CraneCatalogRepository,
    CraneConfiguration,
    Manufacturer,
)


class CraneCatalogListing(Protocol):
    """Lista fabricantes, guindastes e configurações.

    Contrato de toda implementação:
    - devolve uma lista nova (vazia quando não há registros), sem levantar exceção por isso;
    - a ordem é estável: pelo nome (`name` ou `model_name`) e, no empate, pelo id;
    - filtrar por um fabricante ou guindaste inexistente devolve lista vazia (quem precisa
      distinguir "não existe" de "sem registros" consulta o `get_*` da `CraneCatalogRepository`).
    """

    def list_manufacturers(self) -> list[Manufacturer]: ...

    def list_cranes(self, manufacturer_id: str | None = None) -> list[Crane]: ...

    def list_configurations(self, crane_id: str) -> list[CraneConfiguration]: ...


class CraneCatalogStore(CraneCatalogRepository, CraneCatalogListing, CraneCatalogEditing, Protocol):
    """Gravação, leitura por id, listagem e edição do catálogo."""
