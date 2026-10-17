// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import type { CollisionState } from '../../../src/domain/collision/collisions'
import { EMPTY_SCENARIO, type ScenarioSpec } from '../../../src/domain/environment/environment'
import { PROVISIONAL_CRANE_SETUP } from '../../../src/three/crane/provisionalCraneSpec'
import type { CraneCommands } from '../../../src/three/crane/types'
import { buildCraneScene } from '../../../src/three/scene/buildCraneScene'
import {
  type ExtraCraneInput,
  PRIMARY_CRANE_ID,
  type TandemSceneConfig,
  type TandemSceneFrame,
} from '../../../src/three/scene/MultiCrane'

// Cena sem renderer: o guindaste principal e um adicional (provisórios, FICTÍCIOS, ADR-012), lado a
// lado, com a carga à frente dos dois. As medidas valem as do modelo provisório (a/h do ADR-013).

const SECOND: ExtraCraneInput = {
  id: 'extra-1',
  label: 'Guindaste 2',
  setup: PROVISIONAL_CRANE_SETUP,
  placement: { x: 8, z: 0, headingDeg: 0 },
}

const TANDEM: TandemSceneConfig = {
  followerId: 'extra-1',
  load: { lengthM: 8, widthM: 2, heightM: 1.5 },
  cargo: { x: 4, z: 10.5, rotationYDeg: 90 },
}

function sceneWithTwoCranes(extra: ExtraCraneInput = SECOND) {
  const contents = buildCraneScene()
  const frames: (TandemSceneFrame | null)[] = []
  let commands: ReadonlyMap<string, CraneCommands> = new Map()
  contents.multi.configure({
    invalidate: () => undefined,
    loadModel: null,
    signal: new AbortController().signal,
    reducedMotion: true,
    onCollision: () => undefined,
    onExtrasChange: (next) => {
      commands = next
    },
    onTandemFrame: (frame) => frames.push(frame),
  })
  contents.crane.setCollisionGuard(contents.multi.guardFor(PRIMARY_CRANE_ID, contents.collisions))
  contents.multi.setScenario(EMPTY_SCENARIO)
  contents.multi.setExtras([extra])
  return { contents, frames, commands: () => commands }
}

describe('MultiCrane — guindastes adicionais', () => {
  it('cria o rig completo do guindaste adicional, posicionado pelo cenário', () => {
    const { contents, commands } = sceneWithTwoCranes()

    const extra = contents.multi.getExtra('extra-1')
    expect(extra).toBeDefined()
    expect(extra?.anchor.position.x).toBe(8)
    expect(extra?.anchor.position.z).toBe(0)
    expect(extra?.rigInUse.hook).toBeDefined()
    expect(commands().get('extra-1')).toBe(extra?.crane)
    expect(contents.scene.getObjectByName('extra-crane-extra-1')).toBe(extra?.anchor)
  })

  it('cada guindaste tem os próprios comandos', () => {
    const { contents, commands } = sceneWithTwoCranes()

    commands().get('extra-1')?.setTurretRotation(40)

    expect(contents.multi.getExtra('extra-1')?.crane.getState().turretRotationDeg).toBe(40)
    expect(contents.crane.getState().turretRotationDeg).toBe(0)
  })

  it('gira o chassi pelo rumo e tira o guindaste da cena', () => {
    const { contents } = sceneWithTwoCranes()
    contents.multi.setExtras([{ ...SECOND, placement: { x: 8, z: 0, headingDeg: 90 } }])

    const anchor = contents.multi.getExtra('extra-1')?.anchor
    expect(anchor?.rotation.y).toBeCloseTo(Math.PI / 2)

    contents.multi.setExtras([])
    expect(contents.multi.extraCount).toBe(0)
    expect(contents.scene.getObjectByName('extra-crane-extra-1')).toBeUndefined()
  })

  it('bloqueia a lança do principal que atravessa a do outro guindaste', () => {
    // O adicional bem perto, no caminho da lança do principal (ψ = 0, para +Z).
    const { contents } = sceneWithTwoCranes({ ...SECOND, placement: { x: 0, z: 9, headingDeg: 0 } })
    const guard = contents.multi.guardFor(PRIMARY_CRANE_ID, contents.collisions)

    const report = guard.evaluate(contents.crane.getState())

    expect(report.hits.some((hit) => hit.subject === 'crane')).toBe(true)
  })

  it('lado a lado, as lanças paralelas não colidem', () => {
    const { contents } = sceneWithTwoCranes()
    const guard = contents.multi.guardFor(PRIMARY_CRANE_ID, contents.collisions)

    const report = guard.evaluate(contents.crane.getState())

    expect(report.hits.filter((hit) => hit.subject === 'crane')).toEqual([])
  })
})

