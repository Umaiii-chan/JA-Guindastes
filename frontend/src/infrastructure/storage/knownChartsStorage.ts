// Ids das tabelas de carga acompanhadas neste navegador (TASK-042), no `localStorage`. É o paliativo
// enquanto o backend não lista as tabelas de uma configuração (ver `chartVersions.ts`). Sem
// `localStorage` (modo privado, bloqueado), guarda só em memória, até recarregar a página.

import type { KnownChart, KnownChartsStore } from '../../application/loadChart/chartVersions'

export const KNOWN_CHARTS_STORAGE_KEY = 'ja-guindastes.known-load-charts.v1'

type Stored = Record<string, KnownChart[]>

export function createKnownChartsStorage(
  storage: Pick<Storage, 'getItem' | 'setItem'> | null = defaultStorage(),
): KnownChartsStore {
  let memory: Stored = read(storage)

  function save(next: Stored): void {
    memory = next
    try {
      storage?.setItem(KNOWN_CHARTS_STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Sem espaço ou bloqueado: fica em memória.
    }
  }

  return {
    list(configurationId) {
      memory = storage ? read(storage) : memory
      return memory[configurationId] ?? []
    },
    add(chart) {
      const current = read(storage, memory)
      const others = (current[chart.configurationId] ?? []).filter(
        (item) => item.chartId !== chart.chartId,
      )
      const existing = current[chart.configurationId]?.find(
        (item) => item.chartId === chart.chartId,
      )
      save({ ...current, [chart.configurationId]: [...others, existing ?? chart] })
    },
    remove(configurationId, chartId) {
      const current = read(storage, memory)
      save({
        ...current,
        [configurationId]: (current[configurationId] ?? []).filter(
          (item) => item.chartId !== chartId,
        ),
      })
    },
  }
}

function defaultStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

function read(storage: Pick<Storage, 'getItem'> | null, fallback: Stored = {}): Stored {
  if (!storage) return fallback
  try {
    const raw = storage.getItem(KNOWN_CHARTS_STORAGE_KEY)
    if (raw === null) return fallback
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return fallback
    const result: Stored = {}
    for (const [configurationId, list] of Object.entries(parsed)) {
      if (!Array.isArray(list)) continue
      result[configurationId] = list.filter(isKnownChart)
    }
    return result
  } catch {
    return fallback
  }
}

function isKnownChart(value: unknown): value is KnownChart {
  if (typeof value !== 'object' || value === null) return false
  const item = value as Record<string, unknown>
  return (
    typeof item.chartId === 'string' &&
    typeof item.configurationId === 'string' &&
    typeof item.trackedAt === 'string'
  )
}
