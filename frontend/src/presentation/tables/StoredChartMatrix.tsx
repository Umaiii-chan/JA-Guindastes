import { Notice, SkeletonText } from '../ui'
import { LoadChartMatrix } from './LoadChartMatrix'
import type { StoredChartState } from './useStoredChart'

/**
 * Matriz de uma versão gravada (TASK-044): carregando, com erro ou com os pontos lidos do backend
 * (`GET /load-charts/{id}`; a listagem por configuração não traz os pontos).
 */
export function StoredChartMatrix({
  state,
  caption,
  compact,
}: {
  readonly state: StoredChartState
  readonly caption: string
  readonly compact?: boolean
}) {
  if (state.status === 'loaded') {
    return <LoadChartMatrix points={state.chart.points} caption={caption} compact={compact} />
  }
  if (state.status === 'error') {
    return (
      <Notice tone="danger" role="alert" compact title="Não foi possível ler a matriz">
        {state.error}
      </Notice>
    )
  }
  return (
    <div aria-busy="true">
      <span className="visually-hidden">Carregando a matriz…</span>
      <SkeletonText lines={4} />
    </div>
  )
}
