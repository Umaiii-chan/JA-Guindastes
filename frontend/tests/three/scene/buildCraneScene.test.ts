import { DirectionalLight, GridHelper, HemisphereLight, MathUtils, Mesh } from 'three'
import { describe, expect, it } from 'vitest'

import { PROVISIONAL_CRANE_INITIAL_STATE } from '../../../src/three/crane/createProvisionalCrane'
import { buildCraneScene } from '../../../src/three/scene/buildCraneScene'

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
})
