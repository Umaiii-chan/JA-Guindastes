from dataclasses import dataclass

from app.domain.value_objects.length import Length


@dataclass(frozen=True)
class CapacityQuery:
    """Valores consultados na tabela de carga, em unidades internas (RN-006).

    Como os pontos da tabela (doc-fonte § 10.2), a consulta inicial usa comprimento de lança e
    raio de trabalho. O raio vem da geometria operacional do ADR-013; o tratamento de comprimentos
    entre colunas da tabela continua pendente (PEND-001; ADR-013).
    """

    boom_length: Length
    working_radius: Length
