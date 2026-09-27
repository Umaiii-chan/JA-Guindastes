// Versões das tabelas de uma configuração pela rota de listagem (TASK-044), lidas a cada troca de
// configuração e relidas depois de importar ou ativar (`reload`).

import { useCallback, useEffect, useState } from 'react'

import { toLoadChartFailure } from '../../application/loadChart/chartVersions'
import type {
  ActiveChartRef,
  LoadChartGateway,
  LoadChartSummary,
} from '../../application/loadChart/ports'

export type ChartVersionsState =
  | {
      readonly status: 'idle'
      readonly versions: readonly []
      readonly activeChartId: null
      readonly activeCharts: readonly []
    }
  | {
      readonly status: 'loading'
      readonly versions: readonly LoadChartSummary[]
      readonly activeChartId: string | null
      readonly activeCharts: readonly ActiveChartRef[]
    }
  | {
      readonly status: 'loaded'
      readonly versions: readonly LoadChartSummary[]
      readonly activeChartId: string | null
      readonly activeCharts: readonly ActiveChartRef[]
    }
  | {
      readonly status: 'error'
      readonly versions: readonly LoadChartSummary[]
      readonly activeChartId: string | null
      readonly activeCharts: readonly ActiveChartRef[]
      readonly error: string
    }

export const IDLE_CHART_VERSIONS: ChartVersionsState = {
  status: 'idle',
  versions: [],
  activeChartId: null,
  activeCharts: [],
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
      ({ items, activeChartId, activeCharts }) => {
        if (cancelled) return
        setResult({
          key,
          configurationId,
          state: { status: 'loaded', versions: items, activeChartId, activeCharts },
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
            activeCharts: [],
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
      activeCharts: previous?.activeCharts ?? [],
    }
  }

  return { state, reload }
}
