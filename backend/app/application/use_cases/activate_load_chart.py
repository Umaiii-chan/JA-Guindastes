"""Caso de uso `ActivateLoadChart` (TASK-031; doc-fonte § 13.2).

Fluxo sugerido na doc-fonte § 13.2: `DRAFT → VALIDATED → ACTIVE → SUPERSEDED`, ou `INVALID`.

- `DRAFT`: a tabela só é gravada em `DRAFT` depois de passar pela validação da importação sem
  nenhuma inconsistência (`ImportLoadChart`), então ela passa a `VALIDATED` (uma transação) e
  segue para `ACTIVE`. Se a ativação falhar depois disso, a tabela fica em `VALIDATED` (estado
  válido) e pode ser ativada de novo;
- `VALIDATED`: segue direto para `ACTIVE`;
- `VALIDATED → ACTIVE` e `ACTIVE anterior → SUPERSEDED` acontecem **na mesma transação**
  (`LoadChartActivationRepository`). INTERPRETAÇÃO A CONFIRMAR (handoffs/TASK-031.md § 8);
- `INVALID`, `ACTIVE` e `SUPERSEDED` não são ativadas (`LoadChartNotActivatableError`): `INVALID`
  por definição; `ACTIVE` já está ativa; reativar uma `SUPERSEDED` não está no fluxo da § 13.2
  (A CONFIRMAR).
"""

from dataclasses import dataclass

from app.application.ports.load_chart_activation import LoadChartActivationRepository
from app.application.ports.load_chart_repository import (
    LoadChartNotFoundError,
    LoadChartRepository,
    StoredLoadChart,
)
from app.domain.entities.load_chart import LoadChartStatus

ACTIVATABLE_STATUSES = frozenset({LoadChartStatus.DRAFT, LoadChartStatus.VALIDATED})


@dataclass(frozen=True)
class LoadChartActivation:
    """Tabela ativada e o id da que virou `SUPERSEDED` (`None` se não havia `ACTIVE`)."""

    stored: StoredLoadChart
    superseded_load_chart_id: str | None


class LoadChartNotActivatableError(Exception):
    """A tabela está num status que não pode ir para `ACTIVE`."""

    def __init__(self, load_chart_id: str, status: LoadChartStatus) -> None:
        self.load_chart_id = load_chart_id
        self.status = status
        super().__init__(
            f"a tabela de carga {load_chart_id!r} está em {status} e não pode ser ativada; "
            "só tabelas em DRAFT ou VALIDATED podem"
        )


class ActivateLoadChart:
    """Leva uma tabela `DRAFT`/`VALIDATED` a `ACTIVE`, rebaixando a anterior a `SUPERSEDED`."""

    def __init__(
        self, repository: LoadChartRepository, activation: LoadChartActivationRepository
    ) -> None:
        self._repository = repository
        self._activation = activation

    def execute(self, load_chart_id: str) -> LoadChartActivation:
        """Levanta `LoadChartNotFoundError`, `LoadChartNotActivatableError` e, do repositório,
        `LoadChartStatusChangedError` ou `ActiveLoadChartConflictError` (mudança concorrente)."""
        stored = self._repository.get_by_id(load_chart_id)
        if stored is None:
            raise LoadChartNotFoundError(load_chart_id)
        status = stored.chart.status
        if status not in ACTIVATABLE_STATUSES:
            raise LoadChartNotActivatableError(load_chart_id, status)

        if status is LoadChartStatus.DRAFT:
            self._repository.change_status(load_chart_id, LoadChartStatus.VALIDATED)

        superseded = self._activation.activate_superseding_current(
            load_chart_id, expected_status=LoadChartStatus.VALIDATED
        )

        activated = self._repository.get_by_id(load_chart_id)
        if activated is None:
            raise LoadChartNotFoundError(load_chart_id)
        return LoadChartActivation(stored=activated, superseded_load_chart_id=superseded)
