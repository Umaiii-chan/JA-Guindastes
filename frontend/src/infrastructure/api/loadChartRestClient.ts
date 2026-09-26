// Cliente REST da importação e da ativação de tabelas de carga (TASK-034). Contrato da TASK-031:
// - `POST /api/v1/load-charts/import` (multipart: `file`, `configuration_id`, `chart_id`,
//   `version`) → 201 `LoadChartResponse` (DRAFT); 422 com relatório (`status: INVALID`, `issues`),
//   ou 422 do FastAPI (`detail` lista) ou `{detail: str}`; 404; 409; 413; 415.
// - `POST /api/v1/load-charts/{id}/activate` → 200 `LoadChartActivationResponse`
//   (+ `superseded_chart_id`); 404; 409.
// Erros 404/409/413/415 chegam como `{"detail": str}`.

import type {
  LoadChartActivation,
  LoadChartFailure,
  LoadChartGateway,
  LoadChartImportIssue,
  LoadChartPoint,
  LoadChartStatus,
  StoredLoadChart,
} from '../../application/loadChart/ports'
import {
  ContractViolationError,
  isRecord,
  readArray,
  readNullableNumber,
  readNullableString,
  readNumber,
  readRecord,
  readString,
} from '../shared/readJson'
import { createApiFetch } from './apiFetch'

export const LOAD_CHARTS_PATH = '/api/v1/load-charts'

export const LOAD_CHART_CLIENT_ERROR_CODES = {
  network: 'NETWORK_ERROR',
  configurationNotFound: 'CONFIGURATION_NOT_FOUND',
  chartNotFound: 'LOAD_CHART_NOT_FOUND',
  conflict: 'CONFLICT',
  tooLarge: 'FILE_TOO_LARGE',
  unsupportedFormat: 'UNSUPPORTED_FORMAT',
  invalidRequest: 'INVALID_REQUEST',
  http: 'HTTP_ERROR',
  invalidResponse: 'INVALID_RESPONSE',
} as const

/** Falha da importação/ativação; `code`, `httpStatus` e `message` vão para a tela. */
export class LoadChartClientError extends Error implements LoadChartFailure {
  readonly code: string
  readonly httpStatus: number | null

  constructor(code: string, httpStatus: number | null, message: string) {
    super(message)
    this.name = 'LoadChartClientError'
    this.code = code
    this.httpStatus = httpStatus
  }
}

export interface LoadChartRestClientOptions {
  /** `fetch` injetável (testes). Padrão: o `fetch` global. Sempre embrulhado por `createApiFetch` (cookie e CSRF). */
  readonly fetchFn?: typeof fetch
  /** Prefixo da origem; vazio = mesma origem (proxy do Vite em dev, nginx no container). */
  readonly baseUrl?: string
}

const STATUSES: readonly LoadChartStatus[] = [
  'DRAFT',
  'VALIDATED',
  'ACTIVE',
  'SUPERSEDED',
  'INVALID',
]

export function createLoadChartRestClient(
  options: LoadChartRestClientOptions = {},
): LoadChartGateway {
  const fetchFn = createApiFetch(options.fetchFn)
  const base = `${options.baseUrl ?? ''}${LOAD_CHARTS_PATH}`

  async function send(url: string, init: RequestInit): Promise<Response> {
    try {
      return await fetchFn(url, init)
    } catch {
      throw new LoadChartClientError(
        LOAD_CHART_CLIENT_ERROR_CODES.network,
        null,
        'Não foi possível falar com o backend (falha de rede).',
      )
    }
  }

  return {
    async importChart(request) {
      const form = new FormData()
      form.append('file', request.file, request.fileName)
      form.append('configuration_id', request.configurationId)
      form.append('chart_id', request.chartId)
      form.append('version', request.version)
      // Sem `Content-Type`: o navegador põe o `multipart/form-data` com o boundary.
      const response = await send(`${base}/import`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: form,
      })
      const body = await readBody(response)

      if (response.status === 201) {
        return { kind: 'IMPORTED', chart: guard(() => mapLoadChart(body, 'response')) }
      }
      if (response.status === 422 && isRecord(body) && body.status === 'INVALID') {
        return { kind: 'INVALID', issues: guard(() => mapIssues(body)) }
      }
      throw importError(response.status, body)
    },

    async activateChart(chartId) {
      const response = await send(`${base}/${encodeURIComponent(chartId)}/activate`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
      })
      const body = await readBody(response)
      if (response.status === 200) return guard(() => mapActivation(body))
      throw activationError(response.status, body)
    },
  }
}

async function readBody(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown
  } catch {
    return undefined
  }
}

function guard<T>(map: () => T): T {
  try {
    return map()
  } catch (error) {
    if (error instanceof ContractViolationError) {
      throw new LoadChartClientError(
        LOAD_CHART_CLIENT_ERROR_CODES.invalidResponse,
        null,
        error.message,
      )
    }
    throw error
  }
}

