"""Divisão da carga entre dois guindastes no planejamento (tandem; TASK-074 e TASK-075; ADR-037).

O planejamento reaproveita o serviço da TASK-074 (`tandem_load_split`): a mesma alavanca dos
pontos de içamento em relação ao centro de gravidade (CG) e o mesmo limite de 75 % da capacidade
de cada guindaste (RN-016). Aqui só fica a adaptação para o eixo do comprimento da carga, com
posições em metros, e a recusa (em vez do alerta) quando o CG cai fora dos pontos: o planejamento
não recomenda um tandem assim.
"""

from dataclasses import dataclass

from app.domain.services.tandem_load_split import TANDEM_CAPACITY_FACTOR, split_tandem_load

TANDEM_CAPACITY_SHARE = TANDEM_CAPACITY_FACTOR
"""Fração da capacidade de cada guindaste que o tandem pode usar (RN-016; TASK-074)."""

HOIST_POINT_FRACTION = 0.25
"""Os pontos de içamento ficam a 1/4 e 3/4 do comprimento da carga: a 25 % dele, para cada lado do
centro, como na cena (`frontend/src/domain/tandem/tandem.ts`; ADR-037 § 4 e ADR-041)."""


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
    try:
        split = split_tandem_load(
            weight_kg, (cg_position_m, 0.0), (point_a_m, 0.0), (point_b_m, 0.0)
        )
    except ValueError as error:
        raise InvalidTandemGeometryError(str(error)) from error
    if not split.cg_between_points:
        raise InvalidTandemGeometryError("o CG fica fora do segmento entre os pontos de içamento")
    share_a, share_b = split.shares_kg
    return TandemShares(share_a_kg=share_a, share_b_kg=share_b)
