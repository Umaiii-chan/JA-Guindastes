import { Box3, MathUtils, type Object3D, Vector3 } from 'three'

import {
  type OutriggerState,
  outriggersReady,
  RETRACTED_OUTRIGGERS,
} from '../../domain/crane/outriggers'

// Animação das patolas (leva E; TASK-054; ADR-024; RN-013). Só desenho: o estado que vale para o
// cálculo é o enviado ao backend (RN-008), não a posição dos nós.

/** Posições das patolas: dianteira/traseira, esquerda/direita. */
export const OUTRIGGER_POSITIONS = ['fl', 'fr', 'rl', 'rr'] as const
export type OutriggerPosition = (typeof OUTRIGGER_POSITIONS)[number]
export type OutriggerPart = 'beam' | 'jack' | 'pad'

/** Nome do nó do GLB (contrato da leva E): `crane-outrigger-{fl,fr,rl,rr}-{beam,jack,pad}`. */
export function outriggerNodeName(position: OutriggerPosition, part: OutriggerPart): string {
  return `crane-outrigger-${position}-${part}`
}

/** Correção máxima dos macacos (graus) enquanto o catálogo não traz `max_leveling_deg`. FICTÍCIO. */
export const FICTITIOUS_MAX_LEVELING_DEG = 3

/** Curso das vigas (m) quando o modelo não diz. FICTÍCIO. */
export const FICTITIOUS_BEAM_TRAVEL_M = 1.2

/** Velocidades da animação (por segundo). As vigas vão a 100 % em 3 s; os macacos, em 1,5 s. */
const EXTENSION_PERCENT_PER_S = 100 / 3
const JACK_FRACTION_PER_S = 1 / 1.5
const LEVELING_FRACTION_PER_S = 1 / 2

export interface OutriggerControllerOptions {
  /** Raiz onde procurar os nós (a base do rig atual, que muda quando o GLB chega). */
  readonly getRoot: () => Object3D | null
  /** Pede um quadro novo: a renderização é sob demanda. */
  readonly invalidate: () => void
  /** Correção máxima do nivelamento, em graus. Padrão: FICTÍCIA (3°). */
  readonly maxLevelingDeg?: number
  /** Curso das vigas (m). Padrão: FICTÍCIO. */
  readonly beamTravelM?: number
  /** Altura do terreno sob a posição (x, z) da base, em y da base. Padrão: plano em 0. */
  readonly groundHeightAt?: (x: number, z: number) => number
  /** Sem animação (`prefers-reduced-motion`): o estado vale na hora. */
  readonly reducedMotion?: boolean
}

interface Rest {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly bottomY: number
  readonly centreX: number
  readonly centreZ: number
}

/**
 * Estende as vigas de 0 a 100 %, desce os macacos até o terreno e nivela até `maxLevelingDeg`,
 * animado. Move só os nós `crane-outrigger-*` que o modelo 3D tiver; sem eles, o estado continua
 * valendo (a UI e o backend), mas nada é desenhado: nada é modelado por código como substituto.
 */
export class OutriggerController {
  private readonly options: OutriggerControllerOptions
  readonly maxLevelingDeg: number
  private readonly beamTravelM: number

  private target: OutriggerState = RETRACTED_OUTRIGGERS
  private extensionPercent = 0
  private jackFraction = 0
  private levelingFraction = 0
  private lastMs: number | null = null
  private readonly rests = new Map<Object3D, Rest>()

  constructor(options: OutriggerControllerOptions) {
    this.options = options
    this.maxLevelingDeg = options.maxLevelingDeg ?? FICTITIOUS_MAX_LEVELING_DEG
    this.beamTravelM = options.beamTravelM ?? FICTITIOUS_BEAM_TRAVEL_M
  }

  /** Estado desejado, com a extensão e o nivelamento dentro dos limites. */
  get targetState(): OutriggerState {
    return this.target
  }

  /** Estado desenhado agora (no meio da animação, entre o anterior e o desejado). */
  get currentState(): OutriggerState {
    return {
      extensionPercent: this.extensionPercent,
      jacksSet: this.jackFraction >= 1,
      levelingDeg: this.levelingFraction * this.maxLevelingDeg,
    }
  }

  /** `true` se o modelo 3D tem ao menos um nó de patola. */
  hasModel(): boolean {
    return this.findNodes().length > 0
  }

  /** Define o estado desejado; a animação anda em `update`. */
  setState(state: OutriggerState): void {
    this.target = {
      extensionPercent: MathUtils.clamp(state.extensionPercent, 0, 100),
      jacksSet: state.jacksSet,
      levelingDeg: MathUtils.clamp(state.levelingDeg, 0, this.maxLevelingDeg),
    }
    if (this.options.reducedMotion) {
      this.extensionPercent = this.target.extensionPercent
      this.jackFraction = this.jackTarget()
      this.levelingFraction = this.levelingTarget()
      this.apply()
    }
    this.options.invalidate()
  }

  /** `true` enquanto o desenho ainda não alcançou o estado desejado. */
  get animating(): boolean {
    return (
      this.extensionPercent !== this.target.extensionPercent ||
      this.jackFraction !== this.jackTarget() ||
      this.levelingFraction !== this.levelingTarget()
    )
  }

