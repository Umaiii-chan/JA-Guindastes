import { describe, expect, it } from 'vitest'

import { keepLibraryProportions } from '../../../src/application/ai/scenarioDraft'
import type { Obstacle } from '../../../src/domain/environment/environment'
import { findLibraryObject } from '../../../src/domain/environment/objectLibrary'

const base: Obstacle = {
  id: 'ia-obstaculo-1',
  label: 'Carro',
  kind: 'model',
  modelId: 'sedan',
  centerX: 10,
  centerZ: 10,
  widthM: 2,
  depthM: 4.5,
  heightM: 1.5,
  rotationYDeg: 0,
}

describe('keepLibraryProportions', () => {
  it('vehicles keep the real size of the 3D model, whatever the AI wrote', () => {
    const sedan = findLibraryObject('sedan')!
    const fixed = keepLibraryProportions(base)
    expect([fixed.widthM, fixed.depthM, fixed.heightM]).toEqual([
      sedan.baseSize.w,
      sedan.baseSize.d,
      sedan.baseSize.h,
    ])
  })

  it('other library objects get one uniform scale (same proportions as the model)', () => {
    const tree = findLibraryObject('arvore-carvalho')!
    const fixed = keepLibraryProportions({
      ...base,
      modelId: tree.id,
      widthM: 4,
      depthM: 1,
      heightM: 9,
    })
    const sx = fixed.widthM / tree.baseSize.w
    expect(fixed.depthM / tree.baseSize.d).toBeCloseTo(sx)
    expect(fixed.heightM / tree.baseSize.h).toBeCloseTo(sx)
  })

  it('boxes and unknown models are left alone', () => {
    const box: Obstacle = { ...base, kind: 'box', modelId: undefined }
    expect(keepLibraryProportions(box)).toBe(box)
    const unknown = { ...base, modelId: 'nao-existe' }
    expect(keepLibraryProportions(unknown)).toBe(unknown)
  })
})
