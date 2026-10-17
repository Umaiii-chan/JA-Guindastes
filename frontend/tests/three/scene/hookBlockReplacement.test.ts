// Moitão da cadeia no lugar do moitão do modelo (TASK-093; auditoria de 2026-10-16, F-09). O
// desenho já pendurava a cadeia no fim do cabo (0,01 m), mas o engate, as colisões e o planejamento
// liam o ponto e a caixa do moitão escondido do modelo: a carga subia 1,09 m ao engatar e, com o GLB
// 80 t, a descida parava 0,56 m acima da carga e o engate planejado falhava (folga de −1,40 m).
//
// 1,4 m é a altura do "Moitão de 4 polias" do seed (`backend/app/demo_seed.py`); o resto é FICTÍCIO
// (ADR-012).

import { BoxGeometry, Group, Mesh } from 'three'
import { describe, expect, it } from 'vitest'

import { EMPTY_SCENARIO, type ScenarioSpec } from '../../../src/domain/environment/environment'
import { AccessoryChain } from '../../../src/three/accessories/AccessoryChain'
import { parseTruckCraneModel } from '../../../src/three/loaders/loadTruckCraneModel'
import { buildCraneScene } from '../../../src/three/scene/buildCraneScene'
import { HookLoad, REPLACED_HOOK_ATTACH_M } from '../../../src/three/scene/HookLoad'
import { upgradeCraneModel } from '../../../src/three/scene/upgradeCraneModel'
import { readCraneGlbWithoutTextures } from '../../helpers/craneGlb'

const HOOK_BLOCK_M = 1.4
const GLB = await readCraneGlbWithoutTextures()
const quiet = { warn: () => {} }

/** Gancho de teste com um moitão "do modelo" de 1 m de lado logo abaixo de G. */
function hookWithBuiltIn(): { hook: Group; hookLoad: HookLoad } {
  const hook = new Group()
  const builtIn = new Mesh(new BoxGeometry(1, 1, 1))
  builtIn.position.y = -0.5
  hook.add(builtIn)
  return { hook, hookLoad: new HookLoad(hook) }
}

describe('HookLoad com moitão na cadeia (F-09)', () => {
  it('o ponto de amarração e a caixa do gancho passam a ser os do moitão, não os do escondido', () => {
    const { hookLoad } = hookWithBuiltIn()
    expect(hookLoad.currentAttachOffsetM).toBeCloseTo(1, 6)
    expect(hookLoad.currentHookBox?.center.y).toBeCloseTo(-0.5, 6)

    hookLoad.setAccessories(new Group(), HOOK_BLOCK_M, true)

    expect(hookLoad.currentAttachOffsetM).toBe(REPLACED_HOOK_ATTACH_M)
    // Sem modelo 3D do moitão, vale a faixa que ele ocupa na cadeia: de −0,01 a −1,41 m, sem largura.
    const box = hookLoad.currentHookBox!
    expect(box.center.y).toBeCloseTo(-(REPLACED_HOOK_ATTACH_M + HOOK_BLOCK_M / 2), 6)
    expect(box.half).toEqual({ x: 0, y: expect.closeTo(HOOK_BLOCK_M / 2, 6), z: 0 })

    // Sem o moitão, volta o gancho do modelo.
    hookLoad.setAccessories(null, 0)
    expect(hookLoad.currentAttachOffsetM).toBeCloseTo(1, 6)
    expect(hookLoad.currentHookBox?.half.x).toBeCloseTo(0.5, 6)
  })

  it('acessórios sem moitão continuam no gancho do modelo', () => {
    const { hookLoad } = hookWithBuiltIn()

    hookLoad.setAccessories(new Group(), 0.75, false)

    expect(hookLoad.currentAttachOffsetM).toBeCloseTo(1, 6)
    expect(hookLoad.currentHookBox?.center.y).toBeCloseTo(-0.5, 6)
  })

  it('a caixa é a do moitão da cadeia (não a dos outros acessórios) e vira a medida quando o modelo chega', async () => {
    const { hookLoad } = hookWithBuiltIn()
    let arrived: () => void = () => {}
    const modelArrived = new Promise<void>((resolve) => {
      arrived = resolve
    })
    // Modelo FICTÍCIO do moitão: 0,6 × 2 × 0,6 m, escalado para caber nos 1,4 m da cadeia.
    const chain = new AccessoryChain({
      loader: async () => new Mesh(new BoxGeometry(0.6, 2, 0.6)),
      onChange: () => arrived(),
    })
    chain.setAccessories([
      { id: 'moitao', riggingHeightM: HOOK_BLOCK_M, modelUrl: 'moitao.glb', replacesHook: true },
      { id: 'manilha', riggingHeightM: 0.15, modelUrl: null },
    ])
    hookLoad.setAccessories(chain.root, chain.totalDropM, chain.replacesHook)

    // Antes do modelo: só a faixa do moitão (a manilha fica de fora).
    let box = hookLoad.currentHookBox!
    expect(box.center.y - box.half.y).toBeCloseTo(-(REPLACED_HOOK_ATTACH_M + HOOK_BLOCK_M), 6)
    expect(box.half.x).toBe(0)

    await modelArrived
    hookLoad.remeasureAccessories()

    box = hookLoad.currentHookBox!
    expect(box.half.x).toBeCloseTo((0.6 * (HOOK_BLOCK_M / 2)) / 2, 6)
    expect(box.center.y + box.half.y).toBeCloseTo(-REPLACED_HOOK_ATTACH_M, 6)
    expect(box.center.y - box.half.y).toBeCloseTo(-(REPLACED_HOOK_ATTACH_M + HOOK_BLOCK_M), 6)
    chain.dispose()
  })
})

