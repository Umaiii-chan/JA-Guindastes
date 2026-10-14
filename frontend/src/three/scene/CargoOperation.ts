import {
  type CargoState,
  type CargoStatus,
  cargoBaseY,
  cargoStatusKey,
  cargoStatusOf,
  clearResult,
  engageCargo,
  type HookReference,
  INACTIVE_CARGO,
  initialCargoState,
  releaseCargo,
  samePlacement,
} from '../../domain/cargo/cargoOperation'
import { GROUND_CARGO_ID, hookWorldFrame } from '../../domain/collision/collisions'
import {
  type CargoPlacement,
  EMPTY_SCENARIO,
  type Obstacle,
  type ScenarioSpec,
} from '../../domain/environment/environment'
import type { CraneGeometryParameters } from '../../domain/geometry/operationalGeometry'
import type { SwitchableCrane } from '../crane/SwitchableCrane'
import { DeliveryMarker } from './DeliveryMarker'
import { GroundCargo, PLACEHOLDER_CARGO_SIZE } from './GroundCargo'
import type { HookLoad } from './HookLoad'
import { type LoadDimensions, isValidLoad, sameLoad } from './loadBox'
import type { SceneCollisions } from './SceneCollisions'

export interface CargoOperationParts {
  readonly hookLoad: HookLoad
  readonly collisions: SceneCollisions
  readonly geometryParameters: CraneGeometryParameters
  /** Altura do terreno do cenário em uso. */
  readonly heightAt: (x: number, z: number) => number
}

/**
 * Coleta e entrega da carga na cena (TASK-073; ADR-035). Guarda onde a carga está (no chão ou no
 * gancho), desenha a caixa no chão e o ponto de entrega, liga e desliga a carga pendurada e a carga
 * como obstáculo das colisões, e responde a "engatar" e "soltar". As regras (distâncias, tolerâncias,
 * entrega) são de `domain/cargo/cargoOperation`.
 *
 * Sem carga posicionada no cenário, nada muda: a carga das medidas fica pendurada no gancho, como
 * antes (modo livre). Só pré-visualização: capacidade e segurança são do backend (RN-008).
 */
export class CargoOperation {
  readonly ground = new GroundCargo()
  readonly delivery = new DeliveryMarker()

  private readonly parts: CargoOperationParts
  private spec: ScenarioSpec = EMPTY_SCENARIO
  private size: LoadDimensions | null = null
  private placement: CargoPlacement | null = null
  private live: CargoState | null = null
  /** Quadro de uma gravação em reprodução; vale no lugar do estado ao vivo. */
  private override: CargoState | null = null
  private startedAtMs: number | null = null
  private latest: CargoStatus = INACTIVE_CARGO
  private latestKey = cargoStatusKey(INACTIVE_CARGO)
  private listener: ((status: CargoStatus) => void) | null = null
  private disposed = false
  /** No tandem (TASK-074) a carga é a dos dois guindastes: esta fica guardada e não aparece. */
  private suspended = false

  private crane: SwitchableCrane | null = null

  constructor(parts: CargoOperationParts) {
    this.parts = parts
  }

  /** Liga os comandos do guindaste (criados depois, junto da cena): o estado do gancho e a guarda. */
  bindCrane(crane: SwitchableCrane): void {
    this.crane = crane
  }

  get status(): CargoStatus {
    return this.latest
  }

  /** Quem recebe a situação quando ela muda (a UI, a gravação). */
  setListener(listener: ((status: CargoStatus) => void) | null): void {
    this.listener = listener
    listener?.(this.latest)
  }

  /** Medidas da carga do passo "Carga" (`null` ou inválidas = sem caixa para desenhar). */
  setLoad(load: LoadDimensions | null): void {
    const next = isValidLoad(load) ? { ...load } : null
    if (sameLoad(next, this.size)) return
    this.size = next
    // Medidas novas: a carga volta ao chão, na posição escolhida.
    this.resetLive()
    this.sync()
  }

  /** Cenário: posição inicial da carga, ponto de entrega e terreno. */
  setScenario(spec: ScenarioSpec): void {
    this.spec = spec
    const placement = spec.cargo ?? null
    if (!samePlacement(placement, this.placement)) {
      this.placement = placement ? { ...placement } : null
      this.resetLive()
    }
    this.sync()
  }

  /**
   * Liga ou desliga a carga de um guindaste só. Com o tandem ativo (TASK-074), a mesma posição do
   * cenário vira a carga dos dois guindastes, desenhada pelo tandem: aqui não se desenha nada e
   * engatar e soltar ficam indisponíveis. Ao desligar o tandem, a carga volta ao chão.
   */
  setSuspended(suspended: boolean): void {
    if (suspended === this.suspended) return
    this.suspended = suspended
    this.resetLive()
    this.sync()
  }

  /** Mostra o estado de uma gravação (`null` volta ao estado ao vivo). */
  setPlayback(state: CargoState | null): void {
    this.override = state
    this.sync()
  }

  /** Reavalia engatar e soltar (o guindaste se moveu) e avisa se algo mudou. */
  refresh(): void {
    if (this.disposed) return
    this.publish()
  }

