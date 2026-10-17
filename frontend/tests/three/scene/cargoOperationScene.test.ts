// Coleta e entrega na cena (TASK-073): a carga no chão, engatar, levar e soltar no alvo, sem WebGL.

import { Group } from 'three'
import { describe, expect, it } from 'vitest'

import type { CargoStatus } from '../../../src/domain/cargo/cargoOperation'
import { GROUND_CARGO_ID } from '../../../src/domain/collision/collisions'
import { EMPTY_SCENARIO, type ScenarioSpec } from '../../../src/domain/environment/environment'
import { slingDropOf } from '../../../src/domain/rigging/slingGeometry'
import { buildCraneScene } from '../../../src/three/scene/buildCraneScene'

function setup() {
  const contents = buildCraneScene()
  const statuses: CargoStatus[] = []
  contents.cargo.setListener((status) => statuses.push(status))
  // Gancho em G (mundo = coordenadas da geometria, com o guindaste na origem).
  const hook = contents.crane.getOperationalGeometry().hook
  const attach = contents.hookLoad.currentAttachOffsetM
  // Carga logo abaixo do gancho: o topo fica `drop` + 0,1 m abaixo do fim do gancho, onde `drop` é a
  // altura das lingas da geometria única (F-19; 3 × 2 m, 60°): o gancho está 0,1 m acima do ponto
  // em que elas esticam, dentro da folga do engate.
  const heightM = hook.yM - attach - slingDropOf(3, 2) - 0.1
  const load = { lengthM: 3, widthM: 2, heightM }
  const spec: ScenarioSpec = {
    ...EMPTY_SCENARIO,
    cargo: { x: hook.xM, z: hook.zM, rotationYDeg: 0 },
    delivery: { x: hook.xM + 6, z: hook.zM, rotationYDeg: 0, radiusM: 2 },
  }
  return { contents, statuses, hook, load, spec }
}

