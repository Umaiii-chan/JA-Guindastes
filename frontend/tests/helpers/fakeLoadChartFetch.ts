// `fetch` falso das rotas de tabelas de carga (TASK-019 e TASK-031) em memória, para os testes das
// páginas (TASK-042). Lê o CSV canônico provisório (boom_length_m, working_radius_m,
// max_capacity_kg) com regras simplificadas: basta para exercitar a tela, não substitui o parser do
// backend. Dados FICTÍCIOS.

import { vi } from 'vitest'

import { jsonResponse } from './fakeCatalogFetch'

interface PointRow {
  boom_length_m: number
  working_radius_m: number
  max_capacity_kg: number
}

interface IssueRow {
  code: string
  message: string
  line: number | null
  column: string | null
}

export interface ChartRow {
  chart_id: string
  version: string
  configuration_id: string
  status: 'DRAFT' | 'VALIDATED' | 'ACTIVE' | 'SUPERSEDED' | 'INVALID'
  points: PointRow[]
  source: { file_name: string; file_type: string; sha256: string; uri: string }
  /** Zona de giro (TASK-046); ausente = `null`. */
  rotation_zone_code?: string | null
}

const COLUMNS = ['boom_length_m', 'working_radius_m', 'max_capacity_kg'] as const

export function parseCsvFicticio(text: string): { points: PointRow[]; issues: IssueRow[] } {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const header = lines[0]?.split(',').map((cell) => cell.trim()) ?? []
  const issues: IssueRow[] = []
  for (const column of COLUMNS) {
    if (!header.includes(column)) {
      issues.push({
        code: 'MISSING_COLUMN',
        message: `Coluna obrigatória ausente: ${column}.`,
        line: null,
        column,
      })
    }
  }
  if (issues.length > 0) return { points: [], issues }
  const points: PointRow[] = []
  lines.slice(1).forEach((line, index) => {
    if (line.trim() === '') return
    const cells = line.split(',')
    const row: Partial<PointRow> = {}
    COLUMNS.forEach((column) => {
      const raw = (cells[header.indexOf(column)] ?? '').trim()
      const lineNumber = index + 2
      if (raw === '') {
        issues.push({ code: 'MISSING_VALUE', message: 'Valor vazio.', line: lineNumber, column })
        return
      }
      const value = Number(raw)
      if (!Number.isFinite(value)) {
        issues.push({
          code: 'INVALID_NUMBER',
          message: `Valor não numérico: "${raw}".`,
          line: lineNumber,
          column,
        })
      } else if (value <= 0) {
        issues.push({
          code: 'NON_POSITIVE_VALUE',
          message: 'O valor deve ser maior que zero.',
          line: lineNumber,
          column,
        })
      } else {
        row[column] = value
      }
    })
    if (Object.keys(row).length === COLUMNS.length) points.push(row as PointRow)
  })
  return issues.length > 0 ? { points: [], issues } : { points, issues: [] }
}

export interface FakeLoadChartOptions {
  /**
   * Configurações que existem: a listagem de outra responde 404. Sem a lista, toda configuração
   * existe.
   */
  readonly configurationIds?: readonly string[]
  /**
   * Códigos das zonas de giro de cada configuração (TASK-046). A importação confere o
   * `rotation_zone_code` contra eles (422 `ROTATION_ZONE_REQUIRED`, `UNKNOWN_ROTATION_ZONE` ou
   * `ROTATION_ZONE_NOT_ALLOWED`); configuração fora do mapa não tem zonas.
   */
  readonly zonesByConfiguration?: Readonly<Record<string, readonly string[]>>
}

/** Corpo 422 de um erro de zona na importação, no formato `{detail, code}`. */
export function zoneImportErrorBody(code: string, detail: string): unknown {
  return { detail, code }
}

/** Item da listagem por configuração: o `LoadChartResponse` sem `points` (TASK-044). */
function summaryOf(chart: ChartRow) {
  const { points, ...rest } = chart
  return { rotation_zone_code: null, ...rest, point_count: points.length }
}

/** Números da versão (`v2.1` → `[2, 1]`), para ordenar como o backend. */
function versionNumbers(version: string): number[] {
  return (version.match(/\d+/g) ?? []).map(Number)
}

/**
 * Ordem da listagem do backend (TASK-044): versão da maior para a menor, comparando os números como
 * números (`v10`, `v9`, `v2.1`, `v2`, `v1`); empate por `chart_id` decrescente.
 */
function byVersionDesc(a: ChartRow, b: ChartRow): number {
  const left = versionNumbers(a.version)
  const right = versionNumbers(b.version)
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (right[index] ?? -1) - (left[index] ?? -1)
    if (difference !== 0) return difference
  }
  return b.chart_id.localeCompare(a.chart_id)
}

/**
 * Cria o `fetch` falso das tabelas. `charts` pode vir preenchido (tabelas já gravadas); a listagem
 * por configuração devolve na ordem do backend (`byVersionDesc`).
 */
