// Planejamento da operação (TASK-075; ADR-038): tipos do pedido e da recomendação do backend
// (`POST /api/v1/planning/recommend`). Só dados: capacidade e segurança vêm do backend (RN-008); aqui
// ficam a posição do guindaste, os estados da trajetória e as notas que a tela mostra.

import type { ScenarioSpec } from '../environment/environment'

export type PlanPhase = 'aproximar' | 'engatar' | 'levantar' | 'girar' | 'baixar' | 'soltar'

/** Ordem das fases na trajetória. */
export const PLAN_PHASES: readonly PlanPhase[] = [
  'aproximar',
  'engatar',
  'levantar',
  'girar',
  'baixar',
  'soltar',
]

export const PLAN_PHASE_LABELS: Readonly<Record<PlanPhase, string>> = {
  aproximar: 'Aproximar',
  engatar: 'Engatar',
  levantar: 'Levantar',
  girar: 'Girar',
  baixar: 'Baixar',
  soltar: 'Soltar',
}

/** Estado do guindaste num quadro da trajetória (ψ contínuo: pode passar de ±180°). */
export interface PlanCraneState {
  readonly boomLengthM: number
  readonly boomAngleDeg: number
  readonly turretRotationDeg: number
  readonly cableLengthM: number
}

export interface TrajectoryPoint {
  readonly tS: number
  readonly craneIndex: number
  readonly state: PlanCraneState
  readonly phase: PlanPhase
}

export interface PlanPlacement {
  readonly x: number
  readonly z: number
  readonly headingDeg: number
}

export interface PlanCraneDetail {
  readonly configurationId: string
  readonly manufacturerId: string
  readonly craneId: string
  readonly label: string
  readonly shareKg: number
  readonly boomLengthM: number
  readonly boomAnglePickDeg: number
  readonly boomAngleDeliveryDeg: number
  readonly pickRadiusM: number
  readonly deliveryRadiusM: number
  /** Giro total da coleta à entrega; positivo = anti-horário (esquerda). */
  readonly swingDeg: number
  readonly utilizationPercent: number
  readonly transportHeightM: number
  readonly crossedObstacleIds: readonly string[]
}

export type PlanTippingRisk = 'LOW' | 'ATTENTION' | 'HIGH'

export interface PlanRecommendation {
  readonly kind: 'single' | 'tandem'
  readonly configurationIds: readonly string[]
  readonly placements: readonly PlanPlacement[]
  readonly maxLimitUtilizationPercent: number
  readonly tippingRisk: PlanTippingRisk | null
  /** Dentro do limite de capacidade e sem risco alto. */
  readonly valid: boolean
  readonly summary: string
  readonly trajectory: readonly TrajectoryPoint[]
  readonly notes: readonly string[]
  readonly details: readonly PlanCraneDetail[]
}

export interface PlanningResult {
  readonly recommendations: readonly PlanRecommendation[]
  readonly notes: readonly string[]
  /** A busca parou no orçamento de tempo do servidor: pode haver opção que não foi avaliada. */
  readonly timedOut: boolean
}

export interface PlanningRequest {
  readonly load: {
    readonly weightKg: number
    readonly lengthM: number
    readonly widthM: number
    readonly heightM: number
    /** Centro de gravidade ao longo do comprimento, a partir do centro (m); ausente = no centro. */
    readonly cgOffsetM?: number
  }
  readonly pick: { readonly x: number; readonly z: number; readonly rotationYDeg: number }
  readonly delivery: { readonly x: number; readonly z: number; readonly rotationYDeg: number }
  readonly scenario: ScenarioSpec
  readonly accessoryIds: readonly string[]
  /** Do gancho ao ponto de amarração das lingas, medido na cena (m); ausente = padrão do servidor. */
  readonly hookAttachM?: number
}
