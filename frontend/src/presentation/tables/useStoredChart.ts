// Uma tabela gravada, com os pontos, lida pelo cache da página (TASK-044): a listagem por configuração
// não traz os pontos, e a matriz precisa deles.

import { useEffect, useState } from 'react'

import { toLoadChartFailure } from '../../application/loadChart/chartVersions'
import type { LoadChartCache } from '../../application/loadChart/loadChartCache'
import type { StoredLoadChart } from '../../application/loadChart/ports'

export type StoredChartState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'loaded'; readonly chart: StoredLoadChart }
  | { readonly status: 'error'; readonly error: string }

const IDLE: StoredChartState = { status: 'idle' }
const LOADING: StoredChartState = { status: 'loading' }

export function useStoredChart(cache: LoadChartCache, chartId: string | null): StoredChartState {
  const [result, setResult] = useState<{
    readonly chartId: string
    readonly state: StoredChartState
  } | null>(null)

  useEffect(() => {
    if (chartId === null || cache.peek(chartId)) return
    let cancelled = false
    cache.load(chartId).then(
      (chart) => {
        if (!cancelled) setResult({ chartId, state: { status: 'loaded', chart } })
      },
      (error: unknown) => {
        if (cancelled) return
        setResult({ chartId, state: { status: 'error', error: toLoadChartFailure(error).message } })
      },
    )
    return () => {
      cancelled = true
    }
  }, [cache, chartId])

  if (chartId === null) return IDLE
  const cached = cache.peek(chartId)
  if (cached) return { status: 'loaded', chart: cached }
  return result?.chartId === chartId ? result.state : LOADING
}

/** Os pontos, quando a tabela já foi lida. */
export function pointsOf(state: StoredChartState) {
  return state.status === 'loaded' ? state.chart.points : null
}
