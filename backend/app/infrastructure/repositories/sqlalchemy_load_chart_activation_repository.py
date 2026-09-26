"""Troca atômica da tabela `ACTIVE` de uma configuração no PostgreSQL (TASK-031).

Implementa `LoadChartActivationRepository`. Numa única transação:

1. lê a tabela com `SELECT ... FOR UPDATE` e confere o status esperado;
2. marca como `SUPERSEDED` a `ACTIVE` da mesma configuração (um `UPDATE ... WHERE status =
   'ACTIVE'`, que o PostgreSQL reavalia se outra transação mudou a linha no meio do caminho);
3. grava a tabela como `ACTIVE` (depois do passo 2, por causa do índice único parcial de uma
   `ACTIVE` por configuração, que não é adiável).

Se outra ativação concorrente da mesma configuração vencer, o índice único recusa a segunda
`ACTIVE` e o erro vira `ActiveLoadChartConflictError`; a transação inteira é desfeita.
"""

from sqlalchemy import update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from app.application.ports.load_chart_activation import LoadChartStatusChangedError
from app.application.ports.load_chart_repository import (
    ActiveLoadChartConflictError,
    LoadChartNotFoundError,
)
from app.domain.entities.load_chart import LoadChartStatus
from app.infrastructure.database.models.load_chart import (
    ONE_ACTIVE_PER_CONFIGURATION_INDEX,
    LoadChartModel,
)
from app.infrastructure.repositories._integrity import violated_constraint


class SqlAlchemyLoadChartActivationRepository:
    """Implementa `LoadChartActivationRepository`."""

    def __init__(self, session_factory: sessionmaker[Session]) -> None:
        self._session_factory = session_factory

    def activate_superseding_current(
        self, load_chart_id: str, *, expected_status: LoadChartStatus
    ) -> str | None:
        expected = LoadChartStatus(expected_status)
        configuration_id: str | None = None
        try:
            with self._session_factory.begin() as session:
                model = session.get(LoadChartModel, load_chart_id, with_for_update=True)
                if model is None:
                    raise LoadChartNotFoundError(load_chart_id)
                actual = LoadChartStatus(model.status)
                if actual is not expected:
                    raise LoadChartStatusChangedError(load_chart_id, expected, actual)
                configuration_id = model.configuration_id

                superseded_ids = session.scalars(
                    update(LoadChartModel)
                    .where(
                        LoadChartModel.configuration_id == configuration_id,
                        LoadChartModel.status == LoadChartStatus.ACTIVE.value,
                        LoadChartModel.id != load_chart_id,
                    )
                    .values(status=LoadChartStatus.SUPERSEDED.value)
                    .returning(LoadChartModel.id)
                    .execution_options(synchronize_session=False)
                ).all()
                session.flush()

                model.status = LoadChartStatus.ACTIVE.value
                session.flush()
        except IntegrityError as error:
            constraint = violated_constraint(error)
            if constraint == ONE_ACTIVE_PER_CONFIGURATION_INDEX and configuration_id is not None:
                raise ActiveLoadChartConflictError(configuration_id) from error
            raise
        # O índice único garante no máximo uma `ACTIVE` anterior.
        return superseded_ids[0] if superseded_ids else None
