"""Resultado da consulta conservadora provisória (ADR-015; TASK-020).

`ConservativeCapacityFound` é uma subclasse de `CapacityFound`: cumpre a porta
`LoadChartInterpolator` e continua cabendo no `CapacityResult`, então quem já consome o resultado
(o `EvaluateOperation`, por exemplo) não muda. A mais, informa o que o ADR-015 (item 4) exige para
que nenhuma tela apresente o valor como definitivo: o raio consultado, o ponto tabelado de onde veio
a capacidade e a marca de estratégia provisória conservadora.

É um tipo novo, e não campos novos no `CapacityFound`, para não mudar o resultado da
`ExactPointLookup` nem o contrato já testado (TASK-008, TASK-015).
"""

from dataclasses import dataclass
from enum import StrEnum

from app.domain.entities.load_chart_point import LoadChartPoint
from app.domain.value_objects.capacity_query import CapacityQuery
from app.domain.value_objects.capacity_result import CapacityFound
from app.domain.value_objects.length import Length


class CapacityLookupStrategy(StrEnum):
    """Estratégia que produziu a capacidade, legível por máquina."""

    CONSERVATIVE_PROVISIONAL = "CONSERVATIVE_PROVISIONAL"
    """Consulta conservadora provisória do ADR-015, até a empresa responder PEND-001 e PEND-003."""
    LINEAR_INTERPOLATION_PROVISIONAL = "LINEAR_INTERPOLATION_PROVISIONAL"
    """Interpolação linear provisória entre pontos da tabela (ADR-030), decisão de 2026-10-14."""


@dataclass(frozen=True)
class ConservativeCapacityFound(CapacityFound):
    """Capacidade da consulta conservadora provisória, com o ponto tabelado usado (ADR-015).

    - `query`: comprimento de lança e raio consultados, como vieram (o raio consultado é
      `queried_radius`).
    - `used_point`: o ponto da tabela de onde veio a capacidade (comprimento, raio e capacidade).
      Com o raio igual (±ε) a um raio tabelado, é esse ponto; com o raio entre dois raios
      tabelados, é o vizinho de menor capacidade.
    - `strategy`: sempre `CONSERVATIVE_PROVISIONAL`; o valor não é definitivo.

    Invariante (RN-004): `max_capacity` é a capacidade de `used_point`.
    """

    query: CapacityQuery
    used_point: LoadChartPoint
    strategy: CapacityLookupStrategy = CapacityLookupStrategy.CONSERVATIVE_PROVISIONAL

    def __post_init__(self) -> None:
        if self.max_capacity != self.used_point.max_capacity:
            raise ValueError(
                "a capacidade do resultado deve ser a do ponto tabelado usado (RN-004): "
                f"{self.max_capacity!r} != {self.used_point.max_capacity!r}"
            )
        if not isinstance(self.strategy, CapacityLookupStrategy):
            raise ValueError(f"estratégia inválida: {self.strategy!r}")

    @property
    def queried_radius(self) -> Length:
        """Raio consultado (em geral, o calculado pela geometria do ADR-013)."""
        return self.query.working_radius
