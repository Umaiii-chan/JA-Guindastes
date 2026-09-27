// Versões das tabelas de uma configuração, lidas a cada troca de configuração ou recarga (TASK-042).

import { useCallback, useEffect, useState } from 'react'

import {
  type KnownChartsStore,
  loadChartVersions,
  type LoadChartVersion,
  toLoadChartFailure,
} from '../../application/loadChart/chartVersions'
import type { LoadChartGateway } from '../../application/loadChart/ports'

export type ChartVersionsState =
  | { readonly status: 'idle'; readonly versions: readonly [] }
  | { readonly status: 'loading'; readonly versions: readonly LoadChartVersion[] }
  | { readonly status: 'loaded'; readonly versions: readonly LoadChartVersion[] }
  | {
      readonly status: 'error'
      readonly versions: readonly LoadChartVersion[]
      readonly error: string
    }

interface Result {
  readonly key: string
  readonly configurationId: string
  readonly state: ChartVersionsState
}

export interface ChartVersionsApi {
  readonly state: ChartVersionsState
  reload(): void
  /** Passa a acompanhar a tabela (id) nesta configuração e recarrega a lista. */
  track(chartId: string): void
}

export function useChartVersions(
  gateway: Pick<LoadChartGateway, 'getChart'>,
  store: KnownChartsStore,
  configurationId: string | null,
): ChartVersionsApi {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<Result | null>(null)
  const key = `${configurationId ?? ''}#${attempt}`

  useEffect(() => {
    if (configurationId === null) return
    let cancelled = false
    loadChartVersions(gateway, store, configurationId).then(
      ({ versions }) => {
        if (!cancelled) setResult({ key, configurationId, state: { status: 'loaded', versions } })
      },
      (error: unknown) => {
        if (cancelled) return
        setResult({
          key,
          configurationId,
          state: { status: 'error', versions: [], error: toLoadChartFailure(error).message },
        })
      },
    )
    return () => {
      cancelled = true
    }
  }, [gateway, store, configurationId, key])

  const reload = useCallback(() => setAttempt((value) => value + 1), [])

  const track = useCallback(
    (chartId: string) => {
      if (configurationId === null) return
      store.add({ chartId, configurationId, trackedAt: new Date().toISOString() })
      setAttempt((value) => value + 1)
    },
    [store, configurationId],
  )

  let state: ChartVersionsState
  if (configurationId === null) state = { status: 'idle', versions: [] }
  else if (result?.key === key) state = result.state
  else {
    // Recarregando a mesma configuração: a lista atual continua visível até a resposta chegar.
    const previous = result?.configurationId === configurationId ? result.state.versions : []
    state = { status: 'loading', versions: previous }
  }

  return { state, reload, track }
}
