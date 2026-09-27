"""Porta da troca atômica da tabela `ACTIVE` de uma configuração (TASK-031; doc-fonte § 13.2).

A `LoadChartRepository.change_status` troca o status de uma tabela por vez, em transações
separadas, e recusa a segunda `ACTIVE` da configuração. Ativar uma tabela nova precisa marcar a
`ACTIVE` anterior como `SUPERSEDED` **na mesma transação**, para a configuração nunca ficar sem
tabela ativa no meio do caminho nem com duas. Esta porta faz só essa troca; a regra de quais
tabelas podem ser ativadas fica no caso de uso `ActivateLoadChart`.

INTERPRETAÇÃO A CONFIRMAR (handoffs/TASK-031.md § 8): "a anterior vira `SUPERSEDED` ao ativar a
nova" vem do fluxo `ACTIVE → SUPERSEDED` sugerido na doc-fonte § 13.2, não de uma regra escrita.
"""

from typing import Protocol

from app.application.ports.load_chart_repository import LoadChartRepositoryError
from app.domain.entities.load_chart import LoadChartStatus


class LoadChartStatusChangedError(LoadChartRepositoryError):
    """A tabela não estava no status esperado ao ativar (mudou entre a leitura e a gravação)."""

    def __init__(
        self, load_chart_id: str, expected: LoadChartStatus, actual: LoadChartStatus
    ) -> None:
        self.load_chart_id = load_chart_id
        self.expected = expected
        self.actual = actual
        super().__init__(
            f"a tabela de carga {load_chart_id!r} deveria estar em {expected} para ser ativada, "
            f"mas está em {actual}"
        )


class LoadChartActivationRepository(Protocol):
    """Ativa uma tabela e rebaixa a `ACTIVE` anterior da mesma configuração, numa transação.

    Contrato de toda implementação, em `activate_superseding_current`:
    - tudo ou nada, numa única transação;
    - a tabela `load_chart_id` precisa estar em `expected_status`, conferido dentro da transação;
      senão levanta `LoadChartStatusChangedError` e não muda nada;
    - a tabela `ACTIVE` da mesma configuração **e da mesma zona de giro** (ADR-018; zona `None`
      com `None`), se houver e se não for a própria, passa a `SUPERSEDED`, e `load_chart_id` passa
      a `ACTIVE`; as tabelas ativas das outras zonas não mudam;
    - devolve o id da tabela que virou `SUPERSEDED`, ou `None` se não havia `ACTIVE`;
    - levanta `LoadChartNotFoundError` se a tabela não existe e `ActiveLoadChartConflictError` se,
      mesmo assim, a configuração acabaria com duas `ACTIVE` na mesma zona (ex.: outra ativação
      concorrente).
    """

    def activate_superseding_current(
        self, load_chart_id: str, *, expected_status: LoadChartStatus
    ) -> str | None: ...