/** ` Detalhe do backend: <detail>.` quando o corpo é `{"detail": str}`; vazio caso contrário. */
function backendDetail(body: unknown): string {
  if (!isRecord(body) || typeof body.detail !== 'string' || body.detail.trim() === '') return ''
  return ` Detalhe do backend: ${body.detail}`
}

/** Primeiro item do `detail` do 422 do FastAPI, ex.: ` Campo body.version — Field required.`. */
function fastApiDetail(body: unknown): string {
  if (!isRecord(body) || !Array.isArray(body.detail) || body.detail.length === 0) return ''
  const first: unknown = body.detail[0]
  if (!isRecord(first) || typeof first.msg !== 'string') return ''
  const location = Array.isArray(first.loc) ? first.loc.join('.') : ''
  return location ? ` Campo ${location} — ${first.msg}` : ` ${first.msg}`
}

function importError(status: number, body: unknown): LoadChartClientError {
  const codes = LOAD_CHART_CLIENT_ERROR_CODES
  const detail = backendDetail(body)
  switch (status) {
    case 404:
      return new LoadChartClientError(
        codes.configurationNotFound,
        status,
        `Configuração não encontrada (HTTP 404): confira o configuration_id.${detail}`,
      )
    case 409:
      return new LoadChartClientError(
        codes.conflict,
        status,
        'Conflito (HTTP 409): já existe essa versão nesta configuração, ou já existe uma tabela ' +
          `com esse chart_id.${detail}`,
      )
    case 413:
      return new LoadChartClientError(
        codes.tooLarge,
        status,
        `Arquivo grande demais (HTTP 413): passou do limite de tamanho aceito pelo backend.${detail}`,
      )
    case 415:
      return new LoadChartClientError(
        codes.unsupportedFormat,
        status,
        `Formato de arquivo não reconhecido (HTTP 415): envie um CSV ou XLSX.${detail}`,
      )
    case 422:
      return new LoadChartClientError(
        codes.invalidRequest,
        status,
        `O backend recusou a requisição (HTTP 422).${detail || fastApiDetail(body)}`,
      )
    default:
      return new LoadChartClientError(codes.http, status, `O backend respondeu HTTP ${status}.`)
  }
}

function activationError(status: number, body: unknown): LoadChartClientError {
  const codes = LOAD_CHART_CLIENT_ERROR_CODES
  const detail = backendDetail(body)
  switch (status) {
    case 404:
      return new LoadChartClientError(
        codes.chartNotFound,
        status,
        `Tabela de carga não encontrada (HTTP 404).${detail}`,
      )
    case 409:
      return new LoadChartClientError(
        codes.conflict,
        status,
        'A tabela não pode ser ativada (HTTP 409): o status dela não permite ' +
          `(INVALID, ACTIVE ou SUPERSEDED) ou mudou ao mesmo tempo.${detail}`,
      )
    default:
      return new LoadChartClientError(codes.http, status, `O backend respondeu HTTP ${status}.`)
  }
}

function readStatus(record: Readonly<Record<string, unknown>>, path: string): LoadChartStatus {
  const status = readString(record, 'status', path)
  const known = STATUSES.find((candidate) => candidate === status)
  if (known === undefined) throw new ContractViolationError(`${path}.status`, STATUSES.join(', '))
  return known
}

/** Converte `LoadChartResponse` na tabela da tela, conferindo o contrato. */
export function mapLoadChart(json: unknown, path: string): StoredLoadChart {
  const body = readRecord(json, path)
  const points = readArray(body, 'points', path).map((item, index): LoadChartPoint => {
    const pointPath = `${path}.points[${index}]`
    const point = readRecord(item, pointPath)
    return {
      boomLengthM: readNumber(point, 'boom_length_m', pointPath),
      workingRadiusM: readNumber(point, 'working_radius_m', pointPath),
      maxCapacityKg: readNumber(point, 'max_capacity_kg', pointPath),
    }
  })
  const source = readRecord(body.source, `${path}.source`)
  return {
    chartId: readString(body, 'chart_id', path),
    version: readString(body, 'version', path),
    configurationId: readString(body, 'configuration_id', path),
    status: readStatus(body, path),
    points,
    sourceFileName: readString(source, 'file_name', `${path}.source`),
  }
}

function mapIssues(body: Readonly<Record<string, unknown>>): LoadChartImportIssue[] {
  const path = 'response'
  return readArray(body, 'issues', path).map((item, index) => {
    const issuePath = `${path}.issues[${index}]`
    const issue = readRecord(item, issuePath)
    return {
      code: readString(issue, 'code', issuePath),
      message: readString(issue, 'message', issuePath),
      line: readNullableNumber(issue, 'line', issuePath),
      column: readNullableString(issue, 'column', issuePath),
    }
  })
}

function mapActivation(json: unknown): LoadChartActivation {
  const body = readRecord(json, 'response')
  return {
    chart: mapLoadChart(body, 'response'),
    supersededChartId: readNullableString(body, 'superseded_chart_id', 'response'),
  }
}
