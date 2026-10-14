"""Casos de uso do catálogo de acessórios de içamento (TASK-056; ADR-026; RN-014).

Cadastro, consulta, edição e exclusão. Ids gerados pelo servidor (UUID em texto), como no catálogo
de guindastes. A leitura é de qualquer perfil logado e a escrita é do administrador (a apresentação
liga as dependências). Os valores cadastrados são FICTÍCIOS e configuráveis (ADR-012).

Erros: `AccessoryNotFoundError` (id inexistente), `AccessoryAlreadyExistsError` (da porta) e
`InvalidAccessoryError` (do domínio: dado inválido).
"""

import dataclasses
from collections.abc import Callable

from app.application.ports.accessory_repository import AccessoryRepository
from app.application.use_cases.crane_catalog import UNCHANGED, Unchanged, generate_uuid_id
from app.domain.entities.accessory import Accessory, AccessoryType
from app.domain.value_objects.mass import Mass

IdGenerator = Callable[[], str]


class AccessoryNotFoundError(Exception):
    def __init__(self, accessory_id: str) -> None:
        self.accessory_id = accessory_id
        super().__init__(f"acessório com id {accessory_id!r} não existe")


class ManageAccessories:
    def __init__(
        self, repository: AccessoryRepository, id_generator: IdGenerator = generate_uuid_id
    ) -> None:
        self._repository = repository
        self._id_generator = id_generator

    def create(
        self,
        *,
        type: AccessoryType,
        name: str,
        weight_kg: float,
        rigging_height_m: float = 0.0,
        model_file: str | None = None,
        credit: str | None = None,
        license: str | None = None,
    ) -> Accessory:
        accessory = Accessory(
            id=self._id_generator(),
            type=type,
            name=name,
            weight=Mass(weight_kg),
            rigging_height_m=rigging_height_m,
            model_file=model_file,
            credit=credit,
            license=license,
        )
        self._repository.add(accessory)
        return accessory

    def get(self, accessory_id: str) -> Accessory:
        accessory = self._repository.get(accessory_id)
        if accessory is None:
            raise AccessoryNotFoundError(accessory_id)
        return accessory

    def list_all(self) -> list[Accessory]:
        return self._repository.list_all()

    def update(
        self,
        accessory_id: str,
        *,
        type: AccessoryType | Unchanged = UNCHANGED,
        name: str | Unchanged = UNCHANGED,
        weight_kg: float | Unchanged = UNCHANGED,
        rigging_height_m: float | Unchanged = UNCHANGED,
        model_file: str | None | Unchanged = UNCHANGED,
        credit: str | None | Unchanged = UNCHANGED,
        license: str | None | Unchanged = UNCHANGED,
    ) -> Accessory:
        """Muda só os campos informados; `model_file`, `credit` e `license` aceitam `None`."""
        current = self.get(accessory_id)
        changes: dict[str, object] = {}
        if not isinstance(type, Unchanged):
            changes["type"] = type
        if not isinstance(name, Unchanged):
            changes["name"] = name
        if not isinstance(weight_kg, Unchanged):
            changes["weight"] = Mass(weight_kg)
        if not isinstance(rigging_height_m, Unchanged):
            changes["rigging_height_m"] = rigging_height_m
        if not isinstance(model_file, Unchanged):
            changes["model_file"] = model_file
        if not isinstance(credit, Unchanged):
            changes["credit"] = credit
        if not isinstance(license, Unchanged):
            changes["license"] = license
        updated = dataclasses.replace(current, **changes)  # type: ignore[arg-type]
        if not self._repository.update(updated):
            raise AccessoryNotFoundError(accessory_id)
        return updated

    def delete(self, accessory_id: str) -> None:
        if not self._repository.delete(accessory_id):
            raise AccessoryNotFoundError(accessory_id)
