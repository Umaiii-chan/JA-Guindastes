// Transição suave entre duas vistas de câmera (TASK-041), sem Three.js.

import type { CameraView, Vec3 } from './cameraPresets'

/** Aceleração e desaceleração cúbicas, de 0 a 1. */
export function easeInOutCubic(t: number): number {
  const x = Math.min(1, Math.max(0, t))
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2
}

function lerp(a: Vec3, b: Vec3, t: number): Vec3 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t }
}

/** Vista intermediária entre `from` e `to` no progresso `t` (0 a 1), já com a suavização aplicada. */
export function interpolateView(from: CameraView, to: CameraView, t: number): CameraView {
  const eased = easeInOutCubic(t)
  return {
    position: lerp(from.position, to.position, eased),
    target: lerp(from.target, to.target, eased),
  }
}

/**
 * Transição de `from` para `to` que começa em `startMs` e dura `durationMs`. Com duração zero (por
 * exemplo, `prefers-reduced-motion`), `sample` já devolve a vista final.
 */
export class CameraTransition {
  readonly from: CameraView
  readonly to: CameraView
  private readonly startMs: number
  private readonly durationMs: number

  constructor(from: CameraView, to: CameraView, durationMs: number, startMs: number) {
    this.from = from
    this.to = to
    this.durationMs = Math.max(0, durationMs)
    this.startMs = startMs
  }

  /** Vista no instante `nowMs` e se a transição terminou. */
  sample(nowMs: number): { view: CameraView; done: boolean } {
    if (this.durationMs === 0) return { view: this.to, done: true }
    const t = (nowMs - this.startMs) / this.durationMs
    if (t >= 1) return { view: this.to, done: true }
    return { view: interpolateView(this.from, this.to, t), done: false }
  }
}
