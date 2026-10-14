import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'

import type { CollisionReport, CollisionState } from '../../domain/collision/collisions'
import {
  evaluateMultiCraneCollisions,
  type HoistedCargo,
} from '../../domain/collision/multiCraneCollisions'
import type {
  CargoPlacement,
  CranePlacement,
  ScenarioSpec,
} from '../../domain/environment/environment'
import {
  engageTandem as solveEngage,
  type EngageResult,
  type TandemFrame,
  tandemFrame,
  type TandemLoad,
  type TandemSetup,
} from '../../domain/tandem/tandem'
import type { CollisionGuard } from '../crane/SwitchableCrane'
import type { CraneCommands, CraneSetup, CraneState } from '../crane/types'
import type { CraneSceneContents } from './buildCraneScene'
import { ExtraCrane } from './ExtraCrane'
import type { EvaluationStatus } from './palette'
import type { SceneCollisions } from './SceneCollisions'
import { createCraneTagElement } from './sceneLabels'
import { TandemCargo } from './TandemCargo'
import { type CraneModelLoader, upgradeCraneModel } from './upgradeCraneModel'

/** Id do guindaste principal nas guardas e no tandem. */
export const PRIMARY_CRANE_ID = 'primary'

/** Nome mostrado do guindaste principal. */
export const PRIMARY_CRANE_LABEL = 'Guindaste 1'

/** Altura (m) da etiqueta do guindaste principal acima do chassi. */
const PRIMARY_TAG_HEIGHT_M = 7

/** Quanto a base da carga pode estar acima do chão para ela contar como "apoiada" (m). */
const RESTING_TOLERANCE_M = 0.05

/** Guindaste adicional pedido à cena: o que a UI sabe dele (ficha da configuração e posição). */
export interface ExtraCraneInput {
  readonly id: string
  readonly label: string
  readonly setup: CraneSetup
  readonly placement: CranePlacement
}

/** Carga do tandem apoiada no chão, à espera do engate; o guindaste 2 é o que acompanha. */
export interface TandemSceneConfig {
  readonly followerId: string
  readonly load: TandemLoad
  readonly cargo: CargoPlacement
}

/** O que a UI recebe a cada quadro do tandem engatado. */
export interface TandemSceneFrame {
  readonly leaderState: CraneState
  readonly followerState: CraneState
  /** O guindaste que acompanha alcança o ponto de içamento dele. */
  readonly reachable: boolean
  readonly hooks: TandemFrame['hooks']
  readonly cargo: TandemFrame['cargo']
}

export type ReleaseResult =
  | { readonly released: true; readonly cargo: CargoPlacement }
  | { readonly released: false; readonly reason: 'in-air' | 'not-engaged' }

export interface MultiCraneOptions {
  readonly invalidate: () => void
  /** Carregador do modelo 3D dos guindastes adicionais; `null` fica no provisório. */
  readonly loadModel: CraneModelLoader | null
  readonly signal: AbortSignal
  readonly reducedMotion: boolean
  /** Estado de colisão dos comandos dos guindastes adicionais (o principal tem o próprio caminho). */
  readonly onCollision: (state: CollisionState) => void
  /** Os comandos de cada guindaste adicional, quando a lista muda. */
  readonly onExtrasChange: (commands: ReadonlyMap<string, CraneCommands>) => void
  /** Quadro do tandem (a cada comando) ou `null` quando ele não está engatado. */
  readonly onTandemFrame: (frame: TandemSceneFrame | null) => void
}

const EMPTY_REPORT: CollisionReport = { hits: [], alerts: [], penetrationM: 0 }

function combine(a: CollisionReport, b: CollisionReport): CollisionReport {
  if (b.hits.length === 0 && b.alerts.length === 0 && b.penetrationM === 0) return a
  if (a.hits.length === 0 && a.alerts.length === 0 && a.penetrationM === 0) return b
  return {
    hits: [...a.hits, ...b.hits],
    alerts: [...a.alerts, ...b.alerts],
    penetrationM: a.penetrationM + b.penetrationM,
  }
}

