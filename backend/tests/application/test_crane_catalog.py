"""Casos de uso do catálogo com repositório em memória (TASK-030; CA-1..CA-4). Dados FICTÍCIOS."""

from uuid import UUID

import pytest

from app.application.ports.crane_catalog_listing import CraneCatalogStore
from app.application.ports.crane_catalog_repository import (
    CatalogEntryAlreadyExistsError,
    Crane,
    Manufacturer,
)
from app.application.use_cases.crane_catalog import (
    CatalogEntryNotFoundError,
    ManageCraneCatalog,
    generate_uuid_id,
)
from tests.fixtures.crane_catalog_ficticio import (
    CONFIGURACAO_FICTICIA_NOME,
    FABRICANTE_FICTICIO_NOME,
    MODELO_FICTICIO_NOME,
    InMemoryCraneCatalog,
    SequentialIds,
)
from tests.fixtures.crane_geometry_ficticia import build_crane_geometry_ficticia


@pytest.fixture
def repository() -> InMemoryCraneCatalog:
    return InMemoryCraneCatalog()


@pytest.fixture
def catalog(repository: InMemoryCraneCatalog) -> ManageCraneCatalog:
    return ManageCraneCatalog(repository, SequentialIds())


def test_fake_satisfies_the_store_port(repository: InMemoryCraneCatalog) -> None:
    store: CraneCatalogStore = repository
    assert store.list_manufacturers() == []


def test_default_ids_are_distinct_uuid4_strings() -> None:
    first, second = generate_uuid_id(), generate_uuid_id()

    assert first != second
    assert UUID(first).version == 4
    assert str(UUID(first)) == first


def test_create_manufacturer_generates_id_and_stores_it(
    catalog: ManageCraneCatalog, repository: InMemoryCraneCatalog
) -> None:
    manufacturer = catalog.create_manufacturer(FABRICANTE_FICTICIO_NOME)

    assert manufacturer == Manufacturer(id="ID-FICTICIO-1", name=FABRICANTE_FICTICIO_NOME)
    assert repository.get_manufacturer("ID-FICTICIO-1") == manufacturer
    assert catalog.get_manufacturer("ID-FICTICIO-1") == manufacturer


def test_list_manufacturers_is_ordered_by_name(catalog: ManageCraneCatalog) -> None:
    catalog.create_manufacturer("Fabricante FICTÍCIO B")
    catalog.create_manufacturer("Fabricante FICTÍCIO A")

    names = [item.name for item in catalog.list_manufacturers()]

    assert names == ["Fabricante FICTÍCIO A", "Fabricante FICTÍCIO B"]


@pytest.mark.parametrize("blank", ["", "   "])
def test_blank_name_is_rejected_before_writing(
    catalog: ManageCraneCatalog, repository: InMemoryCraneCatalog, blank: str
) -> None:
    with pytest.raises(ValueError, match="nome do fabricante"):
        catalog.create_manufacturer(blank)

    assert repository.manufacturers == {}


def test_missing_manufacturer_raises_not_found(catalog: ManageCraneCatalog) -> None:
    with pytest.raises(CatalogEntryNotFoundError) as caught:
        catalog.get_manufacturer("NAO-EXISTE")

    assert (caught.value.entity, caught.value.entry_id) == ("fabricante", "NAO-EXISTE")


def test_create_crane_for_existing_manufacturer(catalog: ManageCraneCatalog) -> None:
    manufacturer = catalog.create_manufacturer(FABRICANTE_FICTICIO_NOME)

    crane = catalog.create_crane(manufacturer.id, MODELO_FICTICIO_NOME)

    assert crane == Crane(
        id="ID-FICTICIO-2", manufacturer_id=manufacturer.id, model_name=MODELO_FICTICIO_NOME
    )
    assert catalog.get_crane(crane.id) == crane


