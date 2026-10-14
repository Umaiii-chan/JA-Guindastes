import { ArrowHelper, Vector3 } from 'three'

import type { WindSpec } from '../../domain/environment/environment'
import { EDITOR_COLORS } from './palette'

export const WIND_ARROW_NAME = 'scenario-wind-arrow'

const HEIGHT_M = 6
const MIN_LENGTH_M = 3
const LENGTH_PER_MS = 0.5
const MAX_LENGTH_M = 14

/** Direção horizontal do vento: graus a partir de +X, anti-horário visto de cima (como a rampa). */
export function windDirectionVector(directionDeg: number): Vector3 {
  const angle = (directionDeg * Math.PI) / 180
  return new Vector3(Math.cos(angle), 0, -Math.sin(angle))
}

/** Comprimento da seta (m) para a velocidade: cresce com o vento, com mínimo e máximo. */
export function windArrowLengthM(speedMs: number): number {
  return Math.min(MAX_LENGTH_M, Math.max(MIN_LENGTH_M, MIN_LENGTH_M + speedMs * LENGTH_PER_MS))
}

/**
 * Seta do vento (TASK-066): fica acima do guindaste, aponta para onde o vento sopra e cresce com a
 * velocidade. Só desenho; invisível sem vento.
 */
export class WindArrow {
  readonly root = new ArrowHelper(new Vector3(1, 0, 0), new Vector3(), 1, EDITOR_COLORS.wind)

  constructor() {
    this.root.name = WIND_ARROW_NAME
    this.root.visible = false
  }

  /** `base`: ponto do mundo sobre o qual a seta flutua (o eixo de giro do guindaste). */
  setWind(wind: WindSpec | undefined, base: { x: number; y: number; z: number }): void {
    if (!wind || !(wind.speedMs > 0)) {
      this.root.visible = false
      return
    }
    const length = windArrowLengthM(wind.speedMs)
    const direction = windDirectionVector(wind.directionDeg)
    // A seta é centrada no ponto: a cauda fica atrás e a ponta à frente.
    this.root.position.set(
      base.x - (direction.x * length) / 2,
      base.y + HEIGHT_M,
      base.z - (direction.z * length) / 2,
    )
    this.root.setDirection(direction)
    this.root.setLength(length, Math.min(1.6, length * 0.3), Math.min(0.9, length * 0.18))
    this.root.visible = true
  }

  dispose(): void {
    this.root.removeFromParent()
    this.root.dispose()
  }
}
