"""Caso de uso `ListConfigurationLoadCharts` com fakes (TASK-044, CA-1). Dados FICTÍCIOS."""

import pytest

from app.application.ports.load_chart_listing import LoadChartListing, LoadChartSummary
from app.application.use_cases.crane_catalog import CatalogEntryNotFoundError
from app.application.use_cases.list_configuration_load_charts import (
    ListConfigurationLoadCharts,
    version_sort_key,
)
from app.domain.entities.load_chart import LoadChart, LoadChartStatus
from tests.fixtures.crane_catalog_ficticio import InMemoryCraneCatalog
from tests.fixtures.load_chart_ficticio import CONFIGURATION_FICTICIA_ID, build_load_chart_ficticio
from tests.fixtures.load_chart_persistence_fakes import InMemoryLoadChartStore
from tests.infrastructure.repositories.catalog_ficticio import (
    CRANE_FICTICIO,
    MANUFACTURER_FICTICIO,
    SOURCE_FICTICIA,
    configuration_ficticia,
)

OUTRA_CONFIGURACAO_ID = "CFG-FICTICIA-OUTRA"


def chart(
    chart_id: str,
    version: str,
    status: LoadChartStatus = LoadChartStatus.DRAFT,
    configuration_id: str = CONFIGURATION_FICTICIA_ID,
) -> LoadChart:
    return LoadChart(
        id=chart_id,
        version=version,
        configuration_id=configuration_id,
        status=status,
        points=build_load_chart_ficticio().points,
    )


@pytest.fixture
def catalog() -> InMemoryCraneCatalog:
    catalog = InMemoryCraneCatalog()
    catalog.add_manufacturer(MANUFACTURER_FICTICIO)
    catalog.add_crane(CRANE_FICTICIO)
    catalog.add_configuration(configuration_ficticia())
    catalog.add_configuration(configuration_ficticia(configuration_id=OUTRA_CONFIGURACAO_ID))
    return catalog


@pytest.fixture
def store() -> InMemoryLoadChartStore:
    return InMemoryLoadChartStore({CONFIGURATION_FICTICIA_ID, OUTRA_CONFIGURACAO_ID})


@pytest.fixture
def use_case(
    catalog: InMemoryCraneCatalog, store: InMemoryLoadChartStore
) -> ListConfigurationLoadCharts:
    return ListConfigurationLoadCharts(catalog, store)


def test_fake_satisfies_the_listing_port(store: InMemoryLoadChartStore) -> None:
    listing: LoadChartListing = store
    assert listing.list_by_configuration(CONFIGURATION_FICTICIA_ID) == []


def test_lists_only_the_charts_of_the_configuration_with_the_active_one(
    use_case: ListConfigurationLoadCharts, store: InMemoryLoadChartStore
) -> None:
    store.add(chart("LC-V1", "v1", LoadChartStatus.SUPERSEDED), SOURCE_FICTICIA)
    store.add(chart("LC-V2", "v2", LoadChartStatus.ACTIVE), SOURCE_FICTICIA)
    store.add(chart("LC-V3", "v3", LoadChartStatus.DRAFT), SOURCE_FICTICIA)
    store.add(
        chart("LC-OUTRA", "v9", LoadChartStatus.ACTIVE, OUTRA_CONFIGURACAO_ID), SOURCE_FICTICIA
    )

    result = use_case.execute(CONFIGURATION_FICTICIA_ID)

    assert [item.load_chart_id for item in result.items] == ["LC-V3", "LC-V2", "LC-V1"]
    assert result.active_load_chart_id == "LC-V2"
    assert result.items[0] == LoadChartSummary(
        load_chart_id="LC-V3",
        version="v3",
        configuration_id=CONFIGURATION_FICTICIA_ID,
        status=LoadChartStatus.DRAFT,
        point_count=len(build_load_chart_ficticio().points),
        source=SOURCE_FICTICIA,
    )


def test_configuration_without_charts_gives_an_empty_list_and_no_active(
    use_case: ListConfigurationLoadCharts,
) -> None:
    result = use_case.execute(CONFIGURATION_FICTICIA_ID)

    assert result.items == ()
    assert result.active_load_chart_id is None


def test_without_active_chart_the_active_id_is_none(
    use_case: ListConfigurationLoadCharts, store: InMemoryLoadChartStore
) -> None:
    store.add(chart("LC-V1", "v1", LoadChartStatus.VALIDATED), SOURCE_FICTICIA)

    assert use_case.execute(CONFIGURATION_FICTICIA_ID).active_load_chart_id is None


def test_missing_configuration_raises_not_found(use_case: ListConfigurationLoadCharts) -> None:
    with pytest.raises(CatalogEntryNotFoundError) as caught:
        use_case.execute("CFG-FICTICIA-INEXISTENTE")

    assert caught.value.entity == "configuração"


def test_order_is_natural_version_descending_then_id_descending(
    use_case: ListConfigurationLoadCharts, store: InMemoryLoadChartStore
) -> None:
    for chart_id, version in [
        ("LC-A", "v2"),
        ("LC-B", "v10"),
        ("LC-C", "V9"),
        ("LC-D", "v2.1"),
        ("LC-E", "v1"),
    ]:
        store.add(chart(chart_id, version), SOURCE_FICTICIA)

    result = use_case.execute(CONFIGURATION_FICTICIA_ID)

    assert [item.version for item in result.items] == ["v10", "V9", "v2.1", "v2", "v1"]


def test_same_version_key_is_ordered_by_chart_id_descending(
    use_case: ListConfigurationLoadCharts, store: InMemoryLoadChartStore
) -> None:
    store.add(chart("LC-A", "v1"), SOURCE_FICTICIA)
    store.add(chart("LC-B", " V1 "), SOURCE_FICTICIA)

    result = use_case.execute(CONFIGURATION_FICTICIA_ID)

    assert [item.load_chart_id for item in result.items] == ["LC-B", "LC-A"]


@pytest.mark.parametrize(
    ("older", "newer"),
    [
        ("v2", "v10"),
        ("1.9", "1.10"),
        ("v2", "v2.1"),
        ("FICTICIO-v1", "FICTICIO-v2"),
        ("2026-01", "2026-02"),
        ("a", "b"),
    ],
)
def test_version_sort_key_compares_numbers_as_numbers(older: str, newer: str) -> None:
    assert version_sort_key(older) < version_sort_key(newer)


def test_negative_point_count_is_rejected() -> None:
    with pytest.raises(ValueError):
        LoadChartSummary(
            load_chart_id="LC",
            version="v1",
            configuration_id=CONFIGURATION_FICTICIA_ID,
            status=LoadChartStatus.DRAFT,
            point_count=-1,
            source=SOURCE_FICTICIA,
        )
