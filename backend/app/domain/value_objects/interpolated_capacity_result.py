"""Resultado da consulta por interpolação linear provisória (ADR-030; TASK-059).

Como o `ConservativeCapacityFound`, é uma subclasse de `CapacityFound`: quem consome a porta
`LoadChartInterpolator` não muda. Informa os pontos da tabela usados, para a tela mostrar de onde
veio o valor e que ele é interpolado, não um ponto da tabela.
"""

from dataclasses import dataclass

from app.domain.entities.load_chart_point import LoadChartPoint
from app.domain.value_objects.capacity_query import CapacityQuery
from app.domain.value_objects.capacity_result import CapacityFound
from app.domain.value_objects.conservative_capacity_result import CapacityLookupStrategy
from app.domain.value_objects.length import Length

_TOLERANCE_KG = 1e-9


@dataclass(frozen=True)
class InterpolatedCapacityFound(CapacityFound):
    """Capacidade interpolada entre pontos da tabela (ADR-030; ADR-043).

    - `query`: comprimento de lança e raio consultados.
    - `points`: os pontos tabelados usados (1 ou 2), todos da mesma coluna de lança (ADR-043), em
      ordem de raio.
    - `strategy`: sempre `LINEAR_INTERPOLATION_PROVISIONAL`.

    Invariante: a capacidade fica entre a menor e a maior capacidade dos pontos usados.
    """

    query: CapacityQuery
    points: tuple[LoadChartPoint, ...]
    strategy: CapacityLookupStrategy = CapacityLookupStrategy.LINEAR_INTERPOLATION_PROVISIONAL

    def __post_init__(self) -> None:
        if not self.points:
            raise ValueError("a interpolação precisa de ao menos um ponto da tabela")
        capacities = [point.max_capacity.kilograms for point in self.points]
        value = self.max_capacity.kilograms
        if not min(capacities) - _TOLERANCE_KG <= value <= max(capacities) + _TOLERANCE_KG:
            raise ValueError(
                "a capacidade interpolada deve ficar entre as capacidades dos pontos usados: "
                f"{value!r} fora de [{min(capacities)!r}, {max(capacities)!r}]"
            )

    @property
    def queried_radius(self) -> Length:
        return self.query.working_radius

    @property
    def lowest_point(self) -> LoadChartPoint:
        """O ponto usado de menor capacidade (compatível com `used_point` do contrato)."""
        return min(self.points, key=lambda point: point.max_capacity.kilograms)