  /** Engata, se o gancho estiver perto da carga. Devolve se engatou. */
  engage(nowMs: number): boolean {
    const state = this.effectiveState()
    const size = this.size
    if (!state || !size || this.override || state.phase !== 'ground') return false
    const hook = this.hookReference()
    if (!cargoStatusOf(state, hook, size, this.spec.terrain, this.spec.delivery ?? null).canEngage)
      return false
    this.startedAtMs ??= nowMs
    this.live = engageCargo(clearResult(state), hook, size, this.spec.terrain)
    this.sync()
    return true
  }

  /** Solta, se a carga estiver perto do chão. Devolve se soltou. */
  release(nowMs: number): boolean {
    const state = this.effectiveState()
    const size = this.size
    if (!state || !size || this.override || state.phase !== 'hooked') return false
    const hook = this.hookReference()
    const delivery = this.spec.delivery ?? null
    if (!cargoStatusOf(state, hook, size, this.spec.terrain, delivery).canRelease) return false
    const next = releaseCargo(
      state,
      hook,
      size,
      this.spec.terrain,
      delivery,
      this.startedAtMs === null ? null : nowMs - this.startedAtMs,
    )
    this.live = next
    if (next.result === 'delivered') this.startedAtMs = null
    this.sync()
    return true
  }

  /** Volta a carga ao chão, na posição escolhida, e zera o resultado. */
  reset(): void {
    this.resetLive()
    this.sync()
  }

  dispose(): void {
    this.disposed = true
    this.listener = null
    this.ground.dispose()
    this.delivery.dispose()
  }

  private resetLive(): void {
    this.live = this.placement ? initialCargoState(this.placement) : null
    this.startedAtMs = null
  }

  private effectiveState(): CargoState | null {
    if (this.suspended || !this.placement || !this.size) return null
    return this.override ?? this.live
  }

  private requireCrane(): SwitchableCrane {
    if (!this.crane) throw new Error('O guindaste ainda não foi ligado à carga.')
    return this.crane
  }

  private hookReference(): HookReference {
    const { frame, yawDeg } = hookWorldFrame({
      state: this.requireCrane().getState(),
      geometryParameters: this.parts.geometryParameters,
      scenario: this.spec,
    })
    return {
      frame,
      yawDeg,
      attachOffsetM: this.parts.hookLoad.currentAttachOffsetM,
      accessoriesDropM: this.parts.hookLoad.currentAccessoriesDropM,
    }
  }

  /** Redesenha tudo conforme o estado e avisa a UI. */
  private sync(): void {
    if (this.disposed) return
    const { hookLoad, collisions, heightAt } = this.parts
    const state = this.effectiveState()
    const size = this.size
    const delivery = this.spec.delivery ?? null
    const delivered = state?.result === 'delivered'

    if (this.placement && size && state) {
      if (state.phase === 'hooked' && state.hooked) {
        hookLoad.setLoad(size, state.hooked)
        this.ground.show(null, null, 0)
        collisions.setGroundCargo(null)
      } else {
        hookLoad.setLoad(null)
        const baseY = cargoBaseY(this.spec.terrain, size, state)
        this.ground.show(size, state, baseY, delivered)
        collisions.setGroundCargo(groundObstacle(size, state, heightAt(state.x, state.z), baseY))
      }
    } else {
      // Sem carga posicionada (ou sem medidas): a carga das medidas fica no gancho, como antes; o
      // marcador provisório só aparece quando há posição e ainda faltam as medidas.
      hookLoad.setLoad(size)
      collisions.setGroundCargo(null)
      if (this.placement && !this.suspended) {
        const baseY = cargoBaseY(this.spec.terrain, PLACEHOLDER_CARGO_SIZE, this.placement)
        this.ground.show(null, this.placement, baseY)
      } else {
        this.ground.show(null, null, 0)
      }
    }
    this.delivery.setDelivery(delivery, heightAt, delivered)
    this.crane?.revalidate()
    this.publish()
  }

  private publish(): void {
    const state = this.effectiveState()
    const size = this.size
    const next =
      state && size && this.crane
        ? cargoStatusOf(
            state,
            this.hookReference(),
            size,
            this.spec.terrain,
            this.spec.delivery ?? null,
          )
        : { ...INACTIVE_CARGO, hasDelivery: this.spec.delivery !== undefined }
    const key = cargoStatusKey(next)
    this.latest = next
    if (key === this.latestKey) return
    this.latestKey = key
    this.listener?.(next)
  }
}

/**
 * A carga no chão como obstáculo: a base fica no terreno do centro e a altura cobre até o topo da
 * carga, que assenta no ponto mais alto da pegada.
 */
function groundObstacle(
  size: LoadDimensions,
  pose: { readonly x: number; readonly z: number; readonly rotationYDeg: number },
  centerGroundY: number,
  baseY: number,
): Obstacle {
  return {
    id: GROUND_CARGO_ID,
    label: 'Carga',
    kind: 'box',
    centerX: pose.x,
    centerZ: pose.z,
    widthM: size.widthM,
    depthM: size.lengthM,
    heightM: size.heightM + Math.max(0, baseY - centerGroundY),
    rotationYDeg: pose.rotationYDeg,
  }
}
