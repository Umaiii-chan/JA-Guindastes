import {
  type AccessoryChainSpan,
  type CollisionHit,
  type CollisionReport,
  type CollisionState,
  type CraneBody,
  evaluateCollisions,
} from '../../domain/collision/collisions'
import type { CranePayload } from '../../domain/collision/multiCraneCollisions'
import {
  EMPTY_SCENARIO,
  type Obstacle,
  type ScenarioSpec,
} from '../../domain/environment/environment'
import type { CraneGeometryParameters } from '../../domain/geometry/operationalGeometry'
import type { CraneRig } from '../crane/CraneController'
import { measureCraneBody } from '../crane/craneBody'
import type { CollisionGuard } from '../crane/SwitchableCrane'
import type { CraneState } from '../crane/types'
import { CollisionHighlight } from './CollisionHighlight'
import type { HookLoad } from './HookLoad'

/**
 * Liga o domínio de colisões (`domain/collision`) à cena (TASK-053; ADR-028): guarda os dados do
 * cenário (só para colidir; quem desenha terreno e obstáculos é a TASK-052), mede o corpo do rig em
 * uso, lê a caixa da carga e do gancho e destaca em vermelho o que foi atingido.
 */
export class SceneCollisions implements CollisionGuard {
  readonly highlight = new CollisionHighlight()

  private scenario: ScenarioSpec = EMPTY_SCENARIO
  /** Carga apoiada no chão (TASK-073): vale como obstáculo até ser engatada. */
  private groundCargo: Obstacle | null = null
  private effective: ScenarioSpec = EMPTY_SCENARIO
  private body: CraneBody
  private latest: CollisionState = {
    hits: [],
    alerts: [],
    penetrationM: 0,
    blocked: false,
  }
  private listener: ((state: CollisionState) => void) | null = null
  /** Nome deste guindaste nas colisões com os outros (TASK-091); `null` com um guindaste só. */
  private ownerLabel: string | null = null

  private readonly hookLoad: HookLoad
  private readonly geometryParameters: CraneGeometryParameters

  constructor(rig: CraneRig, hookLoad: HookLoad, geometryParameters: CraneGeometryParameters) {
    this.hookLoad = hookLoad
    this.geometryParameters = geometryParameters
    this.body = measureCraneBody(rig)
  }

  /** Caixas do corpo do guindaste medidas no rig em uso. */
  get currentBody(): CraneBody {
    return this.body
  }

  /** Cenário usado nos testes de colisão. */
  get currentScenario(): ScenarioSpec {
    return this.scenario
  }

  /** Cenário com a carga apoiada no chão (TASK-073), como a guarda o enxerga. */
  get effectiveScenario(): ScenarioSpec {
    return this.effective
  }

  /** Último estado de colisão informado pela guarda. */
  get state(): CollisionState {
    return this.latest
  }

  setScenario(spec: ScenarioSpec): void {
    this.scenario = spec
    this.rebuildEffective()
  }

  /**
   * Carga apoiada no chão (TASK-073; ADR-035), como caixa que o gancho, o guindaste e a lança não
   * podem atravessar; `null` quando a carga está engatada (ela então colide pendurada) ou não existe.
   */
  setGroundCargo(cargo: Obstacle | null): void {
    this.groundCargo = cargo
    this.rebuildEffective()
  }

  private rebuildEffective(): void {
    this.effective = this.groundCargo
      ? { ...this.scenario, obstacles: [...this.scenario.obstacles, this.groundCargo] }
      : this.scenario
  }

  /** Mede o corpo de novo, depois da troca do guindaste provisório pelo modelo 3D. */
  setRig(rig: CraneRig): void {
    this.body = measureCraneBody(rig)
  }

  /** Quem recebe o estado de colisão quando ele muda (a UI, a gravação). */
  setListener(listener: ((state: CollisionState) => void) | null): void {
    this.listener = listener
  }

  /**
   * Nome do guindaste (TASK-091): com vários na cena, a carga de um pode encostar no outro, e o
   * destaque vermelho só vale para a carga deste.
   */
  setOwnerLabel(label: string | null): void {
    this.ownerLabel = label
  }

  /**
   * Cadeia de acessórios pendurada no gancho (TASK-056; TASK-091): parte do ponto de amarração e desce
   * a soma das alturas, os mesmos valores com que a cena desce a carga.
   */
  private chain(): AccessoryChainSpan | null {
    const dropM = this.hookLoad.currentAccessoriesDropM
    return dropM > 0 ? { topM: this.hookLoad.currentAttachOffsetM, dropM } : null
  }

  /** O que pende do gancho agora (carga, gancho e cadeia), para a colisão com outros guindastes. */
  payload(): CranePayload {
    return {
      geometryParameters: this.geometryParameters,
      load: this.hookLoad.currentLayout,
      hook: this.hookLoad.currentHookBox,
      chain: this.chain(),
    }
  }

  evaluate(state: CraneState): CollisionReport {
    return evaluateCollisions({
      state,
      scenario: this.effective,
      body: this.body,
      ...this.payload(),
    })
  }

  /** Estado depois de um comando (ou de uma reavaliação): pinta o que foi atingido e avisa. */
  onResult(result: CollisionState): void {
    this.latest = result
    this.hookLoad.setCollisionHighlight(result.hits.some((hit) => this.isOwnLoad(hit)))
    this.highlight.show(result)
    this.listener?.(result)
  }

  /** A carga atingida é a deste guindaste (e não a de outro que encostou nele)? */
  private isOwnLoad(hit: CollisionHit): boolean {
    return hit.subject === 'load' && (hit.owner === undefined || hit.owner === this.ownerLabel)
  }

  dispose(): void {
    this.listener = null
    this.highlight.dispose()
  }
}
