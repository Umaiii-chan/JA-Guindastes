"""Caso de uso `ActivateLoadChart` com fakes (TASK-031; doc-fonte § 13.2). Dados FICTÍCIOS."""

import pytest

from app.application.ports.load_chart_activation import LoadChartStatusChangedError
from app.application.ports.load_chart_repository import LoadChartNotFoundError
from app.application.use_cases.activate_load_chart import (
    ActivateLoadChart,
    LoadChartNotActivatableError,
)
from app.domain.entities.load_chart import LoadChart, LoadChartStatus
from tests.fixtures.load_chart_ficticio import CONFIGURATION_FICTICIA_ID, build_load_chart_ficticio
from tests.fixtures.load_chart_persistence_fakes import InMemoryLoadChartStore
from tests.infrastructure.repositories.catalog_ficticio import SOURCE_FICTICIA


def chart(chart_id: str, status: LoadChartStatus, configuration_id: str = "") -> LoadChart:
    base = build_load_chart_ficticio()
    return LoadChart(
        id=chart_id,
        version=f"v-{chart_id}",
        configuration_id=configuration_id or CONFIGURATION_FICTICIA_ID,
        status=status,
        points=base.points,
    )


@pytest.fixture
def store() -> InMemoryLoadChartStore:
    return InMemoryLoadChartStore({CONFIGURATION_FICTICIA_ID})


def test_draft_goes_through_validated_to_active(store: InMemoryLoadChartStore) -> None:
    store.add(chart("NOVA", LoadChartStatus.DRAFT), SOURCE_FICTICIA)

    activation = ActivateLoadChart(store, store).execute("NOVA")

    assert store.status_changes == [("NOVA", LoadChartStatus.VALIDATED)]
    assert store.activations == [("NOVA", LoadChartStatus.VALIDATED)]
    assert activation.stored.chart.status is LoadChartStatus.ACTIVE
    assert activation.stored.source == SOURCE_FICTICIA
    assert activation.superseded_load_chart_id is None
    assert store.status_of("NOVA") is LoadChartStatus.ACTIVE


def test_validated_goes_straight_to_active(store: InMemoryLoadChartStore) -> None:
    store.add(chart("NOVA", LoadChartStatus.VALIDATED), SOURCE_FICTICIA)

    ActivateLoadChart(store, store).execute("NOVA")

    assert store.status_changes == []
    assert store.status_of("NOVA") is LoadChartStatus.ACTIVE


def test_previous_active_of_the_same_configuration_becomes_superseded(
    store: InMemoryLoadChartStore,
) -> None:
    store.add(chart("ANTIGA", LoadChartStatus.ACTIVE), SOURCE_FICTICIA)
    store.add(chart("NOVA", LoadChartStatus.DRAFT), SOURCE_FICTICIA)

    activation = ActivateLoadChart(store, store).execute("NOVA")

    assert activation.superseded_load_chart_id == "ANTIGA"
    assert store.status_of("ANTIGA") is LoadChartStatus.SUPERSEDED
    assert store.status_of("NOVA") is LoadChartStatus.ACTIVE


def test_active_of_another_configuration_is_not_touched(store: InMemoryLoadChartStore) -> None:
    store.configuration_ids.add("CFG-FICTICIA-B")
    store.add(chart("OUTRA", LoadChartStatus.ACTIVE, "CFG-FICTICIA-B"), SOURCE_FICTICIA)
    store.add(chart("NOVA", LoadChartStatus.DRAFT), SOURCE_FICTICIA)

    activation = ActivateLoadChart(store, store).execute("NOVA")

    assert activation.superseded_load_chart_id is None
    assert store.status_of("OUTRA") is LoadChartStatus.ACTIVE


@pytest.mark.parametrize(
    "status", [LoadChartStatus.INVALID, LoadChartStatus.ACTIVE, LoadChartStatus.SUPERSEDED]
)
def test_invalid_active_and_superseded_are_not_activated(
    store: InMemoryLoadChartStore, status: LoadChartStatus
) -> None:
    store.add(chart("X", status), SOURCE_FICTICIA)

    with pytest.raises(LoadChartNotActivatableError) as raised:
        ActivateLoadChart(store, store).execute("X")

    assert raised.value.status is status
    assert store.status_of("X") is status
    assert store.status_changes == []
    assert store.activations == []


def test_unknown_chart_is_not_found(store: InMemoryLoadChartStore) -> None:
    with pytest.raises(LoadChartNotFoundError):
        ActivateLoadChart(store, store).execute("NAO-EXISTE")


def test_concurrent_status_change_propagates(store: InMemoryLoadChartStore) -> None:
    store.add(chart("NOVA", LoadChartStatus.DRAFT), SOURCE_FICTICIA)

    class RacingStore(InMemoryLoadChartStore):
        def activate_superseding_current(
            self, load_chart_id: str, *, expected_status: LoadChartStatus
        ) -> str | None:
            raise LoadChartStatusChangedError(
                load_chart_id, expected_status, LoadChartStatus.SUPERSEDED
            )

    with pytest.raises(LoadChartStatusChangedError):
        ActivateLoadChart(store, RacingStore(set())).execute("NOVA")
    # Ficou em VALIDATED (estado válido), pronta para tentar de novo.
    assert store.status_of("NOVA") is LoadChartStatus.VALIDATED
