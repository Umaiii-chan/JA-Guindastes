// Rascunho do simulador guardado fora da página (TASK-039): a carga digitada e o passo aberto
// sobrevivem a uma ida ao Catálogo ou às Tabelas e à volta.

import { createContext, useContext } from 'react'

import type { LoadFormValues } from '../../application/load/loadForm'
import type { GuidedStepId } from '../../application/simulator/guidedSteps'

export interface SimulatorDraft {
  readonly load: LoadFormValues
  setLoad(values: LoadFormValues): void
  /** Passo que a pessoa abriu por último (a página resolve se ele está liberado). */
  readonly requestedStep: GuidedStepId
  setRequestedStep(step: GuidedStepId): void
  /** Cadeia de acessórios de içamento escolhida, do gancho para a carga (TASK-056). */
  readonly accessoryIds: readonly string[]
  setAccessoryIds(ids: readonly string[]): void
}

export const SimulatorDraftContext = createContext<SimulatorDraft | null>(null)

export function useSimulatorDraft(): SimulatorDraft {
  const draft = useContext(SimulatorDraftContext)
  if (!draft) throw new Error('useSimulatorDraft precisa de um <SimulatorDraftProvider>.')
  return draft
}
