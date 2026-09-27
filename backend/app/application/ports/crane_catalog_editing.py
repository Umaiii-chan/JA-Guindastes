"""Porta de edição do catálogo de guindastes (TASK-044; RF-001, RF-002, RF-005).

A `CraneCatalogRepository` (TASK-022) só grava registros novos e lê por id, e a
`CraneCatalogListing` (TASK-030) só lista. A edição fica numa porta à parte pelo mesmo motivo da
listagem: não obrigar adapters e fakes que só cumprem as outras portas a implementar métodos que
não usam. `CraneCatalogStore` junta as três.

O que cada `update_*` pode mudar:
- fabricante: o nome;
- guindaste: o nome do modelo (o fabricante não muda);
- configuração: o nome e a ficha técnica inteira (o guindaste não muda). A ficha nova vale para as
  próximas avaliações; as tabelas de carga da configuração não são tocadas.
"""

from typing import Protocol

from app.application.ports.crane_catalog_repository import (
    Crane,
    CraneConfiguration,
    Manufacturer,
)


class CraneCatalogEditing(Protocol):
    """Altera fabricantes, guindastes e configurações já cadastrados.

    Contrato de toda implementação:
    - `update_*` substitui os campos editáveis do registro com o mesmo id e devolve `True`;
    - devolve `False` quando o id não existe, sem gravar nada e sem levantar exceção por isso;
    - `update_crane` ignora `manufacturer_id` e `update_configuration` ignora `crane_id`: o vínculo
      com o registro pai não muda;
    - `update_configuration` grava a ficha recebida como está (`None` apaga a ficha);
    - cada chamada é atômica: ou grava tudo, ou nada.
    """

    def update_manufacturer(self, manufacturer: Manufacturer) -> bool: ...

    def update_crane(self, crane: Crane) -> bool: ...

    def update_configuration(self, configuration: CraneConfiguration) -> bool: ...
