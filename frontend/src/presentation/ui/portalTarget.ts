// Onde as janelas (`Dialog`, `Drawer`) são montadas (TASK-095; F-21). Por padrão, no `document.body`.
// Em tela cheia nativa, o navegador só desenha a subárvore do elemento em tela cheia: uma janela
// montada no `body` ficaria invisível atrás dele. O simulador troca o alvo pelo próprio palco enquanto
// a tela cheia (nativa ou por CSS) estiver ligada.

import { createContext, useContext } from 'react'

export const PortalTargetContext = createContext<HTMLElement | null>(null)

/** Elemento que recebe os portais das janelas: o do contexto, ou o `document.body`. */
export function usePortalTarget(): HTMLElement {
  return useContext(PortalTargetContext) ?? document.body
}
