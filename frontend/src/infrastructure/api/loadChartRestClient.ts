// Cliente REST da validação, importação, consulta, listagem e ativação de tabelas de carga (TASK-034,
// TASK-042, TASK-044).
// - `POST /api/v1/load-charts/validate` (TASK-019; multipart igual ao do import) → 200 com
//   `status: DRAFT` e os pontos, ou `status: INVALID` e o relatório; 413; 422 do FastAPI. Nada é
//   gravado. Só CSV (parser da composição).
// - `GET /api/v1/load-charts/{id}` → 200 `LoadChartResponse`; 404.
// Contrato da TASK-031:
// - `POST /api/v1/load-charts/import` (multipart: `file`, `configuration_id`, `chart_id`,
//   `version`) → 201 `LoadChartResponse` (DRAFT); 422 com relatório (`status: INVALID`, `issues`),
//   ou 422 do FastAPI (`detail` lista) ou `{detail: str}`; 404; 409; 413; 415.
// - `POST /api/v1/load-charts/{id}/activate` → 200 `LoadChartActivationResponse`
//   (+ `superseded_chart_id`); 404; 409.
// Erros 404/409/413/415 chegam como `{"detail": str}`.
// Contrato da TASK-044:
// - `GET /api/v1/configurations/{configuration_id}/load-charts` → 200
//   `{items: [LoadChartResponse sem points], active_chart_id: str | null}`, por versão da maior para a
//   menor (números comparados como números; empate por chart_id decrescente); 404 `{detail}` se a
//   configuração não existe.
// Contrato da TASK-046 (zonas de giro; ADR-018):
// - o `/import` ganha o campo `rotation_zone_code`, que só vai quando há zona; 422
//   `ROTATION_ZONE_REQUIRED`, `UNKNOWN_ROTATION_ZONE` e `ROTATION_ZONE_NOT_ALLOWED` viram erros com
//   esses códigos (em qualquer formato de erro, ver `findApiErrorCode`);
// - `LoadChartResponse` e o item da listagem ganham `rotation_zone_code` (ausente = `null`);
// - a listagem ganha `active_charts: [{rotation_zone_code, chart_id}]` (uma ativa por zona).

import type {
  ActiveChartRef,
  ConfigurationLoadCharts,
  LoadChartActivation,
  LoadChartFailure,
  LoadChartGateway,
  LoadChartImportIssue,
  LoadChartImportRequest,
  LoadChartPoint,
  LoadChartStatus,
  LoadChartSummary,
  LoadChartValidation,
  StoredLoadChart,
} from '../../application/loadChart/ports'
import { detailText, findApiErrorCode } from '../shared/apiErrorCode'
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

