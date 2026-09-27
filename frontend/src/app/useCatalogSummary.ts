// Resumo do catálogo para a página Início (TASK-039), lido do backend a cada visita.

import { useCallback, useEffect, useState } from 'react'

import { loadCatalogSummary } from '../application/catalog/catalogSummary'
import type { CatalogGateway } from '../application/catalog/ports'
import { createCatalogRestClient } from '../infrastructure/api/catalogRestClient'
import type { CatalogSummaryState } from '../presentation/pages/HomePage'

export function useCatalogSummary(gateway?: CatalogGateway): {
  readonly state: CatalogSummaryState
  reload(): void
} {
  const [client] = useState(() => gateway ?? createCatalogRestClient())
  const [state, setState] = useState<CatalogSummaryState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    loadCatalogSummary(client).then(
      (summary) => {
        if (!cancelled) setState({ status: 'loaded', summary })
      },
      (error: unknown) => {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : String(error)
          setState({ status: 'error', message })
        }
      },
    )
    return () => {
      cancelled = true
    }
  }, [client, attempt])

  const reload = useCallback(() => {
    setState({ status: 'loading' })
    setAttempt((value) => value + 1)
  }, [])

  return { state, reload }
}
