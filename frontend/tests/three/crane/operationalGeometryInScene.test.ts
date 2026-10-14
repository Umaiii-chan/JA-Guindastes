import { type Object3D, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { CraneController } from '../../../src/three/crane/CraneController'
import {
  createProvisionalCrane,
  PROVISIONAL_CRANE_LIMITS,
} from '../../../src/three/crane/createProvisionalCrane'
import type { CraneLimits, CraneState } from '../../../src/three/crane/types'
import { buildCraneScene } from '../../../src/three/scene/buildCraneScene'
import { GEOMETRY_PARITY_CASES } from '../../fixtures/geometryParityCases'
import { expectClose, expectXyzClose, xyz, type Xyz } from '../../helpers/expectClose'

// A imagem bate com o cálculo (ADR-013 C-4, regra 3): o guindaste provisório, montado com os mesmos
// a e h do cálculo, põe os nós da lança (P), da ponta (T) e do gancho (G) nas posições das fórmulas.
// O cálculo não lê os nós (C-7); aqui os nós é que são conferidos contra o cálculo.

/**
 * Tolerância só para o erro de ponto flutuante acumulado nas matrizes de mundo da cena (produto de
 * rotações e translações em cinco níveis). Sub-micrométrica; não é tolerância de engenharia (G-7).
 */
const SCENE_TOLERANCE_M = 1e-6

/**
 * FICTÍCIO: limites largos o bastante para os casos de paridade do backend (L de 10 a 20 m,
 * θ de −30° a 90°, ψ até 270°, c de 0,5 a 5 m). Não são limites de nenhum guindaste real.
 */
const PARITY_LIMITS: CraneLimits = {
  turretRotationDeg: { min: -360, max: 360 },
  boomAngleDeg: { min: -30, max: 90 },
  boomLengthM: { min: 10, max: 30 },
  cableLengthM: { min: 0, max: 40 },
}
const PARITY_DIMENSIONS = { boomRetractedLengthM: 10, boomExtendedLengthM: 30 }

function worldXyz(object: Object3D): Xyz {
  object.updateWorldMatrix(true, false)
  return object.getWorldPosition(new Vector3()).toArray()
}

describe('geometria na cena: nós do guindaste provisório × ADR-013', () => {
  describe('casos de paridade do servidor (valores calculados à mão)', () => {
    it.each(GEOMETRY_PARITY_CASES)('$id', ({ parameters, inputs, expected }) => {
      const rig = createProvisionalCrane(PARITY_DIMENSIONS, parameters)
      const controller = new CraneController(rig, PARITY_LIMITS, parameters, inputs)

      expect(controller.getState()).toEqual(inputs)
      expectXyzClose(worldXyz(rig.boom), xyz(expected.boomPivot), SCENE_TOLERANCE_M, 'P')
      expectXyzClose(worldXyz(rig.boomTip), xyz(expected.boomTip), SCENE_TOLERANCE_M, 'T')
      expectXyzClose(worldXyz(rig.hook), xyz(expected.hook), SCENE_TOLERANCE_M, 'G')
    })
  })

  describe('cena da PoC (buildCraneScene, parâmetros FICTÍCIOS)', () => {
    const { turretRotationDeg: psi, boomAngleDeg: theta } = PROVISIONAL_CRANE_LIMITS
    const { boomLengthM: length, cableLengthM: cable } = PROVISIONAL_CRANE_LIMITS
    const states: CraneState[] = []
    for (const turretRotationDeg of [psi.min, -90, 0, 45, 120, psi.max]) {
      for (const boomAngleDeg of [theta.min, 35, theta.max]) {
        for (const boomLengthM of [length.min, (length.min + length.max) / 2, length.max]) {
          for (const cableLengthM of [cable.min, 5, cable.max]) {
            states.push({ turretRotationDeg, boomAngleDeg, boomLengthM, cableLengthM })
          }
        }
      }
    }

    it(`o gancho, a ponta e a lança ficam em G, T e P em ${states.length} estados dentro dos limites`, () => {
      const { rig, crane } = buildCraneScene()

      for (const state of states) {
        crane.setTurretRotation(state.turretRotationDeg)
        crane.setBoomAngle(state.boomAngleDeg)
        crane.setBoomLength(state.boomLengthM)
        crane.setCableLength(state.cableLengthM)
        const geometry = crane.getOperationalGeometry()
        const label = JSON.stringify(state)

        expectXyzClose(worldXyz(rig.hook), xyz(geometry.hook), SCENE_TOLERANCE_M, `G ${label}`)
        expectXyzClose(
          worldXyz(rig.boomTip),
          xyz(geometry.boomTip),
          SCENE_TOLERANCE_M,
          `T ${label}`,
        )
        expectXyzClose(worldXyz(rig.boom), xyz(geometry.boomPivot), SCENE_TOLERANCE_M, `P ${label}`)
      }
    })

    it('ψ = 0° põe o gancho à frente do chassi (+Z) e ψ = 90° sobre o lado esquerdo (+X)', () => {
      const { rig, crane } = buildCraneScene()

      crane.setTurretRotation(0)
      const [frontX, , frontZ] = worldXyz(rig.hook)
      expectClose(frontX, 0, SCENE_TOLERANCE_M)
      expect(frontZ).toBeGreaterThan(0)

      crane.setTurretRotation(90)
      const [leftX, , leftZ] = worldXyz(rig.hook)
      expect(leftX).toBeGreaterThan(0)
      expectClose(leftZ, 0, SCENE_TOLERANCE_M)
    })

    it.each([
      [0, 30],
      [-120, -60],
      [150, 180],
    ])('girar de %s° para %s° move o gancho no sentido anti-horário visto de cima', (from, to) => {
      // Mesmo critério do backend: componente Y de (antes × depois) no plano XZ, z0·x1 − x0·z1 > 0.
      const { rig, crane } = buildCraneScene()

      crane.setTurretRotation(from)
      const [x0, , z0] = worldXyz(rig.hook)
      crane.setTurretRotation(to)
      const [x1, , z1] = worldXyz(rig.hook)

      expect(z0 * x1 - x0 * z1).toBeGreaterThan(0)
    })
  })
})