describe('MultiCrane — o que pende de um guindaste, fora do tandem (TASK-091; F-07)', () => {
  // Carga FICTÍCIA de 4 × 2 × 1,5 m no principal. O adicional fica com a lança deitada (θ = 0),
  // atravessando por baixo do gancho do principal (ψ = 0, para +Z).
  const LOAD = { lengthM: 4, widthM: 2, heightM: 1.5 }

  function sceneWithBoomUnderHook() {
    const contents = buildCraneScene()
    const primaryStates: CollisionState[] = []
    const extraStates: CollisionState[] = []
    contents.multi.configure({
      invalidate: () => undefined,
      loadModel: null,
      signal: new AbortController().signal,
      reducedMotion: true,
      onCollision: (state) => extraStates.push(state),
      onExtrasChange: () => undefined,
      onTandemFrame: () => undefined,
    })
    contents.collisions.setListener((state) => primaryStates.push(state))
    contents.crane.setCollisionGuard(contents.multi.guardFor(PRIMARY_CRANE_ID, contents.collisions))
    contents.multi.setScenario(EMPTY_SCENARIO)
    // Cabo curto: a carga do principal fica bem acima da lança do adicional.
    contents.crane.setCableLength(1)
    const hook = contents.crane.getOperationalGeometry().hook
    // O adicional deita a lança longe dali e só depois vai para o lugar, de lado para o principal.
    contents.multi.setExtras([{ ...SECOND, placement: { x: -40, z: hook.zM, headingDeg: 90 } }])
    const extra = contents.multi.getExtra('extra-1')!
    extra.crane.setCableLength(1)
    extra.crane.setBoomAngle(0)
    contents.multi.setExtras([{ ...SECOND, placement: { x: -9, z: hook.zM, headingDeg: 90 } }])
    contents.hookLoad.setLoad(LOAD)
    contents.crane.revalidate()
    return { contents, extra, primaryStates, extraStates }
  }

  it('baixar o cabo do principal leva a carga até a lança do outro: o cabo para e avisa', () => {
    const { contents, primaryStates } = sceneWithBoomUnderHook()
    expect(primaryStates.at(-1)?.hits).toEqual([])
    expect(contents.multi.getExtra('extra-1')?.crane.getState().boomAngleDeg).toBe(0)

    const applied = contents.crane.setCableLength(10)

    expect(applied).toBeLessThan(10)
    const last = primaryStates.at(-1)!
    expect(last.blocked).toBe(true)
    expect(last.hits).toContainEqual(
      expect.objectContaining({
        subject: 'load',
        owner: 'Guindaste 1',
        target: expect.objectContaining({ kind: 'other-crane' }),
      }),
    )
    // A carga atingida é a do principal: ela fica vermelha.
    expect(contents.hookLoad.collisionHighlighted).toBe(true)
    // No estado aplicado, nada colide: o cabo parou no último estado seguro.
    const guard = contents.multi.guardFor(PRIMARY_CRANE_ID, contents.collisions)
    expect(guard.evaluate(contents.crane.getState()).hits).toEqual([])
  })

  it('levantar a lança do outro por baixo da carga do principal também é barrado', () => {
    const { contents, extra, extraStates } = sceneWithBoomUnderHook()
    // A carga do principal desce até encostar na lança deitada do adicional.
    contents.crane.setCableLength(10)

    const raised = extra.crane.setBoomAngle(10)

    expect(raised).toBeLessThan(1)
    const last = extraStates.at(-1)!
    expect(last.blocked).toBe(true)
    expect(last.hits.some((hit) => hit.subject === 'load' && hit.owner === 'Guindaste 1')).toBe(
      true,
    )
    // A carga é a do principal, não a do adicional: o gancho do adicional não fica vermelho.
    expect(extra.hookLoad.collisionHighlighted).toBe(false)
  })
})