interface Member {
  readonly id: string
  readonly label: string
  readonly placement: CranePlacement
  readonly state: CraneState
  readonly collisions: SceneCollisions
}

/**
 * Vários guindastes numa cena (TASK-074; ADR-037): os adicionais do cenário, as colisões entre eles
 * e o içamento em tandem. O guindaste principal continua sendo o de `CraneSceneContents`; os outros
 * são `ExtraCrane`, cada um com o próprio rig, controller e guarda de colisões.
 *
 * No tandem engatado, o guindaste principal conduz: a cada comando aplicado, o outro leva o gancho
 * ao segundo ponto de içamento (cinemática inversa, `domain/tandem`) e a carga acompanha os dois.
 * A guarda de comandos do que conduz inclui o outro guindaste e a carga, então um movimento que um
 * deles não consegue seguir ou que faria algo colidir é cortado no último estado seguro. Tudo é
 * pré-visualização: a divisão da carga e os 75 % da capacidade vêm do backend (RN-008; RN-016).
 */
export class MultiCrane {
  private readonly contents: CraneSceneContents
  private readonly extras = new Map<string, ExtraCrane>()
  private readonly cargoView = new TandemCargo()
  private options: MultiCraneOptions | null = null
  private scenario: ScenarioSpec | null = null
  private tandem: TandemSceneConfig | null = null
  private engaged = false
  private engagedCargo: CargoPlacement | null = null
  private lastFrame: TandemFrame | null = null
  private primaryTag: CSS2DObject | null = null
  private disposed = false

  constructor(contents: CraneSceneContents) {
    this.contents = contents
    contents.scene.add(this.cargoView.root)
    contents.crane.setAppliedListener(() => this.syncTandem())
  }

  /** Liga a cena real (renderização, carregador do modelo, avisos para a UI). */
  configure(options: MultiCraneOptions): void {
    this.options = options
  }

  /** Quantos guindastes adicionais há. */
  get extraCount(): number {
    return this.extras.size
  }

  /** O tandem está engatado (os dois ganchos presos à carga)? */
  get isEngaged(): boolean {
    return this.engaged
  }

  get frame(): TandemFrame | null {
    return this.lastFrame
  }

  /** Guindaste adicional pelo id, ou `undefined`. */
  getExtra(id: string): ExtraCrane | undefined {
    return this.extras.get(id)
  }

  /** Os guindastes adicionais, na ordem em que foram adicionados. */
  allExtras(): readonly ExtraCrane[] {
    return [...this.extras.values()]
  }

  /** Centro (x, z) dos guindastes da cena, para o enquadramento da câmera. */
  centroid(): { x: number; y: number; z: number } {
    const anchors = [this.contents.craneAnchor, ...this.allExtras().map((extra) => extra.anchor)]
    const sum = anchors.reduce(
      (total, anchor) => ({
        x: total.x + anchor.position.x,
        y: total.y + anchor.position.y,
        z: total.z + anchor.position.z,
      }),
      { x: 0, y: 0, z: 0 },
    )
    return { x: sum.x / anchors.length, y: sum.y / anchors.length, z: sum.z / anchors.length }
  }

  /** Guarda de colisões do guindaste `id`: a própria (terreno, obstáculos, corpo) mais os outros. */
  guardFor(id: string, own: SceneCollisions): CollisionGuard {
    return {
      evaluate: (state) => combine(own.evaluate(state), this.crossReport(id, state)),
      onResult: (result) => {
        own.onResult(result)
        if (this.engaged) {
          this.cargoView.setCollisionHighlight(result.hits.some((hit) => hit.subject === 'load'))
        }
      },
    }
  }

  /** Cenário (terreno, obstáculos, vento…) usado para assentar e para colidir. */
  setScenario(spec: ScenarioSpec): void {
    this.scenario = spec
    for (const extra of this.extras.values()) {
      extra.setPlacement(spec.terrain, extra.placement)
      extra.collisions.setScenario({ ...spec, crane: extra.placement })
    }
    this.refreshTandemPreview()
    this.revalidateAll()
  }

