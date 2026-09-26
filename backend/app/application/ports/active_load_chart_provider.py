"""Porta da tabela de carga ativa de uma configuração (doc-fonte § 14.1, `LoadChartResolver`).

A tabela pertence à configuração (RN-001), e a capacidade só pode vir dela (RN-004). Selecionar,
entre as versões guardadas, a que está `ACTIVE` é papel do adapter (persistência, TASK-011). As
transições de status (doc-fonte § 13.2) e o "modo técnico de validação" ainda não estão definidos,
então a porta só conhece a tabela `ACTIVE`.
"""

from typing import Protocol

from app.domain.entities.load_chart import LoadChart


class ActiveLoadChartProvider(Protocol):
    """Fornece a tabela de carga `ACTIVE` de uma configuração do guindaste.

    Contrato de toda implementação:
    - devolve a `LoadChart` com `status` `ACTIVE` e `configuration_id` igual ao pedido;
    - devolve `None` quando a configuração não tem tabela ativa, sem levantar exceção por isso;
    - não consulta capacidade nem olha o estado operacional: isso é do `LoadChartInterpolator`.
    """

    def get_active_load_chart(self, configuration_id: str) -> LoadChart | None: ...
