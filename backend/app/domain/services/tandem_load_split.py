"""Divisão da carga entre dois guindastes no içamento em tandem (RN-016; TASK-074; ADR-037).

Serviço puro, sem E/S. Dois pontos de içamento sobre a carga e o centro de gravidade (CG), todos no
plano horizontal. O CG é projetado na reta entre os pontos, e cada guindaste leva a parte que a
alavanca manda: `peso × distância do OUTRO ponto ao CG ÷ distância entre os pontos`. Com o CG no
meio, a divisão é 50 % e 50 %; quanto mais perto de um ponto, mais ele carrega.

Se o CG projetado cai fora do segmento entre os pontos, a alavanca não fecha (um guindaste teria
de puxar para baixo): a parte de um é limitada a 0, a do outro ao peso todo, e `cg_between_points`
vem falso para a aplicação alertar.
"""

import math
from dataclasses import dataclass

TANDEM_CAPACITY_FACTOR = 0.75
"""RN-016: cada guindaste usa, no máximo, 75 % da própria capacidade efetiva."""


@dataclass(frozen=True)
class TandemSplit:
    """Resultado da divisão: a parte de cada ponto, em kg e em fração do peso."""

    shares_kg: tuple[float, float]
    fractions: tuple[float, float]
    cg_between_points: bool


def split_tandem_load(
    weight_kg: float,
    cg: tuple[float, float],
    point_a: tuple[float, float],
    point_b: tuple[float, float],
) -> TandemSplit:
    """Divide `weight_kg` entre os pontos de içamento `point_a` e `point_b` pela alavanca do CG.

    Levanta `ValueError` se o peso for negativo ou não finito, ou se os pontos coincidirem.
    """
    if not math.isfinite(weight_kg) or weight_kg < 0:
        raise ValueError("o peso da carga deve ser finito e não negativo")
    span_x = point_b[0] - point_a[0]
    span_z = point_b[1] - point_a[1]
    span_sq = span_x * span_x + span_z * span_z
    if span_sq <= 0 or not math.isfinite(span_sq):
        raise ValueError("os dois pontos de içamento não podem coincidir")
    # Posição do CG ao longo da reta, de 0 (no ponto A) a 1 (no ponto B).
    t = ((cg[0] - point_a[0]) * span_x + (cg[1] - point_a[1]) * span_z) / span_sq
    between = 0.0 <= t <= 1.0
    t = min(1.0, max(0.0, t))
    # O ponto mais perto do CG carrega mais: A leva (1 - t), B leva t.
    fraction_a = 1.0 - t
    fraction_b = t
    return TandemSplit(
        shares_kg=(weight_kg * fraction_a, weight_kg * fraction_b),
        fractions=(fraction_a, fraction_b),
        cg_between_points=between,
    )
