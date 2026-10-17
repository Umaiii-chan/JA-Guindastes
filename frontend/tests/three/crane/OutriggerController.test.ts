import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Vector3 } from 'three'
import { describe, expect, it, vi } from 'vitest'

import { outriggersReady, RETRACTED_OUTRIGGERS } from '../../../src/domain/crane/outriggers'
import {
  FICTITIOUS_MAX_LEVELING_DEG,
  OUTRIGGER_POSITIONS,
  OutriggerController,
  outriggerNodeName,
  terrainHeightInFrame,
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

// TASK-093 (auditoria de 2026-10-16, F-25): as sapatas desciam sempre até y = 0 da base, porque a
// cena nunca passava a altura do terreno. Agora o terreno do mundo é convertido para a base.
describe('OutriggerController — sapatas no terreno (F-25)', () => {
  /** Centro da face de baixo da sapata (caixa de 0,2 m), no mundo. */
  function padBottomWorld(root: Group, position: (typeof OUTRIGGER_POSITIONS)[number]): Vector3 {
    const pad = root.getObjectByName(outriggerNodeName(position, 'pad'))!
    pad.updateWorldMatrix(true, false)
    return pad.localToWorld(new Vector3(0, -0.1, 0))
  }

  it('cada sapata desce até o terreno sob ela, com o chassi deslocado, girado e inclinado', () => {
    // FICTÍCIO: rampa em X e Z e um chassi 2 m acima da origem, girado e inclinado ~3°.
    const worldHeightAt = (x: number, z: number) => 1 + 0.05 * x - 0.03 * z
    const anchor = new Group()
    anchor.position.set(10, 2, -4)
    anchor.rotation.set(0.02, 0.6, 0.05)
    const root = buildRoot()
    anchor.add(root)
    const controller = new OutriggerController({
      getRoot: () => root,
      invalidate: () => {},
      beamTravelM: 1,
      groundHeightAt: terrainHeightInFrame(() => root, worldHeightAt),
    })

    controller.setState({ extensionPercent: 100, jacksSet: true, levelingDeg: 0 })
    run(controller, 10)

    const heights = OUTRIGGER_POSITIONS.map((position) => {
      const bottom = padBottomWorld(root, position)
      expect(bottom.y, position).toBeCloseTo(worldHeightAt(bottom.x, bottom.z), 6)
      return bottom.y
    })
    // Na rampa, as quatro sapatas ficam em alturas diferentes (antes, todas em y = 0 da base).
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(0.1)
  })

  it('reaplicar depois de mudar o terreno leva as sapatas ao terreno novo', () => {
    let worldHeightAt: (x: number, z: number) => number = () => 0
    const root = buildRoot()
    const controller = new OutriggerController({
      getRoot: () => root,
      invalidate: () => {},
      groundHeightAt: terrainHeightInFrame(
        () => root,
        (x, z) => worldHeightAt(x, z),
      ),
    })
    controller.setState({ extensionPercent: 100, jacksSet: true, levelingDeg: 0 })
    run(controller, 10)
    expect(padBottomWorld(root, 'fl').y).toBeCloseTo(0, 6)

    // Um monte de 0,25 m sob a sapata dianteira esquerda (x > 0, z > 0 no teste).
    worldHeightAt = (x, z) => (x > 0 && z > 0 ? 0.25 : 0)
    controller.reapply()

    expect(padBottomWorld(root, 'fl').y).toBeCloseTo(0.25, 6)
    expect(padBottomWorld(root, 'rr').y).toBeCloseTo(0, 6)
  })

  it('sem base, a altura é a do plano de sempre (0)', () => {
    const heightAt = terrainHeightInFrame(
      () => null,
      () => 5,
    )
    expect(heightAt(1, 2)).toBe(0)
  })
})

// TASK-093 (auditoria de 2026-10-16, F-27): "Patolas prontas" e o estado enviado ao backend
// mudavam na hora do comando, enquanto a animação leva até 6,5 s.
describe('OutriggerController — estado alcançado pela animação (F-27)', () => {
  const READY_LEVELED = { extensionPercent: 100, jacksSet: true, levelingDeg: 3 }

  it('"pronta" só quando os macacos apoiam no desenho; o nivelamento vale ao terminar', () => {
    const controller = new OutriggerController({ getRoot: () => null, invalidate: () => {} })

    controller.setState(READY_LEVELED)
    expect(controller.reportedState).toEqual(RETRACTED_OUTRIGGERS)

    run(controller, 1) // vigas a ~33 %
    expect(controller.reportedState).toEqual(RETRACTED_OUTRIGGERS)

    run(controller, 2.5) // vigas a 100 % (3 s), macacos descendo
    expect(controller.reportedState).toEqual({
      extensionPercent: 100,
      jacksSet: false,
      levelingDeg: 0,
    })
    expect(outriggersReady(controller.reportedState)).toBe(false)

    run(controller, 1.5) // macacos apoiados (4,5 s), nivelando
    expect(controller.reportedState).toEqual({
      extensionPercent: 100,
      jacksSet: true,
      levelingDeg: 0,
    })
    expect(outriggersReady(controller.reportedState)).toBe(true)

    run(controller, 5)
    expect(controller.animating).toBe(false)
    expect(controller.reportedState).toEqual(READY_LEVELED)
  })

  it('recolher deixa de valer na hora, mesmo com os macacos ainda apoiados no desenho', () => {
    const controller = new OutriggerController({ getRoot: () => null, invalidate: () => {} })
    controller.setState(READY_LEVELED)
    run(controller, 10)

    controller.setState(RETRACTED_OUTRIGGERS)
    run(controller, 0.5)

    expect(controller.currentState.jacksSet).toBe(true)
    expect(controller.reportedState).toEqual(RETRACTED_OUTRIGGERS)
  })

  it('entre os marcos o estado não muda a cada quadro', () => {
    const controller = new OutriggerController({ getRoot: () => null, invalidate: () => {} })
    controller.setState({ extensionPercent: 60, jacksSet: false, levelingDeg: 0 })
    const seen = new Set<string>()
    controller.update(clockMs)
    for (let i = 0; i < 100; i++) {
      clockMs += 50
      controller.update(clockMs)
      seen.add(JSON.stringify(controller.reportedState))
    }

    expect([...seen]).toEqual([
      JSON.stringify(RETRACTED_OUTRIGGERS),
      JSON.stringify({ extensionPercent: 60, jacksSet: false, levelingDeg: 0 }),
    ])
  })

  it('com movimento reduzido, vale o comando na hora', () => {
    const controller = new OutriggerController({
      getRoot: () => null,
      invalidate: () => {},
      reducedMotion: true,
    })

    controller.setState(READY_LEVELED)

    expect(controller.reportedState).toEqual(READY_LEVELED)
  })

  it('sem macacos apoiados, o nivelamento informado é 0', () => {
    const controller = new OutriggerController({ getRoot: () => null, invalidate: () => {} })

    controller.setState({ extensionPercent: 100, jacksSet: false, levelingDeg: 3 })
    run(controller, 10)

    expect(controller.reportedState).toEqual({
      extensionPercent: 100,
      jacksSet: false,
      levelingDeg: 0,
    })
  })
})
