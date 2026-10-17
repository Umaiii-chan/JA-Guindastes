// Avaliação do içamento com dois guindastes, como o backend a devolve (TASK-074; RN-016). Quem divide
// a carga e aplica os 75 % da capacidade é o backend; o frontend só mostra (RN-008).

import type { EvaluationInput, EvaluationResult, SafetyAlert } from '../evaluation/evaluation'

/**
 * Ambiente e acessórios de um guindaste do tandem (TASK-090; RN-014, RN-015): os mesmos campos
 * opcionais da avaliação individual, cada guindaste com os dele. O vento é comum (`TandemInput`).
 */
export type TandemCraneEnvironment = Pick<
  EvaluationInput,
  'outriggers' | 'groundSlopeDeg' | 'accessoryIds' | 'soilKinds' | 'obstacleConflicts'
>

/** Um guindaste do pedido: configuração, posição, estado operacional e ponto de içamento. */
export interface TandemCraneInput extends TandemCraneEnvironment {
  readonly configurationId: string
  readonly placement: { readonly x: number; readonly z: number; readonly headingDeg: number }
  readonly state: {
    readonly boomLengthM: number
    readonly boomAngleDeg: number
    readonly turretRotationDeg: number
    readonly cableLengthM: number
  }
  /**
   * Ponto de içamento sobre a carga, no plano do mundo (m). O backend confere se o gancho, pela
   * posição, pelo rumo e pelo estado, está sobre ele (TASK-090).
   */
  readonly hookPoint: { readonly x: number; readonly z: number }
}

export interface TandemInput {
  readonly loadWeightKg: number
  /** Centro de gravidade da carga, no plano do mundo (m). */
  readonly loadCg: { readonly x: number; readonly z: number }
  /** Exatamente dois guindastes: o 1 conduz e o 2 acompanha. */
  readonly cranes: readonly [TandemCraneInput, TandemCraneInput]
  /** Vento no local, em m/s, para os dois guindastes (TASK-090; RN-015). */
  readonly windSpeedMs?: number
}

export interface TandemResult {
  /** Parte da carga de cada guindaste (kg). */
  readonly sharesKg: readonly number[]
  /** Parte de cada guindaste (% do peso). */
  readonly sharePercent: readonly number[]
  /** Avaliação de cada guindaste, com a parte dele e o limite de 75 %. */
  readonly evaluations: readonly EvaluationResult[]
  /** Só verdadeiro quando os dois guindastes estão OK. */
  readonly tandemOk: boolean
  readonly alerts: readonly SafetyAlert[]
}
