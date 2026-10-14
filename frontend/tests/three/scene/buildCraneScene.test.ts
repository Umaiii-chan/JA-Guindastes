import { DirectionalLight, HemisphereLight, MathUtils, Mesh, ShaderMaterial } from 'three'
import { describe, expect, it } from 'vitest'

import {
  PROVISIONAL_CRANE_GEOMETRY,
  PROVISIONAL_CRANE_INITIAL_STATE,
} from '../../../src/three/crane/createProvisionalCrane'
import { buildCraneScene } from '../../../src/three/scene/buildCraneScene'
import { HOOK_LOAD_NAMES } from '../../../src/three/scene/HookLoad'
import { RADIUS_INDICATOR_NAMES } from '../../../src/three/scene/RadiusIndicator'
import { expectClose } from '../../helpers/expectClose'

describe('buildCraneScene', () => {
  it('adiciona luzes, chão e grade à cena', () => {
    const { scene } = buildCraneScene()

    expect(scene.children.some((child) => child instanceof HemisphereLight)).toBe(true)
    expect(scene.children.some((child) => child instanceof DirectionalLight)).toBe(true)
    const grid = scene.getObjectByName('environment-grid')
    expect(grid).toBeInstanceOf(Mesh)
    expect((grid as Mesh).material).toBeInstanceOf(ShaderMaterial)
    const ground = scene.getObjectByName('environment-ground')
    expect(ground).toBeInstanceOf(Mesh)
    expect(ground?.position.y).toBe(0)
    expect(ground?.rotation.x).toBeCloseTo(-Math.PI / 2)
  })

  it('liga as sombras: o sol projeta, o chão recebe e as peças do guindaste projetam', () => {
    const { scene, rig, environment, hookLoad } = buildCraneScene()

    expect(environment.sun.castShadow).toBe(true)
    // O chão de papel não tem luz: quem recebe a sombra é o plano de sombra logo acima dele.
    expect(scene.getObjectByName('environment-ground-shadow')?.receiveShadow).toBe(true)
    // O halo (transparente) fica pendurado no gancho, mas não é peça do guindaste nem faz sombra.
    const halo = hookLoad.root.getObjectByName(HOOK_LOAD_NAMES.halo) as Mesh
    expect(halo.castShadow).toBe(false)
    const craneMeshes: Mesh[] = []
    rig.base.traverse((object) => {
      if (object instanceof Mesh && object !== halo) craneMeshes.push(object)
    })
    expect(craneMeshes.length).toBeGreaterThan(0)
    expect(craneMeshes.every((mesh) => mesh.castShadow)).toBe(true)
  })

  it('adiciona o anel de raio no raio da pose inicial e o halo no gancho', () => {
    const { scene, rig, crane, radiusIndicator } = buildCraneScene()

    expect(scene.getObjectByName(RADIUS_INDICATOR_NAMES.ring)?.visible).toBe(true)
    expect(radiusIndicator.currentRadiusM).toBe(crane.getOperationalGeometry().workingRadiusM)
    expect(rig.hook.getObjectByName(HOOK_LOAD_NAMES.halo)).toBeInstanceOf(Mesh)
  })

  it('o anel e a carga não mudam a geometria operacional', () => {
    const before = buildCraneScene().crane.getOperationalGeometry()
    const { crane, hookLoad, radiusIndicator } = buildCraneScene()

    hookLoad.setLoad({ lengthM: 4, widthM: 2, heightM: 1.5 })
    hookLoad.setStatus('over')
    radiusIndicator.setStatus('over')

    expect(crane.getOperationalGeometry()).toEqual(before)
  })

  it('adiciona o guindaste provisório na origem da cena', () => {
    const { craneAnchor, rig } = buildCraneScene()

    expect(rig.base.parent).toBe(craneAnchor)
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
    // Pose inicial (ψ 0°, θ 35°, L 12 m, c 5 m), a = −1,56 m, h = 3,3 m; valores de referência
    // conferidos com awk, 6 casas: R = −1,56 + 12·cos 35° = 8,269825; y_T = 3,3 + 12·sin 35° =
    // 10,182917; y_G = y_T − 5 = 5,182917 (são os números do teste manual da tarefa, § 7).
    const geometry = crane.getOperationalGeometry()
    expectClose(geometry.workingRadiusM!, 8.269825, 1e-6)
    expectClose(geometry.tipHeightM, 10.182917, 1e-6)
    expectClose(geometry.hookHeightM, 5.182917, 1e-6)
  })
})
