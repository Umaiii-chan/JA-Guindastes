// Composição do catálogo de acessórios (TASK-056) com o cliente REST real, na mesma origem da página.
// O catálogo é lido ao abrir o simulador; uma falha não impede a simulação sem acessórios.

import { useCallback, useEffect, useState } from 'react'

import type { AccessoryGateway } from '../application/accessory/ports'
import type { Accessory } from '../domain/accessory/accessory'
import { createAccessoryRestClient } from '../infrastructure/api/accessoryRestClient'

export interface AccessoryCatalogState {
  readonly status: 'loading' | 'loaded' | 'error'
  readonly items: readonly Accessory[]
  readonly error: string | null
}

const LOADING: AccessoryCatalogState = { status: 'loading', items: [], error: null }

export function useAccessoryCatalog(gateway?: AccessoryGateway): {
  readonly state: AccessoryCatalogState
  reload(): void
} {
  const [client] = useState(() => gateway ?? createAccessoryRestClient())
  const [state, setState] = useState<AccessoryCatalogState>(LOADING)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let current = true
    client
      .list()
      .then((items) => {
        if (current) setState({ status: 'loaded', items, error: null })
      })
      .catch((error: unknown) => {
        if (!current) return
        const message = error instanceof Error ? error.message : 'Falha ao carregar os acessórios.'
        setState({ status: 'error', items: [], error: message })
      })
    return () => {
      current = false
    }
  }, [client, attempt])

  const reload = useCallback(() => {
    setState(LOADING)
    setAttempt((value) => value + 1)
  }, [])

  return { state, reload }
}
