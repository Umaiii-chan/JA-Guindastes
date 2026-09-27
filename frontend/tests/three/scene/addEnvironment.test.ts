import {
  Color,
  DirectionalLight,
  Mesh,
  MeshBasicMaterial,
  Scene,
  ShaderMaterial,
  ShadowMaterial,
  Vector3,
} from 'three'
import { describe, expect, it } from 'vitest'

import {
  addEnvironment,
  atmosphereRange,
  GRID_MAJOR_SPACING_M,
  GRID_MINOR_SPACING_M,
  GROUND_SHADOW_OPACITY,
} from '../../../src/three/scene/addEnvironment'
import { PAPER_INK, SCENE_COLORS } from '../../../src/three/scene/palette'

describe('addEnvironment', () => {
  it('papel milimetrado: linhas de 1 m na cor das linhas, de 5 m mais fortes e eixos em tinta', () => {
    const scene = new Scene()
    const { grid } = addEnvironment(scene)

    const material = grid.material as ShaderMaterial
    expect(material).toBeInstanceOf(ShaderMaterial)
    expect(GRID_MINOR_SPACING_M).toBe(1)
    expect(GRID_MAJOR_SPACING_M).toBe(5)
    expect(material.uniforms.minorSpacing.value).toBe(1)
    expect(material.uniforms.majorSpacing.value).toBe(5)
    expect((material.uniforms.minorColor.value as Color).getHex()).toBe(PAPER_INK.line)
    expect((material.uniforms.axisColor.value as Color).getHex()).toBe(PAPER_INK.inkSecondary)
    // A linha de 5 m é mais escura (mais forte) que a de 1 m.
    const luminance = (color: Color) => color.r + color.g + color.b
    expect(luminance(material.uniforms.majorColor.value as Color)).toBeLessThan(
      luminance(material.uniforms.minorColor.value as Color),
    )
    expect(material.transparent).toBe(true)
    expect(grid.position.y).toBeGreaterThanOrEqual(0)
    expect(grid.position.y).toBeLessThan(0.01)
  })

  it('fundo e chão no mesmo papel, sem céu nem névoa', () => {
    const scene = new Scene()
    const { ground } = addEnvironment(scene)

    expect((scene.background as Color).getHex()).toBe(PAPER_INK.paper)
    expect(scene.fog).toBeNull()
    expect(scene.getObjectByName('environment-sky')).toBeUndefined()
    const material = ground.material as MeshBasicMaterial
    // Sem luz e sem tone mapping: a cor sai exatamente a do fundo, sem emenda no horizonte.
    expect(material).toBeInstanceOf(MeshBasicMaterial)
    expect(material.toneMapped).toBe(false)
    expect(material.color.getHex()).toBe(SCENE_COLORS.background)
  })

  it('luz neutra com sombra discreta, num plano que só recebe a sombra', () => {
    const scene = new Scene()
    const { sun, groundShadow } = addEnvironment(scene)

    expect(sun.castShadow).toBe(true)
    expect(sun.color.getHex()).toBe(0xffffff)
    expect(sun.shadow.mapSize.x).toBe(2048)
    expect(sun.shadow.radius).toBeGreaterThan(1)
    expect(groundShadow.receiveShadow).toBe(true)
    const shadow = groundShadow.material as ShadowMaterial
    expect(shadow).toBeInstanceOf(ShadowMaterial)
    expect(shadow.opacity).toBe(GROUND_SHADOW_OPACITY)
    expect(GROUND_SHADOW_OPACITY).toBeLessThanOrEqual(0.2)
    // Nenhuma luz colorida (a luz de recorte azul do tema escuro saiu).
    const lights: DirectionalLight[] = []
    scene.traverse((object) => {
      if (object instanceof DirectionalLight) lights.push(object)
    })
    for (const light of lights) expect(light.color.getHex()).toBe(0xffffff)
    expect(scene.getObjectByName('environment-ground')).toBeInstanceOf(Mesh)
  })

  it('o esmaecimento da grade acompanha a distância da câmera', () => {
    const near = atmosphereRange(20)
    const far = atmosphereRange(120)
    expect(far.gridFadeFarM).toBeGreaterThan(near.gridFadeFarM)
    expect(far.gridFadeNearM).toBeGreaterThan(near.gridFadeNearM)
    expect(near.gridFadeNearM).toBeLessThan(near.gridFadeFarM)
    // O alvo da órbita fica sempre antes do fim do esmaecimento.
    expect(far.gridFadeFarM).toBeGreaterThan(120)
  })

  it('update põe a grade sob a câmera e ajusta o esmaecimento', () => {
    const scene = new Scene()
    const environment = addEnvironment(scene)

    environment.update(new Vector3(5, 6, 7), 80)

    expect(environment.grid.position.x).toBe(5)
    expect(environment.grid.position.z).toBe(7)
    expect(environment.grid.position.y).toBeLessThan(0.01)
    const range = atmosphereRange(80)
    const uniforms = (environment.grid.material as ShaderMaterial).uniforms
    expect(uniforms.fadeNear.value).toBe(range.gridFadeNearM)
    expect(uniforms.fadeFar.value).toBe(range.gridFadeFarM)
  })

  it('fitShadowToReach cobre o alcance máximo com folga', () => {
    const scene = new Scene()
    const { sun, fitShadowToReach } = addEnvironment(scene)

    fitShadowToReach(30)

    expect(sun.shadow.camera.right).toBeGreaterThan(30)
    expect(sun.shadow.camera.left).toBe(-sun.shadow.camera.right)
  })
})
