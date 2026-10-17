// Folha aberta no simulador (TASK-095; ADR-042), para os controles que estão fora das folhas (o chip
// de contexto, o estado das patolas na barra de comando) abrirem a folha certa.

import { createContext, useContext } from 'react'

/** Folhas da barra de ferramentas, na ordem em que aparecem. */
export type SimulatorSheetId =
  'setup' | 'accessories' | 'environment' | 'tandem' | 'planning' | 'recordings'

export interface SimulatorLayout {
  readonly activeSheet: SimulatorSheetId | null
  openSheet(id: SimulatorSheetId): void
  closeSheet(): void
}

export const SimulatorLayoutContext = createContext<SimulatorLayout | null>(null)

/** Layout do simulador, ou `null` fora dele (ex.: num teste de componente isolado). */
export function useSimulatorLayout(): SimulatorLayout | null {
  return useContext(SimulatorLayoutContext)
}
