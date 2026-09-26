import { DirectionalLight, GridHelper, HemisphereLight, MathUtils, Mesh } from 'three'
import { describe, expect, it } from 'vitest'

import {
  PROVISIONAL_CRANE_GEOMETRY,
  PROVISIONAL_CRANE_INITIAL_STATE,
} from '../../../src/three/crane/createProvisionalCrane'
import { buildCraneScene } from '../../../src/three/scene/buildCraneScene'
import { expectClose } from '../../helpers/expectClose'

describe('buildCraneScene', () => {
  it('adiciona luzes, chão e grade à cena', () => {
    const { scene } = buildCraneScene()

    expect(scene.children.some((child) => child instanceof HemisphereLight)).toBe(true)
    expect(scene.children.some((child) => child instanceof DirectionalLight)).toBe(true)
    expect(scene.getObjectByName('environment-grid')).toBeInstanceOf(GridHelper)
    const ground = scene.getObjectByName('environment-ground')
    expect(ground).toBeInstanceOf(Mesh)
    expect(ground?.position.y).toBe(0)
    expect(ground?.rotation.x).toBeCloseTo(-Math.PI / 2)
  })

  it('adiciona o guindaste provisório na origem da cena', () => {
    const { scene, rig } = buildCraneScene()

    expect(rig.base.parent).toBe(scene)
    expect(rig.base.position.toArray()).toEqual([0, 0, 0])
  })

  it('liga o controller ao guindaste da cena, na pose inicial FICTÍCIA', () => {
    const { rig, crane } = buildCraneScene()

    expect(crane.getState()).toEqual(PROVISIONAL_CRANE_INITIAL_STATE)
    expect(rig.boom.rotation.x).toBeCloseTo(
      -MathUtils.degToRad(PROVISIONAL_CRANE_INITIAL_STATE.boomAngleDeg),
    )

    crane.setTurretRotation(90)

    expect(rig.turret.rotation.y).toBeCloseTo(Math.PI / 2)
  })

  it('calcula a pré-visualização com os parâmetros geométricos FICTÍCIOS do guindaste provisório', () => {
    const { crane } = buildCraneScene()

    expect(crane.geometryParameters).toEqual(PROVISIONAL_CRANE_GEOMETRY)
    // Pose inicial (ψ 0°, θ 35°, L 12 m, c 5 m), a = −1,2 m, h = 3,3 m; valores de referência
    // conferidos com awk, 6 casas: R = −1,2 + 12·cos 35° = 8,629825; y_T = 3,3 + 12·sin 35° =
    // 10,182917; y_G = y_T − 5 = 5,182917 (são os números do teste manual da tarefa, § 7).
    const geometry = crane.getOperationalGeometry()
    expectClose(geometry.workingRadiusM!, 8.629825, 1e-6)
    expectClose(geometry.tipHeightM, 10.182917, 1e-6)
    expectClose(geometry.hookHeightM, 5.182917, 1e-6)
  })
})
