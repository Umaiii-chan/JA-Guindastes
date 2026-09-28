"""Casos de uso do catálogo, da importação, da listagem e da ativação com zonas de giro.

TASK-046 (ADR-018), com fakes em memória e dados FICTÍCIOS (ADR-012).
"""

import dataclasses

import pytest

from app.application.ports.load_chart_repository import LoadChartConfigurationNotFoundError
from app.application.use_cases.activate_load_chart import ActivateLoadChart
from app.application.use_cases.crane_catalog import (
    UNCHANGED,
    ManageCraneCatalog,
    RotationZoneInUseError,
    ZonelessLoadChartsExistError,
)
from app.application.use_cases.import_load_chart import (
    ImportedLoadChart,
    ImportLoadChart,
    RotationZoneNotAllowedError,
    RotationZoneRequiredError,
    UnknownRotationZoneError,
)
from app.application.use_cases.list_configuration_load_charts import (
    ActiveLoadChartByZone,
    ListConfigurationLoadCharts,
)
from app.application.use_cases.validate_load_chart_import import InvalidLoadChartImport
from app.domain.entities.load_chart import LoadChart, LoadChartStatus
from app.domain.value_objects.mass import Mass
from app.domain.value_objects.rotation_zone import RotationZone, RotationZones
from app.infrastructure.importers.csv_load_chart_parser import CsvLoadChartParser
from tests.fixtures.crane_catalog_ficticio import InMemoryCraneCatalog
from tests.fixtures.load_chart_csv_ficticio import (
    CSV_FICTICIO_INCONSISTENCIAS,
    CSV_FICTICIO_VALIDO,
    read_csv_ficticio,
)
from tests.fixtures.load_chart_ficticio import CONFIGURATION_FICTICIA_ID, build_load_chart_ficticio
from tests.fixtures.load_chart_persistence_fakes import InMemoryFileStorage, InMemoryLoadChartStore
from tests.fixtures.rotation_zones_ficticias import (
    GANCHO_FICTICIO_KG,
    ZONA_FRONTAL_FICTICIA,
    ZONA_LATERAL_TRASEIRA_FICTICIA,
    zonas_ficticias,
)
from tests.infrastructure.repositories.catalog_ficticio import (
    CRANE_FICTICIO,
    MANUFACTURER_FICTICIO,
    SOURCE_FICTICIA,
    configuration_ficticia,
)

SEM_ZONAS_ID = "CFG-FICTICIA-SEM-ZONAS"
VALID_CSV = read_csv_ficticio(CSV_FICTICIO_VALIDO)


@pytest.fixture
def catalog() -> InMemoryCraneCatalog:
    catalog = InMemoryCraneCatalog()
    catalog.add_manufacturer(MANUFACTURER_FICTICIO)
    catalog.add_crane(CRANE_FICTICIO)
    catalog.add_configuration(
        dataclasses.replace(
            configuration_ficticia(),
            rotation_zones=zonas_ficticias(),
            hook_block_weight=Mass(GANCHO_FICTICIO_KG),
        )
    )
    catalog.add_configuration(configuration_ficticia(configuration_id=SEM_ZONAS_ID))
    return catalog


@pytest.fixture
def store() -> InMemoryLoadChartStore:
    return InMemoryLoadChartStore({CONFIGURATION_FICTICIA_ID, SEM_ZONAS_ID})


def chart(
    chart_id: str,
    zone: str | None,
    status: LoadChartStatus = LoadChartStatus.DRAFT,
    configuration_id: str = CONFIGURATION_FICTICIA_ID,
) -> LoadChart:
    return LoadChart(
        id=chart_id,
        version=f"{chart_id}-v",
        configuration_id=configuration_id,
        status=status,
        points=build_load_chart_ficticio().points,
        rotation_zone_code=zone,
    )


# --- catálogo -------------------------------------------------------------------------------


def test_create_configuration_keeps_zones_and_hook_block(catalog: InMemoryCraneCatalog) -> None:
    created = ManageCraneCatalog(catalog, lambda: "CFG-FICTICIA-NOVA").create_configuration(
        CRANE_FICTICIO.id,
        "Configuração FICTÍCIA nova",
        rotation_zones=zonas_ficticias(),
        hook_block_weight=Mass(150.0),
    )

    stored = catalog.get_configuration(created.id)
    assert stored is not None
    assert stored.rotation_zones == zonas_ficticias()
    assert stored.hook_block_weight == Mass(150.0)


