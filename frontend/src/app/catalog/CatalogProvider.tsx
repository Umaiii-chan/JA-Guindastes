import { type ReactNode, useMemo } from 'react'

import { useCatalogBrowser } from '../useCatalogBrowser'
import { CatalogContext } from './catalogContext'

/** Uma `CatalogBrowser` para a aplicação inteira, com os fabricantes carregados na abertura. */
export function CatalogProvider({ children }: { readonly children: ReactNode }) {
  const { catalog, state } = useCatalogBrowser()
  const value = useMemo(() => ({ catalog, state }), [catalog, state])
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>
}
