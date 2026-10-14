// Cliente REST de `/api/v1/simulations` (TASK-057; ADR-027). Contrato em snake_case, como o das
// avaliações; os quadros e o cenário viajam como o frontend os escreve (JSON opaco para o backend).
//
// - `GET    /simulations` → 200 `{items: Summary[]}`;
// - `GET    /simulations/{id}` → 200 `Recording` (resumo + `scenario` + `frames`); 404;
// - `POST   /simulations` → 201 `Recording`; 413 `RECORDING_TOO_LARGE`; 422 `RECORDING_TOO_LONG`;
// - `DELETE /simulations/{id}` → 204; 403 `FORBIDDEN`; 404 `RECORDING_NOT_FOUND`.

import {
  type NewSimulationRecording,
  RecordingRequestError,
  type SimulationRecordingGateway,
} from '../../application/recording/ports'
import type {
  RecordingFrame,
  SimulationRecording,
  SimulationRecordingSummary,
} from '../../application/recording/recording'
import type { ScenarioSpec } from '../../domain/environment/environment'
import {
  ContractViolationError,
  isRecord,
  readArray,
  readNumber,
  readRecord,
  readString,
  type JsonRecord,
} from '../shared/readJson'
import { createApiFetch } from './apiFetch'

export const SIMULATIONS_PATH = '/api/v1/simulations'

export interface SimulationRecordingClientOptions {
  /** `fetch` injetável (testes). Padrão: o `fetch` global, com cookie e cabeçalho CSRF. */
  readonly fetchFn?: typeof fetch
  readonly baseUrl?: string
}

const DEFAULT_MESSAGES: Readonly<Record<string, string>> = {
  RECORDING_TOO_LARGE: 'A gravação passa do limite de tamanho (5 MB).',
  RECORDING_TOO_LONG: 'A gravação passa do limite de duração (10 minutos).',
  RECORDING_NOT_FOUND: 'Gravação não encontrada.',
  FORBIDDEN: 'Só o autor da gravação ou um administrador pode apagá-la.',
  NOT_AUTHENTICATED: 'A sessão acabou. Entre de novo.',
}

export function createSimulationRecordingRestClient(
  options: SimulationRecordingClientOptions = {},
): SimulationRecordingGateway {
  const fetchFn = createApiFetch(options.fetchFn)
  const baseUrl = options.baseUrl ?? ''

  async function send(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<unknown> {
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    let response: Response
    try {
      response = await fetchFn(`${baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    } catch {
      throw new RecordingRequestError(
        'NETWORK_ERROR',
        'Não foi possível falar com o servidor (falha de rede).',
      )
    }
    let json: unknown
    if (response.status !== 204) {
      try {
        json = (await response.json()) as unknown
      } catch {
        json = undefined
      }
    }
    if (!response.ok) throw errorFrom(response.status, json)
    return json
  }

  async function guard<T>(map: () => T): Promise<T> {
    try {
      return map()
    } catch (error) {
      if (error instanceof ContractViolationError) {
        throw new RecordingRequestError('INVALID_RESPONSE', error.message)
      }
      throw error
    }
  }

  return {
    async list() {
      const json = await send('GET', SIMULATIONS_PATH)
      return guard(() =>
        readArray(readRecord(json, 'response'), 'items', 'response').map((item, index) =>
          mapSummary(item, `response.items[${index}]`),
        ),
      )
    },
    async open(id) {
      const json = await send('GET', `${SIMULATIONS_PATH}/${encodeURIComponent(id)}`)
      return guard(() => mapRecording(json, 'response'))
    },
    async create(recording) {
      const json = await send('POST', SIMULATIONS_PATH, toRequestBody(recording))
      return guard(() => mapSummary(json, 'response'))
    },
    async remove(id) {
      await send('DELETE', `${SIMULATIONS_PATH}/${encodeURIComponent(id)}`)
    },
  }
}

export function toRequestBody(recording: NewSimulationRecording): Record<string, unknown> {
  return {
    name: recording.name,
    configuration_id: recording.configurationId,
    duration_ms: Math.round(recording.durationMs),
    load_chart_refs: recording.loadChartRefs.map((ref) => ({
      load_chart_id: ref.loadChartId,
      version: ref.version,
    })),
    scenario: recording.scenario ?? null,
    frames: recording.frames,
  }
}

function errorFrom(status: number, body: unknown): RecordingRequestError {
  const code = isRecord(body) && typeof body.code === 'string' ? body.code : null
  const detail = isRecord(body) && typeof body.detail === 'string' ? body.detail : null
  if (status === 422 && isRecord(body) && Array.isArray(body.detail)) {
    return new RecordingRequestError(
      'VALIDATION',
      'O servidor recusou os dados da gravação (HTTP 422).',
      status,
    )
  }
  if (code !== null) {
    return new RecordingRequestError(
      code,
      DEFAULT_MESSAGES[code] ?? detail ?? `Erro ${code} (HTTP ${status}).`,
      status,
    )
  }
  return new RecordingRequestError('HTTP_ERROR', `O servidor respondeu HTTP ${status}.`, status)
}

function mapSummary(json: unknown, path: string): SimulationRecordingSummary {
  const record = readRecord(json, path)
  return {
    id: readString(record, 'id', path),
    name: readString(record, 'name', path),
    authorUserId: readString(record, 'author_user_id', path),
    authorDisplayName: readString(record, 'author_display_name', path),
    createdAt: readString(record, 'created_at', path),
    durationMs: readNumber(record, 'duration_ms', path),
    configurationId: readString(record, 'configuration_id', path),
    loadChartRefs: readArray(record, 'load_chart_refs', path).map((item, index) => {
      const ref = readRecord(item, `${path}.load_chart_refs[${index}]`)
      return {
        loadChartId: readString(ref, 'load_chart_id', path),
        version: readString(ref, 'version', path),
      }
    }),
    frameCount: readNumber(record, 'frame_count', path),
  }
}

function mapRecording(json: unknown, path: string): SimulationRecording {
  const record = readRecord(json, path)
  const frames = readArray(record, 'frames', path).map((item, index): RecordingFrame => {
    const frame: JsonRecord = readRecord(item, `${path}.frames[${index}]`)
    readNumber(frame, 'tMs', `${path}.frames[${index}]`)
    readRecord(frame.crane, `${path}.frames[${index}].crane`)
    // Os quadros foram escritos pelo próprio frontend (campos opcionais podem faltar).
    return frame as unknown as RecordingFrame
  })
  const scenario = isRecord(record.scenario)
    ? (record.scenario as unknown as ScenarioSpec)
    : undefined
  return { ...mapSummary(record, path), scenario, frames }
}