/** Tabelas de uma configuração (TASK-044). */
export function configurationLoadChartsPath(configurationId: string): string {
  return `/api/v1/configurations/${encodeURIComponent(configurationId)}/load-charts`
}

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
  const origin = options.baseUrl ?? ''
  const base = `${origin}${LOAD_CHARTS_PATH}`

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

  function multipart(request: LoadChartImportRequest, withZone = false): RequestInit {
    const form = new FormData()
    form.append('file', request.file, request.fileName)
    form.append('configuration_id', request.configurationId)
    form.append('chart_id', request.chartId)
    form.append('version', request.version)
    // A zona só vai na importação, e só quando há (TASK-046): numa configuração sem zonas, o campo
    // precisa estar ausente.
    const zone = request.rotationZoneCode?.trim()
    if (withZone && zone) form.append('rotation_zone_code', zone)
    // Sem `Content-Type`: o navegador põe o `multipart/form-data` com o boundary.
    return { method: 'POST', headers: { Accept: 'application/json' }, body: form }
  }

  return {
    async validateChart(request) {
      const response = await send(`${base}/validate`, multipart(request))
      const body = await readBody(response)
      if (response.status === 200) return guard(() => mapValidation(body))
      throw importError(response.status, body)
    },

    async importChart(request) {
      const response = await send(`${base}/import`, multipart(request, true))
      const body = await readBody(response)

      if (response.status === 201) {
        return { kind: 'IMPORTED', chart: guard(() => mapLoadChart(body, 'response')) }
      }
      // Problema da zona, não do arquivo (TASK-046), em qualquer formato de erro.
      const zoneCode = response.status === 422 ? findApiErrorCode(body, ZONE_IMPORT_CODES) : null
      if (zoneCode !== null) throw zoneImportError(zoneCode, body)
      if (response.status === 422 && isRecord(body) && body.status === 'INVALID') {
        return { kind: 'INVALID', issues: guard(() => mapIssues(body)) }
      }
      throw importError(response.status, body)
    },

    async getChart(chartId) {
      const response = await send(`${base}/${encodeURIComponent(chartId)}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      })
      const body = await readBody(response)
      if (response.status === 200) return guard(() => mapLoadChart(body, 'response'))
      throw activationError(response.status, body)
    },

    async listConfigurationCharts(configurationId) {
      const response = await send(`${origin}${configurationLoadChartsPath(configurationId)}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      })
      const body = await readBody(response)
      if (response.status === 200) return guard(() => mapConfigurationCharts(body))
      throw listError(response.status, body)
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

/** Códigos de erro da zona na importação (TASK-046 § 3), todos com HTTP 422. */
export const ZONE_IMPORT_ERROR_CODES = {
  required: 'ROTATION_ZONE_REQUIRED',
  unknown: 'UNKNOWN_ROTATION_ZONE',
  notAllowed: 'ROTATION_ZONE_NOT_ALLOWED',
} as const

const ZONE_IMPORT_CODES: readonly string[] = Object.values(ZONE_IMPORT_ERROR_CODES)

const ZONE_IMPORT_MESSAGES: Readonly<Record<string, string>> = {
  [ZONE_IMPORT_ERROR_CODES.required]:
    'Esta configuração tem zonas de giro: escolha a zona desta tabela (HTTP 422 ROTATION_ZONE_REQUIRED).',
  [ZONE_IMPORT_ERROR_CODES.unknown]:
    'A zona escolhida não existe nesta configuração (HTTP 422 UNKNOWN_ROTATION_ZONE): ela pode ter mudado no Catálogo. Recarregue a página e escolha outra.',
  [ZONE_IMPORT_ERROR_CODES.notAllowed]:
    'Esta configuração não tem zonas de giro no backend (HTTP 422 ROTATION_ZONE_NOT_ALLOWED): ela pode ter mudado no Catálogo. Recarregue a página e importe sem zona.',
}

function zoneImportError(code: string, body: unknown): LoadChartClientError {
  const detail = detailText(body)
  return new LoadChartClientError(
    code,
    422,
    `${ZONE_IMPORT_MESSAGES[code] ?? `O backend recusou a zona (HTTP 422 ${code}).`}${detail ? ` Detalhe do backend: ${detail}` : ''}`,
  )
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

function listError(status: number, body: unknown): LoadChartClientError {
  const codes = LOAD_CHART_CLIENT_ERROR_CODES
  if (status === 404) {
    return new LoadChartClientError(
      codes.configurationNotFound,
      status,
      `A configuração não existe mais (HTTP 404): escolha outra ou recarregue o catálogo.${backendDetail(body)}`,
    )
  }
  return new LoadChartClientError(codes.http, status, `O backend respondeu HTTP ${status}.`)
}

function readStatus(record: Readonly<Record<string, unknown>>, path: string): LoadChartStatus {
  const status = readString(record, 'status', path)
  const known = STATUSES.find((candidate) => candidate === status)
  if (known === undefined) throw new ContractViolationError(`${path}.status`, STATUSES.join(', '))
  return known
}

function mapPoints(body: Readonly<Record<string, unknown>>, path: string): LoadChartPoint[] {
  return readArray(body, 'points', path).map((item, index): LoadChartPoint => {
    const pointPath = `${path}.points[${index}]`
    const point = readRecord(item, pointPath)
    return {
      boomLengthM: readNumber(point, 'boom_length_m', pointPath),
      workingRadiusM: readNumber(point, 'working_radius_m', pointPath),
      maxCapacityKg: readNumber(point, 'max_capacity_kg', pointPath),
    }
  })
}

/** Converte `LoadChartResponse` na tabela da tela, conferindo o contrato. */
export function mapLoadChart(json: unknown, path: string): StoredLoadChart {
  const body = readRecord(json, path)
  const points = mapPoints(body, path)
  const source = readRecord(body.source, `${path}.source`)
  return {
    chartId: readString(body, 'chart_id', path),
    version: readString(body, 'version', path),
    configurationId: readString(body, 'configuration_id', path),
    status: readStatus(body, path),
    points,
    sourceFileName: readString(source, 'file_name', `${path}.source`),
    rotationZoneCode: readNullableString(body, 'rotation_zone_code', path),
  }
}

/** Um item da listagem: o `LoadChartResponse` sem `points`, com `point_count`. */
function mapSummary(json: unknown, path: string): LoadChartSummary {
  const body = readRecord(json, path)
  const source = readRecord(body.source, `${path}.source`)
  return {
    chartId: readString(body, 'chart_id', path),
    version: readString(body, 'version', path),
    configurationId: readString(body, 'configuration_id', path),
    status: readStatus(body, path),
    pointCount: readNumber(body, 'point_count', path),
    sourceFileName: readString(source, 'file_name', `${path}.source`),
    rotationZoneCode: readNullableString(body, 'rotation_zone_code', path),
  }
}

function mapConfigurationCharts(json: unknown): ConfigurationLoadCharts {
  const body = readRecord(json, 'response')
  const items = readArray(body, 'items', 'response').map((item, index) =>
    mapSummary(item, `response.items[${index}]`),
  )
  const activeChartId = readNullableString(body, 'active_chart_id', 'response')
  return { items, activeChartId, activeCharts: mapActiveCharts(body, items, activeChartId) }
}

/**
 * `active_charts` (TASK-046). Sem o campo (backend anterior), as ativas vêm das tabelas `ACTIVE`
 * da lista, cada uma na sua zona, mais a `active_chart_id` na zona `null`.
 */
function mapActiveCharts(
  body: Readonly<Record<string, unknown>>,
  items: readonly LoadChartSummary[],
  activeChartId: string | null,
): ActiveChartRef[] {
  if (body.active_charts !== undefined && body.active_charts !== null) {
    return readArray(body, 'active_charts', 'response').map((item, index) => {
      const path = `response.active_charts[${index}]`
      const record = readRecord(item, path)
      return {
        rotationZoneCode: readNullableString(record, 'rotation_zone_code', path),
        chartId: readString(record, 'chart_id', path),
      }
    })
  }
  const derived: ActiveChartRef[] = items
    .filter((item) => item.status === 'ACTIVE')
    .map((item) => ({ rotationZoneCode: item.rotationZoneCode, chartId: item.chartId }))
  if (activeChartId !== null && !derived.some((item) => item.chartId === activeChartId)) {
    derived.push({ rotationZoneCode: null, chartId: activeChartId })
  }
  return derived
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

function mapValidation(json: unknown): LoadChartValidation {
  const body = readRecord(json, 'response')
  const status = readString(body, 'status', 'response')
  if (status === 'INVALID') return { kind: 'INVALID', issues: mapIssues(body) }
  if (status !== 'DRAFT') throw new ContractViolationError('response.status', 'DRAFT ou INVALID')
  return { kind: 'VALID', points: mapPoints(body, 'response') }
}

function mapActivation(json: unknown): LoadChartActivation {
  const body = readRecord(json, 'response')
  return {
    chart: mapLoadChart(body, 'response'),
    supersededChartId: readNullableString(body, 'superseded_chart_id', 'response'),
  }
}
