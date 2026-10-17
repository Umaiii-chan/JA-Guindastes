import { describe, expect, it } from 'vitest'

import { HOOK_ATTACH_OFFSET_M } from '../../../src/domain/collision/loadBox'
import {
  cargoCgWorld,
  craneHookWorld,
  defaultLiftOffsets,
  engageHookHeightM,
  engageTandem,
  liftPointsWorld,
  localToWorld,
  slingTopsWorld,
  solveCraneForHook,
  tandemFrame,
  tandemHookDropM,
  TANDEM_SLING_DROP_M,
  type TandemCrane,
  type TandemCraneState,
  type TandemSetup,
  worldToLocal,
} from '../../../src/domain/tandem/tandem'

// Guindastes FICTÍCIOS (ADR-012): limites e a/h do guindaste provisório da PoC.
const LIMITS = {
  turretRotationDeg: { min: -180, max: 180 },
  boomAngleDeg: { min: 0, max: 80 },
  boomLengthM: { min: 12, max: 22 },
  cableLengthM: { min: 1, max: 15 },
}
const PARAMETERS = { boomPivotOffsetM: 0.46, boomPivotHeightM: 3.3 }

function crane(x: number, z: number, headingDeg = 0): TandemCrane {
  return { placement: { x, z, headingDeg }, groundY: 0, parameters: PARAMETERS, limits: LIMITS }
}

const PREFERRED: TandemCraneState = {
  turretRotationDeg: 0,
  boomAngleDeg: 40,
  boomLengthM: 14,
  cableLengthM: 6,
}

// Dois guindastes de frente um para o outro, a carga entre eles (comprimento ao longo de X).
const SETUP: TandemSetup = {
  leader: crane(-10, 0, 90),
  follower: crane(10, 0, -90),
  load: { lengthM: 8, widthM: 2, heightM: 1.5 },
  cargo: { x: 0, z: 0, rotationYDeg: 90 },
  cargoGroundY: 0,
}

describe('tandem — pontos de içamento', () => {
  it('os pontos padrão ficam a 1/4 e 3/4 do comprimento, simétricos ao centro', () => {
    const offsets = defaultLiftOffsets(SETUP.load)

    expect(offsets[0]).toEqual({ x: 0, z: -2 })
    expect(offsets[1]).toEqual({ x: 0, z: 2 })
  })

  it('acompanham o centro e o giro da carga', () => {
    const [a, b] = liftPointsWorld({ x: 5, z: 1, rotationYDeg: 90 }, SETUP.load)

    // Giro de 90°: o +Z da carga aponta para +X do mundo.
    expect(a.x).toBeCloseTo(3)
    expect(b.x).toBeCloseTo(7)
    expect(a.z).toBeCloseTo(1)
    expect(b.z).toBeCloseTo(1)
  })

  it('o CG sai do centro pelo deslocamento informado', () => {
    const cg = cargoCgWorld(
      { x: 5, z: 1, rotationYDeg: 90 },
      { ...SETUP.load, cgAlongLengthM: 1, cgAlongWidthM: 0.5 },
    )

    // Comprimento (+Z local) vira +X; largura (+X local) vira -Z.
    expect(cg.x).toBeCloseTo(6)
    expect(cg.z).toBeCloseTo(0.5)
  })

  it('converte entre o mundo e o referencial do guindaste', () => {
    const placement = { x: 3, z: -2, headingDeg: 35 }
    const world = localToWorld(placement, 4, 7)

    const local = worldToLocal(placement, world.x, world.z)

    expect(local.x).toBeCloseTo(4)
    expect(local.z).toBeCloseTo(7)
  })
})

