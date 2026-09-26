"""Resultado da consulta de capacidade (`CapacityResult`, doc-fonte § 14.4).

É uma união de dois tipos para que a capacidade só exista quando a tabela a suporta: quem recebe um
`CapacityUnsupported` não tem de onde ler um número, e o mypy obriga a tratar os dois casos. Os
dois trazem o id e a versão da tabela usada (RN-005).
"""

from dataclasses import dataclass
from enum import StrEnum

from app.domain.value_objects.mass import Mass


class CapacityUnsupportedReason(StrEnum):
    """Motivo, legível por máquina, de uma consulta sem capacidade (RN-007).

    A mensagem mostrada ao usuário ainda não está definida (doc-fonte § 26, pergunta 9).
    """

    POINT_NOT_IN_CHART = "POINT_NOT_IN_CHART"
    """A combinação consultada não é um ponto da tabela, e a estratégia usada não interpola."""
    BOOM_LENGTH_NOT_IN_CHART = "BOOM_LENGTH_NOT_IN_CHART"
    """O comprimento de lança não coincide (±ε) com nenhum comprimento da tabela (ADR-015)."""
    RADIUS_BELOW_CHART_MIN = "RADIUS_BELOW_CHART_MIN"
    """O raio fica abaixo do menor raio tabelado do comprimento consultado, além de ε (ADR-015)."""
    RADIUS_ABOVE_CHART_MAX = "RADIUS_ABOVE_CHART_MAX"
    """O raio fica acima do maior raio tabelado do comprimento consultado, além de ε (ADR-015)."""


@dataclass(frozen=True)
class CapacityFound:
    """A tabela suporta a consulta: `max_capacity` é a capacidade admissível dela (RN-004)."""

    max_capacity: Mass
    load_chart_id: str
    load_chart_version: str


@dataclass(frozen=True)
class CapacityUnsupported:
    """Consulta fora do domínio suportado: não há capacidade, só o motivo (RN-007)."""

    reason: CapacityUnsupportedReason
    load_chart_id: str
    load_chart_version: str


type CapacityResult = CapacityFound | CapacityUnsupported
