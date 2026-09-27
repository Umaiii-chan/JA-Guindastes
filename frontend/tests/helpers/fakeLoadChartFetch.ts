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

/** Cria o `fetch` falso das tabelas. `charts` pode vir preenchido (tabelas já gravadas). */
export function createFakeLoadChartFetch(charts: ChartRow[] = []) {
  return vi.fn<typeof fetch>(async (input, init) => {
    const path = new URL(String(input), 'http://localhost').pathname
    const method = init?.method ?? 'GET'

    if (method === 'POST' && (path.endsWith('/validate') || path.endsWith('/import'))) {
      const form = init?.body as FormData
      const file = form.get('file') as File
      const { points, issues } = parseCsvFicticio(await file.text())
      const base = {
        chart_id: String(form.get('chart_id')),
        version: String(form.get('version')),
        configuration_id: String(form.get('configuration_id')),
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
      const previous = charts.find(
        (item) => item.configuration_id === chart.configuration_id && item.status === 'ACTIVE',
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
    return path.startsWith('/api/v1/load-charts')
      ? loadChartFetch(input, init)
      : catalogFetch(input, init)
  })
}
