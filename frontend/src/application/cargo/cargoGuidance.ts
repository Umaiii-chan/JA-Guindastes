// Dicas da coleta e entrega da carga (TASK-073; ADR-035): o que a pessoa já fez, o que falta e o que
// dizer a ela. Texto de produto, em português e sem termos técnicos. As dicas orientam; nada trava o
// modo livre.

import {
  type CargoStatus,
  ENGAGE_HORIZONTAL_TOLERANCE_M,
  ENGAGE_MAX_GAP_M,
  ENGAGE_MIN_GAP_M,
  RELEASE_MAX_HEIGHT_M,
} from '../../domain/cargo/cargoOperation'
import { exceedsCapacity } from '../../domain/cargo/loadBeds'
import { formatClock } from '../recording/playback'

export type CargoStepId = 'position' | 'engage' | 'deliver'

export interface CargoGuidanceStep {
  readonly id: CargoStepId
  readonly label: string
  readonly done: boolean
}

export type CargoGuidanceTone = 'info' | 'ok' | 'warning'

export interface CargoGuidance {
  readonly steps: readonly CargoGuidanceStep[]
  /** Passo em andamento; `null` quando os três estão feitos. */
  readonly currentStep: CargoStepId | null
  readonly message: string
  readonly tone: CargoGuidanceTone
}

export interface CargoGuidanceInput {
  readonly status: CargoStatus
  /** A carga foi posicionada no cenário. */
  readonly cargoPlaced: boolean
  readonly deliveryPlaced: boolean
  /** Peso da carga (kg), se já informado: com ele a dica confere a capacidade do apoio (ADR-052). */
  readonly loadWeightKg?: number
}

/**
 * O que dizer do apoio sob a carga (ADR-052): a capacidade conhecida contra o peso, ou o rótulo FICTÍCIO
 * (sem capacidade conhecida, o peso não é conferido). Vazio sobre o terreno. A dica orienta; não trava.
 */
export function bedNote(
  status: CargoStatus,
  loadWeightKg?: number,
): { text: string; warning: boolean } | null {
  const bed = status.bed
  // Sobre o mesmo apoio de onde foi coletada, a carga já estava ali: a capacidade não se confere (ADR-052).
  if (!bed || bed.atPickup) return null
  if (bed.capacityKg === null) {
    return {
      text: ` Apoio: ${bed.label}. Apoio FICTÍCIO: a capacidade de carga não é conhecida e o peso não foi conferido.`,
      warning: false,
    }
  }
  const kg = (value: number) => `${value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} kg`
  if (loadWeightKg !== undefined && exceedsCapacity(bed, loadWeightKg)) {
    return {
      text: ` Atenção: ${bed.label} suporta no máximo ${kg(bed.capacityKg)} e a carga pesa ${kg(loadWeightKg)}.`,
      warning: true,
    }
  }
  return { text: ` Apoio: ${bed.label} (capacidade de ${kg(bed.capacityKg)}).`, warning: false }
}

/** O que conta como apoio nos textos da soltura: o chão ou o topo de um caminhão, carreta ou contêiner. */
const SUPPORT_TEXT = 'chão, carroceria, convés ou teto do contêiner'

function meters(value: number): string {
  return `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m`
}

/** Tempo da operação como "m:ss,d". */
export function formatOperationTime(ms: number): string {
  return formatClock(ms, true)
}

