// Passos do simulador guiado (ADR-017 § 2; TASK-039): 1 Guindaste → 2 Carga → 3 Posição.
//
// Cada passo está `complete` (concluído), `current` (liberado e por fazer) ou `pending` (bloqueado).
// Um passo só é liberado quando todos os anteriores estão concluídos; se um anterior deixa de estar
// (ex.: a configuração foi desmarcada), os seguintes voltam a ficar bloqueados.

export type GuidedStepId = 'crane' | 'load' | 'position'

export type GuidedStepStatus = 'pending' | 'current' | 'complete'

export const GUIDED_STEPS: readonly GuidedStepId[] = ['crane', 'load', 'position']

/** O que conclui cada passo. */
export interface GuidedProgress {
  /** Passo 1: há configuração escolhida na seleção fabricante → guindaste → configuração. */
  readonly configurationChosen: boolean
  /** Passo 2: o formulário de carga inteiro é válido (o peso vai para a avaliação). */
  readonly loadValid: boolean
  /** Passo 3: o backend devolveu um resultado para o estado atual (sem erro). */
  readonly evaluated: boolean
}

export type GuidedStepStatuses = Readonly<Record<GuidedStepId, GuidedStepStatus>>

export function guidedStepStatuses(progress: GuidedProgress): GuidedStepStatuses {
  const done: Record<GuidedStepId, boolean> = {
    crane: progress.configurationChosen,
    load: progress.loadValid,
    position: progress.evaluated,
  }
  const statuses = {} as Record<GuidedStepId, GuidedStepStatus>
  let unlocked = true
  for (const id of GUIDED_STEPS) {
    if (!unlocked) statuses[id] = 'pending'
    else if (done[id]) statuses[id] = 'complete'
    else {
      statuses[id] = 'current'
      unlocked = false
    }
  }
  return statuses
}

export function isStepUnlocked(statuses: GuidedStepStatuses, id: GuidedStepId): boolean {
  return statuses[id] !== 'pending'
}

/**
 * Passo que fica aberto: o pedido, se estiver liberado; senão o primeiro por fazer (ou o último, se
 * todos estiverem concluídos).
 */
export function resolveActiveStep(
  statuses: GuidedStepStatuses,
  requested: GuidedStepId,
): GuidedStepId {
  if (isStepUnlocked(statuses, requested)) return requested
  return (
    GUIDED_STEPS.find((id) => statuses[id] === 'current') ?? GUIDED_STEPS[GUIDED_STEPS.length - 1]
  )
}

/** Passo seguinte na ordem, ou `null` no último. */
export function nextStep(id: GuidedStepId): GuidedStepId | null {
  const index = GUIDED_STEPS.indexOf(id)
  return GUIDED_STEPS[index + 1] ?? null
}

/** Quantos passos estão concluídos. */
export function completedStepCount(statuses: GuidedStepStatuses): number {
  return GUIDED_STEPS.filter((id) => statuses[id] === 'complete').length
}
