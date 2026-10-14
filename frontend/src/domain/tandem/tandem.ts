// Içamento com dois guindastes (tandem; TASK-074; RN-016; ADR-037), sem Three.js nem React.
//
// Só geometria de pré-visualização: a divisão da carga, os 75 % da capacidade e a segurança são do
// backend (`POST /evaluations/tandem`; RN-008). Aqui ficam o que a cena precisa para mover os dois
// guindastes juntos: os pontos de içamento sobre a carga, a posição do gancho no mundo e a
// cinemática inversa do guindaste que acompanha (dado onde o gancho deve ficar, acha giro, ângulo e
// comprimento da lança e cabo, dentro dos limites da ficha).
//
// Convenções (ADR-013): Y para cima; o rumo do chassi gira em torno de Y como `rotation.y` (a
// frente +Z vai para +X); o gancho G fica a R·(sin ψ, cos ψ) do eixo de giro, no referencial do
// guindaste. Carga: x = largura, z = comprimento, centro em (x, z) e giro em torno de Y.

import {
  calculateOperationalGeometry,
  type CraneGeometryParameters,
} from '../geometry/operationalGeometry'
import type { CargoPlacement, CranePlacement } from '../environment/environment'

const DEG = Math.PI / 180

/** Cada guindaste usa no máximo esta fração da capacidade dele (RN-016); o cálculo é do backend. */
export const TANDEM_CAPACITY_FACTOR = 0.75

/** Altura das lingas entre o gancho e o topo da carga (m). */
export const TANDEM_SLING_DROP_M = 1.5

/** Os pontos de içamento ficam a esta fração do comprimento, a partir do centro (1/4 e 3/4). */
export const DEFAULT_LIFT_FRACTION = 0.25

/** Folga (m) abaixo da qual o gancho conta como "no ponto". */
export const REACH_TOLERANCE_M = 0.02

export interface PlanPoint {
  readonly x: number
  readonly z: number
}

export interface WorldPoint extends PlanPoint {
  readonly y: number
}

export interface Range {
  readonly min: number
  readonly max: number
}

/** Limites de cada comando; os mesmos de `CraneLimits` da cena, sem importar `three/`. */
export interface TandemCraneLimits {
  readonly turretRotationDeg: Range
  readonly boomAngleDeg: Range
  readonly boomLengthM: Range
  readonly cableLengthM: Range
}

export interface TandemCraneState {
  readonly turretRotationDeg: number
  readonly boomAngleDeg: number
  readonly boomLengthM: number
  readonly cableLengthM: number
}

/** Um guindaste do tandem no mundo. */
export interface TandemCrane {
  readonly placement: CranePlacement
  /** Altura do terreno sob o eixo de giro (m). */
  readonly groundY: number
  readonly parameters: CraneGeometryParameters
  readonly limits: TandemCraneLimits
}

export interface TandemLoad {
  readonly lengthM: number
  readonly widthM: number
  readonly heightM: number
  /** CG a partir do centro da caixa (m); ausente = no centro. */
  readonly cgAlongLengthM?: number
  readonly cgAlongWidthM?: number
}

/** Configuração do tandem: quem conduz, quem acompanha, a carga e onde ela está no chão. */
export interface TandemSetup {
  readonly leader: TandemCrane
  readonly follower: TandemCrane
  readonly load: TandemLoad
  /** Pose da carga no chão (centro e giro); é com ela que os pontos de içamento são definidos. */
  readonly cargo: CargoPlacement
  /** Altura do terreno sob a carga (m). */
  readonly cargoGroundY: number
  /** Pontos de içamento no referencial da carga (x = largura, z = comprimento). */
  readonly liftOffsets?: readonly [PlanPoint, PlanPoint]
}

/** Ponto do referencial local do guindaste (rumo `headingDeg`) no mundo. */
export function localToWorld(placement: CranePlacement, localX: number, localZ: number): PlanPoint {
  const heading = placement.headingDeg * DEG
  const cos = Math.cos(heading)
  const sin = Math.sin(heading)
  return {
    x: placement.x + localX * cos + localZ * sin,
    z: placement.z - localX * sin + localZ * cos,
  }
}

/** Inverso de `localToWorld`. */
export function worldToLocal(placement: CranePlacement, worldX: number, worldZ: number): PlanPoint {
  const heading = placement.headingDeg * DEG
  const cos = Math.cos(heading)
  const sin = Math.sin(heading)
  const dx = worldX - placement.x
  const dz = worldZ - placement.z
  return { x: dx * cos - dz * sin, z: dx * sin + dz * cos }
}

/** Posição do gancho G no mundo para o estado dado (ADR-013 C-5; cabo vertical). */
export function craneHookWorld(crane: TandemCrane, state: TandemCraneState): WorldPoint {
  const geometry = calculateOperationalGeometry(state, crane.parameters)
  const plan = localToWorld(crane.placement, geometry.hook.xM, geometry.hook.zM)
  return { ...plan, y: crane.groundY + geometry.hook.yM }
}

