import { Box3, MathUtils, type Object3D, Vector3 } from 'three'

import {
  type OutriggerState,
  outriggersReady,
  RETRACTED_OUTRIGGERS,
} from '../../domain/crane/outriggers'
import { boxInFrameOf } from './rigLandmarks'

// Animação das patolas (leva E; TASK-054; ADR-024; RN-013). Só desenho: quem calcula é o backend
// (RN-008), com o estado que a tela envia. Desde a TASK-093 esse estado é `reportedState`, o que a
// animação já alcançou, e não o comando; a posição dos nós não entra em conta nenhuma.

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
  /** Estado desenhado no último marco da animação (ver `reportedState`). */
  private milestone: OutriggerState = RETRACTED_OUTRIGGERS
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

  /**
   * Estado que vale para a tela e para a avaliação (TASK-093, F-27): o que a animação já alcançou,
   * nunca mais do que o comando. Campo a campo, é o menos pronto entre o alvo e o desenho do último
   * marco: vigas chegando a 100 % ou saindo dele, macacos apoiando ou subindo, e o fim da animação.
   * Assim "pronta" só vale quando os macacos apoiam no desenho, e recolher deixa de valer na hora.
   * Entre os marcos o valor não muda, para não mandar um estado novo a cada quadro.
   */
  get reportedState(): OutriggerState {
    const { target, milestone } = this
    const jacksSet = target.jacksSet && milestone.jacksSet
    return {
      extensionPercent: Math.min(target.extensionPercent, milestone.extensionPercent),
      jacksSet,
      // Sem os macacos apoiados não há nivelamento (`levelingTarget`).
      levelingDeg: jacksSet ? Math.min(target.levelingDeg, milestone.levelingDeg) : 0,
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
    this.captureMilestone()
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
    if (changed) {
      this.apply()
      this.captureMilestone()
    }
    return changed
  }

  /** Guarda o desenho num marco da animação (ou o alvo, quando ela acaba); ver `reportedState`. */
  private captureMilestone(): void {
    if (!this.animating) {
      this.milestone = this.target
      return
    }
    const drawn = this.currentState
    const previous = this.milestone
    const full = drawn.extensionPercent >= 100
    if (drawn.jacksSet === previous.jacksSet && full === previous.extensionPercent >= 100) return
    this.milestone = {
      // Para baixo: nunca diz mais do que o desenho.
      extensionPercent: Math.floor(drawn.extensionPercent),
      jacksSet: drawn.jacksSet,
      levelingDeg: Math.floor(drawn.levelingDeg * 10) / 10,
    }
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
      // Base e centro do nó medidos direto no referencial da base do rig: valem com o chassi
      // inclinado no terreno (TASK-093), o que uma caixa no mundo não garante.
      // Sem malha, vale a origem do nó.
      const origin = root.worldToLocal(node.getWorldPosition(new Vector3()))
      const box = boxInFrameOf(root, node) ?? new Box3(origin, origin.clone())
      const centre = box.getCenter(new Vector3())
      rest = {
        x: node.position.x,
        y: node.position.y,
        z: node.position.z,
        bottomY: box.min.y,
        centreX: centre.x,
        centreZ: centre.z,
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

/**
 * `groundHeightAt` para o `OutriggerController` (TASK-093, F-25): converte a altura do terreno do
 * mundo (`worldHeightAt(x, z)`, como `terrainHeightAt`) para o referencial da base do rig. O ponto
 * (x, z) é da base; a resposta é o y da base onde a descida do macaco (o −Y da base) encontra o
 * terreno. Com o chassi inclinado, esse eixo não é a vertical do mundo: três iterações de ponto fixo
 * bastam para as inclinações de poucos graus do assentamento. Sem base, 0 (o plano de sempre).
 */
export function terrainHeightInFrame(
  getFrame: () => Object3D | null,
  worldHeightAt: (x: number, z: number) => number,
): (x: number, z: number) => number {
  const point = new Vector3()
  return (x, z) => {
    const frame = getFrame()
    if (!frame) return 0
    frame.updateWorldMatrix(true, false)
    let localY = 0
    for (let i = 0; i < 3; i++) {
      frame.localToWorld(point.set(x, localY, z))
      point.y = worldHeightAt(point.x, point.z)
      localY = frame.worldToLocal(point).y
    }
    return localY
  }
}

function approach(value: number, target: number, step: number): number {
  if (value < target) return Math.min(target, value + step)
  return Math.max(target, value - step)
}
