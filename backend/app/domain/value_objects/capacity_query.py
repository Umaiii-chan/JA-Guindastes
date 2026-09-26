from dataclasses import dataclass

from app.domain.value_objects.length import Length


@dataclass(frozen=True)
class CapacityQuery:
    """Valores consultados na tabela de carga, em unidades internas (RN-006).

    Como os pontos da tabela (doc-fonte § 10.2), a consulta inicial usa comprimento de lança e
    raio de trabalho. Como eles são obtidos da geometria do guindaste ainda não está definido
    (known-gaps P-001 e P-002).
    """

    boom_length: Length
    working_radius: Length
