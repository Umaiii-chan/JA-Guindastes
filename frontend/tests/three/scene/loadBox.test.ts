import { describe, expect, it } from 'vitest'

import {
  computeLoadBox,
  HOOK_ATTACH_OFFSET_M,
  isValidLoad,
  sameLoad,
  slingDropM,
} from '../../../src/three/scene/loadBox'

describe('loadBox', () => {
  it('sem carga ou com medidas inválidas, não há caixa (fica só o gancho)', () => {
    expect(computeLoadBox(null)).toBeNull()
    expect(computeLoadBox(undefined)).toBeNull()
    expect(computeLoadBox({ lengthM: 0, widthM: 1, heightM: 1 })).toBeNull()
    expect(computeLoadBox({ lengthM: 2, widthM: -1, heightM: 1 })).toBeNull()
    expect(computeLoadBox({ lengthM: 2, widthM: 1, heightM: Number.NaN })).toBeNull()
    expect(isValidLoad({ lengthM: 2, widthM: 1, heightM: Number.POSITIVE_INFINITY })).toBe(false)
  })

  it('mapeia as medidas nos eixos locais: largura em X, altura em Y e comprimento em Z', () => {
    const layout = computeLoadBox({ lengthM: 4, widthM: 2, heightM: 1.5 })
    expect(layout?.size).toEqual({ x: 2, y: 1.5, z: 4 })
  })

  it('pendura a caixa abaixo do gancho, com as lingas até os quatro cantos de cima', () => {
    const load = { lengthM: 4, widthM: 2, heightM: 1.5 }
    const layout = computeLoadBox(load)!
    const drop = slingDropM(load)
    const topY = -(HOOK_ATTACH_OFFSET_M + drop)

    expect(drop).toBe(2)
    expect(layout.slingTop).toEqual({ x: 0, y: -HOOK_ATTACH_OFFSET_M, z: 0 })
    expect(layout.center).toEqual({ x: 0, y: topY - 0.75, z: 0 })
    expect(layout.slingBottoms).toHaveLength(4)
    for (const corner of layout.slingBottoms) {
      expect(corner.y).toBe(topY)
      expect(Math.abs(corner.x)).toBe(1)
      expect(Math.abs(corner.z)).toBe(2)
    }
    // Toda a caixa fica abaixo do ponto de suspensão G.
    expect(layout.center.y + layout.size.y / 2).toBeLessThan(0)
  })

  it('usa o ponto de amarração medido no gancho, e o padrão se a medida for inválida', () => {
    const load = { lengthM: 2, widthM: 2, heightM: 1 }

    expect(computeLoadBox(load, 2.4)!.slingTop.y).toBe(-2.4)
    expect(computeLoadBox(load, 2.4)!.slingBottoms[0].y).toBe(-(2.4 + slingDropM(load)))
    expect(computeLoadBox(load, 0)!.slingTop.y).toBe(-HOOK_ATTACH_OFFSET_M)
    expect(computeLoadBox(load, Number.NaN)!.slingTop.y).toBe(-HOOK_ATTACH_OFFSET_M)
  })

  it('limita a altura das lingas entre 0,6 e 3 m', () => {
    expect(slingDropM({ lengthM: 0.4, widthM: 0.4, heightM: 1 })).toBe(0.6)
    expect(slingDropM({ lengthM: 12, widthM: 2, heightM: 1 })).toBe(3)
  })

  it('reconhece medidas iguais em objetos diferentes', () => {
    expect(
      sameLoad({ lengthM: 1, widthM: 2, heightM: 3 }, { lengthM: 1, widthM: 2, heightM: 3 }),
    ).toBe(true)
    expect(
      sameLoad({ lengthM: 1, widthM: 2, heightM: 3 }, { lengthM: 1, widthM: 2, heightM: 4 }),
    ).toBe(false)
    expect(sameLoad(null, undefined)).toBe(true)
    expect(sameLoad(null, { lengthM: 0, widthM: 2, heightM: 3 })).toBe(true)
    expect(sameLoad(null, { lengthM: 1, widthM: 2, heightM: 3 })).toBe(false)
  })
})