/** Pontos de içamento padrão no referencial da carga: sobre o comprimento, a 1/4 e 3/4 dele. */
export function defaultLiftOffsets(load: TandemLoad): readonly [PlanPoint, PlanPoint] {
  const along = load.lengthM * DEFAULT_LIFT_FRACTION
  return [
    { x: 0, z: -along },
    { x: 0, z: along },
  ]
}

function cargoToWorld(cargo: CargoPlacement, local: PlanPoint): PlanPoint {
  return localToWorld({ x: cargo.x, z: cargo.z, headingDeg: cargo.rotationYDeg }, local.x, local.z)
}

/** Pontos de içamento da carga na pose `cargo`, no mundo. */
export function liftPointsWorld(
  cargo: CargoPlacement,
  load: TandemLoad,
  offsets: readonly [PlanPoint, PlanPoint] = defaultLiftOffsets(load),
): readonly [PlanPoint, PlanPoint] {
  return [cargoToWorld(cargo, offsets[0]), cargoToWorld(cargo, offsets[1])]
}

/** Centro de gravidade da carga na pose `cargo`, no mundo. */
export function cargoCgWorld(cargo: CargoPlacement, load: TandemLoad): PlanPoint {
  return cargoToWorld(cargo, { x: load.cgAlongWidthM ?? 0, z: load.cgAlongLengthM ?? 0 })
}

/** Altura do gancho com a carga recém apoiada no chão (lingas esticadas, sem içar). */
export function engageHookHeightM(setup: TandemSetup): number {
  return setup.cargoGroundY + setup.load.heightM + TANDEM_SLING_DROP_M
}

const clamp = (value: number, range: Range): number =>
  Math.min(range.max, Math.max(range.min, value))

/** Giro equivalente a `degrees` dentro da faixa (soma ou tira voltas); `null` se nenhum cabe. */
function fitTurret(degrees: number, range: Range): number | null {
  for (const turn of [0, -360, 360, -720, 720]) {
    const candidate = degrees + turn
    if (candidate >= range.min - 1e-9 && candidate <= range.max + 1e-9) return candidate
  }
  return null
}

export interface CraneSolution {
  readonly state: TandemCraneState
  /** O gancho chega ao ponto (erro menor que `REACH_TOLERANCE_M`). */
  readonly reachable: boolean
  /** Distância (m) entre o gancho obtido e o pedido. */
  readonly errorM: number
}

const THETA_STEP_DEG = 0.25

/**
 * Estado do guindaste que leva o gancho a `target` (mundo), dentro dos limites. Entre as soluções
 * possíveis escolhe a de ângulo de lança mais perto do de `preferred`, para o movimento ser
 * contínuo. Sem solução, devolve a que mais se aproxima, com `reachable: false`.
 */
export function solveCraneForHook(
  crane: TandemCrane,
  target: WorldPoint,
  preferred: TandemCraneState,
): CraneSolution {
  const local = worldToLocal(crane.placement, target.x, target.z)
  const reach = Math.hypot(local.x, local.z)
  const rawTurret = reach < 1e-9 ? preferred.turretRotationDeg : Math.atan2(local.x, local.z) / DEG
  const fitted = fitTurret(rawTurret, crane.limits.turretRotationDeg)
  const turret = fitted ?? clamp(rawTurret, crane.limits.turretRotationDeg)
  // Erro angular do giro fora da faixa, em metros no raio do gancho.
  const turretErrorM = fitted === null ? Math.abs(rawTurret - turret) * DEG * reach : 0

  const { boomPivotOffsetM: a, boomPivotHeightM: h } = crane.parameters
  const targetY = target.y - crane.groundY

  const attempt = (thetaDeg: number): CraneSolution & { distance: number } => {
    const cos = Math.cos(thetaDeg * DEG)
    const length = cos > 1e-6 ? (reach - a) / cos : Number.POSITIVE_INFINITY
    const clampedLength = Number.isFinite(length)
      ? clamp(length, crane.limits.boomLengthM)
      : crane.limits.boomLengthM.max
    const horizontal = a + clampedLength * cos
    const tipY = h + clampedLength * Math.sin(thetaDeg * DEG)
    const cable = tipY - targetY
    const clampedCable = clamp(cable, crane.limits.cableLengthM)
    const errorM = Math.hypot(horizontal - reach, cable - clampedCable, turretErrorM)
    return {
      state: {
        turretRotationDeg: turret,
        boomAngleDeg: thetaDeg,
        boomLengthM: clampedLength,
        cableLengthM: clampedCable,
      },
      reachable: errorM < REACH_TOLERANCE_M,
      errorM,
      distance: Math.abs(thetaDeg - preferred.boomAngleDeg),
    }
  }

  const preferredTheta = clamp(preferred.boomAngleDeg, crane.limits.boomAngleDeg)
  let best = attempt(preferredTheta)
  if (best.reachable) return strip(best)
  const { min, max } = crane.limits.boomAngleDeg
  // Lança toda recolhida ou toda estendida: o ângulo exato que fecha o raio (a grade não o pega).
  const exact = [crane.limits.boomLengthM.min, crane.limits.boomLengthM.max]
    .map((length) => (length > 0 ? Math.acos((reach - a) / length) / DEG : Number.NaN))
    .filter((theta) => Number.isFinite(theta) && theta >= min && theta <= max)
  const candidates: number[] = [...exact]
  for (let theta = min; theta <= max + 1e-9; theta += THETA_STEP_DEG) {
    candidates.push(Math.min(theta, max))
  }
  for (const thetaDeg of candidates) {
    const candidate = attempt(thetaDeg)
    // Erros abaixo de 1 mm empatam; aí vale o ângulo mais perto do preferido.
    const errorOf = (item: { errorM: number }): number => (item.errorM < 1e-3 ? 0 : item.errorM)
    const better =
      errorOf(candidate) < errorOf(best) - 1e-9 ||
      (Math.abs(errorOf(candidate) - errorOf(best)) <= 1e-9 && candidate.distance < best.distance)
    if (better) best = candidate
  }
  return strip(best)
}

