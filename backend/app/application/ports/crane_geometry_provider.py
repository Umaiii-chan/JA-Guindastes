"""Porta da ficha técnica geométrica de uma configuração (ADR-013 C-4; doc-fonte § 14.1).

A ficha técnica (`CraneGeometry`) é cadastrada no backend e nunca lida do GLB (RN-003). Onde ela
fica no modelo (atributos de `CraneKinematics`, entidade própria ou parte de `CraneConfiguration`) e
se varia por configuração (ADR-013, G-2) ainda não foi decidido. Por isso a porta recebe só o
`configuration_id`: o adapter decide se a ficha vem do guindaste ou da configuração.
"""

from typing import Protocol

from app.domain.value_objects.crane_geometry import CraneGeometry


class CraneGeometryProvider(Protocol):
    """Fornece a ficha técnica geométrica que vale para uma configuração do guindaste.

    Contrato de toda implementação:
    - devolve a `CraneGeometry` aplicável à configuração `configuration_id`;
    - devolve `None` quando não há ficha técnica para ela (configuração desconhecida ou ficha não
      cadastrada), sem levantar exceção por isso;
    - nunca monta a ficha a partir do modelo 3D (RN-003).
    """

    def get_crane_geometry(self, configuration_id: str) -> CraneGeometry | None: ...
