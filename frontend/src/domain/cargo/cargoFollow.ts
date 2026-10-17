// A carga solta sobre a carroceria de um caminhão acompanha o caminhão quando ele muda no editor do
// ambiente (TASK-103; ADR-047), sem Three.js: posição, giro e altura (a altura vem do apoio, que
// `cargoBaseY` recalcula a cada desenho). Eixos da cena (ADR-013): Y para cima; metros e graus (RN-006).

import { type LoadDimensions } from '../collision/loadBox'
import { mulVec, rotY } from '../collision/obb'
import { type Obstacle, type TerrainSpec } from '../environment/environment'
import { type CargoState, footprintCorners } from './cargoOperation'
import { loadBedsOf, loadBedUnder } from './loadBeds'

const DEG = Math.PI / 180

function normalizeDeg(deg: number): number {
  const wrapped = ((((deg + 180) % 360) + 360) % 360) - 180
  return Math.round(wrapped * 1000) / 1000
}

/**
 * Carga no chão apoiada na carroceria de um caminhão (a pegada cobre a carroceria em `before`): leva a
 * carga junto quando o mesmo caminhão (`id`) muda de lugar, de giro ou de tamanho em `after`. A
 * posição e o giro dela em relação ao caminhão se mantêm (as medidas da carga não mudam; o
 * afastamento do centro do caminhão acompanha a escala dele). Se o caminhão sumiu ou deixou de ter
 * carroceria, a carga fica onde está e assenta no apoio que houver ali (terreno ou outra carroceria),
 * porque a altura é sempre recalculada. Sem carroceria sob ela, ou com a carga no gancho, devolve o
 * mesmo `state`.
 */
export function followLoadBed(
  state: CargoState,
  size: LoadDimensions,
  before: readonly Obstacle[],
  after: readonly Obstacle[],
  terrain: TerrainSpec,
): CargoState {
  if (state.phase !== 'ground' || before === after) return state
  const bed = loadBedUnder(footprintCorners(size, state), loadBedsOf(before, terrain))
  if (!bed) return state
  const from = before.find((obstacle) => obstacle.id === bed.obstacleId)
  const to = after.find((obstacle) => obstacle.id === bed.obstacleId)
  if (!from || !to || to.kind !== 'model' || to.modelId !== from.modelId) return state
  const sameTruck =
    from.centerX === to.centerX &&
    from.centerZ === to.centerZ &&
    from.rotationYDeg === to.rotationYDeg &&
    from.widthM === to.widthM &&
    from.depthM === to.depthM
  if (sameTruck) return state

  const local = mulVec(rotY(-from.rotationYDeg * DEG), {
    x: state.x - from.centerX,
    y: 0,
    z: state.z - from.centerZ,
  })
  const scaled = {
    x: local.x * (from.widthM > 0 ? to.widthM / from.widthM : 1),
    y: 0,
    z: local.z * (from.depthM > 0 ? to.depthM / from.depthM : 1),
  }
  const world = mulVec(rotY(to.rotationYDeg * DEG), scaled)
  return {
    ...state,
    x: to.centerX + world.x,
    z: to.centerZ + world.z,
    rotationYDeg: normalizeDeg(state.rotationYDeg + (to.rotationYDeg - from.rotationYDeg)),
  }
}
