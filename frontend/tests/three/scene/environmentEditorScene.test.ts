// Cena do editor do ambiente (TASK-066): o guindaste acompanha o terreno, o solo e o vento aparecem.

import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { EMPTY_SCENARIO, type ScenarioSpec } from '../../../src/domain/environment/environment'
import { buildCraneScene } from '../../../src/three/scene/buildCraneScene'
import { WIND_ARROW_NAME } from '../../../src/three/scene/WindArrow'

const SLOPE: ScenarioSpec = {
  ...EMPTY_SCENARIO,
  terrain: { slopeXPercent: 10, slopeZPercent: 0, features: [] },
  crane: { x: 20, z: 0, headingDeg: 0 },
}

function tiltDeg(contents: ReturnType<typeof buildCraneScene>): number {
  const up = new Vector3(0, 1, 0).applyQuaternion(contents.craneAnchor.quaternion)
  return (Math.acos(Math.min(1, up.y)) * 180) / Math.PI
}

describe('cenário no editor 3D', () => {
  it('assenta o guindaste no terreno e inclina; os macacos tiram a inclinação', () => {
    const contents = buildCraneScene()
    contents.setScenario(SLOPE)
    expect(contents.craneAnchor.position.y).toBeCloseTo(2, 6)
    const tilted = tiltDeg(contents)
    expect(tilted).toBeGreaterThan(5)

    contents.setLevelingDeg(3)
    expect(tiltDeg(contents)).toBeCloseTo(tilted - 3, 3)
    contents.setLevelingDeg(30)
    expect(tiltDeg(contents)).toBeCloseTo(0, 6)
  })

  it('esculpir um morro sob o guindaste o faz subir', () => {
    const contents = buildCraneScene()
    contents.setScenario(EMPTY_SCENARIO)
    expect(contents.craneAnchor.position.y).toBe(0)
    contents.setScenario({
      ...EMPTY_SCENARIO,
      terrain: {
        ...EMPTY_SCENARIO.terrain,
        features: [{ id: 'm', kind: 'mound', centerX: 0, centerZ: 0, radiusM: 8, heightM: 2 }],
      },
    })
    expect(contents.craneAnchor.position.y).toBeCloseTo(2, 6)
  })

  it('desenha as zonas de solo e a seta do vento só quando existem', () => {
    const contents = buildCraneScene()
    contents.setScenario({
      ...EMPTY_SCENARIO,
      soilZones: [{ id: 's', kind: 'clay', centerX: 4, centerZ: 4, radiusM: 3 }],
      wind: { speedMs: 10, directionDeg: 90 },
    })
    expect(contents.soil.count).toBe(1)
    const arrow = contents.scene.getObjectByName(WIND_ARROW_NAME)
    expect(arrow?.visible).toBe(true)

    contents.setScenario(EMPTY_SCENARIO)
    expect(contents.soil.count).toBe(0)
    expect(arrow?.visible).toBe(false)
  })
})
