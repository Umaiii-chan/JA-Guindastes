// Cliente REST de `/api/v1/ai*` (TASK-076; ADR-039). Contrato em snake_case.
//
// - `GET  /ai/status` → 200 `{enabled, model, fallback_models, usage_limit_per_hour}`;
// - `POST /ai/scenario-from-text` `{text}` → `{summary, assumptions, load, scenario, model, fallback_used}`;
// - `POST /ai/explain-recommendation` `{recommendation, context?}` → `{text, model, fallback_used}`;
// - `POST /ai/lift-report` `{evaluation, load, crane_label?, scenario?, note?}` → `{markdown, ...}`;
// - `POST /ai/review-recording` `{recording_id}` → `{markdown, ...}`.
//
// Erros do backend: 422 `AI_INPUT_INVALID`/`AI_REJECTED`, 429 `AI_RATE_LIMITED`, 502 `AI_BAD_OUTPUT`,
// 503 `AI_UNAVAILABLE`, 504 `AI_TIMEOUT`; o `detail` já vem em pt-BR e vai direto para a tela.

import type {
  AiGateway,
  AiLiftReportRequest,
  AiModelInfo,
  AiScenarioDraft,
  AiStatus,
  AiText,
} from '../../application/ai/ports'
import {
  type JsonRecord,
  readArray,
  readNullableNumber,
  readNumber,
  readRecord,
  readString,
} from '../shared/readJson'
import { type AuthHttpOptions, createSendJson, guardContract, readBoolean } from './authHttp'
import { toEvaluationRequestDto } from './evaluationContract'
import { mapScenarioSpec, toScenarioSpecDto } from './scenarioRestClient'

export const AI_PATH = '/api/v1/ai'

function mapModelInfo(record: JsonRecord, path: string): AiModelInfo {
  return {
    model: readString(record, 'model', path),
    fallbackUsed: readBoolean(record, 'fallback_used', path),
  }
}

function mapStatus(json: unknown): AiStatus {
  const record = readRecord(json, 'response')
  const model = record.model
  return {
    enabled: readBoolean(record, 'enabled', 'response'),
    model: typeof model === 'string' ? model : null,
    fallbackModels: readArray(record, 'fallback_models', 'response').filter(
      (item): item is string => typeof item === 'string',
    ),
    usageLimitPerHour: readNullableNumber(record, 'usage_limit_per_hour', 'response'),
  }
}

function mapScenarioDraft(json: unknown): AiScenarioDraft {
  const record = readRecord(json, 'response')
  const load = readRecord(record.load, 'response.load')
  return {
    ...mapModelInfo(record, 'response'),
    summary: readString(record, 'summary', 'response'),
    assumptions: readArray(record, 'assumptions', 'response').filter(
      (item): item is string => typeof item === 'string',
    ),
    load: {
      description: readString(load, 'description', 'response.load'),
      weightKg: readNumber(load, 'weight_kg', 'response.load'),
      lengthM: readNumber(load, 'length_m', 'response.load'),
      widthM: readNumber(load, 'width_m', 'response.load'),
      heightM: readNumber(load, 'height_m', 'response.load'),
    },
    scenario: mapScenarioSpec(record.scenario, 'response.scenario'),
  }
}

function mapText(json: unknown, textKey: 'text' | 'markdown'): AiText {
  const record = readRecord(json, 'response')
  return {
    ...mapModelInfo(record, 'response'),
    markdown: readString(record, textKey, 'response'),
  }
}

function liftReportBody(request: AiLiftReportRequest): Record<string, unknown> {
  return {
    evaluation: toEvaluationRequestDto(request.evaluation),
    load: {
      description: request.load.description,
      length_m: request.load.lengthM,
      width_m: request.load.widthM,
      height_m: request.load.heightM,
    },
    ...(request.craneLabel ? { crane_label: request.craneLabel } : {}),
    ...(request.scenario ? { scenario: toScenarioSpecDto(request.scenario) } : {}),
    ...(request.note && request.note.trim() !== '' ? { note: request.note.trim() } : {}),
  }
}

export function createAiRestClient(options: AuthHttpOptions = {}): AiGateway {
  const send = createSendJson(options)

  return {
    async status() {
      const { json } = await send('GET', `${AI_PATH}/status`)
      return guardContract(() => mapStatus(json))
    },

    async scenarioFromText(text) {
      const { json } = await send('POST', `${AI_PATH}/scenario-from-text`, { text })
      return guardContract(() => mapScenarioDraft(json))
    },

    async explainRecommendation(recommendation, context) {
      const { json } = await send('POST', `${AI_PATH}/explain-recommendation`, {
        recommendation,
        ...(context ? { context } : {}),
      })
      return guardContract(() => mapText(json, 'text'))
    },

    async liftReport(request) {
      const { json } = await send('POST', `${AI_PATH}/lift-report`, liftReportBody(request))
      return guardContract(() => mapText(json, 'markdown'))
    },

    async reviewRecording(recordingId) {
      const { json } = await send('POST', `${AI_PATH}/review-recording`, {
        recording_id: recordingId,
      })
      return guardContract(() => mapText(json, 'markdown'))
    },
  }
}
