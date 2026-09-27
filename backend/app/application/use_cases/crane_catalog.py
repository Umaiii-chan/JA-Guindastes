"""Casos de uso do catálogo de guindastes (RF-001, RF-002, RF-005, RF-010; doc-fonte § 15.1).

TASK-030. Criar, listar e obter fabricantes, guindastes (modelos lógicos) e configurações
operacionais com a ficha técnica geométrica (`CraneGeometry`, ADR-013 C-4). A ficha vem só deste
cadastro, nunca do modelo 3D (RN-003), e é opcional: a empresa ainda não forneceu as fichas reais
(ADR-013 C-4 regra 2).

Ids: gerados aqui, pelo servidor, como UUID em texto. A porta (`CraneCatalogRepository`) aceita
qualquer texto não vazio; gerar no servidor evita que quem cadastra tenha de inventar ids e deixa o
conflito de id (`CatalogEntryAlreadyExistsError`) praticamente restrito a erro de programação. O
gerador é injetável para os testes.

Edição (TASK-044): renomear fabricante e guindaste; renomear a configuração e/ou substituir a
ficha técnica inteira. A ficha nova vale para as próximas avaliações (o `CraneGeometryProvider` lê
o cadastro a cada avaliação) e não altera as tabelas de carga da configuração.

Fora do escopo: excluir (TASK-030 e TASK-044); unicidade de nomes (não há regra; pendência 2 da
TASK-022), então editar nunca conflita por nome; paginação.
"""

import dataclasses
from collections.abc import Callable
from uuid import uuid4

from app.application.ports.crane_catalog_listing import CraneCatalogStore
from app.application.ports.crane_catalog_repository import (
    CatalogReferenceNotFoundError,
    Crane,
    CraneConfiguration,
    Manufacturer,
)
from app.domain.value_objects.crane_geometry import CraneGeometry

# Nomes das entidades nas mensagens de erro (os mesmos do repositório da TASK-022).
MANUFACTURER_ENTITY = "fabricante"
CRANE_ENTITY = "guindaste"
CONFIGURATION_ENTITY = "configuração"

IdGenerator = Callable[[], str]


def generate_uuid_id() -> str:
    """Id novo: UUID versão 4 em texto (36 caracteres, minúsculo, com hífens)."""
    return str(uuid4())


class CatalogEntryNotFoundError(Exception):
    """O registro pedido, ou referenciado por outro, não existe no catálogo."""

    def __init__(self, entity: str, entry_id: str) -> None:
        self.entity = entity
        self.entry_id = entry_id
        super().__init__(f"{entity} com id {entry_id!r} não existe")


class ManageCraneCatalog:
    """Cadastro e consulta do catálogo: fabricante → guindaste → configuração.

    Erros:
    - `CatalogEntryNotFoundError`: o registro pedido não existe, ou o fabricante/guindaste de que o
      novo registro depende não existe;
    - `CatalogEntryAlreadyExistsError` (da porta): o repositório recusou um id repetido;
    - `ValueError` (dos registros da porta): nome vazio ou só com espaços; e, na edição da
      configuração, nenhum campo informado.
    """

    def __init__(
        self, repository: CraneCatalogStore, id_generator: IdGenerator = generate_uuid_id
    ) -> None:
        self._repository = repository
        self._id_generator = id_generator

    def create_manufacturer(self, name: str) -> Manufacturer:
        manufacturer = Manufacturer(id=self._id_generator(), name=name)
        self._repository.add_manufacturer(manufacturer)
        return manufacturer

    def list_manufacturers(self) -> list[Manufacturer]:
        return self._repository.list_manufacturers()

    def get_manufacturer(self, manufacturer_id: str) -> Manufacturer:
        manufacturer = self._repository.get_manufacturer(manufacturer_id)
        if manufacturer is None:
            raise CatalogEntryNotFoundError(MANUFACTURER_ENTITY, manufacturer_id)
        return manufacturer

    def create_crane(self, manufacturer_id: str, model_name: str) -> Crane:
        crane = Crane(
            id=self._id_generator(), manufacturer_id=manufacturer_id, model_name=model_name
        )
        try:
            self._repository.add_crane(crane)
        except CatalogReferenceNotFoundError as error:
            raise CatalogEntryNotFoundError(error.entity, error.entry_id) from error
        return crane

    def list_cranes(self, manufacturer_id: str | None = None) -> list[Crane]:
        """Todos os guindastes ou os de um fabricante; fabricante inexistente é erro, não lista
        vazia, para não confundir "fabricante sem guindastes" com "fabricante que não existe"."""
        if manufacturer_id is not None:
            self.get_manufacturer(manufacturer_id)
        return self._repository.list_cranes(manufacturer_id)

    def get_crane(self, crane_id: str) -> Crane:
        crane = self._repository.get_crane(crane_id)
        if crane is None:
            raise CatalogEntryNotFoundError(CRANE_ENTITY, crane_id)
        return crane

    def create_configuration(
        self, crane_id: str, name: str, geometry: CraneGeometry | None = None
    ) -> CraneConfiguration:
        configuration = CraneConfiguration(
            id=self._id_generator(), crane_id=crane_id, name=name, geometry=geometry
        )
        try:
            self._repository.add_configuration(configuration)
        except CatalogReferenceNotFoundError as error:
            raise CatalogEntryNotFoundError(error.entity, error.entry_id) from error
        return configuration

    def list_configurations(self, crane_id: str) -> list[CraneConfiguration]:
        """Configurações de um guindaste; guindaste inexistente é erro, não lista vazia."""
        self.get_crane(crane_id)
        return self._repository.list_configurations(crane_id)

    def get_configuration(self, configuration_id: str) -> CraneConfiguration:
        configuration = self._repository.get_configuration(configuration_id)
        if configuration is None:
            raise CatalogEntryNotFoundError(CONFIGURATION_ENTITY, configuration_id)
        return configuration

    def rename_manufacturer(self, manufacturer_id: str, name: str) -> Manufacturer:
        """Troca o nome do fabricante (TASK-044)."""
        manufacturer = Manufacturer(id=manufacturer_id, name=name)
        if not self._repository.update_manufacturer(manufacturer):
            raise CatalogEntryNotFoundError(MANUFACTURER_ENTITY, manufacturer_id)
        return manufacturer

    def rename_crane(self, crane_id: str, model_name: str) -> Crane:
        """Troca o nome do modelo do guindaste; o fabricante não muda (TASK-044)."""
        crane = dataclasses.replace(self.get_crane(crane_id), model_name=model_name)
        if not self._repository.update_crane(crane):
            raise CatalogEntryNotFoundError(CRANE_ENTITY, crane_id)
        return crane

    def update_configuration(
        self,
        configuration_id: str,
        *,
        name: str | None = None,
        geometry: CraneGeometry | None = None,
    ) -> CraneConfiguration:
        """Troca o nome e/ou a ficha técnica inteira da configuração (TASK-044).

        `None` mantém o valor atual: por aqui não se apaga a ficha. Pelo menos um dos dois precisa
        vir (`ValueError`). O guindaste não muda, e as tabelas de carga não são tocadas.
        """
        if name is None and geometry is None:
            raise ValueError("informe o nome ou a ficha técnica da configuração")
        current = self.get_configuration(configuration_id)
        configuration = dataclasses.replace(
            current,
            name=current.name if name is None else name,
            geometry=current.geometry if geometry is None else geometry,
        )
        if not self._repository.update_configuration(configuration):
            raise CatalogEntryNotFoundError(CONFIGURATION_ENTITY, configuration_id)
        return configuration