describe('MultiCrane — tandem', () => {
  it('mostra a carga no chão antes de engatar e engata os dois ganchos nos pontos', () => {
    const { contents, frames } = sceneWithTwoCranes()
    contents.multi.setTandemCargo(TANDEM)

    const result = contents.multi.engage()

    expect(result?.reachable).toBe(true)
    expect(contents.multi.isEngaged).toBe(true)
    const frame = frames.at(-1)
    expect(frame?.hooks[0].x).toBeCloseTo(2, 1)
    expect(frame?.hooks[1].x).toBeCloseTo(6, 1)
    expect(frame?.hooks[0].z).toBeCloseTo(10.5, 1)
    expect(frame?.cargo.bottomY).toBeCloseTo(0, 1)
  })

  it('o guindaste 2 acompanha o 1 e a carga sobe junto', () => {
    const { contents, frames } = sceneWithTwoCranes()
    contents.multi.setTandemCargo(TANDEM)
    contents.multi.engage()
    const cable = contents.crane.getState().cableLengthM

    contents.crane.setCableLength(cable - 2)

    const frame = frames.at(-1)
    expect(frame?.cargo.bottomY).toBeCloseTo(2, 1)
    expect(frame?.hooks[1].y).toBeCloseTo(frame?.hooks[0].y ?? 0, 2)
    const follower = contents.multi.getExtra('extra-1')?.crane.getState()
    expect(follower?.cableLengthM).toBeCloseTo(frame?.followerState.cableLengthM ?? 0, 6)
    expect(frame?.reachable).toBe(true)
  })

  it('corta o movimento que o guindaste 2 não consegue seguir', () => {
    const { contents, frames } = sceneWithTwoCranes()
    contents.multi.setTandemCargo(TANDEM)
    contents.multi.engage()
    contents.crane.setTurretRotation(-90)

    // Com a lança toda estendida para o lado oposto ao do 2, o gancho dele ficaria a mais de 23 m.
    const length = contents.crane.setBoomLength(22)

    expect(length).toBeLessThan(22)
    expect(frames.at(-1)?.reachable).toBe(true)
  })

  it('só solta a carga apoiada no chão', () => {
    const { contents } = sceneWithTwoCranes()
    contents.multi.setTandemCargo(TANDEM)
    contents.multi.engage()
    const cable = contents.crane.getState().cableLengthM
    contents.crane.setCableLength(cable - 2)

    expect(contents.multi.release()).toEqual({ released: false, reason: 'in-air' })

    contents.crane.setCableLength(cable)
    const released = contents.multi.release()

    expect(released.released).toBe(true)
    expect(contents.multi.isEngaged).toBe(false)
  })

  it('avisa qual guindaste não alcança o ponto de içamento', () => {
    const { contents } = sceneWithTwoCranes({
      ...SECOND,
      placement: { x: 80, z: 0, headingDeg: 0 },
    })
    contents.multi.setTandemCargo(TANDEM)

    const result = contents.multi.engage()

    expect(result?.reachable).toBe(false)
    expect(result?.unreachable).toEqual([2])
    expect(contents.multi.isEngaged).toBe(false)
  })

  it('a carga içada colide com o terreno quando desce além do chão', () => {
    const { contents } = sceneWithTwoCranes()
    contents.multi.setTandemCargo(TANDEM)
    contents.multi.engage()
    const cable = contents.crane.getState().cableLengthM

    // Alongar o cabo desceria a carga para dentro do chão: o comando é cortado no chão.
    const applied = contents.crane.setCableLength(cable + 1.5)

    expect(applied).toBeLessThan(cable + 1.5)
    expect(applied).toBeGreaterThanOrEqual(cable - 1e-3)
  })

  it('desligar o tandem desengata', () => {
    const { contents, frames } = sceneWithTwoCranes()
    contents.multi.setTandemCargo(TANDEM)
    contents.multi.engage()

    contents.multi.setTandemCargo(null)

    expect(contents.multi.isEngaged).toBe(false)
    expect(frames.at(-1)).toBeNull()
  })
})

describe('MultiCrane — sem guindaste adicional', () => {
  it('não muda a guarda do principal', () => {
    const contents = buildCraneScene()
    contents.multi.configure({
      invalidate: () => undefined,
      loadModel: null,
      signal: new AbortController().signal,
      reducedMotion: true,
      onCollision: () => undefined,
      onExtrasChange: () => undefined,
      onTandemFrame: () => undefined,
    })
    const guard = contents.multi.guardFor(PRIMARY_CRANE_ID, contents.collisions)

    const own = contents.collisions.evaluate(contents.crane.getState())
    const combined = guard.evaluate(contents.crane.getState())

    expect(combined).toEqual(own)
    const spec: ScenarioSpec = EMPTY_SCENARIO
    contents.multi.setScenario(spec)
    expect(contents.multi.extraCount).toBe(0)
  })
})
