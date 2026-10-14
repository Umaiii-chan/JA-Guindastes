# FICTÍCIO — acessórios inventados só para testar a TASK-056 (ADR-012).
#
# Nenhum nome ou peso daqui representa um acessório real nem um dado oficial.
"""Repositório de acessórios em memória e acessórios FICTÍCIOS para os testes."""

from collections.abc import Sequence

from app.application.ports.accessory_repository import AccessoryAlreadyExistsError
from app.domain.entities.accessory import Accessory, AccessoryType
from app.domain.value_objects.mass import Mass

GANCHO_ACESSORIO_FICTICIO = Accessory(
    id="ACC-FICTICIO-GANCHO",
    type=AccessoryType.HOOK_BLOCK,
    name="Moitão FICTÍCIO",
    weight=Mass(200.0),
    rigging_height_m=1.2,
)
MANILHA_FICTICIA = Accessory(
    id="ACC-FICTICIO-MANILHA",
    type=AccessoryType.SHACKLE,
    name="Manilha FICTÍCIA",
    weight=Mass(20.0),
    rigging_height_m=0.3,
    model_file="manilha.glb",
    credit="Autor FICTÍCIO",
    license="CC0",
)
CINTA_FICTICIA = Accessory(
    id="ACC-FICTICIO-CINTA",
    type=AccessoryType.POLYESTER_SLING,
    name="Cinta FICTÍCIA",
    weight=Mass(15.0),
    rigging_height_m=2.0,
)


class InMemoryAccessories:
    """`AccessoryRepository` em memória, com o mesmo contrato do repositório SQLAlchemy."""

    def __init__(self, *accessories: Accessory) -> None:
        self.items: dict[str, Accessory] = {}
        for accessory in accessories:
            self.add(accessory)

    def add(self, accessory: Accessory) -> None:
        if accessory.id in self.items:
            raise AccessoryAlreadyExistsError(accessory.id)
        self.items[accessory.id] = accessory

    def get(self, accessory_id: str) -> Accessory | None:
        return self.items.get(accessory_id)

    def get_accessories(self, accessory_ids: Sequence[str]) -> dict[str, Accessory]:
        return {key: self.items[key] for key in accessory_ids if key in self.items}

    def list_all(self) -> list[Accessory]:
        return sorted(self.items.values(), key=lambda item: (item.name, item.id))

    def update(self, accessory: Accessory) -> bool:
        if accessory.id not in self.items:
            return False
        self.items[accessory.id] = accessory
        return True

    def delete(self, accessory_id: str) -> bool:
        return self.items.pop(accessory_id, None) is not None
