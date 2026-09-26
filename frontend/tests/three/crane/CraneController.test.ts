import { MathUtils, Object3D, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { CraneController, type CraneRig } from '../../../src/three/crane/CraneController'
import type { CraneLimits } from '../../../src/three/crane/types'

// FICTÍCIO: limites só para testar o mecanismo de clamp; não são de nenhum guindaste real.
const LIMITS: CraneLimits = {
  turretRotationDeg: { min: -90, max: 90 },
  boomAngleDeg: { min: 0, max: 75 },
  boomLengthM: { min: 10, max: 25 },
  cableLengthM: { min: 1, max: 20 },
}
const RETRACTED_M = 10

/** Rig mínimo com a mesma hierarquia e pose de repouso do guindaste provisório, sem malhas. */
function makeRig(): CraneRig {
  const base = new Object3D()
  const turret = new Object3D()
  const boom = new Object3D()
  const boomExtension = new Object3D()
  const boomTip = new Object3D()
  const cable = new Object3D()
  const cableLine = new Object3D()
  const hook = new Object3D()
  turret.position.set(0, 1.5, 0)
  boom.position.set(0, 1, -1)
  boomTip.position.set(0, 0, RETRACTED_M)
  base.add(turret)
  turret.add(boom)
  boom.add(boomExtension)
  boomExtension.add(boomTip)
  boomTip.add(cable)
  cable.add(cableLine)
  cable.add(hook)
  return {
    base,
    turret,
    boom,
    boomExtension,
    boomTip,
    cable,
    cableLine,
    hook,
    boomRetractedLengthM: RETRACTED_M,
  }
}

function worldPosition(object: Object3D): Vector3 {
  object.updateWorldMatrix(true, false)
  return object.getWorldPosition(new Vector3())
}

describe('CraneController (limites FICTÍCIOS)', () => {
  describe('construção', () => {
    it('aplica o estado inicial informado nos nós', () => {
      const rig = makeRig()
      new CraneController(rig, LIMITS, {
        turretRotationDeg: 30,
        boomAngleDeg: 40,
        boomLengthM: 15,
        cableLengthM: 6,
      })

      expect(rig.turret.rotation.y).toBeCloseTo(MathUtils.degToRad(30))
      expect(rig.boom.rotation.x).toBeCloseTo(-MathUtils.degToRad(40))
      expect(rig.boomExtension.position.z).toBeCloseTo(5)
      expect(rig.cableLine.scale.y).toBeCloseTo(6)
      expect(rig.hook.position.y).toBeCloseTo(-6)
    })

    it('sem estado inicial, usa o valor permitido mais próximo de zero em cada comando', () => {
      const controller = new CraneController(makeRig(), LIMITS)

      expect(controller.getState()).toEqual({
        turretRotationDeg: 0,
        boomAngleDeg: 0,
        boomLengthM: 10,
        cableLengthM: 1,
      })
    })

    it('limita o estado inicial aos limites', () => {
      const controller = new CraneController(makeRig(), LIMITS, {
        turretRotationDeg: -400,
        boomAngleDeg: 100,
        boomLengthM: 99,
        cableLengthM: 0,
      })

      expect(controller.getState()).toEqual({
        turretRotationDeg: -90,
        boomAngleDeg: 75,
        boomLengthM: 25,
        cableLengthM: 1,
      })
    })

    it.each(Object.keys(LIMITS) as (keyof CraneLimits)[])(
      'rejeita faixa de %s com mínimo maior que o máximo',
      (key) => {
        const limits = { ...LIMITS, [key]: { min: 30, max: 20 } }

        expect(() => new CraneController(makeRig(), limits)).toThrow(RangeError)
      },
    )

    it.each([NaN, Infinity, -Infinity])('rejeita limite não finito (%s)', (value) => {
      const limits = { ...LIMITS, boomAngleDeg: { min: 0, max: value } }

      expect(() => new CraneController(makeRig(), limits)).toThrow(RangeError)
    })

    it('rejeita comprimento mínimo de cabo negativo', () => {
      const limits = { ...LIMITS, cableLengthM: { min: -1, max: 20 } }

      expect(() => new CraneController(makeRig(), limits)).toThrow(RangeError)
    })

    it('rejeita comprimento mínimo de lança menor que a lança recolhida do modelo', () => {
      const limits = { ...LIMITS, boomLengthM: { min: RETRACTED_M - 1, max: 25 } }

      expect(() => new CraneController(makeRig(), limits)).toThrow(RangeError)
    })

    it('guarda uma cópia congelada dos limites', () => {
      const limits = { ...LIMITS, cableLengthM: { min: 1, max: 20 } }
      const controller = new CraneController(makeRig(), limits)

      ;(limits.cableLengthM as { max: number }).max = 5

      expect(controller.limits.cableLengthM.max).toBe(20)
      expect(Object.isFrozen(controller.limits)).toBe(true)
      expect(Object.isFrozen(controller.limits.cableLengthM)).toBe(true)
    })
  })

  describe('setTurretRotation', () => {
    it('gira só a torre, em torno do eixo Y, convertendo graus em radianos', () => {
      const rig = makeRig()
      const controller = new CraneController(rig, LIMITS)

      const applied = controller.setTurretRotation(45)

      expect(applied).toBe(45)
      expect(rig.turret.rotation.y).toBeCloseTo(Math.PI / 4)
      expect(rig.turret.rotation.x).toBe(0)
      expect(rig.turret.rotation.z).toBe(0)
      expect(rig.boom.rotation.x).toBeCloseTo(0)
      expect(controller.getState().turretRotationDeg).toBe(45)
    })

    it.each([
      [120, 90],
      [-120, -90],
    ])('limita %s° a %s°', (input, expected) => {
      const rig = makeRig()
      const controller = new CraneController(rig, LIMITS)

      expect(controller.setTurretRotation(input)).toBe(expected)
      expect(rig.turret.rotation.y).toBeCloseTo(MathUtils.degToRad(expected))
    })
  })

  describe('setBoomAngle', () => {
    it('inclina a lança em torno do seu eixo X e levanta a ponta', () => {
      const rig = makeRig()
      const controller = new CraneController(rig, LIMITS)
      const tipHeightAtZero = worldPosition(rig.boomTip).y

      expect(controller.setBoomAngle(30)).toBe(30)

      expect(rig.boom.rotation.x).toBeCloseTo(-MathUtils.degToRad(30))
      expect(rig.boom.rotation.y).toBe(0)
      expect(rig.turret.rotation.y).toBe(0)
      expect(worldPosition(rig.boomTip).y).toBeGreaterThan(tipHeightAtZero)
    })

    it('mantém o cabo na vertical, com o gancho logo abaixo da ponta', () => {
      const rig = makeRig()
      const controller = new CraneController(rig, LIMITS, { cableLengthM: 8 })

      controller.setTurretRotation(30)
      controller.setBoomAngle(60)
      const tip = worldPosition(rig.boomTip)
      const hook = worldPosition(rig.hook)

      expect(hook.x).toBeCloseTo(tip.x)
      expect(hook.z).toBeCloseTo(tip.z)
      expect(tip.y - hook.y).toBeCloseTo(8)
    })

    it.each([
      [90, 75],
      [-10, 0],
    ])('limita %s° a %s°', (input, expected) => {
      const rig = makeRig()
      const controller = new CraneController(rig, LIMITS)

      expect(controller.setBoomAngle(input)).toBe(expected)
      expect(rig.boom.rotation.x).toBeCloseTo(-MathUtils.degToRad(expected))
    })
  })

  describe('setBoomLength', () => {
    it('desliza a extensão ao longo do Z da lança, e a ponta acompanha', () => {
      const rig = makeRig()
      const controller = new CraneController(rig, LIMITS)

      expect(controller.setBoomLength(18)).toBe(18)

      expect(rig.boomExtension.position.z).toBeCloseTo(8)
      expect(rig.boomExtension.position.x).toBe(0)
      expect(rig.boomExtension.position.y).toBe(0)
      expect(worldPosition(rig.boomTip).distanceTo(worldPosition(rig.boom))).toBeCloseTo(18)
    })

    it.each([
      [30, 25],
      [5, 10],
    ])('limita %s m a %s m', (input, expected) => {
      const rig = makeRig()
      const controller = new CraneController(rig, LIMITS)

      expect(controller.setBoomLength(input)).toBe(expected)
      expect(rig.boomExtension.position.z).toBeCloseTo(expected - RETRACTED_M)
    })
  })

  describe('setCableLength', () => {
    it('estica a linha do cabo no Y e leva o gancho até a ponta do cabo', () => {
      const rig = makeRig()
      const controller = new CraneController(rig, LIMITS)

      expect(controller.setCableLength(7)).toBe(7)

      expect(rig.cableLine.scale.y).toBeCloseTo(7)
      expect(rig.cableLine.scale.x).toBe(1)
      expect(rig.cableLine.scale.z).toBe(1)
      expect(rig.hook.position.y).toBeCloseTo(-7)
    })

    it.each([
      [50, 20],
      [0, 1],
    ])('limita %s m a %s m', (input, expected) => {
      const rig = makeRig()
      const controller = new CraneController(rig, LIMITS)

      expect(controller.setCableLength(input)).toBe(expected)
      expect(rig.cableLine.scale.y).toBeCloseTo(expected)
      expect(rig.hook.position.y).toBeCloseTo(-expected)
    })
  })

  describe('entradas inválidas', () => {
    const commands = [
      'setTurretRotation',
      'setBoomAngle',
      'setBoomLength',
      'setCableLength',
    ] as const
    const cases = commands.flatMap((command) =>
      [NaN, Infinity, -Infinity].map((value) => ({ command, value })),
    )

    it.each(cases)(
      '$command($value) lança RangeError e não muda o estado',
      ({ command, value }) => {
        const controller = new CraneController(makeRig(), LIMITS, { boomAngleDeg: 20 })
        const before = controller.getState()

        expect(() => controller[command](value)).toThrow(RangeError)
        expect(controller.getState()).toEqual(before)
      },
    )
  })
})