  /** Define os guindastes adicionais: cria, atualiza a posição ou remove o que mudou. */
  setExtras(inputs: readonly ExtraCraneInput[]): void {
    const options = this.options
    if (this.disposed || !options) return
    const wanted = new Map(inputs.map((input) => [input.id, input]))
    for (const [id, extra] of [...this.extras]) {
      const input = wanted.get(id)
      if (input && JSON.stringify(input.setup) === JSON.stringify(extra.setup)) continue
      if (this.tandem?.followerId === id) this.forceRelease()
      extra.dispose()
      this.extras.delete(id)
    }
    const terrain = this.scenario?.terrain ?? this.contents.collisions.currentScenario.terrain
    for (const input of inputs) {
      const existing = this.extras.get(input.id)
      if (existing) {
        existing.setPlacement(terrain, input.placement)
        existing.collisions.setScenario({
          ...this.collisionScenario(),
          crane: input.placement,
        })
        continue
      }
      this.addExtra(input, terrain, options)
    }
    this.syncPrimaryTag()
    this.refreshTandemPreview()
    options.onExtrasChange(this.commands())
    this.revalidateAll()
    options.invalidate()
  }

  /** Mostra o novo posicionamento de um guindaste adicional durante o arrasto (sem avisar a UI). */
  previewPlacement(id: string, placement: CranePlacement): void {
    const extra = this.extras.get(id)
    if (!extra) return
    const terrain = this.scenario?.terrain ?? this.contents.collisions.currentScenario.terrain
    extra.setPlacement(terrain, placement)
    extra.collisions.setScenario({ ...this.collisionScenario(), crane: placement })
    this.options?.invalidate()
  }

  /** Carga do tandem no chão, com os pontos de içamento marcados; `null` desliga o tandem. */
  setTandemCargo(config: TandemSceneConfig | null): void {
    if (this.disposed) return
    if (config === null) {
      this.forceRelease()
      this.tandem = null
      this.cargoView.hide()
      this.options?.invalidate()
      return
    }
    this.tandem = config
    if (this.engaged) return
    this.refreshTandemPreview()
  }

  /**
   * Engata os dois ganchos nos pontos de içamento e liga o movimento sincronizado. Sem alcance
   * para algum dos dois, não muda nada e diz qual não alcança.
   */
  engage(): EngageResult | null {
    const setup = this.setup()
    if (!setup || this.disposed) return null
    const follower = this.extras.get(setup.followerId)
    if (!follower) return null
    const result = solveEngage(
      setup.value,
      this.contents.crane.getState(),
      follower.crane.getState(),
    )
    if (!result.reachable) return result
    this.contents.crane.applyUnguarded(result.leaderState)
    follower.crane.applyUnguarded(result.followerState)
    this.engaged = true
    this.engagedCargo = setup.value.cargo
    this.syncTandem()
    this.contents.crane.revalidate()
    return result
  }

  /** Solta a carga. Só com a carga apoiada no chão; devolve onde ela ficou. */
  release(): ReleaseResult {
    const frame = this.lastFrame
    const tandem = this.tandem
    if (!this.engaged || !frame || !tandem) return { released: false, reason: 'not-engaged' }
    const ground = this.contents.environment.heightAt(frame.cargo.x, frame.cargo.z)
    if (frame.cargo.bottomY > ground + RESTING_TOLERANCE_M) {
      return { released: false, reason: 'in-air' }
    }
    const cargo: CargoPlacement = {
      x: frame.cargo.x,
      z: frame.cargo.z,
      rotationYDeg: frame.cargo.rotationYDeg,
    }
    this.tandem = { ...tandem, cargo }
    this.endEngagement()
    this.refreshTandemPreview()
    return { released: true, cargo }
  }

  /** Situação (cor) do guindaste adicional e da carga içada. */
  setStatus(id: string, status: EvaluationStatus): void {
    this.extras.get(id)?.hookLoad.setStatus(status)
    this.options?.invalidate()
  }

  setCargoStatus(status: EvaluationStatus): void {
    this.cargoView.setStatus(status)
    this.options?.invalidate()
  }