describe('tandem — cinemática inversa do guindaste que acompanha', () => {
  it('leva o gancho ao ponto pedido', () => {
    const follower = SETUP.follower
    const target = { x: 4, z: 2, y: 3 }

    const solution = solveCraneForHook(follower, target, PREFERRED)
    const hook = craneHookWorld(follower, solution.state)

    expect(solution.reachable).toBe(true)
    expect(hook.x).toBeCloseTo(target.x, 2)
    expect(hook.z).toBeCloseTo(target.z, 2)
    expect(hook.y).toBeCloseTo(target.y, 2)
  })

  it('mantém o ângulo preferido quando ele serve (movimento contínuo)', () => {
    const solution = solveCraneForHook(crane(0, 0), { x: 0, z: 14, y: 3 }, PREFERRED)

    // R = 14: com θ = 40° a lança precisa de L = (14 - 0,46) / cos 40° = 17,67 m, dentro da faixa.
    expect(solution.state.boomAngleDeg).toBe(40)
    expect(solution.state.boomLengthM).toBeCloseTo((14 - 0.46) / Math.cos((40 * Math.PI) / 180))
  })

  it('muda o ângulo quando o preferido não alcança e diz que alcança', () => {
    // R = 22: com θ = 40° L seria 28 m, acima do limite; precisa abaixar a lança.
    const solution = solveCraneForHook(crane(0, 0), { x: 0, z: 22, y: 4 }, PREFERRED)

    expect(solution.reachable).toBe(true)
    expect(solution.state.boomAngleDeg).toBeLessThan(40)
    expect(solution.state.boomLengthM).toBeLessThanOrEqual(22)
  })

  it('diz que não alcança um ponto além do alcance máximo', () => {
    const solution = solveCraneForHook(crane(0, 0), { x: 0, z: 40, y: 3 }, PREFERRED)

    expect(solution.reachable).toBe(false)
    expect(solution.errorM).toBeGreaterThan(10)
  })

  it('diz que não alcança um ponto mais perto que a lança mais curta permite', () => {
    const solution = solveCraneForHook(crane(0, 0), { x: 0, z: 2, y: 3 }, PREFERRED)

    expect(solution.reachable).toBe(false)
  })
})

describe('tandem — engate e quadros', () => {
  it('engata os dois ganchos nos pontos de içamento, na altura de engate', () => {
    const result = engageTandem(SETUP, PREFERRED, PREFERRED)

    expect(result.reachable).toBe(true)
    const [p1, p2] = liftPointsWorld(SETUP.cargo, SETUP.load)
    const hook1 = craneHookWorld(SETUP.leader, result.leaderState)
    const hook2 = craneHookWorld(SETUP.follower, result.followerState)
    expect(hook1.x).toBeCloseTo(p1.x, 2)
    expect(hook1.z).toBeCloseTo(p1.z, 2)
    expect(hook2.x).toBeCloseTo(p2.x, 2)
    expect(hook2.y).toBeCloseTo(engageHookHeightM(SETUP), 2)
  })

  it('avisa qual guindaste não alcança o ponto', () => {
    const far = { ...SETUP, follower: crane(60, 0, -90) }

    const result = engageTandem(far, PREFERRED, PREFERRED)

    expect(result.reachable).toBe(false)
    expect(result.unreachable).toEqual([2])
  })

  it('a carga acompanha o gancho de quem conduz e o outro gancho segue o ponto dele', () => {
    const engaged = engageTandem(SETUP, PREFERRED, PREFERRED)
    // O condutor sobe o gancho 2 m (cabo mais curto).
    const raised = {
      ...engaged.leaderState,
      cableLengthM: engaged.leaderState.cableLengthM - 2,
    }

    const frame = tandemFrame(SETUP, raised, engaged.followerState)

    expect(frame.reachable).toBe(true)
    expect(frame.cargo.bottomY).toBeCloseTo(2, 2)
    expect(frame.hooks[0].y).toBeCloseTo(frame.hooks[1].y, 2)
    expect(frame.cargo.rotationYDeg).toBe(SETUP.cargo.rotationYDeg)
  })

  it('translada a carga e mantém a distância entre os ganchos', () => {
    const engaged = engageTandem(SETUP, PREFERRED, PREFERRED)
    const turned = {
      ...engaged.leaderState,
      turretRotationDeg: engaged.leaderState.turretRotationDeg + 5,
    }

    const frame = tandemFrame(SETUP, turned, engaged.followerState)
    const spacing = Math.hypot(
      frame.hooks[1].x - frame.hooks[0].x,
      frame.hooks[1].z - frame.hooks[0].z,
    )

    expect(spacing).toBeCloseTo(4, 1)
    const [p1] = liftPointsWorld(SETUP.cargo, SETUP.load)
    expect(frame.cargo.x - SETUP.cargo.x).toBeCloseTo(frame.hooks[0].x - p1.x, 5)
  })

  it('a carga recém engatada fica apoiada no chão', () => {
    const engaged = engageTandem(SETUP, PREFERRED, PREFERRED)

    const frame = tandemFrame(SETUP, engaged.leaderState, engaged.followerState)

    expect(frame.cargo.bottomY).toBeCloseTo(0, 2)
    // Sem medida do gancho, vale o engate do gancho provisório (TASK-090).
    expect(engageHookHeightM(SETUP)).toBeCloseTo(
      SETUP.load.heightM + TANDEM_SLING_DROP_M + HOOK_ATTACH_OFFSET_M,
    )
  })
})

