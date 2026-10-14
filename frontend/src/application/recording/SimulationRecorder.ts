// Gravador puro da simulação (TASK-057; ADR-027): sem React, sem relógio próprio e sem Three.js.
// Quem usa passa o instante (`nowMs`), o que deixa o comportamento determinístico nos testes.
//
// - `start` grava o estado inicial completo (quadro em `tMs` = 0);
// - `record` registra um quadro a cada MUDANÇA do estado, no máximo a 10 Hz (`MIN_FRAME_INTERVAL_MS`):
//   uma mudança que chega antes do intervalo fica pendente e entra em `flush` ou `stop`, então a
//   última posição nunca se perde;
// - para sozinho no limite de duração ou de tamanho (constantes PROVISÓRIAS, ADR-027); quem usa
//   consulta `limitReached` e chama `stop`.

import type { ScenarioSpec } from '../../domain/environment/environment'
import {
  MAX_RECORDING_BYTES,
  MAX_RECORDING_DURATION_MS,
  MIN_FRAME_INTERVAL_MS,
  type RecordedSimulation,
  type RecordingFrame,
  type RecordingSnapshot,
} from './recording'

export interface SimulationRecorderOptions {
  readonly minIntervalMs?: number
  readonly maxDurationMs?: number
  readonly maxBytes?: number
  /** Cópia do cenário (TASK-052); opcional enquanto ela não integra. */
  readonly scenario?: ScenarioSpec
}

export type RecorderLimit = 'duration-limit' | 'size-limit'

export class SimulationRecorder {
  private readonly minIntervalMs: number
  private readonly maxDurationMs: number
  private readonly maxBytes: number
  private readonly scenario: ScenarioSpec | undefined
  private startedAtMs = 0
  private running = false
  private frames: RecordingFrame[] = []
  private lastKey = ''
  private bytes = 0
  private pending: { snapshot: RecordingSnapshot; atMs: number } | null = null
  private limit: RecorderLimit | null = null

  constructor(options: SimulationRecorderOptions = {}) {
    this.minIntervalMs = options.minIntervalMs ?? MIN_FRAME_INTERVAL_MS
    this.maxDurationMs = options.maxDurationMs ?? MAX_RECORDING_DURATION_MS
    this.maxBytes = options.maxBytes ?? MAX_RECORDING_BYTES
    this.scenario = options.scenario
  }

  get isRecording(): boolean {
    return this.running
  }

  get frameCount(): number {
    return this.frames.length
  }

  /** Limite atingido, se algum; a gravação não aceita mais quadros, mas ainda precisa de `stop`. */
  get limitReached(): RecorderLimit | null {
    return this.limit
  }

  elapsedMs(nowMs: number): number {
    return this.running ? Math.max(0, nowMs - this.startedAtMs) : 0
  }

  /** Começa a gravar com o estado inicial completo. Recomeça se já estava gravando. */
  start(initial: RecordingSnapshot, nowMs: number): void {
    this.running = true
    this.startedAtMs = nowMs
    this.frames = []
    this.pending = null
    this.limit = null
    this.bytes = 0
    this.lastKey = ''
    this.push(initial, 0, true)
  }

  /** Estado atual da cena. Só entra quadro se algo mudou e o intervalo mínimo passou. */
  record(snapshot: RecordingSnapshot, nowMs: number): void {
    if (!this.running || this.limit !== null) return
    const reference = this.pending ? keyOf(this.pending.snapshot) : this.lastKey
    if (keyOf(snapshot) === reference) return
    this.pending = { snapshot, atMs: nowMs }
    this.flush(nowMs)
  }

  /** Grava o quadro pendente se o intervalo mínimo já passou. */
  flush(nowMs: number): void {
    if (!this.running || this.pending === null || this.limit !== null) return
    const last = this.frames[this.frames.length - 1]
    if (nowMs - this.startedAtMs < last.tMs + this.minIntervalMs) return
    this.commitPending(last)
  }

  /** Encerra e devolve a gravação. O quadro pendente entra, respeitando o intervalo mínimo. */
  stop(
    nowMs: number,
    stoppedBy: RecordedSimulation['stoppedBy'] = this.limit ?? 'user',
  ): RecordedSimulation {
    if (this.pending !== null && this.limit === null) {
      this.commitPending(this.frames[this.frames.length - 1])
    }
    const lastTMs = this.frames[this.frames.length - 1]?.tMs ?? 0
    const durationMs = Math.min(this.maxDurationMs, Math.max(lastTMs, nowMs - this.startedAtMs))
    const result: RecordedSimulation = {
      durationMs,
      frames: this.frames,
      scenario: this.scenario,
      stoppedBy,
    }
    this.running = false
    this.pending = null
    return result
  }

  private commitPending(last: RecordingFrame): void {
    const pending = this.pending
    if (pending === null) return
    this.pending = null
    const tMs = Math.max(pending.atMs - this.startedAtMs, last.tMs + this.minIntervalMs)
    if (tMs > this.maxDurationMs) {
      this.limit = 'duration-limit'
      return
    }
    this.push(pending.snapshot, tMs)
  }

  private push(snapshot: RecordingSnapshot, tMs: number, force = false): void {
    const frame: RecordingFrame = { ...snapshot, tMs }
    const size = JSON.stringify(frame).length
    if (!force && this.bytes + size > this.maxBytes) {
      this.limit = 'size-limit'
      return
    }
    this.bytes += size
    this.frames.push(frame)
    this.lastKey = keyOf(snapshot)
  }
}

function keyOf(snapshot: RecordingSnapshot): string {
  return JSON.stringify(snapshot)
}
