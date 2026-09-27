// Versões das tabelas de carga de uma configuração (TASK-042; RN-005).
//
// O backend ainda NÃO tem rota para listar as tabelas de uma configuração (só `GET /load-charts/{id}`;
// ver handoffs/TASK-042.md § 8). Até ela existir, a tela lembra, neste navegador, os ids das tabelas
// que importou, ativou ou acompanhou (`KnownChartsStore`) e consulta cada uma no backend para ter o
// status atual. Uma tabela importada em outro lugar só aparece depois de acompanhada pelo id.

import type { LoadChartFailure, LoadChartGateway, LoadChartStatus, StoredLoadChart } from './ports'

/** Tabela lembrada neste navegador. */
export interface KnownChart {
  readonly chartId: string
  readonly configurationId: string
  /** Quando a tela passou a acompanhar a tabela (ISO 8601): ordena a linha do tempo. */
  readonly trackedAt: string
}

/** Onde os ids ficam guardados (implementação em `src/infrastructure/storage/`). */
export interface KnownChartsStore {
  list(configurationId: string): readonly KnownChart[]
  add(chart: KnownChart): void
  remove(configurationId: string, chartId: string): void
}

export interface LoadChartVersion extends StoredLoadChart {
  readonly trackedAt: string
}

export interface LoadChartVersionList {
  /** Da mais recente para a mais antiga. */
  readonly versions: readonly LoadChartVersion[]
  /** Ids lembrados que o backend não conhece mais (404) ou que são de outra configuração. */
  readonly forgotten: readonly string[]
}

const NOT_FOUND = 'LOAD_CHART_NOT_FOUND'

/**
 * Consulta no backend cada tabela lembrada da configuração. As que sumiram (404) ou mudaram de
 * configuração são esquecidas. Qualquer outra falha rejeita com a primeira delas (a lista não
 * mostra meia verdade).
 */
export async function loadChartVersions(
  gateway: Pick<LoadChartGateway, 'getChart'>,
  store: KnownChartsStore,
  configurationId: string,
): Promise<LoadChartVersionList> {
  const known = store.list(configurationId)
  const results = await Promise.allSettled(known.map((entry) => gateway.getChart(entry.chartId)))
  const versions: LoadChartVersion[] = []
  const forgotten: string[] = []
  let failure: unknown = null

  results.forEach((result, index) => {
    const entry = known[index]
    if (result.status === 'fulfilled') {
      if (result.value.configurationId === configurationId) {
        versions.push({ ...result.value, trackedAt: entry.trackedAt })
      } else {
        forgotten.push(entry.chartId)
      }
    } else if (failureCode(result.reason) === NOT_FOUND) {
      forgotten.push(entry.chartId)
    } else {
      failure ??= result.reason
    }
  })

  if (failure !== null) throw failure
  for (const chartId of forgotten) store.remove(configurationId, chartId)
  versions.sort((a, b) => b.trackedAt.localeCompare(a.trackedAt))
  return { versions, forgotten }
}

/** A versão ativa da lista, se houver (o backend garante no máximo uma por configuração). */
export function activeVersion<T extends { readonly status: LoadChartStatus }>(
  versions: readonly T[],
): T | null {
  return versions.find((version) => version.status === 'ACTIVE') ?? null
}

/** Só `DRAFT` e `VALIDATED` podem ser ativadas (doc-fonte § 13.2; 409 nos demais). */
export function isActivatable(status: LoadChartStatus): boolean {
  return status === 'DRAFT' || status === 'VALIDATED'
}

/**
 * Sugestão da próxima versão: `v<n+1>`, com `n` o maior número final entre as versões conhecidas
 * (ex.: `v1`, `v2` → `v3`), sem repetir nenhuma. Só sugestão: a pessoa pode mudar.
 */
export function suggestNextVersion(versions: readonly { readonly version: string }[]): string {
  const taken = new Set(versions.map((item) => item.version.trim().toLowerCase()))
  let next =
    versions.reduce((max, item) => {
      const match = /(\d+)\s*$/.exec(item.version)
      return match ? Math.max(max, Number(match[1])) : max
    }, 0) + 1
  while (taken.has(`v${next}`)) next += 1
  return `v${next}`
}

/** Sugestão de id da tabela: `<configuração>-<versão>`, só com letras, números, `-` e `_`. */
export function suggestChartId(configurationId: string, version: string): string {
  return `${configurationId}-${version}`.replace(/[^A-Za-z0-9_-]+/g, '-')
}

/** `code` de uma falha do gateway, se houver. */
export function failureCode(error: unknown): string | null {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : null
}

/** Converte qualquer erro na falha exibível do gateway. */
export function toLoadChartFailure(error: unknown): LoadChartFailure {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    typeof error.code === 'string' &&
    typeof error.message === 'string'
  ) {
    const httpStatus =
      'httpStatus' in error && typeof error.httpStatus === 'number' ? error.httpStatus : null
    return { code: error.code, httpStatus, message: error.message }
  }
  const message = error instanceof Error ? error.message : String(error)
  return { code: 'UNEXPECTED_ERROR', httpStatus: null, message: `Erro inesperado: ${message}` }
}
