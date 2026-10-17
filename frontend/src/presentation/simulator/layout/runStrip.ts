// Onde a execução do planejamento aparece sobre a cena (TASK-104; ADR-048). A página do simulador
// publica o elemento da faixa; o painel de planejamento, que fica numa folha, monta nele (portal) a
// execução da trajetória e o passo a passo. A lógica continua no painel: só muda onde aparece.

import { createContext, useContext } from 'react'

export const RunStripTargetContext = createContext<HTMLElement | null>(null)

/** Elemento da faixa de execução, ou `null` fora do simulador (a execução fica no próprio painel). */
export function useRunStripTarget(): HTMLElement | null {
  return useContext(RunStripTargetContext)
}
