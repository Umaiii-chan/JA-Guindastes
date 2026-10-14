// Funções puras da reprodução e da linha do tempo (TASK-057; ADR-027). A reprodução só escolhe qual
// quadro gravado mostrar; nunca reavalia (RN-008).

import {
  type LoadChartRef,
  PLAYBACK_SPEEDS,
  type PlaybackSpeed,
  type RecordingFrame,
  type TimelineMarker,
} from './recording'

/** Índice do último quadro com `tMs <= positionMs` (o primeiro, se a posição vier antes dele). */
export function frameIndexAt(frames: readonly RecordingFrame[], positionMs: number): number {
  if (frames.length === 0) return -1
  let low = 0
  let high = frames.length - 1
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if (frames[middle].tMs <= positionMs) low = middle
    else high = middle - 1
  }
  return low
}

export function isPlaybackSpeed(value: number): value is PlaybackSpeed {
  return (PLAYBACK_SPEEDS as readonly number[]).includes(value)
}

/** Nova posição depois de `elapsedMs` reais à velocidade escolhida; para no fim da gravação. */
export function advancePosition(
  positionMs: number,
  elapsedMs: number,
  speed: PlaybackSpeed,
  durationMs: number,
): { readonly positionMs: number; readonly ended: boolean } {
  const next = positionMs + Math.max(0, elapsedMs) * speed
  if (next >= durationMs) return { positionMs: durationMs, ended: true }
  return { positionMs: next, ended: false }
}

function alertKeys(frame: RecordingFrame): Map<string, string> {
  const keys = new Map<string, string>()
  for (const alert of frame.evaluation?.alerts ?? []) keys.set(alert.code, alert.message)
  return keys
}

/**
 * Marcadores da linha do tempo: um `alert` quando aparece um código de alerta que o quadro anterior
 * não tinha, e um `collision` quando o número de colisões sobe. O primeiro quadro conta contra "nada".
 */
export function timelineMarkers(frames: readonly RecordingFrame[]): TimelineMarker[] {
  const markers: TimelineMarker[] = []
  let previousAlerts = new Map<string, string>()
  let previousCollisions = 0
  for (const frame of frames) {
    const alerts = alertKeys(frame)
    for (const [code, message] of alerts) {
      if (!previousAlerts.has(code)) {
        markers.push({ tMs: frame.tMs, kind: 'alert', label: message || code })
      }
    }
    const collisions = frame.collisions?.length ?? 0
    if (collisions > previousCollisions) {
      markers.push({ tMs: frame.tMs, kind: 'collision', label: 'Colisão' })
    }
    previousAlerts = alerts
    previousCollisions = collisions
  }
  return markers
}

/** Tabelas de carga (id e versão), sem repetição, usadas nas avaliações dos quadros (RN-005). */
export function loadChartRefsOf(frames: readonly RecordingFrame[]): LoadChartRef[] {
  const seen = new Map<string, LoadChartRef>()
  for (const frame of frames) {
    const result = frame.evaluation
    if (!result || result.loadChartId === null || result.loadChartVersion === null) continue
    const key = `${result.loadChartId}\u0000${result.loadChartVersion}`
    if (!seen.has(key)) {
      seen.set(key, { loadChartId: result.loadChartId, version: result.loadChartVersion })
    }
  }
  return [...seen.values()]
}

/** `m:ss` (ou `m:ss,d` com `withTenths`), a partir de milissegundos. */
export function formatClock(ms: number, withTenths = false): string {
  const totalTenths = Math.floor(Math.max(0, ms) / 100)
  const seconds = Math.floor(totalTenths / 10)
  const text = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
  return withTenths ? `${text},${totalTenths % 10}` : text
}
