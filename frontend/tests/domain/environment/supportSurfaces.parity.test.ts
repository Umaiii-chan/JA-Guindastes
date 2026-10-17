// Paridade das superfícies de apoio com o backend (TASK-108; ADR-052). O dourado
// `backend/tests/fixtures/support_surfaces.golden.json` é conferido por este teste (contra a biblioteca do
// frontend) e por `test_support_surfaces.py` (contra `LOAD_SUPPORTS` do planejador): se um lado muda um
// número sem o outro, um dos dois quebra.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { OBJECT_LIBRARY } from '../../../src/domain/environment/objectLibrary'

interface GoldenSupport {
  readonly baseSize: readonly number[]
  readonly loadBed: readonly number[]
  readonly collision: readonly (readonly number[])[]
  readonly capacityKg: number | null
}

const golden = JSON.parse(
  readFileSync(
    resolve(__dirname, '../../../../backend/tests/fixtures/support_surfaces.golden.json'),
    'utf-8',
  ),
) as { supports: Record<string, GoldenSupport> }

// Ordem do dourado: [x, z, y, largura, profundidade, altura].
const asArray = (box: { x: number; z: number; y: number; w: number; d: number; h: number }) => [
  box.x,
  box.z,
  box.y,
  box.w,
  box.d,
  box.h,
]

describe('superfícies de apoio: frontend = backend', () => {
  const declared = OBJECT_LIBRARY.filter((object) => object.loadBed !== undefined)

  it('os mesmos objetos declaram apoio nos dois lados', () => {
    expect(declared.map((object) => object.id).sort()).toEqual(Object.keys(golden.supports).sort())
  })

  it.each(declared.map((object) => [object.id, object] as const))(
    '%s: tamanho, caixas, apoio e capacidade iguais ao dourado',
    (id, object) => {
      const expected = golden.supports[id]!
      expect([object.baseSize.w, object.baseSize.d, object.baseSize.h]).toEqual(expected.baseSize)
      expect(object.collision.map(asArray)).toEqual(expected.collision)
      expect(asArray(object.loadBed!)).toEqual(expected.loadBed)
      expect(object.loadBedInfo?.capacityKg ?? null).toBe(expected.capacityKg)
    },
  )

  it('todo apoio é uma das caixas de colisão (o topo dele é a altura de apoio)', () => {
    for (const object of declared) {
      expect(object.collision.map(asArray), object.id).toContainEqual(asArray(object.loadBed!))
    }
  })

  it('sem dado de capacidade o apoio diz que é FICTÍCIO', () => {
    for (const object of declared) {
      if (object.loadBedInfo?.capacityKg === undefined) {
        expect(object.loadBedInfo?.source, object.id).toMatch(/^FICTÍCIO/)
      }
    }
  })
})
