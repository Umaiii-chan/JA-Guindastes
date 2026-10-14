// Medidas, limites e parâmetros FICTÍCIOS do guindaste provisório da PoC (ADR-012; ADR-013 C-4,
// regra 2). Não descrevem nenhum guindaste real. Ficam sem Three.js (TASK-033) para a composição da
// UI poder usá-los como reserva quando a configuração escolhida não tem ficha técnica (ADR-005).

import type { CraneGeometryParameters } from '../../domain/geometry/operationalGeometry'
import type { CraneLimits, CraneSetup, CraneState } from './types'

export interface ProvisionalCraneDimensions {
  /** Lança toda recolhida, do pivô até a ponta (m). */
  readonly boomRetractedLengthM: number
  /** Lança toda estendida (m); define o curso da única seção telescópica do modelo. */
  readonly boomExtendedLengthM: number
}

/** FICTÍCIO: dimensões do guindaste provisório. */
export const PROVISIONAL_CRANE_DIMENSIONS: ProvisionalCraneDimensions = {
  boomRetractedLengthM: 12,
  boomExtendedLengthM: 22,
}

/** FICTÍCIO: limites dos comandos na PoC; não são limites de nenhum guindaste real. */
export const PROVISIONAL_CRANE_LIMITS: CraneLimits = {
  turretRotationDeg: { min: -180, max: 180 },
  boomAngleDeg: { min: 0, max: 80 },
  boomLengthM: {
    min: PROVISIONAL_CRANE_DIMENSIONS.boomRetractedLengthM,
    max: PROVISIONAL_CRANE_DIMENSIONS.boomExtendedLengthM,
  },
  cableLengthM: { min: 1, max: 15 },
}

/**
 * FICTÍCIO: parâmetros geométricos do guindaste provisório (ADR-013 C-4). O pino do pé da lança fica
 * 1,56 m atrás do eixo de giro (a < 0) e 3,3 m acima do plano de apoio, como a ficha de demo do
 * backend e o modelo 3D ilustrativo (TASK-043; TASK-041). Em produção, a e h virão da
 * ficha técnica cadastrada no backend, nunca do modelo 3D (RN-003).
 */
export const PROVISIONAL_CRANE_GEOMETRY: CraneGeometryParameters = {
  boomPivotOffsetM: 0.46,
  boomPivotHeightM: 3.3,
}

/** FICTÍCIO: pose inicial da PoC. */
export const PROVISIONAL_CRANE_INITIAL_STATE: CraneState = {
  turretRotationDeg: 0,
  boomAngleDeg: 35,
  boomLengthM: PROVISIONAL_CRANE_DIMENSIONS.boomRetractedLengthM,
  cableLengthM: 5,
}

/** FICTÍCIO: limites e parâmetros a e h com que a cena monta o guindaste quando não há ficha técnica. */
export const PROVISIONAL_CRANE_SETUP: CraneSetup = {
  limits: PROVISIONAL_CRANE_LIMITS,
  geometryParameters: PROVISIONAL_CRANE_GEOMETRY,
}
