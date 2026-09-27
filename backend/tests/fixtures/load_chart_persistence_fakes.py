"""Fakes em memória das portas de tabela de carga e de armazenamento (TASK-031).

Cumprem os contratos de `LoadChartRepository`, `LoadChartActivationRepository`, `LoadChartListing`
(TASK-044) e `FileStoragePort` sem banco nem disco, para testar os casos de uso e as rotas. Os
dados usados com eles nos testes são FICTÍCIOS (ADR-012).
"""

import dataclasses
import hashlib

from app.application.ports.file_storage import StoredFile, StoredFileNotFoundError
from app.application.ports.load_chart_activation import LoadChartStatusChangedError
from app.application.ports.load_chart_listing import LoadChartSummary
from app.application.ports.load_chart_repository import (
    ActiveLoadChartConflictError,
    DuplicateLoadChartVersionError,
    LoadChartAlreadyExistsError,
    LoadChartConfigurationNotFoundError,
    LoadChartNotDraftError,
    LoadChartNotFoundError,
    LoadChartSource,
    StoredLoadChart,
)
from app.domain.entities.load_chart import LoadChart, LoadChartStatus


def with_status(chart: LoadChart, status: LoadChartStatus) -> LoadChart:
    return LoadChart(
        id=chart.id,
        version=chart.version,
        configuration_id=chart.configuration_id,
        status=status,
        points=chart.points,
    )


class InMemoryLoadChartStore:
    """`LoadChartRepository` + `LoadChartActivationRepository` + `LoadChartListing` em memória."""

    def __init__(self, configuration_ids: set[str]) -> None:
        self.configuration_ids = configuration_ids
        self.charts: dict[str, StoredLoadChart] = {}
        self.status_changes: list[tuple[str, LoadChartStatus]] = []
        self.activations: list[tuple[str, LoadChartStatus]] = []

    def add(self, chart: LoadChart, source: LoadChartSource) -> None:
        """Grava direto, em qualquer status (montagem do cenário)."""
        self.charts[chart.id] = StoredLoadChart(chart=chart, source=source)

    def save_draft(self, chart: LoadChart, source: LoadChartSource) -> None:
        if chart.status is not LoadChartStatus.DRAFT:
            raise LoadChartNotDraftError(chart.status)
        if chart.id in self.charts:
            raise LoadChartAlreadyExistsError(chart.id)
        if any(
            stored.chart.configuration_id == chart.configuration_id
            and stored.chart.version == chart.version
            for stored in self.charts.values()
        ):
            raise DuplicateLoadChartVersionError(chart.configuration_id, chart.version)
        if chart.configuration_id not in self.configuration_ids:
            raise LoadChartConfigurationNotFoundError(chart.configuration_id)
        self.add(chart, source)

    def change_status(self, load_chart_id: str, new_status: LoadChartStatus) -> None:
        stored = self.charts.get(load_chart_id)
        if stored is None:
            raise LoadChartNotFoundError(load_chart_id)
        if new_status is LoadChartStatus.ACTIVE and self._active_of(
            stored.chart.configuration_id, excluding=load_chart_id
        ):
            raise ActiveLoadChartConflictError(stored.chart.configuration_id)
        self.status_changes.append((load_chart_id, new_status))
        self._set(load_chart_id, new_status)

    def get_by_id(self, load_chart_id: str) -> StoredLoadChart | None:
        return self.charts.get(load_chart_id)

    def activate_superseding_current(
        self, load_chart_id: str, *, expected_status: LoadChartStatus
    ) -> str | None:
        stored = self.charts.get(load_chart_id)
        if stored is None:
            raise LoadChartNotFoundError(load_chart_id)
        if stored.chart.status is not expected_status:
            raise LoadChartStatusChangedError(load_chart_id, expected_status, stored.chart.status)
        self.activations.append((load_chart_id, expected_status))
        previous = self._active_of(stored.chart.configuration_id, excluding=load_chart_id)
        if previous is not None:
            self._set(previous, LoadChartStatus.SUPERSEDED)
        self._set(load_chart_id, LoadChartStatus.ACTIVE)
        return previous

    def list_by_configuration(self, configuration_id: str) -> list[LoadChartSummary]:
        """`LoadChartListing` (TASK-044): na ordem de gravação (a ordem é do caso de uso)."""
        return [
            LoadChartSummary(
                load_chart_id=stored.chart.id,
                version=stored.chart.version,
                configuration_id=stored.chart.configuration_id,
                status=stored.chart.status,
                point_count=len(stored.chart.points),
                source=stored.source,
            )
            for stored in self.charts.values()
            if stored.chart.configuration_id == configuration_id
        ]

    def status_of(self, load_chart_id: str) -> LoadChartStatus:
        return self.charts[load_chart_id].chart.status

    def _active_of(self, configuration_id: str, *, excluding: str) -> str | None:
        for chart_id, stored in self.charts.items():
            if (
                chart_id != excluding
                and stored.chart.configuration_id == configuration_id
                and stored.chart.status is LoadChartStatus.ACTIVE
            ):
                return chart_id
        return None

    def _set(self, load_chart_id: str, status: LoadChartStatus) -> None:
        stored = self.charts[load_chart_id]
        self.charts[load_chart_id] = dataclasses.replace(
            stored, chart=with_status(stored.chart, status)
        )


class InMemoryFileStorage:
    """`FileStoragePort` em memória, endereçado pelo SHA-256."""

    def __init__(self) -> None:
        self.files: dict[str, bytes] = {}
        self.saves = 0

    def save(self, content: bytes) -> StoredFile:
        self.saves += 1
        sha256 = hashlib.sha256(content).hexdigest()
        uri = f"memory://{sha256}"
        self.files.setdefault(uri, content)
        return StoredFile(uri=uri, sha256=sha256, size_bytes=len(content))

    def read(self, uri: str) -> bytes:
        if uri not in self.files:
            raise StoredFileNotFoundError(uri)
        return self.files[uri]
