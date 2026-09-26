import { MathUtils, Object3D, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import {
  calculateOperationalGeometry,
  type CraneGeometryParameters,
} from '../../../src/domain/geometry/operationalGeometry'
import { CraneController, type CraneRig } from '../../../src/three/crane/CraneController'
import type { CraneLimits } from '../../../src/three/crane/types'
import { expectClose, expectXyzClose, xyz } from '../../helpers/expectClose'

// FICTÍCIO: limites só para testar o mecanismo de clamp; não são de nenhum guindaste real.
const LIMITS: CraneLimits = {
  turretRotationDeg: { min: -90, max: 90 },
  boomAngleDeg: { min: 0, max: 75 },
  boomLengthM: { min: 10, max: 25 },
  cableLengthM: { min: 1, max: 20 },
}
const RETRACTED_M = 10
/** FICTÍCIO: a e h coerentes com `makeRig` (pino em z = −1 e y = 1,5 + 1 = 2,5). */
const GEOMETRY: CraneGeometryParameters = { boomPivotOffsetM: -1, boomPivotHeightM: 2.5 }
/** Só erro de ponto flutuante: as fórmulas e os valores esperados são exatos. */
const TOLERANCE_M = 1e-9
/** Erro de ponto flutuante acumulado nas matrizes de mundo da cena (sub-micrométrico). */
const SCENE_TOLERANCE_M = 1e-6

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
      new CraneController(rig, LIMITS, GEOMETRY, {
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
      const controller = new CraneController(makeRig(), LIMITS, GEOMETRY)

      expect(controller.getState()).toEqual({
        turretRotationDeg: 0,
        boomAngleDeg: 0,
        boomLengthM: 10,
        cableLengthM: 1,
      })
    })

    it('limita o estado inicial aos limites', () => {
      const controller = new CraneController(makeRig(), LIMITS, GEOMETRY, {
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

        expect(() => new CraneController(makeRig(), limits, GEOMETRY)).toThrow(RangeError)
      },
    )

    it.each([NaN, Infinity, -Infinity])('rejeita limite não finito (%s)', (value) => {
      const limits = { ...LIMITS, boomAngleDeg: { min: 0, max: value } }

      expect(() => new CraneController(makeRig(), limits, GEOMETRY)).toThrow(RangeError)
    })

    it('rejeita comprimento mínimo de cabo negativo', () => {
      const limits = { ...LIMITS, cableLengthM: { min: -1, max: 20 } }

      expect(() => new CraneController(makeRig(), limits, GEOMETRY)).toThrow(RangeError)
    })

    it('rejeita comprimento mínimo de lança menor que a lança recolhida do modelo', () => {
      const limits = { ...LIMITS, boomLengthM: { min: RETRACTED_M - 1, max: 25 } }

      expect(() => new CraneController(makeRig(), limits, GEOMETRY)).toThrow(RangeError)
    })

    it('guarda uma cópia congelada dos limites', () => {
      const limits = { ...LIMITS, cableLengthM: { min: 1, max: 20 } }
      const controller = new CraneController(makeRig(), limits, GEOMETRY)

      ;(limits.cableLengthM as { max: number }).max = 5

      expect(controller.limits.cableLengthM.max).toBe(20)
      expect(Object.isFrozen(controller.limits)).toBe(true)
      expect(Object.isFrozen(controller.limits.cableLengthM)).toBe(true)
    })

    it.each([
      { boomPivotOffsetM: NaN, boomPivotHeightM: 2.5 },
      { boomPivotOffsetM: -1, boomPivotHeightM: Infinity },
      { boomPivotOffsetM: -1, boomPivotHeightM: -0.5 },
    ])('rejeita parâmetros geométricos inválidos %o', (geometry) => {
      expect(() => new CraneController(makeRig(), LIMITS, geometry)).toThrow(RangeError)
    })

    it('guarda uma cópia congelada dos parâmetros geométricos', () => {
      const geometry = { ...GEOMETRY }
      const controller = new CraneController(makeRig(), LIMITS, geometry)

      geometry.boomPivotHeightM = 99

      expect(controller.geometryParameters).toEqual(GEOMETRY)
      expect(Object.isFrozen(controller.geometryParameters)).toBe(true)
    })
  })

  describe('getOperationalGeometry (pré-visualização, ADR-013 C-5)', () => {
    it('calcula a geometria do estado atual pelas fórmulas do ADR-013', () => {
      // a = −1; h = 2,5; L = 20; θ = 60°; ψ = 90°; c = 5 →
      // R = −1 + 20·(1/2) = 9; y_T = 2,5 + 20·(√3/2) = 2,5 + 10√3; y_G = y_T − 5;
      // P = (−1, 2,5, 0); T = (9, y_T, 0); G = (9, y_G, 0).
      const controller = new CraneController(makeRig(), LIMITS, GEOMETRY, {
        turretRotationDeg: 90,
        boomAngleDeg: 60,
        boomLengthM: 20,
        cableLengthM: 5,
      })
      const tipHeight = 2.5 + 10 * Math.sqrt(3)

      const geometry = controller.getOperationalGeometry()

      expectClose(geometry.workingRadiusM!, 9, TOLERANCE_M)
      expectClose(geometry.tipHeightM, tipHeight, TOLERANCE_M)
      expectClose(geometry.hookHeightM, tipHeight - 5, TOLERANCE_M)
      expectXyzClose(xyz(geometry.boomPivot), [-1, 2.5, 0], TOLERANCE_M)
      expectXyzClose(xyz(geometry.boomTip), [9, tipHeight, 0], TOLERANCE_M)
      expectXyzClose(xyz(geometry.hook), [9, tipHeight - 5, 0], TOLERANCE_M)
    })

    it('acompanha cada comando aplicado', () => {
      const controller = new CraneController(makeRig(), LIMITS, GEOMETRY)
      // Estado inicial (0°, 0°, 10 m, 1 m): R = −1 + 10 = 9; y_T = 2,5; y_G = 1,5.
      expectClose(controller.getOperationalGeometry().workingRadiusM!, 9, TOLERANCE_M)
      expectClose(controller.getOperationalGeometry().hookHeightM, 1.5, TOLERANCE_M)

      // θ = 30°: R = −1 + 10·(√3/2) = −1 + 5√3; y_T = 2,5 + 5 = 7,5.
      controller.setBoomAngle(30)
      expectClose(
        controller.getOperationalGeometry().workingRadiusM!,
        -1 + 5 * Math.sqrt(3),
        TOLERANCE_M,
      )
      expectClose(controller.getOperationalGeometry().tipHeightM, 7.5, TOLERANCE_M)

      // L = 20 m: R = −1 + 10√3; y_T = 2,5 + 10 = 12,5.
      controller.setBoomLength(20)
      expectClose(
        controller.getOperationalGeometry().workingRadiusM!,
        -1 + 10 * Math.sqrt(3),
        TOLERANCE_M,
      )
      expectClose(controller.getOperationalGeometry().tipHeightM, 12.5, TOLERANCE_M)

      // c = 4 m: só a altura do gancho muda, y_G = 12,5 − 4 = 8,5.
      controller.setCableLength(4)
      expectClose(controller.getOperationalGeometry().hookHeightM, 8.5, TOLERANCE_M)

      // ψ = 90°: o raio não muda; o gancho vai para o lado +X.
      controller.setTurretRotation(90)
      const geometry = controller.getOperationalGeometry()
      expectClose(geometry.workingRadiusM!, -1 + 10 * Math.sqrt(3), TOLERANCE_M)
      expectXyzClose(xyz(geometry.hook), [-1 + 10 * Math.sqrt(3), 8.5, 0], TOLERANCE_M)
    })

    it('usa o valor já limitado pelos limites, e não o pedido', () => {
      const controller = new CraneController(makeRig(), LIMITS, GEOMETRY)

      controller.setBoomAngle(120)

      expect(controller.getOperationalGeometry()).toEqual(
        calculateOperationalGeometry({ ...controller.getState(), boomAngleDeg: 75 }, GEOMETRY),
      )
    })

    it('põe o nó do gancho da cena no G calculado', () => {
      const rig = makeRig()
      const controller = new CraneController(rig, LIMITS, GEOMETRY, {
        turretRotationDeg: -37,
        boomAngleDeg: 52,
        boomLengthM: 17.3,
        cableLengthM: 6.4,
      })

      const { hook, boomTip, boomPivot } = controller.getOperationalGeometry()

      expectXyzClose(worldPosition(rig.hook).toArray(), xyz(hook), SCENE_TOLERANCE_M, 'G')
      expectXyzClose(worldPosition(rig.boomTip).toArray(), xyz(boomTip), SCENE_TOLERANCE_M, 'T')
      expectXyzClose(worldPosition(rig.boom).toArray(), xyz(boomPivot), SCENE_TOLERANCE_M, 'P')
    })
  })

  describe('setTurretRotation', () => {
    it('gira só a torre, em torno do eixo Y, convertendo graus em radianos', () => {
      const rig = makeRig()
      const controller = new CraneController(rig, LIMITS, GEOMETRY)

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
      const controller = new CraneController(rig, LIMITS, GEOMETRY)

      expect(controller.setTurretRotation(input)).toBe(expected)
      expect(rig.turret.rotation.y).toBeCloseTo(MathUtils.degToRad(expected))
    })
  })

  describe('setBoomAngle', () => {
    it('inclina a lança em torno do seu eixo X e levanta a ponta', () => {
      const rig = makeRig()
      const controller = new CraneController(rig, LIMITS, GEOMETRY)
      const tipHeightAtZero = worldPosition(rig.boomTip).y

      expect(controller.setBoomAngle(30)).toBe(30)

      expect(rig.boom.rotation.x).toBeCloseTo(-MathUtils.degToRad(30))
      expect(rig.boom.rotation.y).toBe(0)
      expect(rig.turret.rotation.y).toBe(0)
      expect(worldPosition(rig.boomTip).y).toBeGreaterThan(tipHeightAtZero)
    })

    it('mantém o cabo na vertical, com o gancho logo abaixo da ponta', () => {
      const rig = makeRig()
      const controller = new CraneController(rig, LIMITS, GEOMETRY, { cableLengthM: 8 })

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
      const controller = new CraneController(rig, LIMITS, GEOMETRY)

      expect(controller.setBoomAngle(input)).toBe(expected)
      expect(rig.boom.rotation.x).toBeCloseTo(-MathUtils.degToRad(expected))
    })
  })

  describe('setBoomLength', () => {
    it('desliza a extensão ao longo do Z da lança, e a ponta acompanha', () => {
      const rig = makeRig()
      const controller = new CraneController(rig, LIMITS, GEOMETRY)

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
      const controller = new CraneController(rig, LIMITS, GEOMETRY)

      expect(controller.setBoomLength(input)).toBe(expected)
      expect(rig.boomExtension.position.z).toBeCloseTo(expected - RETRACTED_M)
    })
  })

  describe('setCableLength', () => {
    it('estica a linha do cabo no Y e leva o gancho até a ponta do cabo', () => {
      const rig = makeRig()
      const controller = new CraneController(rig, LIMITS, GEOMETRY)

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
      const controller = new CraneController(rig, LIMITS, GEOMETRY)

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
        const controller = new CraneController(makeRig(), LIMITS, GEOMETRY, { boomAngleDeg: 20 })
        const before = controller.getState()

        expect(() => controller[command](value)).toThrow(RangeError)
        expect(controller.getState()).toEqual(before)
      },
    )
  })
})