// TASK-090 (F-16): as lingas saem do fim do gancho (e da cadeia de acessórios), não de G.
describe('tandem — altura do gancho no engate e no quadro', () => {
  /** Distância de G ao fim do moitão do GLB 80 t, medida pela auditoria de 2026-10-16. */
  const GLB_HOOK_DROP_M = 1.965
  /** Cadeia FICTÍCIA de acessórios (gancho giratório + manilha) no guindaste 1. */
  const CHAIN_M = 0.75

  const withDrops = (drops: readonly [number, number]): TandemSetup => ({
    ...SETUP,
    load: { ...SETUP.load, hookDropsM: drops },
  })

  it('reproduz a auditoria: o moitão do 80 t não entra mais na carga', () => {
    const setup = withDrops([GLB_HOOK_DROP_M, GLB_HOOK_DROP_M])
    const top = setup.cargoGroundY + setup.load.heightM

    const hookBottom = engageHookHeightM(setup) - GLB_HOOK_DROP_M

    // Antes: G a 1,5 m do topo, e o moitão 1,965 m abaixo de G entrava 0,465 m na carga.
    expect(top + TANDEM_SLING_DROP_M - GLB_HOOK_DROP_M - top).toBeCloseTo(-0.465, 3)
    expect(hookBottom - top).toBeCloseTo(TANDEM_SLING_DROP_M, 9)
  })

  it('cada gancho engata na altura dele: chão + carga + lingas + engate + acessórios', () => {
    const setup = withDrops([GLB_HOOK_DROP_M + CHAIN_M, GLB_HOOK_DROP_M])

    const result = engageTandem(setup, PREFERRED, PREFERRED)

    expect(result.reachable).toBe(true)
    const hook1 = craneHookWorld(setup.leader, result.leaderState)
    const hook2 = craneHookWorld(setup.follower, result.followerState)
    const base = setup.cargoGroundY + setup.load.heightM + TANDEM_SLING_DROP_M
    expect(hook1.y).toBeCloseTo(base + GLB_HOOK_DROP_M + CHAIN_M, 2)
    expect(hook2.y).toBeCloseTo(base + GLB_HOOK_DROP_M, 2)
  })

  it('no quadro, a carga pende do fim do gancho de quem conduz, e o outro acompanha essa altura', () => {
    const setup = withDrops([GLB_HOOK_DROP_M + CHAIN_M, GLB_HOOK_DROP_M])
    const engaged = engageTandem(setup, PREFERRED, PREFERRED)
    const raised = { ...engaged.leaderState, cableLengthM: engaged.leaderState.cableLengthM - 2 }

    const frame = tandemFrame(setup, raised, engaged.followerState)

    expect(frame.reachable).toBe(true)
    expect(frame.cargo.bottomY).toBeCloseTo(2, 2)
    const [top1, top2] = slingTopsWorld(frame.hooks, setup.load)
    // As lingas dos dois saem da mesma altura, 1,5 m acima do topo da carga.
    expect(top1.y).toBeCloseTo(frame.cargo.bottomY + setup.load.heightM + TANDEM_SLING_DROP_M, 6)
    expect(top2.y).toBeCloseTo(top1.y, 2)
    expect(frame.hooks[0].y - frame.hooks[1].y).toBeCloseTo(CHAIN_M, 2)
  })

  it('a carga recém engatada com o gancho medido fica apoiada no chão', () => {
    const setup = withDrops([GLB_HOOK_DROP_M + CHAIN_M, GLB_HOOK_DROP_M])
    const engaged = engageTandem(setup, PREFERRED, PREFERRED)

    const frame = tandemFrame(setup, engaged.leaderState, engaged.followerState)

    expect(frame.cargo.bottomY).toBeCloseTo(0, 2)
  })

  it('medida ausente ou inválida cai no engate do gancho provisório', () => {
    expect(tandemHookDropM(SETUP.load, 0)).toBe(HOOK_ATTACH_OFFSET_M)
    expect(tandemHookDropM({ ...SETUP.load, hookDropsM: [Number.NaN, 0] }, 0)).toBe(
      HOOK_ATTACH_OFFSET_M,
    )
    expect(tandemHookDropM({ ...SETUP.load, hookDropsM: [Number.NaN, 0] }, 1)).toBe(
      HOOK_ATTACH_OFFSET_M,
    )
    expect(tandemHookDropM({ ...SETUP.load, hookDropsM: [2.2, 1.1] }, 1)).toBe(1.1)
  })
})
