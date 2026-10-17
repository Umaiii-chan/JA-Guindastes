from typing import Protocol

from app.domain.entities.load_chart import LoadChart
from app.domain.value_objects.capacity_query import CapacityQuery
from app.domain.value_objects.capacity_result import CapacityResult


class LoadChartInterpolator(Protocol):
    """Porta da consulta de capacidade numa tabela de carga (doc-fonte §§ 14.1 e 14.4).

    O método de interpolação está pendente (PEND-001), assim como o arredondamento (PEND-002) e o
    uso de valor conservador (PEND-003). Por isso a estratégia fica atrás desta interface e pode ser
    trocada sem mudar os casos de uso.

    Implementações: `ExactPointLookup` (só ponto exato; referência e testes),
    `ConservativeTabulatedLookup` (ADR-015/029, provisória: menor capacidade entre os vizinhos) e
    `LinearInterpolationLookup` (ADR-030, provisória: interpolação linear), que é a estratégia
    ligada na raiz de composição (`app.main`).

    Contrato de toda implementação:
    - devolve `CapacityFound` só quando a tabela suporta a consulta (RN-004);
    - fora do domínio suportado, devolve `CapacityUnsupported` com o motivo, nunca extrapola em
      silêncio (RN-007);
    - nos dois casos, informa o id e a versão da tabela usada (RN-005);
    - não escolhe a tabela nem olha o status dela: isso é da porta `ActiveLoadChartProvider` da
      aplicação (o papel do `LoadChartResolver` da doc-fonte § 14.1).
    """

    def calculate_capacity(self, chart: LoadChart, query: CapacityQuery) -> CapacityResult: ...
