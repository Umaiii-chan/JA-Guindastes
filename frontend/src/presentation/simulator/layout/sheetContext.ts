// Folhas laterais do simulador (TASK-095; ADR-042): o que um painel precisa saber da folha em que
// está. As folhas ESCONDEM o conteúdo fechado, não o desmontam (F-20): o estado do planejamento, a
// lista de cenários e as janelas da IA continuam vivos com a folha fechada.

import { createContext, useContext, useEffect, useRef } from 'react'

export interface SheetState {
  /** A folha está aberta (à vista). */
  readonly open: boolean
}

export const SheetContext = createContext<SheetState | null>(null)

/** `true` dentro de uma folha: o painel deixa o título com a folha, sem repeti-lo. */
export function useInSheet(): boolean {
  return useContext(SheetContext) !== null
}

/**
 * Chama `callback` cada vez que a folha que contém o componente abre (ex.: recarregar os cenários
 * salvos). Fora de uma folha, nunca chama.
 */
export function useOnSheetOpen(callback: (() => void) | undefined): void {
  const sheet = useContext(SheetContext)
  const callbackRef = useRef(callback)
  useEffect(() => {
    callbackRef.current = callback
  })
  const open = sheet?.open ?? false
  useEffect(() => {
    if (open) callbackRef.current?.()
  }, [open])
}
