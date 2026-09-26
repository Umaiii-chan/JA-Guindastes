from dataclasses import dataclass

from app.domain.exceptions.domain_errors import InvalidLoadChartError
from app.domain.value_objects.length import Length
from app.domain.value_objects.mass import Mass


@dataclass(frozen=True)
class LoadChartPoint:
    """Ponto discreto de uma tabela de carga (doc-fonte § 10.2).

    Modelado inicialmente por comprimento de lança, raio de trabalho e capacidade máxima; a
    estrutura real das tabelas pode exigir mais campos (PEND-008). A capacidade não negativa
    (doc-fonte § 13.1) é garantida por `Mass`.

    O que é "comprimento de lança" (lança telescópica) e de onde se mede o raio ainda não está
    definido (known-gaps P-001 e P-002); aqui são só os valores da tabela, em metros.
    """

    boom_length: Length
    working_radius: Length
    max_capacity: Mass

    def __post_init__(self) -> None:
        if not isinstance(self.boom_length, Length):
            raise InvalidLoadChartError("boom_length deve ser Length")
        if not isinstance(self.working_radius, Length):
            raise InvalidLoadChartError("working_radius deve ser Length")
        if not isinstance(self.max_capacity, Mass):
            raise InvalidLoadChartError("max_capacity deve ser Mass")
