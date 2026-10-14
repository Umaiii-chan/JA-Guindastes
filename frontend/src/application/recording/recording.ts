// Gravação de simulações (TASK-057; ADR-027; RN-005). Tipos sem Three.js nem React.
//
// Um quadro é uma fotografia do simulador num instante: o estado do guindaste, a configuração, a
// carga e o resultado que o BACKEND devolveu para esse estado. A reprodução mostra os quadros como
// estão e NUNCA reavalia (RN-008): o resultado gravado é o que valia na hora.
//
// Os campos opcionais vêm das outras tarefas da leva E (patolas, acessórios, colisões) e podem faltar.

import type { CargoState } from '../../domain/cargo/cargoOperation'
import type { OutriggerState } from '../../domain/crane/outriggers'
import type { EvaluationResult } from '../../domain/evaluation/evaluation'
import type { ScenarioSpec } from '../../domain/environment/environment'
import type { CraneState } from '../../three/crane/types'

/** Limites PROVISÓRIOS (ADR-027; A VALIDAR). Os mesmos valores valem no backend. */
export const MAX_RECORDING_DURATION_MS = 10 * 60 * 1000
export const MAX_RECORDING_BYTES = 5 * 1024 * 1024
/** No máximo 10 quadros por segundo. */
export const MIN_FRAME_INTERVAL_MS = 100

export const PLAYBACK_SPEEDS = [0.5, 1, 2, 4] as const
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number]

/** Colisão da carga (TASK-053; RN-012). O formato é daquela tarefa: aqui só se guarda como veio. */
export type RecordedCollision = Readonly<Record<string, unknown>>

/** O que o simulador mostra num instante, sem o tempo. */
export interface RecordingSnapshot {
  readonly crane: CraneState
  readonly configurationId: string
  /** Peso da carga em kg (campo do formulário, já convertido). */
  readonly loadWeightKg: number
  /** Resultado do backend válido para este estado; `null` se ainda não chegou. */
  readonly evaluation: EvaluationResult | null
  readonly outriggers?: OutriggerState
  readonly accessoryIds?: readonly string[]
  readonly collisions?: readonly RecordedCollision[]
  /**
   * Onde a carga está (no chão ou no gancho), com o resultado da entrega (TASK-073; ADR-035). Ausente
   * em gravações antigas e sem carga posicionada: aí a carga pende do gancho.
   */
  readonly cargo?: CargoState | null
  /** Medidas da carga desenhada (m); `null` sem carga desenhada (TASK-068). */
  readonly load?: {
    readonly lengthM: number
    readonly widthM: number
    readonly heightM: number
  } | null
}

/** Quadro gravado: `tMs` é o tempo desde o início da gravação. */
export interface RecordingFrame extends RecordingSnapshot {
  readonly tMs: number
}

/** Tabela de carga (id e versão) usada nas avaliações da gravação (RN-005). */
export interface LoadChartRef {
  readonly loadChartId: string
  readonly version: string
}

/** Gravação pronta, ainda sem nome nem autor. */
export interface RecordedSimulation {
  readonly durationMs: number
  /** O primeiro quadro é o estado inicial completo (`tMs` = 0). */
  readonly frames: readonly RecordingFrame[]
  /** Cópia do cenário (TASK-052); ausente enquanto ela não integra. */
  readonly scenario?: ScenarioSpec
  /** Por que parou antes de a pessoa mandar, se for o caso. */
  readonly stoppedBy: 'user' | 'duration-limit' | 'size-limit'
}

/** Gravação na lista (sem os quadros). */
export interface SimulationRecordingSummary {
  readonly id: string
  readonly name: string
  readonly authorUserId: string
  readonly authorDisplayName: string
  readonly createdAt: string
  readonly durationMs: number
  readonly configurationId: string
  readonly loadChartRefs: readonly LoadChartRef[]
  readonly frameCount: number
}

export interface SimulationRecording extends SimulationRecordingSummary {
  readonly scenario?: ScenarioSpec
  readonly frames: readonly RecordingFrame[]
}

/** Marcador da linha do tempo. */
export interface TimelineMarker {
  readonly tMs: number
  readonly kind: 'alert' | 'collision' | 'engage' | 'release'
  /** Texto curto para o título do marcador. */
  readonly label: string
}
