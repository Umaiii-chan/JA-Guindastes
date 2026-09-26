// Versões conhecidas das tabelas de uma configuração (TASK-042): consulta no backend, esquecimento
// das que sumiram e sugestões de versão e id. Dados FICTÍCIOS.

import { describe, expect, it, vi } from 'vitest'

import {
  activeVersion,
  isActivatable,
  type KnownChart,
  type KnownChartsStore,
  loadChartVersions,
  suggestChartId,
  suggestNextVersion,
} from '../../../src/application/loadChart/chartVersions'
import type { StoredLoadChart } from '../../../src/application/loadChart/ports'
import { LoadChartClientError } from '../../../src/infrastructure/api/loadChartRestClient'
import {
  createKnownChartsStorage,
  KNOWN_CHARTS_STORAGE_KEY,
} from '../../../src/infrastructure/storage/knownChartsStorage'

function memoryStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  const data = new Map<string, string>()
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
  }
}

function chart(chartId: string, patch: Partial<StoredLoadChart> = {}): StoredLoadChart {
  return {
    chartId,
    version: chartId.toLowerCase(),
    configurationId: 'CFG-FICTICIA',
    status: 'DRAFT',
    points: [],
    sourceFileName: 'tabela_ficticia.csv',
    ...patch,
  }
}

const known = (chartId: string, trackedAt: string): KnownChart => ({
  chartId,
  configurationId: 'CFG-FICTICIA',
  trackedAt,
})

describe('loadChartVersions', () => {
  it('consulta cada tabela lembrada e ordena da mais recente para a mais antiga', async () => {
    const store = createKnownChartsStorage(memoryStorage())
    store.add(known('V1', '2026-09-01T10:00:00.000Z'))
    store.add(known('V2', '2026-09-02T10:00:00.000Z'))
    const getChart = vi.fn(async (id: string) =>
      chart(id, { status: id === 'V1' ? 'ACTIVE' : 'DRAFT' }),
    )

    const { versions, forgotten } = await loadChartVersions({ getChart }, store, 'CFG-FICTICIA')

    expect(versions.map((item) => item.chartId)).toEqual(['V2', 'V1'])
    expect(versions[1].trackedAt).toBe('2026-09-01T10:00:00.000Z')
    expect(forgotten).toEqual([])
    expect(activeVersion(versions)?.chartId).toBe('V1')
  })

  it('esquece as que o backend não conhece (404) ou que são de outra configuração', async () => {
    const store = createKnownChartsStorage(memoryStorage())
    store.add(known('SUMIU', '2026-09-01T10:00:00.000Z'))
    store.add(known('OUTRA', '2026-09-02T10:00:00.000Z'))
    store.add(known('OK', '2026-09-03T10:00:00.000Z'))
    const getChart = vi.fn(async (id: string) => {
      if (id === 'SUMIU') throw new LoadChartClientError('LOAD_CHART_NOT_FOUND', 404, 'não existe')
      return chart(id, { configurationId: id === 'OUTRA' ? 'CFG-OUTRA' : 'CFG-FICTICIA' })
    })

    const { versions, forgotten } = await loadChartVersions({ getChart }, store, 'CFG-FICTICIA')

    expect(versions.map((item) => item.chartId)).toEqual(['OK'])
    expect([...forgotten].sort()).toEqual(['OUTRA', 'SUMIU'])
    expect(store.list('CFG-FICTICIA').map((item) => item.chartId)).toEqual(['OK'])
  })

  it('outra falha (rede) rejeita a lista inteira e não esquece nada', async () => {
    const store = createKnownChartsStorage(memoryStorage())
    store.add(known('V1', '2026-09-01T10:00:00.000Z'))
    const failure = new LoadChartClientError('NETWORK_ERROR', null, 'sem rede')

    await expect(
      loadChartVersions({ getChart: () => Promise.reject(failure) }, store, 'CFG-FICTICIA'),
    ).rejects.toBe(failure)
    expect(store.list('CFG-FICTICIA')).toHaveLength(1)
  })
})

describe('knownChartsStorage', () => {
  it('guarda por configuração, sem repetir o id, e sobrevive a uma nova instância', () => {
    const storage = memoryStorage()
    const store = createKnownChartsStorage(storage)
    store.add(known('V1', '2026-09-01T10:00:00.000Z'))
    store.add(known('V1', '2026-09-05T10:00:00.000Z'))

    const again = createKnownChartsStorage(storage)
    expect(again.list('CFG-FICTICIA')).toEqual([known('V1', '2026-09-01T10:00:00.000Z')])
    expect(again.list('CFG-OUTRA')).toEqual([])
  })

  it('ignora conteúdo corrompido e funciona sem localStorage', () => {
    const storage = memoryStorage()
    storage.setItem(KNOWN_CHARTS_STORAGE_KEY, '{nao é json')
    expect(createKnownChartsStorage(storage).list('CFG-FICTICIA')).toEqual([])

    const memoryOnly: KnownChartsStore = createKnownChartsStorage(null)
    memoryOnly.add(known('V1', '2026-09-01T10:00:00.000Z'))
    expect(memoryOnly.list('CFG-FICTICIA')).toHaveLength(1)
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
