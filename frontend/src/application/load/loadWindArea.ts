// Área de vento da carga `A_W` enviada à avaliação (TASK-106; RN-017; EN 13000).

/**
 * Coeficiente de arrasto de uma caixa de cantos vivos (FICTÍCIO até haver coeficiente por tipo de
 * carga): `A_W` = área projetada × `c_D`.
 */
export const LOAD_DRAG_COEFFICIENT = 1.2

/**
 * Área de vento da carga, em m²: a MAIOR face lateral (o vento pode vir de qualquer lado) × o
 * coeficiente de arrasto. É só a entrada do backend: quem calcula `v_max` é ele (EN 13000).
 */
export function loadWindAreaM2(load: {
  readonly lengthM: number
  readonly widthM: number
  readonly heightM: number
}): number {
  return Math.max(load.lengthM, load.widthM) * load.heightM * LOAD_DRAG_COEFFICIENT
}
