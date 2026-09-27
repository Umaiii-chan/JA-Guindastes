// Versões das tabelas de uma configuração (TASK-042, TASK-044): a ativa, a conversão para item da
// listagem, o cache dos pontos e as sugestões de versão e id. Dados FICTÍCIOS.

import { describe, expect, it, vi } from 'vitest'

import {
  activeVersion,
  activeVersionsByZone,
  firstActiveVersion,
  isActivatable,
  isActiveChart,
  suggestChartId,
  suggestNextVersion,
  summaryOf,
} from '../../../src/application/loadChart/chartVersions'
import { createLoadChartCache } from '../../../src/application/loadChart/loadChartCache'
import type { StoredLoadChart } from '../../../src/application/loadChart/ports'
import { LoadChartClientError } from '../../../src/infrastructure/api/loadChartRestClient'

function chart(chartId: string, patch: Partial<StoredLoadChart> = {}): StoredLoadChart {
  return {
    chartId,
    version: chartId.toLowerCase(),
    configurationId: 'CFG-FICTICIA',
    status: 'DRAFT',
    points: [{ boomLengthM: 12, workingRadiusM: 4, maxCapacityKg: 9000 }],
    sourceFileName: 'tabela_ficticia.csv',
    rotationZoneCode: null,
    ...patch,
  }
}

describe('ativas por zona (TASK-046)', () => {
  const versions = [
    summaryOf(chart('F2', { rotationZoneCode: 'FRONTAL' })),
    summaryOf(chart('F1', { rotationZoneCode: 'FRONTAL', status: 'ACTIVE' })),
    summaryOf(chart('L1', { rotationZoneCode: 'LATERAL_TRASEIRA', status: 'ACTIVE' })),
  ]
  const activeCharts = [
    { rotationZoneCode: 'LATERAL_TRASEIRA', chartId: 'L1' },
    { rotationZoneCode: 'FRONTAL', chartId: 'F1' },
    { rotationZoneCode: 'FRONTAL', chartId: 'FORA-DA-LISTA' },
  ]

  it('uma ativa por zona, pela active_charts do backend', () => {
    const byZone = activeVersionsByZone(versions, activeCharts)
    expect(byZone.get('FRONTAL')?.chartId).toBe('F1')
    expect(byZone.get('LATERAL_TRASEIRA')?.chartId).toBe('L1')
    expect(byZone.has(null)).toBe(false)
    expect(isActiveChart('F1', activeCharts)).toBe(true)
    expect(isActiveChart('F2', activeCharts)).toBe(false)
  })

  it('a primeira ativa segue a ordem das zonas da configuração', () => {
    expect(
      firstActiveVersion(versions, activeCharts, ['FRONTAL', 'LATERAL_TRASEIRA'])?.chartId,
    ).toBe('F1')
    expect(
      firstActiveVersion(versions, activeCharts, ['LATERAL_TRASEIRA', 'FRONTAL'])?.chartId,
    ).toBe('L1')
    // Sem `active_charts` (backend anterior), vale o status ACTIVE, como antes.
    expect(firstActiveVersion(versions, [], [])?.chartId).toBe('F1')
    expect(firstActiveVersion([], [], [])).toBeNull()
  })
})

describe('activeVersion', () => {
  const versions = [
    summaryOf(chart('V2')),
    summaryOf(chart('V1', { status: 'ACTIVE' })),
    summaryOf(chart('V0', { status: 'SUPERSEDED' })),
  ]

  it('usa a ativa indicada pelo backend (active_chart_id)', () => {
    expect(activeVersion(versions, 'V1')?.chartId).toBe('V1')
  })

  it('sem indicação (ou indicação fora da lista), cai no status ACTIVE', () => {
    expect(activeVersion(versions)?.chartId).toBe('V1')
    expect(activeVersion(versions, 'SUMIU')?.chartId).toBe('V1')
    expect(activeVersion([summaryOf(chart('V9'))], null)).toBeNull()
  })
})

describe('summaryOf', () => {
  it('troca os pontos pela contagem', () => {
    expect(summaryOf(chart('V1'))).toEqual({
      chartId: 'V1',
      version: 'v1',
      configurationId: 'CFG-FICTICIA',
      status: 'DRAFT',
      pointCount: 1,
      sourceFileName: 'tabela_ficticia.csv',
      rotationZoneCode: null,
    })
  })
})

describe('createLoadChartCache', () => {
  it('lê cada tabela uma vez só, mesmo com pedidos simultâneos', async () => {
    const getChart = vi.fn(async (id: string) => chart(id))
    const cache = createLoadChartCache({ getChart })

    const [first, second] = await Promise.all([cache.load('V1'), cache.load('V1')])
    await cache.load('V1')

    expect(first).toBe(second)
    expect(getChart).toHaveBeenCalledTimes(1)
    expect(cache.peek('V1')).toBe(first)
  })

  it('guarda a tabela que já veio inteira (importação, ativação) sem ir ao backend', async () => {
    const getChart = vi.fn(async (id: string) => chart(id))
    const cache = createLoadChartCache({ getChart })

    cache.remember(chart('V3'))

    expect(cache.peek('V3')?.chartId).toBe('V3')
    await cache.load('V3')
    expect(getChart).not.toHaveBeenCalled()
  })

  it('uma falha não fica guardada: a próxima leitura tenta de novo', async () => {
    const failure = new LoadChartClientError('NETWORK_ERROR', null, 'sem rede')
    const getChart = vi
      .fn<(id: string) => Promise<StoredLoadChart>>()
      .mockRejectedValueOnce(failure)
      .mockImplementation(async (id) => chart(id))
    const cache = createLoadChartCache({ getChart })

    await expect(cache.load('V1')).rejects.toBe(failure)
    expect(cache.peek('V1')).toBeUndefined()
    expect((await cache.load('V1')).chartId).toBe('V1')
    expect(getChart).toHaveBeenCalledTimes(2)
  })
})

describe('sugestões e regras de ativação', () => {
  it('sugere a próxima versão sem repetir', () => {
    expect(suggestNextVersion([])).toBe('v1')
    expect(suggestNextVersion([{ version: 'v1' }, { version: 'v2' }])).toBe('v3')
    expect(suggestNextVersion([{ version: 'rev 7' }])).toBe('v8')
  })

  it('sugere o id a partir da configuração e da versão, só com caracteres seguros', () => {
    expect(suggestChartId('CFG-DEMO', 'v2')).toBe('CFG-DEMO-v2')
    expect(suggestChartId('CFG DEMO', 'v 2/b')).toBe('CFG-DEMO-v-2-b')
  })

  it('só DRAFT e VALIDATED podem ser ativadas', () => {
    expect(isActivatable('DRAFT')).toBe(true)
    expect(isActivatable('VALIDATED')).toBe(true)
    expect(isActivatable('ACTIVE')).toBe(false)
    expect(isActivatable('SUPERSEDED')).toBe(false)
    expect(isActivatable('INVALID')).toBe(false)
  })
})