describe('coleta e entrega na cena', () => {
  it('com o tandem ligado, a carga de um guindaste só some e volta ao chão ao desligar', () => {
    const { contents, load, spec } = setup()
    contents.cargo.setLoad(load)
    contents.cargo.setScenario(spec)
    contents.cargo.setSuspended(true)
    expect(contents.cargo.ground.visible).toBe(false)
    expect(contents.cargo.status.active).toBe(false)
    expect(contents.collisions.effectiveScenario.obstacles).toEqual([])
    expect(contents.cargo.engage(1_000)).toBe(false)

    contents.cargo.setSuspended(false)
    expect(contents.cargo.ground.visible).toBe(true)
    expect(contents.cargo.status.state?.phase).toBe('ground')
  })

  it('sem carga posicionada, a carga continua pendurada no gancho (modo livre)', () => {
    const { contents, load } = setup()
    contents.cargo.setLoad(load)
    contents.cargo.setScenario(EMPTY_SCENARIO)
    expect(contents.hookLoad.currentLayout).not.toBeNull()
    expect(contents.cargo.ground.visible).toBe(false)
    expect(contents.cargo.status.active).toBe(false)
  })

  it('com carga posicionada, ela fica no chão, fora do gancho, e vira obstáculo', () => {
    const { contents, load, spec } = setup()
    contents.cargo.setLoad(load)
    contents.cargo.setScenario(spec)
    expect(contents.hookLoad.currentLayout).toBeNull()
    expect(contents.cargo.ground.visible).toBe(true)
    expect(contents.collisions.effectiveScenario.obstacles.map((obstacle) => obstacle.id)).toEqual([
      GROUND_CARGO_ID,
    ])
    expect(contents.cargo.status.state?.phase).toBe('ground')
    expect(contents.cargo.delivery.root.visible).toBe(true)
  })

  it('engata perto do gancho, a carga passa a pender dele e solta no alvo entregando', () => {
    const { contents, hook, load, spec } = setup()
    contents.cargo.setLoad(load)
    contents.cargo.setScenario(spec)
    expect(contents.cargo.status.canEngage).toBe(true)

    expect(contents.cargo.engage(1_000)).toBe(true)
    expect(contents.cargo.status.state?.phase).toBe('hooked')
    expect(contents.hookLoad.currentLayout).not.toBeNull()
    expect(contents.cargo.ground.visible).toBe(false)
    // Engatada, a carga deixa de ser obstáculo: ela colide pendurada.
    expect(contents.collisions.effectiveScenario.obstacles).toHaveLength(0)

    // Solta logo (a base está rente ao chão), fora do alvo, que fica a 6 m.
    expect(contents.cargo.status.canRelease).toBe(true)
    expect(contents.cargo.release(9_000)).toBe(true)
    expect(contents.cargo.status.state?.result).toBe('outside')
    expect(contents.cargo.status.state?.phase).toBe('ground')
    expect(contents.cargo.status.state?.x).toBeCloseTo(hook.xM, 2)
    expect(contents.cargo.ground.visible).toBe(true)
  })

  it('entrega quando solta dentro do raio e conta o tempo desde o primeiro engate', () => {
    const { contents, hook, load, spec } = setup()
    // O alvo exatamente sob o gancho.
    contents.cargo.setLoad(load)
    contents.cargo.setScenario({
      ...spec,
      delivery: { x: hook.xM, z: hook.zM, rotationYDeg: 0, radiusM: 1 },
    })
    contents.cargo.engage(2_000)
    contents.cargo.release(14_500)
    expect(contents.cargo.status.state?.result).toBe('delivered')
    expect(contents.cargo.status.state?.elapsedMs).toBe(12_500)
  })

  it('com acessórios, a cadeia para no topo da carga no chão, e dá para engatar (TASK-091)', () => {
    const contents = buildCraneScene()
    contents.crane.setCollisionGuard(contents.collisions)
    // Gancho giratório + manilha: 0,75 m de cadeia FICTÍCIA abaixo do gancho.
    contents.hookLoad.setAccessories(new Group(), 0.75)
    const hook = contents.crane.getOperationalGeometry().hook
    const attach = contents.hookLoad.currentAttachOffsetM
    // Carga no chão com o topo `drop` + 0,1 m abaixo do fim da cadeia (F-19: lingas da geometria única).
    const drop = slingDropOf(3, 2)
    const load = { lengthM: 3, widthM: 2, heightM: hook.yM - attach - 0.75 - drop - 0.1 }
    contents.cargo.setLoad(load)
    contents.cargo.setScenario({
      ...EMPTY_SCENARIO,
      cargo: { x: hook.xM, z: hook.zM, rotationYDeg: 0 },
    })
    const cable = contents.crane.getState().cableLengthM

    // Descer demais levaria a cadeia para dentro da carga: o cabo para no contato com o topo.
    const applied = contents.crane.setCableLength(cable + 10)

    expect(applied - cable).toBeCloseTo(drop + 0.1, 2)
    expect(contents.collisions.state.hits).toContainEqual(
      expect.objectContaining({
        subject: 'accessories',
        target: expect.objectContaining({ id: GROUND_CARGO_ID }),
      }),
    )
    // Encostada no topo, a cadeia está abaixo do ponto em que as lingas esticam: ainda não engata.
    contents.cargo.refresh()
    expect(contents.cargo.status.canEngage).toBe(false)
    // Subindo até as lingas esticarem (`drop` acima do topo), dá para engatar.
    contents.crane.setCableLength(cable + 0.1)
    contents.cargo.refresh()
    expect(contents.cargo.status.canEngage).toBe(true)
    expect(contents.cargo.engage(0)).toBe(true)
  })

  it('não engata nem solta fora das condições', () => {
    const { contents, load, spec } = setup()
    contents.cargo.setLoad(load)
    contents.cargo.setScenario({
      ...spec,
      cargo: { x: spec.cargo!.x + 5, z: spec.cargo!.z, rotationYDeg: 0 },
    })
    expect(contents.cargo.status.canEngage).toBe(false)
    expect(contents.cargo.engage(0)).toBe(false)
    expect(contents.cargo.release(0)).toBe(false)
  })

  it('mudar a posição da carga no cenário a devolve ao chão, no lugar novo', () => {
    const { contents, load, spec } = setup()
    contents.cargo.setLoad(load)
    contents.cargo.setScenario(spec)
    contents.cargo.engage(0)
    contents.cargo.setScenario({ ...spec, cargo: { x: 3, z: 4, rotationYDeg: 15 } })
    expect(contents.cargo.status.state).toMatchObject({
      phase: 'ground',
      x: 3,
      z: 4,
      rotationYDeg: 15,
    })
  })

  it('a reprodução mostra o estado gravado e volta ao ao vivo', () => {
    const { contents, load, spec } = setup()
    contents.cargo.setLoad(load)
    contents.cargo.setScenario(spec)
    contents.cargo.setPlayback({
      phase: 'hooked',
      x: 0,
      z: 0,
      rotationYDeg: 0,
      result: 'none',
      hooked: { offsetX: 0, offsetZ: 0, yawDeg: 0, slingDropM: 0.3 },
    })
    expect(contents.hookLoad.currentLayout).not.toBeNull()
    expect(contents.cargo.engage(0)).toBe(false)
    contents.cargo.setPlayback(null)
    expect(contents.hookLoad.currentLayout).toBeNull()
  })
})
