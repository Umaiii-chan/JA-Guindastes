// Seleção do catálogo compartilhada entre as páginas (TASK-039): a configuração escolhida no
// Catálogo continua escolhida no Simulador e nas Tabelas.

import { createContext, useContext } from 'react'

import type { CatalogBrowser, CatalogBrowserState } from '../../application/catalog/CatalogBrowser'

export interface CatalogContextValue {
  readonly catalog: CatalogBrowser
  readonly state: CatalogBrowserState
}

export const CatalogContext = createContext<CatalogContextValue | null>(null)

export function useCatalog(): CatalogContextValue {
  const value = useContext(CatalogContext)
  if (!value) throw new Error('useCatalog precisa de um <CatalogProvider> acima na árvore.')
  return value
}