  /**
   * Avança a animação até `nowMs` (ms). Devolve `true` se algo mudou neste quadro. Ordem natural:
   * os macacos só descem com as vigas estendidas e sobem antes de as vigas recolherem.
   */
  update(nowMs: number): boolean {
    const dt = this.lastMs === null ? 0 : Math.min((nowMs - this.lastMs) / 1000, 0.1)
    this.lastMs = nowMs
    if (!this.animating) return false
    const before = [this.extensionPercent, this.jackFraction, this.levelingFraction]

    const wantsJacksDown = this.jackTarget() === 1
    const jackStep = JACK_FRACTION_PER_S * dt
    if (!wantsJacksDown) {
      // Primeiro sobem os macacos (e o nivelamento volta); só depois as vigas recolhem.
      this.levelingFraction = approach(this.levelingFraction, 0, LEVELING_FRACTION_PER_S * dt)
      if (this.levelingFraction === 0) {
        this.jackFraction = approach(this.jackFraction, 0, jackStep)
      }
      if (this.jackFraction === 0) {
        this.extensionPercent = approach(
          this.extensionPercent,
          this.target.extensionPercent,
          EXTENSION_PERCENT_PER_S * dt,
        )
      }
    } else {
      this.extensionPercent = approach(
        this.extensionPercent,
        Math.max(this.target.extensionPercent, 0),
        EXTENSION_PERCENT_PER_S * dt,
      )
      if (this.extensionPercent >= this.target.extensionPercent) {
        this.jackFraction = approach(this.jackFraction, 1, jackStep)
      }
      if (this.jackFraction === 1) {
        this.levelingFraction = approach(
          this.levelingFraction,
          this.levelingTarget(),
          LEVELING_FRACTION_PER_S * dt,
        )
      }
    }
    const changed =
      before[0] !== this.extensionPercent ||
      before[1] !== this.jackFraction ||
      before[2] !== this.levelingFraction
    if (changed) this.apply()
    return changed
  }

  /** Pronta para a tabela de carga: vigas a 100 % e macacos apoiados (RN-013). */
  isReady(): boolean {
    return outriggersReady(this.currentState)
  }

  private jackTarget(): number {
    return this.target.jacksSet ? 1 : 0
  }

  private levelingTarget(): number {
    return this.target.jacksSet && this.maxLevelingDeg > 0
      ? this.target.levelingDeg / this.maxLevelingDeg
      : 0
  }

  private findNodes(): Object3D[] {
    const root = this.options.getRoot()
    if (!root) return []
    const nodes: Object3D[] = []
    for (const position of OUTRIGGER_POSITIONS) {
      for (const part of ['beam', 'jack', 'pad'] as const) {
        const node = root.getObjectByName(outriggerNodeName(position, part))
        if (node) nodes.push(node)
      }
    }
    return nodes
  }

  /** Pose de repouso do nó, medida na primeira vez que ele é visto (antes de qualquer movimento). */
  private restOf(root: Object3D, node: Object3D): Rest {
    let rest = this.rests.get(node)
    if (!rest) {
      const box = new Box3().setFromObject(node)
      const centre = box.getCenter(new Vector3())
      rest = {
        x: node.position.x,
        y: node.position.y,
        z: node.position.z,
        // Base e centro do nó, no referencial da base do rig.
        bottomY: root.worldToLocal(new Vector3(centre.x, box.min.y, centre.z)).y,
        centreX: root.worldToLocal(centre.clone()).x,
        centreZ: root.worldToLocal(centre.clone()).z,
      }
      this.rests.set(node, rest)
    }
    return rest
  }

  /** Reaplica o estado desenhado, por exemplo quando o modelo 3D acaba de chegar. */
  reapply(): void {
    this.apply()
  }

  /** Posiciona os nós do modelo (se houver) para o estado desenhado. */
  private apply(): void {
    const root = this.options.getRoot()
    if (!root) return
    root.updateMatrixWorld(true)
    // Primeiro mede o repouso de todos os nós; só depois move.
    const found = OUTRIGGER_POSITIONS.map((position) => ({
      position,
      beam: root.getObjectByName(outriggerNodeName(position, 'beam')),
      jack: root.getObjectByName(outriggerNodeName(position, 'jack')),
      pad: root.getObjectByName(outriggerNodeName(position, 'pad')),
    }))
    for (const { beam, jack, pad } of found) {
      for (const node of [beam, jack, pad]) if (node) this.restOf(root, node)
    }
    const extension = this.extensionPercent / 100
    for (const { position, beam, jack, pad } of found) {
      const shift = (position.endsWith('l') ? 1 : -1) * extension * this.beamTravelM
      for (const node of [beam, jack, pad]) {
        if (node) node.position.x = this.restOf(root, node).x + shift
      }
      const reference = pad ?? jack
      if (!reference) continue
      const rest = this.restOf(root, reference)
      const ground = this.options.groundHeightAt?.(rest.centreX + shift, rest.centreZ) ?? 0
      // Desce até o terreno: da base da sapata (ou do macaco, sem sapata) até a altura dele.
      const drop = Math.max(0, rest.bottomY - ground) * this.jackFraction
      for (const node of [jack, pad]) {
        if (node) node.position.y = this.restOf(root, node).y - drop
      }
    }
    this.options.invalidate()
  }
}

function approach(value: number, target: number, step: number): number {
  if (value < target) return Math.min(target, value + step)
  return Math.max(target, value - step)
}