def test_update_replaces_zones_and_keeps_what_is_unchanged(
    catalog: InMemoryCraneCatalog, store: InMemoryLoadChartStore
) -> None:
    new_zones = RotationZones(
        zones=(
            RotationZone(ZONA_FRONTAL_FICTICIA, "Frontal FICTÍCIA", 300.0, 60.0),
            RotationZone(ZONA_LATERAL_TRASEIRA_FICTICIA, "Resto FICTÍCIO", 60.0, 300.0),
        )
    )
    service = ManageCraneCatalog(catalog, load_chart_listing=store)

    updated = service.update_configuration(CONFIGURATION_FICTICIA_ID, rotation_zones=new_zones)

    assert updated.rotation_zones == new_zones
    assert updated.hook_block_weight == Mass(GANCHO_FICTICIO_KG)
    assert updated.name == "Configuração FICTÍCIA"


def test_update_with_none_removes_zones_and_hook_block(catalog: InMemoryCraneCatalog) -> None:
    updated = ManageCraneCatalog(catalog).update_configuration(
        CONFIGURATION_FICTICIA_ID, rotation_zones=None, hook_block_weight=None
    )

    assert updated.rotation_zones is None
    assert updated.hook_block_weight is None


def test_update_with_only_unchanged_fields_is_rejected(catalog: InMemoryCraneCatalog) -> None:
    with pytest.raises(ValueError):
        ManageCraneCatalog(catalog).update_configuration(
            CONFIGURATION_FICTICIA_ID, rotation_zones=UNCHANGED, hook_block_weight=UNCHANGED
        )


@pytest.mark.parametrize("remove", ["lista nova sem a zona", "sem zonas"])
def test_removing_or_renaming_a_zone_with_charts_is_rejected(
    catalog: InMemoryCraneCatalog, store: InMemoryLoadChartStore, remove: str
) -> None:
    store.add(chart("LC-FICTICIO-LATERAL", ZONA_LATERAL_TRASEIRA_FICTICIA), SOURCE_FICTICIA)
    renamed = RotationZones(
        zones=(
            RotationZone(ZONA_FRONTAL_FICTICIA, "Frontal FICTÍCIA", 305.0, 55.0),
            RotationZone("LATERAL_E_TRASEIRA", "Renomeada FICTÍCIA", 55.0, 305.0),
        )
    )
    zones = renamed if remove == "lista nova sem a zona" else None

    with pytest.raises(RotationZoneInUseError) as error:
        ManageCraneCatalog(catalog, load_chart_listing=store).update_configuration(
            CONFIGURATION_FICTICIA_ID, rotation_zones=zones
        )

    assert error.value.codes == (ZONA_LATERAL_TRASEIRA_FICTICIA,)
    stored = catalog.get_configuration(CONFIGURATION_FICTICIA_ID)
    assert stored is not None and stored.rotation_zones == zonas_ficticias()


def test_zones_without_charts_can_be_removed(
    catalog: InMemoryCraneCatalog, store: InMemoryLoadChartStore
) -> None:
    store.add(chart("LC-FICTICIO-FRONTAL", ZONA_FRONTAL_FICTICIA), SOURCE_FICTICIA)
    kept_front = RotationZones(
        zones=(
            RotationZone(ZONA_FRONTAL_FICTICIA, "Frontal FICTÍCIA", 0.0, 180.0),
            RotationZone("TRASEIRA", "Traseira FICTÍCIA", 180.0, 0.0),
        )
    )

    updated = ManageCraneCatalog(catalog, load_chart_listing=store).update_configuration(
        CONFIGURATION_FICTICIA_ID, rotation_zones=kept_front
    )

    assert updated.rotation_zones == kept_front


def test_adding_zones_to_a_configuration_with_charts_without_zone_is_rejected(
    catalog: InMemoryCraneCatalog, store: InMemoryLoadChartStore
) -> None:
    store.add(chart("LC-FICTICIO-SEM-ZONA", None, configuration_id=SEM_ZONAS_ID), SOURCE_FICTICIA)

    with pytest.raises(ZonelessLoadChartsExistError) as error:
        ManageCraneCatalog(catalog, load_chart_listing=store).update_configuration(
            SEM_ZONAS_ID, rotation_zones=zonas_ficticias(), hook_block_weight=Mass(200.0)
        )

    assert error.value.load_chart_ids == ("LC-FICTICIO-SEM-ZONA",)
    stored = catalog.get_configuration(SEM_ZONAS_ID)
    assert stored is not None
    assert stored.rotation_zones is None
    assert stored.hook_block_weight is None


