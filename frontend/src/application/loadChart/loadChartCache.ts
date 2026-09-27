// Pontos das tabelas de carga já lidas (TASK-044). A listagem por configuração não traz os pontos;
// a matriz, a tabela ativa do Catálogo e a comparação do Dialog de ativação pedem cada tabela no
// `GET /load-charts/{id}` uma vez só. Os pontos de uma tabela gravada não mudam (ADR-009): o status
// sim, e por isso a tela lê o status da listagem, nunca daqui.

import type { LoadChartGateway, StoredLoadChart } from './ports'

export interface LoadChartCache {
  /** A tabela, se já foi lida (sem ir ao backend). */
  peek(chartId: string): StoredLoadChart | undefined
  /** Lê a tabela (uma vez por id; uma falha não fica guardada, a próxima chamada tenta de novo). */
  load(chartId: string): Promise<StoredLoadChart>
  /** Guarda uma tabela que já veio inteira (resposta da importação ou da ativação). */
  remember(chart: StoredLoadChart): void
}

export function createLoadChartCache(gateway: Pick<LoadChartGateway, 'getChart'>): LoadChartCache {
  const loaded = new Map<string, StoredLoadChart>()
  const pending = new Map<string, Promise<StoredLoadChart>>()

  return {
    peek: (chartId) => loaded.get(chartId),
    load(chartId) {
      const known = loaded.get(chartId)
      if (known) return Promise.resolve(known)
      const inFlight = pending.get(chartId)
      if (inFlight) return inFlight
      const request = gateway.getChart(chartId).then(
        (chart) => {
          loaded.set(chartId, chart)
          pending.delete(chartId)
          return chart
        },
        (error: unknown) => {
          pending.delete(chartId)
          throw error
        },
      )
      pending.set(chartId, request)
      return request
    },
    remember(chart) {
      loaded.set(chart.chartId, chart)
    },
  }
}
