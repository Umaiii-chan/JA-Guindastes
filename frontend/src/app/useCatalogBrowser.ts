// Composição da seleção e dos cadastros do catálogo com o cliente REST real (TASK-033), na mesma
// origem da página (proxy do Vite em dev; nginx no container).

import { useEffect, useState, useSyncExternalStore } from 'react'

import { CatalogBrowser, type CatalogBrowserState } from '../application/catalog/CatalogBrowser'
import { createCatalogRestClient } from '../infrastructure/api/catalogRestClient'

function createBrowserCatalog(): CatalogBrowser {
  return new CatalogBrowser(createCatalogRestClient())
}

export function useCatalogBrowser(): {
  readonly catalog: CatalogBrowser
  readonly state: CatalogBrowserState
} {
  const [catalog] = useState(createBrowserCatalog)
  const state = useSyncExternalStore(catalog.subscribe, catalog.getState)

  useEffect(() => {
    void catalog.loadManufacturers()
  }, [catalog])

  return { catalog, state }
}