def test_adding_zones_to_a_configuration_without_charts_is_accepted(
    catalog: InMemoryCraneCatalog, store: InMemoryLoadChartStore
) -> None:
    updated = ManageCraneCatalog(catalog, load_chart_listing=store).update_configuration(
        SEM_ZONAS_ID, rotation_zones=zonas_ficticias()
    )

    assert updated.rotation_zones == zonas_ficticias()


def test_other_edits_of_a_configuration_without_zones_with_zoneless_charts_still_work(
    catalog: InMemoryCraneCatalog, store: InMemoryLoadChartStore
) -> None:
    store.add(chart("LC-FICTICIO-SEM-ZONA", None, configuration_id=SEM_ZONAS_ID), SOURCE_FICTICIA)
    service = ManageCraneCatalog(catalog, load_chart_listing=store)

    renamed = service.update_configuration(
        SEM_ZONAS_ID, name="Nova FICTÍCIA", hook_block_weight=Mass(150.0)
    )
    still_without = service.update_configuration(SEM_ZONAS_ID, rotation_zones=None)

    assert renamed.hook_block_weight == Mass(150.0)
    assert still_without.rotation_zones is None


def test_replacing_zones_keeps_working_when_a_zoned_configuration_has_charts(
    catalog: InMemoryCraneCatalog, store: InMemoryLoadChartStore
) -> None:
    store.add(chart("LC-FICTICIO-FRONTAL", ZONA_FRONTAL_FICTICIA), SOURCE_FICTICIA)
    store.add(chart("LC-FICTICIO-LATERAL", ZONA_LATERAL_TRASEIRA_FICTICIA), SOURCE_FICTICIA)
    moved = RotationZones(
        zones=(
            RotationZone(ZONA_FRONTAL_FICTICIA, "Frontal FICTÍCIA", 300.0, 60.0),
            RotationZone(ZONA_LATERAL_TRASEIRA_FICTICIA, "Resto FICTÍCIO", 60.0, 300.0),
        )
    )

    updated = ManageCraneCatalog(catalog, load_chart_listing=store).update_configuration(
        CONFIGURATION_FICTICIA_ID, rotation_zones=moved
    )

    assert updated.rotation_zones == moved


# --- importação -----------------------------------------------------------------------------


def import_chart(
    catalog: InMemoryCraneCatalog,
    store: InMemoryLoadChartStore,
    *,
    configuration_id: str = CONFIGURATION_FICTICIA_ID,
    zone: str | None = ZONA_FRONTAL_FICTICIA,
    content: bytes = VALID_CSV,
) -> ImportedLoadChart | InvalidLoadChartImport:
    return ImportLoadChart(store, InMemoryFileStorage(), catalog).execute(
        content,
        parser=CsvLoadChartParser(),
        file_name="tabela_ficticia.csv",
        file_type="text/csv",
        load_chart_id="LC-FICTICIO-IMPORTADA",
        version="FICTICIO-v1",
        configuration_id=configuration_id,
        rotation_zone_code=zone,
    )


def test_import_into_a_zone_records_the_zone(
    catalog: InMemoryCraneCatalog, store: InMemoryLoadChartStore
) -> None:
    result = import_chart(catalog, store)

    assert isinstance(result, ImportedLoadChart)
    assert result.stored.chart.rotation_zone_code == ZONA_FRONTAL_FICTICIA
    stored = store.get_by_id("LC-FICTICIO-IMPORTADA")
    assert stored is not None and stored.chart.rotation_zone_code == ZONA_FRONTAL_FICTICIA


def test_import_without_zone_into_a_configuration_with_zones_is_rejected(
    catalog: InMemoryCraneCatalog, store: InMemoryLoadChartStore
) -> None:
    with pytest.raises(RotationZoneRequiredError):
        import_chart(catalog, store, zone=None)
    assert store.charts == {}


def test_import_into_an_unknown_zone_is_rejected(
    catalog: InMemoryCraneCatalog, store: InMemoryLoadChartStore
) -> None:
    with pytest.raises(UnknownRotationZoneError):
        import_chart(catalog, store, zone="TRASEIRA")


def test_import_with_zone_into_a_configuration_without_zones_is_rejected(
    catalog: InMemoryCraneCatalog, store: InMemoryLoadChartStore
) -> None:
    with pytest.raises(RotationZoneNotAllowedError):
        import_chart(catalog, store, configuration_id=SEM_ZONAS_ID)


