"""Portas do catálogo de acessórios de içamento (TASK-056; ADR-026).

- `AccessoryProvider`: o que a avaliação precisa (buscar por id), numa porta pequena para não
  obrigar os fakes da avaliação a implementar o CRUD;
- `AccessoryRepository`: o cadastro completo, usado pelo caso de uso `ManageAccessories`.
"""

from collections.abc import Sequence
from typing import Protocol

from app.domain.entities.accessory import Accessory


class AccessoryAlreadyExistsError(Exception):
    """O repositório recusou um acessório com id repetido."""

    def __init__(self, accessory_id: str) -> None:
        self.accessory_id = accessory_id
        super().__init__(f"acessório com id {accessory_id!r} já existe")


class AccessoryProvider(Protocol):
    """Busca acessórios pelo id para a avaliação.

    Contrato: devolve só os acessórios que existem, em qualquer ordem; ids desconhecidos são
    simplesmente omitidos (quem chama compara com o que pediu).
    """

    def get_accessories(self, accessory_ids: Sequence[str]) -> dict[str, Accessory]: ...


class AccessoryRepository(AccessoryProvider, Protocol):
    """Cadastro de acessórios.

    Contrato:
    - `add` levanta `AccessoryAlreadyExistsError` com id repetido;
    - `update` substitui o registro de mesmo id e devolve `True`, ou `False` se o id não existe;
    - `delete` devolve `True` se apagou, `False` se o id não existe;
    - `list_all` ordena por nome e, no empate, por id.
    """

    def add(self, accessory: Accessory) -> None: ...

    def get(self, accessory_id: str) -> Accessory | None: ...

    def list_all(self) -> list[Accessory]: ...

    def update(self, accessory: Accessory) -> bool: ...

    def delete(self, accessory_id: str) -> bool: ...