  /** Avança a animação das patolas dos adicionais; `true` se algo se moveu. */
  update(nowMs: number): boolean {
    let moved = false
    for (const extra of this.extras.values()) {
      if (extra.outriggers.update(nowMs)) moved = true
    }
    return moved
  }

  /** O modelo 3D do principal chegou: os corpos mudaram, e o tandem precisa refazer o quadro. */
  onPrimaryModelChanged(): void {
    this.syncTandem()
    this.revalidateAll()
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.contents.crane.setAppliedListener(null)
    for (const extra of this.extras.values()) extra.dispose()
    this.extras.clear()
    this.syncPrimaryTag()
    this.cargoView.dispose()
  }

  // --- internos ----------------------------------------------------------------------------------

  /** Com mais de um guindaste na cena, o principal também ganha a etiqueta "Guindaste 1". */
  private syncPrimaryTag(): void {
    if (this.extras.size > 0 && !this.primaryTag) {
      this.primaryTag = new CSS2DObject(createCraneTagElement(PRIMARY_CRANE_LABEL))
      this.primaryTag.position.set(0, PRIMARY_TAG_HEIGHT_M, 0)
      this.contents.craneAnchor.add(this.primaryTag)
    } else if (this.extras.size === 0 && this.primaryTag) {
      this.primaryTag.element.remove()
      this.primaryTag.removeFromParent()
      this.primaryTag = null
    }
  }

  private commands(): ReadonlyMap<string, CraneCommands> {
    return new Map([...this.extras].map(([id, extra]) => [id, extra.crane]))
  }

  private collisionScenario(): ScenarioSpec {
    return this.scenario ?? this.contents.collisions.currentScenario
  }

  private addExtra(
    input: ExtraCraneInput,
    terrain: ScenarioSpec['terrain'],
    options: MultiCraneOptions,
  ): void {
    const extra = new ExtraCrane({
      id: input.id,
      label: input.label,
      setup: input.setup,
      scene: this.contents.scene,
      placement: input.placement,
      invalidate: options.invalidate,
      reducedMotion: options.reducedMotion,
    })
    extra.setPlacement(terrain, input.placement)
    extra.collisions.setScenario({ ...this.collisionScenario(), crane: input.placement })
    extra.collisions.setListener((state) => {
      options.invalidate()
      options.onCollision(state)
    })
    extra.crane.setCollisionGuard(this.guardFor(input.id, extra.collisions))
    this.extras.set(input.id, extra)
    if (options.loadModel) {
      void upgradeCraneModel(extra, options.loadModel, { signal: options.signal }).then(() => {
        if (this.disposed || this.extras.get(input.id) !== extra) return
        extra.outriggers.reapply()
        options.invalidate()
        extra.crane.revalidate()
        this.syncTandem()
      })
    }
  }

  private members(): Member[] {
    const primary: Member = {
      id: PRIMARY_CRANE_ID,
      label: PRIMARY_CRANE_LABEL,
      placement: this.contents.collisions.currentScenario.crane,
      state: this.contents.crane.getState(),
      collisions: this.contents.collisions,
    }
    const extras = [...this.extras.values()].map((extra): Member => ({
      id: extra.id,
      label: extra.label,
      placement: extra.placement,
      state: extra.crane.getState(),
      collisions: extra.collisions,
    }))
    return [primary, ...extras]
  }

  /** Colisões do guindaste `id` no estado `state` contra os outros e, no tandem, a carga. */
  private crossReport(id: string, state: CraneState): CollisionReport {
    const members = this.members()
    if (members.length < 2) return EMPTY_REPORT
    const states = new Map(members.map((member) => [member.id, member.state]))
    states.set(id, state)
    let cargo: HoistedCargo | null = null
    let extra = EMPTY_REPORT
    const setup = this.engaged ? this.setup() : null
    const tandem = this.tandem
    if (setup && tandem) {
      const follower = this.extras.get(setup.followerId)
      if (id === PRIMARY_CRANE_ID && follower) {
        const frame = tandemFrame(setup.value, state, follower.crane.getState())
        states.set(follower.id, frame.followerState)
        cargo = hoisted(frame.cargo, tandem.load)
        extra = follower.collisions.evaluate(frame.followerState)
        if (!frame.reachable) {
          extra = combine(extra, {
            hits: [
              {
                subject: 'crane',
                target: { kind: 'tandem-reach', craneLabel: follower.label },
              },
            ],
            alerts: [],
            penetrationM: frame.errorM,
          })
        }
      } else if (this.lastFrame) {
        cargo = hoisted(this.lastFrame.cargo, tandem.load)
      }
    }
    const multi = evaluateMultiCraneCollisions({
      scenario: this.collisionScenario(),
      cranes: members.map((member) => ({
        label: member.label,
        placement: member.placement,
        state: states.get(member.id) ?? member.state,
        body: member.collisions.currentBody,
      })),
      cargo,
    })
    return combine(multi, extra)
  }

