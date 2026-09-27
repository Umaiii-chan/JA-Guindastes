import { Fog, Mesh, Scene, ShaderMaterial, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import {
  addEnvironment,
  atmosphereRange,
  GRID_MAJOR_SPACING_M,
  GRID_MINOR_SPACING_M,
} from '../../../src/three/scene/addEnvironment'

describe('addEnvironment', () => {
  it('grade técnica com linhas secundárias a cada 1 m e principais a cada 5 m', () => {
    const scene = new Scene()
    const { grid } = addEnvironment(scene)

    const material = grid.material as ShaderMaterial
    expect(material).toBeInstanceOf(ShaderMaterial)
    expect(GRID_MINOR_SPACING_M).toBe(1)
    expect(GRID_MAJOR_SPACING_M).toBe(5)
    expect(material.uniforms.minorSpacing.value).toBe(1)
    expect(material.uniforms.majorSpacing.value).toBe(5)
    expect(material.transparent).toBe(true)
    expect(grid.position.y).toBeGreaterThanOrEqual(0)
    expect(grid.position.y).toBeLessThan(0.01)
  })

  it('céu escuro com névoa da cor do horizonte e sombras suaves do sol', () => {
    const scene = new Scene()
    const { sun, sky } = addEnvironment(scene)

    expect(scene.fog).toBeInstanceOf(Fog)
    const horizon = (sky.material as ShaderMaterial).uniforms.horizonColor.value
    expect((scene.fog as Fog).color.equals(horizon)).toBe(true)
    // Escuro: luminância baixa no horizonte.
    expect(horizon.r + horizon.g + horizon.b).toBeLessThan(0.3)
    expect(sun.castShadow).toBe(true)
    expect(sun.shadow.mapSize.x).toBe(2048)
    expect(sun.shadow.radius).toBeGreaterThan(1)
    expect(scene.getObjectByName('environment-ground')).toBeInstanceOf(Mesh)
  })

  it('a névoa e o esmaecimento da grade acompanham a distância da câmera', () => {
    const near = atmosphereRange(20)
    const far = atmosphereRange(120)
    expect(far.fogNearM).toBeGreaterThan(near.fogNearM)
    expect(far.gridFadeFarM).toBeGreaterThan(near.gridFadeFarM)
    expect(near.gridFadeNearM).toBeLessThan(near.gridFadeFarM)
    expect(near.fogNearM).toBeLessThan(near.fogFarM)
    // O alvo da órbita fica sempre antes do início da névoa.
    expect(far.fogNearM).toBeGreaterThan(120)
  })

  it('update põe o céu na câmera e ajusta névoa e grade', () => {
    const scene = new Scene()
    const environment = addEnvironment(scene)

    environment.update(new Vector3(5, 6, 7), 80)

    expect(environment.sky.position.toArray()).toEqual([5, 6, 7])
    const range = atmosphereRange(80)
    expect((scene.fog as Fog).near).toBe(range.fogNearM)
    expect((environment.grid.material as ShaderMaterial).uniforms.fadeFar.value).toBe(
      range.gridFadeFarM,
    )
  })

  it('fitShadowToReach cobre o alcance máximo com folga', () => {
    const scene = new Scene()
    const { sun, fitShadowToReach } = addEnvironment(scene)

    fitShadowToReach(30)

    expect(sun.shadow.camera.right).toBeGreaterThan(30)
    expect(sun.shadow.camera.left).toBe(-sun.shadow.camera.right)
  })
})
