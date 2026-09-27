// Versões das tabelas de uma configuração pela rota de listagem (TASK-044), lidas a cada troca de
// configuração e relidas depois de importar ou ativar (`reload`).

import { useCallback, useEffect, useState } from 'react'

import { toLoadChartFailure } from '../../application/loadChart/chartVersions'
import type { LoadChartGateway, LoadChartSummary } from '../../application/loadChart/ports'

export type ChartVersionsState =
  | { readonly status: 'idle'; readonly versions: readonly []; readonly activeChartId: null }
  | {
      readonly status: 'loading'
      readonly versions: readonly LoadChartSummary[]
      readonly activeChartId: string | null
    }
  | {
      readonly status: 'loaded'
      readonly versions: readonly LoadChartSummary[]
      readonly activeChartId: string | null
    }
  | {
      readonly status: 'error'
      readonly versions: readonly LoadChartSummary[]
      readonly activeChartId: string | null
      readonly error: string
    }

export const IDLE_CHART_VERSIONS: ChartVersionsState = {
  status: 'idle',
  versions: [],
  activeChartId: null,
}

interface Result {
  readonly key: string
  readonly configurationId: string
  readonly state: ChartVersionsState
}

export interface ChartVersionsApi {
  readonly state: ChartVersionsState
  /** Relê a lista (depois de importar, ativar ou de uma falha). */
  reload(): void
}

export function useChartVersions(
  gateway: Pick<LoadChartGateway, 'listConfigurationCharts'>,
  configurationId: string | null,
): ChartVersionsApi {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<Result | null>(null)
  const key = `${configurationId ?? ''}#${attempt}`

  useEffect(() => {
    if (configurationId === null) return
    let cancelled = false
    gateway.listConfigurationCharts(configurationId).then(
      ({ items, activeChartId }) => {
        if (cancelled) return
        setResult({
          key,
          configurationId,
          state: { status: 'loaded', versions: items, activeChartId },
        })
      },
      (error: unknown) => {
        if (cancelled) return
        setResult({
          key,
          configurationId,
          state: {
            status: 'error',
            versions: [],
            activeChartId: null,
            error: toLoadChartFailure(error).message,
          },
        })
      },
    )
    return () => {
      cancelled = true
    }
  }, [gateway, configurationId, key])

  const reload = useCallback(() => setAttempt((value) => value + 1), [])

  let state: ChartVersionsState
  if (configurationId === null) state = IDLE_CHART_VERSIONS
  else if (result?.key === key) state = result.state
  else {
    // Relendo a mesma configuração: a lista atual continua visível até a resposta chegar.
    const previous = result?.configurationId === configurationId ? result.state : null
    state = {
      status: 'loading',
      versions: previous?.versions ?? [],
      activeChartId: previous?.activeChartId ?? null,
    }
  }

  return { state, reload }
}