def test_create_crane_for_missing_manufacturer_raises_not_found(
    catalog: ManageCraneCatalog, repository: InMemoryCraneCatalog
) -> None:
    with pytest.raises(CatalogEntryNotFoundError) as caught:
        catalog.create_crane("NAO-EXISTE", MODELO_FICTICIO_NOME)

    assert (caught.value.entity, caught.value.entry_id) == ("fabricante", "NAO-EXISTE")
    assert repository.cranes == {}


def test_list_cranes_all_or_by_manufacturer(catalog: ManageCraneCatalog) -> None:
    first = catalog.create_manufacturer("Fabricante FICTÍCIO 1")
    second = catalog.create_manufacturer("Fabricante FICTÍCIO 2")
    crane_b = catalog.create_crane(first.id, "Modelo FICTÍCIO B")
    crane_a = catalog.create_crane(first.id, "Modelo FICTÍCIO A")
    other = catalog.create_crane(second.id, "Modelo FICTÍCIO C")

    assert catalog.list_cranes() == [crane_a, crane_b, other]
    assert catalog.list_cranes(first.id) == [crane_a, crane_b]
    assert catalog.list_cranes(second.id) == [other]


def test_list_cranes_of_missing_manufacturer_raises_not_found(
    catalog: ManageCraneCatalog,
) -> None:
    with pytest.raises(CatalogEntryNotFoundError):
        catalog.list_cranes("NAO-EXISTE")


def test_missing_crane_raises_not_found(catalog: ManageCraneCatalog) -> None:
    with pytest.raises(CatalogEntryNotFoundError) as caught:
        catalog.get_crane("NAO-EXISTE")

    assert caught.value.entity == "guindaste"


def test_create_configuration_with_and_without_geometry(catalog: ManageCraneCatalog) -> None:
    manufacturer = catalog.create_manufacturer(FABRICANTE_FICTICIO_NOME)
    crane = catalog.create_crane(manufacturer.id, MODELO_FICTICIO_NOME)
    geometry = build_crane_geometry_ficticia(
        turret_rotation_min_deg=-30.0, turret_rotation_max_deg=30.0
    )

    with_geometry = catalog.create_configuration(crane.id, "Configuração FICTÍCIA B", geometry)
    without_geometry = catalog.create_configuration(crane.id, "Configuração FICTÍCIA A")

    assert with_geometry.geometry == geometry
    assert without_geometry.geometry is None
    assert catalog.get_configuration(with_geometry.id) == with_geometry
    assert catalog.list_configurations(crane.id) == [without_geometry, with_geometry]


def test_create_configuration_for_missing_crane_raises_not_found(
    catalog: ManageCraneCatalog,
) -> None:
    with pytest.raises(CatalogEntryNotFoundError) as caught:
        catalog.create_configuration("NAO-EXISTE", CONFIGURACAO_FICTICIA_NOME)

    assert (caught.value.entity, caught.value.entry_id) == ("guindaste", "NAO-EXISTE")


def test_list_configurations_of_missing_crane_raises_not_found(
    catalog: ManageCraneCatalog,
) -> None:
    with pytest.raises(CatalogEntryNotFoundError):
        catalog.list_configurations("NAO-EXISTE")


def test_missing_configuration_raises_not_found(catalog: ManageCraneCatalog) -> None:
    with pytest.raises(CatalogEntryNotFoundError) as caught:
        catalog.get_configuration("NAO-EXISTE")

    assert caught.value.entity == "configuração"


def test_repeated_id_from_the_repository_propagates_as_conflict(
    repository: InMemoryCraneCatalog,
) -> None:
    catalog = ManageCraneCatalog(repository, lambda: "ID-FICTICIO-REPETIDO")
    catalog.create_manufacturer(FABRICANTE_FICTICIO_NOME)

    with pytest.raises(CatalogEntryAlreadyExistsError):
        catalog.create_manufacturer("Outro fabricante FICTÍCIO")