def test_import_without_zone_into_a_configuration_without_zones_works_as_before(
    catalog: InMemoryCraneCatalog, store: InMemoryLoadChartStore
) -> None:
    result = import_chart(catalog, store, configuration_id=SEM_ZONAS_ID, zone=None)

    assert isinstance(result, ImportedLoadChart)
    assert result.stored.chart.rotation_zone_code is None


def test_zone_is_checked_before_reading_the_file(
    catalog: InMemoryCraneCatalog, store: InMemoryLoadChartStore
) -> None:
    invalid = read_csv_ficticio(CSV_FICTICIO_INCONSISTENCIAS)

    with pytest.raises(RotationZoneRequiredError):
        import_chart(catalog, store, zone=None, content=invalid)


def test_import_into_an_unknown_configuration_is_404_before_reading(
    catalog: InMemoryCraneCatalog, store: InMemoryLoadChartStore
) -> None:
    with pytest.raises(LoadChartConfigurationNotFoundError):
        import_chart(catalog, store, configuration_id="CFG-INEXISTENTE", zone=None)


# --- ativação e listagem --------------------------------------------------------------------


def test_activation_replaces_only_the_active_chart_of_the_same_zone(
    catalog: InMemoryCraneCatalog, store: InMemoryLoadChartStore
) -> None:
    store.add(chart("LC-F1", ZONA_FRONTAL_FICTICIA, LoadChartStatus.ACTIVE), SOURCE_FICTICIA)
    store.add(
        chart("LC-L1", ZONA_LATERAL_TRASEIRA_FICTICIA, LoadChartStatus.ACTIVE), SOURCE_FICTICIA
    )
    store.add(chart("LC-F2", ZONA_FRONTAL_FICTICIA), SOURCE_FICTICIA)

    activation = ActivateLoadChart(store, store).execute("LC-F2")

    assert activation.superseded_load_chart_id == "LC-F1"
    assert activation.stored.chart.rotation_zone_code == ZONA_FRONTAL_FICTICIA
    assert store.status_of("LC-F1") is LoadChartStatus.SUPERSEDED
    assert store.status_of("LC-L1") is LoadChartStatus.ACTIVE
    assert store.status_of("LC-F2") is LoadChartStatus.ACTIVE


def test_listing_reports_the_active_chart_of_each_zone(
    catalog: InMemoryCraneCatalog, store: InMemoryLoadChartStore
) -> None:
    store.add(
        chart("LC-L1", ZONA_LATERAL_TRASEIRA_FICTICIA, LoadChartStatus.ACTIVE), SOURCE_FICTICIA
    )
    store.add(chart("LC-F1", ZONA_FRONTAL_FICTICIA, LoadChartStatus.ACTIVE), SOURCE_FICTICIA)
    store.add(chart("LC-F0", ZONA_FRONTAL_FICTICIA, LoadChartStatus.SUPERSEDED), SOURCE_FICTICIA)
    store.add(chart("LC-SEM", None, LoadChartStatus.ACTIVE), SOURCE_FICTICIA)

    result = ListConfigurationLoadCharts(catalog, store).execute(CONFIGURATION_FICTICIA_ID)

    assert result.active_load_charts == (
        ActiveLoadChartByZone(None, "LC-SEM"),
        ActiveLoadChartByZone(ZONA_FRONTAL_FICTICIA, "LC-F1"),
        ActiveLoadChartByZone(ZONA_LATERAL_TRASEIRA_FICTICIA, "LC-L1"),
    )
    assert result.active_load_chart_id == "LC-SEM"
    zones = {item.load_chart_id: item.rotation_zone_code for item in result.items}
    assert zones["LC-F0"] == ZONA_FRONTAL_FICTICIA


def test_listing_without_active_chart_without_zone_keeps_active_chart_id_null(
    catalog: InMemoryCraneCatalog, store: InMemoryLoadChartStore
) -> None:
    store.add(chart("LC-F1", ZONA_FRONTAL_FICTICIA, LoadChartStatus.ACTIVE), SOURCE_FICTICIA)

    result = ListConfigurationLoadCharts(catalog, store).execute(CONFIGURATION_FICTICIA_ID)

    assert result.active_load_chart_id is None
    assert result.active_load_charts == (ActiveLoadChartByZone(ZONA_FRONTAL_FICTICIA, "LC-F1"),)
