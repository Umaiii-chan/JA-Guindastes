"""Porta dos limites do modelo de guindaste de uma configuração (RN-011; TASK-051; ADR-022).

A avaliação precisa do limite de capacidade do **modelo** a que a configuração pertence. Porta
mínima, à parte das outras, para não obrigar os provedores existentes a mudar.
"""

from typing import Protocol

from app.domain.value_objects.crane_limits import CraneLimits


class CraneLimitsProvider(Protocol):
    """Fornece os limites do guindaste dono da configuração.

    Devolve `None` quando a configuração não existe, sem levantar exceção por isso (a avaliação
    usa os limites padrão).
    """

    def get_crane_limits(self, configuration_id: str) -> CraneLimits | None: ...
