// Catálogo inteiro para a página Catálogo (TASK-042), lido do backend na abertura e a cada recarga.

import { useCallback, useEffect, useState } from 'react'

import { type CatalogTree, loadCatalogTree } from '../../application/catalog/catalogTree'
import type { CatalogGateway } from '../../application/catalog/ports'

export type CatalogTreeState =
  | { readonly status: 'loading'; readonly tree: CatalogTree | null }
  | { readonly status: 'loaded'; readonly tree: CatalogTree }
  | { readonly status: 'error'; readonly tree: null; readonly error: string }

type TreeGateway = Pick<CatalogGateway, 'listManufacturers' | 'listCranes' | 'listConfigurations'>

export function useCatalogTree(gateway: TreeGateway): {
  readonly state: CatalogTreeState
  reload(): void
} {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{
    readonly attempt: number
    readonly state: CatalogTreeState
  } | null>(null)

  useEffect(() => {
    let cancelled = false
    loadCatalogTree(gateway).then(
      (tree) => {
        if (!cancelled) setResult({ attempt, state: { status: 'loaded', tree } })
      },
      (error: unknown) => {
        if (cancelled) return
        const message = error instanceof Error ? error.message : String(error)
        setResult({ attempt, state: { status: 'error', tree: null, error: message } })
      },
    )
    return () => {
      cancelled = true
    }
  }, [gateway, attempt])

  const reload = useCallback(() => setAttempt((value) => value + 1), [])

  // Recarregando: a árvore atual continua visível até a resposta chegar.
  const state: CatalogTreeState =
    result?.attempt === attempt
      ? result.state
      : { status: 'loading', tree: result?.state.tree ?? null }
  return { state, reload }
}