export function cargoGuidance({
  status,
  cargoPlaced,
  deliveryPlaced,
  loadWeightKg,
}: CargoGuidanceInput): CargoGuidance {
  const state = status.state
  const hooked = state?.phase === 'hooked'
  const delivered = state?.result === 'delivered'
  const steps: CargoGuidanceStep[] = [
    { id: 'position', label: 'Posicione a carga e a entrega', done: cargoPlaced && deliveryPlaced },
    { id: 'engage', label: 'Vá até a carga e engate', done: hooked === true || delivered },
    { id: 'deliver', label: 'Leve até a entrega e solte', done: delivered },
  ]
  const currentStep = steps.find((step) => !step.done)?.id ?? null

  if (!cargoPlaced) {
    return {
      steps,
      currentStep,
      tone: 'info',
      message:
        'Modo livre: a carga fica no gancho. Em Editar ambiente, escolha Posicionar carga para praticar a coleta e a entrega.',
    }
  }
  if (!deliveryPlaced) {
    return {
      steps,
      currentStep,
      tone: 'info',
      message:
        'Agora marque onde a carga deve chegar: em Editar ambiente, escolha Ponto de entrega.',
    }
  }
  if (!status.active) {
    return {
      steps,
      currentStep,
      tone: 'info',
      message: 'Preencha o peso e as medidas da carga no passo Carga para ela aparecer na cena.',
    }
  }
  if (delivered) {
    return {
      steps,
      currentStep,
      tone: 'ok',
      message:
        state?.elapsedMs === undefined
          ? 'Entregue! A carga está no ponto de entrega.'
          : `Entregue! A carga chegou ao ponto de entrega em ${formatOperationTime(state.elapsedMs)}.`,
    }
  }
  if (!hooked) {
    const prefix =
      state?.result === 'outside'
        ? 'Fora do ponto de entrega: a carga ficou onde caiu. Para tentar de novo, engate-a outra vez. '
        : ''
    const tone: CargoGuidanceTone = state?.result === 'outside' ? 'warning' : 'info'
    if (status.canEngage) {
      return {
        steps,
        currentStep,
        tone,
        message: `${prefix}O gancho está no lugar. Toque em Engatar.`,
      }
    }
    const needs: string[] = []
    if (status.offsetM !== null && status.offsetM > ENGAGE_HORIZONTAL_TOLERANCE_M) {
      needs.push(`alinhe o gancho com a carga (faltam ${meters(status.offsetM)})`)
    }
    if (status.gapM !== null && status.slingDropM !== null) {
      // F-19 (ADR-051): engata com as lingas esticadas, a `slingDropM` do topo (geometria única).
      const slack = status.gapM - status.slingDropM
      if (slack > ENGAGE_MAX_GAP_M) {
        needs.push(
          `baixe o gancho até ${meters(status.slingDropM)} do topo, onde as lingas esticam ` +
            `(está a ${meters(status.gapM)})`,
        )
      } else if (slack < ENGAGE_MIN_GAP_M) {
        needs.push(
          `suba o gancho até ${meters(status.slingDropM)} do topo: as lingas só esticam aí ` +
            `(está a ${meters(status.gapM)})`,
        )
      }
    }
    return {
      steps,
      currentStep,
      tone,
      message: `${prefix}Vá até a carga: ${needs.length > 0 ? needs.join(' e ') : 'aproxime o gancho'}.`,
    }
  }
  const bed = bedNote(status, loadWeightKg)
  if (status.canRelease) {
    return {
      steps,
      currentStep,
      tone: bed?.warning ? 'warning' : 'info',
      message:
        (status.distanceToDeliveryM === null
          ? `A carga está rente ao apoio (${SUPPORT_TEXT}). Toque em Soltar.`
          : `A carga está rente ao apoio (${SUPPORT_TEXT}), a ${meters(status.distanceToDeliveryM)} do centro da entrega. Toque em Soltar.`) +
        (bed?.text ?? ''),
    }
  }
  const parts: string[] = []
  if (status.distanceToDeliveryM !== null) {
    parts.push(`leve a carga até o ponto de entrega (faltam ${meters(status.distanceToDeliveryM)})`)
  }
  if (status.heightAboveGroundM !== null) {
    parts.push(
      `baixe-a até ${meters(RELEASE_MAX_HEIGHT_M)} do apoio, no chão ou sobre o veículo ou contêiner (está a ${meters(status.heightAboveGroundM)})`,
    )
  }
  return {
    steps,
    currentStep,
    tone: bed?.warning ? 'warning' : 'info',
    message: `Carga engatada: ${parts.join(' e ')}.${bed?.text ?? ''}`,
  }
}
