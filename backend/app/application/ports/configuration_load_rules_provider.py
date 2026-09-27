"""Porta das regras de carga de uma configuração: zonas de giro e gancho (ADR-018; TASK-046).

A avaliação precisa saber, além da ficha técnica (`CraneGeometryProvider`) e da tabela ativa
(`ActiveLoadChartProvider`):

- as **zonas de giro** da configuração, para escolher a tabela pelo giro ψ (ADR-018 § 1);
- o **peso do gancho** que a tabela considera, para comparar carga + gancho com a capacidade
  (ADR-018 § 2).

Fica numa porta à parte para não obrigar os provedores de ficha técnica que já existem a mudar.
"""

from dataclasses import dataclass
from typing import Protocol

from app.domain.value_objects.mass import Mass
from app.domain.value_objects.rotation_zone import RotationZones


@dataclass(frozen=True)
class ConfigurationLoadRules:
    """Zonas de giro (ou `None`: uma tabela para todo o giro) e peso do gancho (`None` = 0 kg)."""

    rotation_zones: RotationZones | None = None
    hook_block_weight: Mass | None = None

    def __post_init__(self) -> None:
        if self.rotation_zones is not None and not isinstance(self.rotation_zones, RotationZones):
            raise ValueError(f"rotation_zones inválido: {self.rotation_zones!r}")
        if self.hook_block_weight is not None and not isinstance(self.hook_block_weight, Mass):
            raise ValueError(
                f"hook_block_weight deve ser Mass, recebido {self.hook_block_weight!r}"
            )


class ConfigurationLoadRulesProvider(Protocol):
    """Fornece as zonas de giro e o peso do gancho de uma configuração.

    Contrato de toda implementação:
    - devolve as regras cadastradas na configuração `configuration_id`;
    - devolve `None` quando a configuração não existe, sem levantar exceção por isso (a avaliação
      trata como "sem zonas e sem gancho").
    """

    def get_load_rules(self, configuration_id: str) -> ConfigurationLoadRules | None: ...
