// Versões das tabelas de carga de uma configuração (TASK-042, TASK-044; RN-005).
//
// A lista vem do backend (`GET /configurations/{id}/load-charts`, TASK-044), já ordenada da versão
// importada mais recentemente para a mais antiga e com a ativa indicada. Aqui ficam só as regras da
// tela sobre ela: qual é a ativa, o que pode ser ativado e as sugestões de versão e id.

import type {
  ActiveChartRef,
  LoadChartFailure,
  LoadChartStatus,
  LoadChartSummary,
  StoredLoadChart,
} from './ports'

/**
 * A versão ativa da lista: a indicada pelo backend (`active_chart_id`) ou, sem ela, a de status
 * `ACTIVE` (o backend garante no máximo uma por configuração; ADR-009).
 */
export function activeVersion<
  T extends { readonly chartId: string; readonly status: LoadChartStatus },
>(versions: readonly T[], activeChartId: string | null = null): T | null {
  const indicated =
    activeChartId === null ? undefined : versions.find((item) => item.chartId === activeChartId)
  return indicated ?? versions.find((version) => version.status === 'ACTIVE') ?? null
}

/** A tabela gravada vista como item da listagem (sem os pontos). */
export function summaryOf(chart: StoredLoadChart): LoadChartSummary {
  return {
    chartId: chart.chartId,
    version: chart.version,
    configurationId: chart.configurationId,
    status: chart.status,
    pointCount: chart.points.length,
    sourceFileName: chart.sourceFileName,
    rotationZoneCode: chart.rotationZoneCode,
  }
}

/**
 * A versão ativa de cada zona (ADR-018; TASK-046), pela `active_charts` do backend. A chave `null`
 * é a ativa de uma configuração sem zonas. Ativa indicada que não está na lista fica de fora.
 */
export function activeVersionsByZone<
  T extends { readonly chartId: string; readonly rotationZoneCode: string | null },
>(versions: readonly T[], activeCharts: readonly ActiveChartRef[]): ReadonlyMap<string | null, T> {
  const byZone = new Map<string | null, T>()
  for (const ref of activeCharts) {
    const version = versions.find((item) => item.chartId === ref.chartId)
    if (version && !byZone.has(ref.rotationZoneCode)) byZone.set(ref.rotationZoneCode, version)
  }
  return byZone
}

/** A tabela é a ativa da sua zona (ou da configuração sem zonas). */
export function isActiveChart(chartId: string, activeCharts: readonly ActiveChartRef[]): boolean {
  return activeCharts.some((item) => item.chartId === chartId)
}

/**
 * A primeira ativa na ordem das zonas da configuração (ou a ativa sem zona), para quem mostra uma
 * só matriz. Sem zonas, é a ativa de sempre.
 */
export function firstActiveVersion<
  T extends {
    readonly chartId: string
    readonly status: LoadChartStatus
    readonly rotationZoneCode: string | null
  },
>(
  versions: readonly T[],
  activeCharts: readonly ActiveChartRef[],
  zoneCodes: readonly string[],
  activeChartId: string | null = null,
): T | null {
  const byZone = activeVersionsByZone(versions, activeCharts)
  for (const code of zoneCodes) {
    const version = byZone.get(code)
    if (version) return version
  }
  return byZone.get(null) ?? activeVersion(versions, activeChartId)
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