  /** `TandemSetup` do estado da cena (posições, fichas, carga e terreno), ou `null` se faltar algo. */
  private setup(): { value: TandemSetup; followerId: string } | null {
    const tandem = this.tandem
    if (!tandem) return null
    const follower = this.extras.get(tandem.followerId)
    if (!follower) return null
    const { environment, collisions, crane } = this.contents
    const leaderPlacement = collisions.currentScenario.crane
    const cargo = this.engagedCargo ?? tandem.cargo
    return {
      followerId: tandem.followerId,
      value: {
        leader: {
          placement: leaderPlacement,
          groundY: environment.heightAt(leaderPlacement.x, leaderPlacement.z),
          parameters: this.contents.setup.geometryParameters,
          limits: crane.limits,
        },
        follower: {
          placement: follower.placement,
          groundY: environment.heightAt(follower.placement.x, follower.placement.z),
          parameters: follower.setup.geometryParameters,
          limits: follower.crane.limits,
        },
        load: tandem.load,
        cargo,
        cargoGroundY: environment.heightAt(cargo.x, cargo.z),
      },
    }
  }

  /** Depois de cada comando do que conduz: leva o outro guindaste e a carga à nova posição. */
  private syncTandem(): void {
    const options = this.options
    if (!this.engaged || this.disposed || !options) return
    const setup = this.setup()
    const tandem = this.tandem
    const follower = setup ? this.extras.get(setup.followerId) : undefined
    if (!setup || !tandem || !follower) return
    const frame = tandemFrame(
      setup.value,
      this.contents.crane.getState(),
      follower.crane.getState(),
    )
    follower.crane.applyUnguarded(frame.followerState)
    this.lastFrame = frame
    this.cargoView.showHoisted(frame.cargo, tandem.load, frame.hooks)
    options.invalidate()
    options.onTandemFrame({
      leaderState: frame.leaderState,
      followerState: frame.followerState,
      reachable: frame.reachable,
      hooks: frame.hooks,
      cargo: frame.cargo,
    })
  }

  /** Carga no chão com os marcadores (tandem configurado e ainda não engatado). */
  private refreshTandemPreview(): void {
    const tandem = this.tandem
    if (!tandem || this.engaged) {
      if (!tandem) this.cargoView.hide()
      return
    }
    const ground = this.contents.environment.heightAt(tandem.cargo.x, tandem.cargo.z)
    this.cargoView.showAtRest(tandem.cargo, tandem.load, ground)
    this.options?.invalidate()
  }

  private forceRelease(): void {
    if (!this.engaged) return
    this.endEngagement()
  }

  private endEngagement(): void {
    this.engaged = false
    this.engagedCargo = null
    this.lastFrame = null
    this.cargoView.setCollisionHighlight(false)
    this.options?.onTandemFrame(null)
    this.contents.crane.revalidate()
  }

  private revalidateAll(): void {
    this.contents.crane.revalidate()
    for (const extra of this.extras.values()) extra.crane.revalidate()
  }
}

function hoisted(cargo: TandemFrame['cargo'], load: TandemLoad): HoistedCargo {
  return {
    x: cargo.x,
    z: cargo.z,
    rotationYDeg: cargo.rotationYDeg,
    bottomY: cargo.bottomY,
    lengthM: load.lengthM,
    widthM: load.widthM,
    heightM: load.heightM,
  }
}
