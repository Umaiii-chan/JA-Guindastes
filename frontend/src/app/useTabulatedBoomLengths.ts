// Comprimentos de lança das tabelas ativas da configuração escolhida (TASK-050), para o slider da
// lança encaixar nas colunas que o backend sabe avaliar. Sem configuração, sem tabela ativa ou com
// falha na leitura, devolve lista vazia e o slider continua livre (o backend responde "Não avaliável"
// com o motivo, como antes).

import { useEffect, useState } from 'react'

import { createLoadChartCache } from '../application/loadChart/loadChartCache'
import type { LoadChartGateway } from '../application/loadChart/ports'
import { tabulatedBoomLengths } from '../application/loadChart/tabulatedBoomLengths'
import { createLoadChartRestClient } from '../infrastructure/api/loadChartRestClient'

type Gateway = Pick<LoadChartGateway, 'listConfigurationCharts' | 'getChart'>

export async function loadTabulatedBoomLengths(
  gateway: Gateway,
  configurationId: string,
): Promise<number[]> {
  const cache = createLoadChartCache(gateway)
  const listing = await gateway.listConfigurationCharts(configurationId)
  const activeIds = listing.activeCharts.map((active) => active.chartId)
  const charts = await Promise.all(activeIds.map((chartId) => cache.load(chartId)))
  return tabulatedBoomLengths(charts)
}

export function useTabulatedBoomLengths(
  configurationId: string | null,
  gatewayFactory: () => Gateway = createLoadChartRestClient,
): readonly number[] {
  const [gateway] = useState(gatewayFactory)
  const [loaded, setLoaded] = useState<{ readonly id: string; readonly lengths: number[] } | null>(
    null,
  )

  useEffect(() => {
    if (configurationId === null) return
    let cancelled = false
    loadTabulatedBoomLengths(gateway, configurationId).then(
      (lengths) => {
        if (!cancelled) setLoaded({ id: configurationId, lengths })
      },
      () => {
        if (!cancelled) setLoaded({ id: configurationId, lengths: [] })
      },
    )
    return () => {
      cancelled = true
    }
  }, [gateway, configurationId])

  return loaded !== null && loaded.id === configurationId ? loaded.lengths : NO_LENGTHS
}

const NO_LENGTHS: readonly number[] = []
