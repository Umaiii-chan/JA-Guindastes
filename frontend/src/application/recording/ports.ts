// Porta da persistência das gravações (TASK-057; ADR-027). O adaptador REST está em
// `infrastructure/api/simulationRecordingRestClient.ts`.

import type {
  LoadChartRef,
  RecordingFrame,
  SimulationRecording,
  SimulationRecordingSummary,
} from './recording'
import type { ScenarioSpec } from '../../domain/environment/environment'

export interface NewSimulationRecording {
  readonly name: string
  readonly configurationId: string
  readonly durationMs: number
  readonly loadChartRefs: readonly LoadChartRef[]
  readonly scenario?: ScenarioSpec
  readonly frames: readonly RecordingFrame[]
}

export interface SimulationRecordingGateway {
  list(): Promise<SimulationRecordingSummary[]>
  open(id: string): Promise<SimulationRecording>
  create(recording: NewSimulationRecording): Promise<SimulationRecordingSummary>
  remove(id: string): Promise<void>
}

/** Falha numa chamada das gravações; `code` é o do backend (`RECORDING_TOO_LARGE`...) ou do cliente. */
export class RecordingRequestError extends Error {
  readonly code: string
  readonly httpStatus: number | null

  constructor(code: string, message: string, httpStatus: number | null = null) {
    super(message)
    this.name = 'RecordingRequestError'
    this.code = code
    this.httpStatus = httpStatus
  }
}