export function createFakeLoadChartFetch(
  charts: ChartRow[] = [],
  options: FakeLoadChartOptions = {},
) {
  return vi.fn<typeof fetch>(async (input, init) => {
    const path = new URL(String(input), 'http://localhost').pathname
    const method = init?.method ?? 'GET'

    const list = /^\/api\/v1\/configurations\/([^/]+)\/load-charts$/.exec(path)
    if (method === 'GET' && list) {
      const configurationId = decodeURIComponent(list[1])
      if (options.configurationIds && !options.configurationIds.includes(configurationId)) {
        return jsonResponse({ detail: `configuração com id '${configurationId}' não existe` }, 404)
      }
      const items = charts
        .filter((chart) => chart.configuration_id === configurationId)
        .sort(byVersionDesc)
      // Como o backend: a ativa sem zona primeiro, depois as zonas na ordem cadastrada (as fora do
      // cadastro, no fim); zona sem ativa não aparece.
      const zoneOrder = options.zonesByConfiguration?.[configurationId] ?? []
      const rank = (chart: ChartRow) => {
        const code = chart.rotation_zone_code ?? null
        if (code === null) return -1
        const index = zoneOrder.indexOf(code)
        return index < 0 ? zoneOrder.length : index
      }
      const active = items
        .filter((chart) => chart.status === 'ACTIVE')
        .sort((a, b) => rank(a) - rank(b))
      return jsonResponse({
        items: items.map(summaryOf),
        active_chart_id:
          active.find((chart) => (chart.rotation_zone_code ?? null) === null)?.chart_id ?? null,
        active_charts: active.map((chart) => ({
          rotation_zone_code: chart.rotation_zone_code ?? null,
          chart_id: chart.chart_id,
        })),
      })
    }

    if (method === 'POST' && (path.endsWith('/validate') || path.endsWith('/import'))) {
      const form = init?.body as FormData
      const file = form.get('file') as File
      const { points, issues } = parseCsvFicticio(await file.text())
      const base = {
        chart_id: String(form.get('chart_id')),
        version: String(form.get('version')),
        configuration_id: String(form.get('configuration_id')),
      }
      // Ordem do backend (TASK-046): 404 da configuração → erros da zona → relatório → 409.
      const zone = form.get('rotation_zone_code')
      // Vazio conta como ausente.
      const zoneCode = typeof zone === 'string' && zone.trim() !== '' ? zone.trim() : null
      if (path.endsWith('/import')) {
        if (options.configurationIds && !options.configurationIds.includes(base.configuration_id)) {
          return jsonResponse({ detail: `configuração ${base.configuration_id} não existe` }, 404)
        }
        const zones = options.zonesByConfiguration?.[base.configuration_id] ?? []
        if (zones.length > 0 && zoneCode === null) {
          return jsonResponse(
            zoneImportErrorBody('ROTATION_ZONE_REQUIRED', 'a configuração tem zonas de giro'),
            422,
          )
        }
        if (zones.length > 0 && zoneCode !== null && !zones.includes(zoneCode)) {
          return jsonResponse(
            zoneImportErrorBody('UNKNOWN_ROTATION_ZONE', `a zona ${zoneCode} não existe`),
            422,
          )
        }
        if (zones.length === 0 && zoneCode !== null) {
          return jsonResponse(
            zoneImportErrorBody('ROTATION_ZONE_NOT_ALLOWED', 'a configuração não tem zonas'),
            422,
          )
        }
      }
      if (issues.length > 0) {
        return jsonResponse(
          { ...base, status: 'INVALID', point_count: 0, points: [], issues },
          path.endsWith('/validate') ? 200 : 422,
        )
      }
      if (path.endsWith('/validate')) {
        return jsonResponse(
          { ...base, status: 'DRAFT', point_count: points.length, points, issues: [] },
          200,
        )
      }
      if (
        charts.some(
          (chart) =>
            chart.chart_id === base.chart_id ||
            (chart.configuration_id === base.configuration_id && chart.version === base.version),
        )
      ) {
        return jsonResponse({ detail: 'Versão ou id já existentes.' }, 409)
      }
      const row: ChartRow = {
        ...base,
        rotation_zone_code: zoneCode,
        status: 'DRAFT',
        points,
        source: {
          file_name: file.name,
          file_type: 'text/csv',
          sha256: 'f'.repeat(64),
          uri: `local://${'f'.repeat(64)}`,
        },
      }
      charts.push(row)
      return jsonResponse({ ...row, point_count: points.length }, 201)
    }

    const activate = /\/api\/v1\/load-charts\/([^/]+)\/activate$/.exec(path)
    if (method === 'POST' && activate) {
      const chart = charts.find((item) => item.chart_id === decodeURIComponent(activate[1]))
      if (!chart) return jsonResponse({ detail: 'Tabela não encontrada.' }, 404)
      if (chart.status !== 'DRAFT' && chart.status !== 'VALIDATED') {
        return jsonResponse({ detail: `Status ${chart.status} não permite ativar.` }, 409)
      }
      // Uma ativa por (configuração, zona) (ADR-018): as outras zonas não mudam.
      const previous = charts.find(
        (item) =>
          item.configuration_id === chart.configuration_id &&
          (item.rotation_zone_code ?? null) === (chart.rotation_zone_code ?? null) &&
          item.status === 'ACTIVE',
      )
      if (previous) previous.status = 'SUPERSEDED'
      chart.status = 'ACTIVE'
      return jsonResponse(
        {
          ...chart,
          point_count: chart.points.length,
          superseded_chart_id: previous?.chart_id ?? null,
        },
        200,
      )
    }

    const get = /\/api\/v1\/load-charts\/([^/]+)$/.exec(path)
    if (method === 'GET' && get) {
      const chart = charts.find((item) => item.chart_id === decodeURIComponent(get[1]))
      if (!chart) return jsonResponse({ detail: 'Tabela não encontrada.' }, 404)
      return jsonResponse({ ...chart, point_count: chart.points.length })
    }
    return jsonResponse({ detail: 'Not Found' }, 404)
  })
}

/** Junta o `fetch` falso do catálogo com o das tabelas (as páginas usam os dois). */
export function combineFetch(catalogFetch: typeof fetch, loadChartFetch: typeof fetch) {
  return vi.fn<typeof fetch>((input, init) => {
    const path = new URL(String(input), 'http://localhost').pathname
    return path.startsWith('/api/v1/load-charts') || path.endsWith('/load-charts')
      ? loadChartFetch(input, init)
      : catalogFetch(input, init)
  })
}