function strip(solution: CraneSolution & { distance: number }): CraneSolution {
  return { state: solution.state, reachable: solution.reachable, errorM: solution.errorM }
}

/** Resultado de um quadro do tandem: os dois estados, os ganchos e a carga içada. */
export interface TandemFrame {
  readonly leaderState: TandemCraneState
  readonly followerState: TandemCraneState
  /** O guindaste que acompanha chega ao ponto dele. */
  readonly reachable: boolean
  readonly errorM: number
  readonly hooks: readonly [WorldPoint, WorldPoint]
  /** Carga içada: centro (x, z) e giro como `CargoPlacement`, e a altura da base (m). */
  readonly cargo: CargoPlacement & { readonly bottomY: number }
}

/**
 * Quadro do tandem para o estado do guindaste que conduz: a carga acompanha o gancho dele (mesmo
 * giro, translada com ele) e o guindaste que acompanha leva o gancho ao outro ponto de içamento, na
 * mesma altura. `followerPreferred` é o estado atual dele (para a solução ser contínua).
 */
export function tandemFrame(
  setup: TandemSetup,
  leaderState: TandemCraneState,
  followerPreferred: TandemCraneState,
): TandemFrame {
  const [point1, point2] = liftPointsWorld(setup.cargo, setup.load, setup.liftOffsets)
  const leaderHook = craneHookWorld(setup.leader, leaderState)
  const dx = leaderHook.x - point1.x
  const dz = leaderHook.z - point1.z
  const target: WorldPoint = { x: point2.x + dx, z: point2.z + dz, y: leaderHook.y }
  const solution = solveCraneForHook(setup.follower, target, followerPreferred)
  const followerHook = craneHookWorld(setup.follower, solution.state)
  return {
    leaderState,
    followerState: solution.state,
    reachable: solution.reachable,
    errorM: solution.errorM,
    hooks: [leaderHook, followerHook],
    cargo: {
      x: setup.cargo.x + dx,
      z: setup.cargo.z + dz,
      rotationYDeg: setup.cargo.rotationYDeg,
      bottomY: leaderHook.y - TANDEM_SLING_DROP_M - setup.load.heightM,
    },
  }
}

export interface EngageResult {
  readonly leaderState: TandemCraneState
  readonly followerState: TandemCraneState
  /** Os dois ganchos chegaram aos pontos de içamento. */
  readonly reachable: boolean
  /** Qual guindaste não alcança (1 conduz, 2 acompanha); vazio quando os dois alcançam. */
  readonly unreachable: readonly (1 | 2)[]
}

/** Leva os dois ganchos aos pontos de içamento, na altura de engate (carga no chão). */
export function engageTandem(
  setup: TandemSetup,
  leaderPreferred: TandemCraneState,
  followerPreferred: TandemCraneState,
): EngageResult {
  const [point1, point2] = liftPointsWorld(setup.cargo, setup.load, setup.liftOffsets)
  const y = engageHookHeightM(setup)
  const leader = solveCraneForHook(setup.leader, { ...point1, y }, leaderPreferred)
  const follower = solveCraneForHook(setup.follower, { ...point2, y }, followerPreferred)
  const unreachable: (1 | 2)[] = []
  if (!leader.reachable) unreachable.push(1)
  if (!follower.reachable) unreachable.push(2)
  return {
    leaderState: leader.state,
    followerState: follower.state,
    reachable: unreachable.length === 0,
    unreachable,
  }
}
