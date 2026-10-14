import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from 'three'
import { describe, expect, it, vi } from 'vitest'

import { RETRACTED_OUTRIGGERS } from '../../../src/domain/crane/outriggers'
import {
  FICTITIOUS_MAX_LEVELING_DEG,
  OUTRIGGER_POSITIONS,
  OutriggerController,
  outriggerNodeName,
} from '../../../src/three/crane/OutriggerController'

// FICTÍCIO: nós de teste com o nome do contrato; não representam o modelo 3D real.
function buildRoot(): Group {
  const root = new Group()
  for (const position of OUTRIGGER_POSITIONS) {
    const x = position.endsWith('l') ? 0.8 : -0.8
    const z = position.startsWith('f') ? 2 : -2
    for (const [part, y, height] of [
      ['beam', 1, 0.2],
      ['jack', 0.8, 0.4],
      ['pad', 0.5, 0.2],
    ] as const) {
      const mesh = new Mesh(new BoxGeometry(0.2, height, 0.2), new MeshBasicMaterial())
      mesh.name = outriggerNodeName(position, part)
      mesh.position.set(x, y, z)
      root.add(mesh)
    }
  }
  return root
}

let clockMs = 1000

/** Avança o relógio simulado em quadros de 50 ms. */
function run(controller: OutriggerController, seconds: number): void {
  controller.update(clockMs)
  for (let t = 0; t < seconds - 1e-9; t += 0.05) {
    clockMs += 50
    controller.update(clockMs)
  }
}

describe('OutriggerController', () => {
  it('sem nós de patola no modelo não desenha nada, mas guarda o estado', () => {
    const invalidate = vi.fn()
    const controller = new OutriggerController({ getRoot: () => new Group(), invalidate })

    controller.setState({ extensionPercent: 100, jacksSet: true, levelingDeg: 3 })
    run(controller, 10)

    expect(controller.hasModel()).toBe(false)
    expect(controller.isReady()).toBe(true)
  })

  it('estende as vigas de 0 a 100 % ao longo do tempo e invalida enquanto anima', () => {
    const root = buildRoot()
    const invalidate = vi.fn()
    const controller = new OutriggerController({ getRoot: () => root, invalidate, beamTravelM: 1 })
    const beam = root.getObjectByName('crane-outrigger-fl-beam')!

    controller.setState({ extensionPercent: 50, jacksSet: false, levelingDeg: 0 })
    expect(controller.animating).toBe(true)
    run(controller, 0.5)
    const partial = beam.position.x
    expect(partial).toBeGreaterThan(0.8)
    expect(partial).toBeLessThan(1.3)

    run(controller, 5)
    expect(beam.position.x).toBeCloseTo(0.8 + 0.5)
    expect(root.getObjectByName('crane-outrigger-rr-beam')!.position.x).toBeCloseTo(-0.8 - 0.5)
    expect(controller.animating).toBe(false)
    expect(invalidate).toHaveBeenCalled()
  })

  it('só desce os macacos com as vigas estendidas, até o terreno', () => {
    const root = buildRoot()
    const controller = new OutriggerController({
      getRoot: () => root,
      invalidate: () => {},
      groundHeightAt: () => 0,
    })
    const pad = root.getObjectByName('crane-outrigger-fl-pad')!
    const jack = root.getObjectByName('crane-outrigger-fl-jack')!
    // A base da sapata (altura 0,2 centrada em y = 0,5) está em y = 0,4.
    controller.setState({ extensionPercent: 100, jacksSet: true, levelingDeg: 0 })

    run(controller, 1)
    expect(pad.position.y).toBeCloseTo(0.5)
    run(controller, 10)

    expect(pad.position.y).toBeCloseTo(0.1)
    expect(jack.position.y).toBeCloseTo(0.4)
    expect(controller.currentState.jacksSet).toBe(true)
  })

  it('respeita a altura do terreno sob a sapata', () => {
    const root = buildRoot()
    const controller = new OutriggerController({
      getRoot: () => root,
      invalidate: () => {},
      groundHeightAt: () => 0.2,
    })
    controller.setState({ extensionPercent: 100, jacksSet: true, levelingDeg: 0 })
    run(controller, 10)

    expect(root.getObjectByName('crane-outrigger-rl-pad')!.position.y).toBeCloseTo(0.3)
  })

  it('nivela até o máximo, sem passar dele, e só com os macacos apoiados', () => {
    const controller = new OutriggerController({ getRoot: () => null, invalidate: () => {} })

    controller.setState({ extensionPercent: 100, jacksSet: false, levelingDeg: 9 })
    expect(controller.targetState.levelingDeg).toBe(FICTITIOUS_MAX_LEVELING_DEG)
    run(controller, 10)
    expect(controller.currentState.levelingDeg).toBe(0)

    controller.setState({ extensionPercent: 100, jacksSet: true, levelingDeg: 9 })
    run(controller, 10)
    expect(controller.currentState.levelingDeg).toBe(FICTITIOUS_MAX_LEVELING_DEG)
  })

  it('recolher sobe os macacos e desfaz o nivelamento antes de recolher as vigas', () => {
    const controller = new OutriggerController({ getRoot: () => null, invalidate: () => {} })
    controller.setState({ extensionPercent: 100, jacksSet: true, levelingDeg: 3 })
    run(controller, 10)

    controller.setState(RETRACTED_OUTRIGGERS)
    run(controller, 0.3)
    expect(controller.currentState.extensionPercent).toBe(100)

    run(controller, 10)
    expect(controller.currentState).toEqual(RETRACTED_OUTRIGGERS)
  })

  it('com movimento reduzido, o estado vale na hora', () => {
    const root = buildRoot()
    const controller = new OutriggerController({
      getRoot: () => root,
      invalidate: () => {},
      reducedMotion: true,
      beamTravelM: 1,
    })

    controller.setState({ extensionPercent: 100, jacksSet: true, levelingDeg: 3 })

    expect(controller.animating).toBe(false)
    expect(root.getObjectByName('crane-outrigger-fl-beam')!.position.x).toBeCloseTo(1.8)
    expect(controller.isReady()).toBe(true)
  })

  it('limita a extensão a 0–100 %', () => {
    const controller = new OutriggerController({ getRoot: () => null, invalidate: () => {} })

    controller.setState({ extensionPercent: 250, jacksSet: false, levelingDeg: 0 })
    expect(controller.targetState.extensionPercent).toBe(100)
    controller.setState({ extensionPercent: -5, jacksSet: false, levelingDeg: 0 })
    expect(controller.targetState.extensionPercent).toBe(0)
  })
})
