import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { CraneController } from '../../../src/three/crane/CraneController'
import {
  CRANE_NODE_NAMES,
  createProvisionalCrane,
  PROVISIONAL_CRANE_DIMENSIONS,
  PROVISIONAL_CRANE_GEOMETRY,
  PROVISIONAL_CRANE_INITIAL_STATE,
  PROVISIONAL_CRANE_LIMITS,
} from '../../../src/three/crane/createProvisionalCrane'
import { expectXyzClose } from '../../helpers/expectClose'

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

  it('é controlável pelo CraneController com os limites, a geometria e a pose inicial FICTÍCIOS', () => {
    const controller = new CraneController(
      createProvisionalCrane(),
      PROVISIONAL_CRANE_LIMITS,
      PROVISIONAL_CRANE_GEOMETRY,
      PROVISIONAL_CRANE_INITIAL_STATE,
    )

    expect(controller.getState()).toEqual(PROVISIONAL_CRANE_INITIAL_STATE)
    expect(controller.geometryParameters).toEqual(PROVISIONAL_CRANE_GEOMETRY)
  })

  it.each([
    PROVISIONAL_CRANE_GEOMETRY,
    { boomPivotOffsetM: 1.5, boomPivotHeightM: 2.5 },
    { boomPivotOffsetM: 0, boomPivotHeightM: 0 },
  ])('põe o pino da lança em (0, h, a) da base, na pose de repouso: %o', (geometry) => {
    const rig = createProvisionalCrane(PROVISIONAL_CRANE_DIMENSIONS, geometry)

    rig.base.updateWorldMatrix(true, true)
    const pivot = rig.boom.getWorldPosition(new Vector3())

    expectXyzClose(pivot.toArray(), [0, geometry.boomPivotHeightM, geometry.boomPivotOffsetM], 1e-9)
  })

  it.each([
    { boomPivotOffsetM: NaN, boomPivotHeightM: 3 },
    { boomPivotOffsetM: 0, boomPivotHeightM: -1 },
  ])('rejeita parâmetros geométricos inválidos %o', (geometry) => {
    expect(() => createProvisionalCrane(PROVISIONAL_CRANE_DIMENSIONS, geometry)).toThrow(RangeError)
  })

  it('os parâmetros geométricos FICTÍCIOS são os do guindaste provisório (a = −1,2 m; h = 3,3 m)', () => {
    expect(PROVISIONAL_CRANE_GEOMETRY).toEqual({ boomPivotOffsetM: -1.2, boomPivotHeightM: 3.3 })
  })
})
