import { describe, expect, it } from 'vitest'

import { CraneController } from '../../../src/three/crane/CraneController'
import {
  CRANE_NODE_NAMES,
  createProvisionalCrane,
  PROVISIONAL_CRANE_DIMENSIONS,
  PROVISIONAL_CRANE_INITIAL_STATE,
  PROVISIONAL_CRANE_LIMITS,
} from '../../../src/three/crane/createProvisionalCrane'

describe('createProvisionalCrane (guindaste provisório, medidas FICTÍCIAS)', () => {
  it('monta a hierarquia base → torre → lança → extensão → ponta → cabo → gancho', () => {
    const rig = createProvisionalCrane()

    expect(rig.base.parent).toBeNull()
    expect(rig.turret.parent).toBe(rig.base)
    expect(rig.boom.parent).toBe(rig.turret)
    expect(rig.boomExtension.parent).toBe(rig.boom)
    expect(rig.boomTip.parent).toBe(rig.boomExtension)
    expect(rig.cable.parent).toBe(rig.boomTip)
    expect(rig.cableLine.parent).toBe(rig.cable)
    expect(rig.hook.parent).toBe(rig.cable)
  })

  it('dá a cada nó um nome estável, encontrável a partir da base', () => {
    const rig = createProvisionalCrane()

    for (const [key, name] of Object.entries(CRANE_NODE_NAMES)) {
      expect(rig.base.getObjectByName(name), name).toBe(rig[key as keyof typeof CRANE_NODE_NAMES])
    }
  })

  it('põe a ponta no fim da lança recolhida', () => {
    const rig = createProvisionalCrane({ boomRetractedLengthM: 8, boomExtendedLengthM: 14 })

    expect(rig.boomRetractedLengthM).toBe(8)
    expect(rig.boomTip.position.z).toBe(8)
    expect(rig.boomExtension.position.z).toBe(0)
  })

  it.each([
    { boomRetractedLengthM: 0, boomExtendedLengthM: 10 },
    { boomRetractedLengthM: 12, boomExtendedLengthM: 11 },
    { boomRetractedLengthM: NaN, boomExtendedLengthM: 10 },
  ])('rejeita dimensões inválidas da lança %o', (dimensions) => {
    expect(() => createProvisionalCrane(dimensions)).toThrow(RangeError)
  })

  it('os limites FICTÍCIOS da lança coincidem com as dimensões do modelo', () => {
    expect(PROVISIONAL_CRANE_LIMITS.boomLengthM).toEqual({
      min: PROVISIONAL_CRANE_DIMENSIONS.boomRetractedLengthM,
      max: PROVISIONAL_CRANE_DIMENSIONS.boomExtendedLengthM,
    })
  })

  it('é controlável pelo CraneController com os limites e a pose inicial FICTÍCIOS', () => {
    const controller = new CraneController(
      createProvisionalCrane(),
      PROVISIONAL_CRANE_LIMITS,
      PROVISIONAL_CRANE_INITIAL_STATE,
    )

    expect(controller.getState()).toEqual(PROVISIONAL_CRANE_INITIAL_STATE)
  })
})
