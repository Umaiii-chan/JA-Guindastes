// Área de vento da carga enviada à avaliação (TASK-106; RN-017). FICTÍCIO.

import { describe, expect, it } from 'vitest'

import { LOAD_DRAG_COEFFICIENT, loadWindAreaM2 } from '../../../src/application/load/loadWindArea'

describe('loadWindAreaM2', () => {
  it('usa a maior face lateral vezes o coeficiente de arrasto', () => {
    // 4 m × 1,5 m de face (a maior entre 4 e 2) × 1,2 = 7,2 m²
    expect(loadWindAreaM2({ lengthM: 4, widthM: 2, heightM: 1.5 })).toBeCloseTo(7.2, 10)
    expect(loadWindAreaM2({ lengthM: 2, widthM: 4, heightM: 1.5 })).toBeCloseTo(7.2, 10)
  })

  it('o coeficiente é o da caixa de cantos vivos', () => {
    expect(LOAD_DRAG_COEFFICIENT).toBe(1.2)
  })
})