describe('engate com o moitão de 4 polias (F-09)', () => {
  it('guindaste provisório: o fim desenhado é o do engate e a carga não salta ao engatar', () => {
    const contents = buildCraneScene()
    const hook = contents.crane.getOperationalGeometry().hook
    contents.hookLoad.setAccessories(new Group(), HOOK_BLOCK_M, true)
    // Carga com o topo 0,3 m abaixo do fim desenhado da cadeia (o moitão do acessório).
    const drawnEnd = hook.yM - REPLACED_HOOK_ATTACH_M - HOOK_BLOCK_M
    const heightM = drawnEnd - 0.3
    const spec: ScenarioSpec = {
      ...EMPTY_SCENARIO,
      cargo: { x: hook.xM, z: hook.zM, rotationYDeg: 0 },
    }
    contents.cargo.setLoad({ lengthM: 2, widthM: 2, heightM })
    contents.cargo.setScenario(spec)

    expect(contents.cargo.status.gapM).toBeCloseTo(0.3, 6)
    expect(contents.cargo.status.canEngage).toBe(true)
    expect(contents.cargo.engage(0)).toBe(true)

    // Antes da correção o topo desenhado subia 1,09 m e a carga ficava flutuando.
    const layout = contents.hookLoad.currentLayout!
    expect(hook.yM + layout.center.y + layout.size.y / 2).toBeCloseTo(heightM, 6)
    expect(contents.cargo.status.heightAboveGroundM).toBeCloseTo(0, 6)
    expect(contents.cargo.status.canRelease).toBe(true)
  })

  it('GLB 80 t: a descida para no moitão e o engate na pose do planejador funciona', async () => {
    const contents = buildCraneScene()
    await upgradeCraneModel(contents, () => parseTruckCraneModel(GLB.slice(0)), { logger: quiet })
    contents.crane.setCollisionGuard(contents.collisions)
    contents.hookLoad.setAccessories(new Group(), HOOK_BLOCK_M, true)
    contents.crane.setState({
      turretRotationDeg: 0,
      boomAngleDeg: 45,
      boomLengthM: 16,
      cableLengthM: 2,
    })
    const start = contents.crane.getOperationalGeometry().hook
    const spec: ScenarioSpec = {
      ...EMPTY_SCENARIO,
      cargo: { x: start.xM, z: start.zM, rotationYDeg: 0 },
    }
    contents.collisions.setScenario(spec)
    const heightM = 1
    contents.cargo.setLoad({ lengthM: 2, widthM: 2, heightM })
    contents.cargo.setScenario(spec)

    // Pose do planejador (o backend usa 0,01 m com moitão): fim do moitão 0,2 m acima do topo.
    const hookY = heightM + 0.2 + REPLACED_HOOK_ATTACH_M + HOOK_BLOCK_M
    const cable = start.yM + 2 - hookY
    const applied = contents.crane.setState({ cableLengthM: cable })

    // Antes, o moitão escondido do modelo (≈ 2 m abaixo de G) parava a descida 0,56 m acima.
    expect(contents.collisions.state.blocked).toBe(false)
    expect(applied.cableLengthM).toBeCloseTo(cable, 6)
    contents.cargo.refresh()
    expect(contents.cargo.status.gapM).toBeCloseTo(0.2, 3)
    expect(contents.cargo.status.canEngage).toBe(true)

    // Descer mais: o moitão encosta no topo da carga e a guarda corta ali.
    contents.crane.setState({ cableLengthM: cable + 0.5 })
    expect(contents.collisions.state.blocked).toBe(true)
    contents.cargo.refresh()
    expect(contents.cargo.status.gapM).toBeGreaterThanOrEqual(-0.01)
    expect(contents.cargo.status.gapM).toBeLessThan(0.05)
  })

  it('o ponto que vai ao planejamento é o mesmo do engate (0,01 m com o moitão)', () => {
    const contents = buildCraneScene()
    const withoutBlock = contents.hookLoad.currentAttachOffsetM

    contents.hookLoad.setAccessories(new Group(), HOOK_BLOCK_M, true)

    expect(withoutBlock).toBeGreaterThan(1)
    // `mountCraneScene.hookAttachOffsetM()` devolve este getter (TASK-075).
    expect(contents.hookLoad.currentAttachOffsetM).toBe(REPLACED_HOOK_ATTACH_M)
  })
})
