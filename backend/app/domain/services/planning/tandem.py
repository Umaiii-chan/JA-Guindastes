"""Divisão da carga entre dois guindastes (tandem; TASK-074 e TASK-075; ADR-037).

A divisão é pela alavanca dos pontos de içamento em relação ao centro de gravidade (CG), medidos ao
longo do comprimento da carga: o guindaste mais perto do CG leva mais peso. Cada guindaste fica
com no máximo 75 % da capacidade dele (`TANDEM_CAPACITY_SHARE`). Cálculo local, igual ao contrato
da TASK-074 (`POST /evaluations/tandem`), para o planejamento não depender de a rota existir.
"""

from dataclasses import dataclass

TANDEM_CAPACITY_SHARE = 0.75
"""Fração da capacidade de cada guindaste que o tandem pode usar (contrato da TASK-074)."""

HOIST_POINT_FRACTION = 0.4
"""Os pontos de içamento ficam a 40 % do comprimento da carga, para cada lado do centro."""


class InvalidTandemGeometryError(ValueError):
    """O CG está fora do segmento entre os dois pontos de içamento (um guindaste ficaria com carga
    negativa) ou os pontos coincidem."""


@dataclass(frozen=True, slots=True)
class TandemShares:
    share_a_kg: float
    share_b_kg: float


def split_load_by_cg(
    weight_kg: float, cg_position_m: float, point_a_m: float, point_b_m: float
) -> TandemShares:
    """Divide `weight_kg` pela alavanca: `a = W·(b − cg)/(b − a)` e `b = W − a`.

    Posições em metros ao longo do comprimento da carga. Com o CG no meio, 50 % para cada um.
    """
    span = point_b_m - point_a_m
    if abs(span) < 1e-9:
        raise InvalidTandemGeometryError("os dois pontos de içamento coincidem")
    share_a = weight_kg * (point_b_m - cg_position_m) / span
    share_b = weight_kg - share_a
    if share_a < -1e-9 or share_b < -1e-9:
        raise InvalidTandemGeometryError("o CG fica fora do segmento entre os pontos de içamento")
    return TandemShares(share_a_kg=max(0.0, share_a), share_b_kg=max(0.0, share_b))
