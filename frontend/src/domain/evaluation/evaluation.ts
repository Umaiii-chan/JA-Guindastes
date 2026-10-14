// Tipos da avaliação operacional como a tela os usa (TASK-032; doc-fonte § 17.2).
//
// São o resultado do BACKEND, já traduzido dos contratos REST (TASK-024) e WebSocket (TASK-025)
// para um formato único. O frontend não calcula capacidade nem utilização: só mostra o que o backend
// devolveu (RN-008). Não há nível de alerta (normal/atenção/crítico): está pendente (PEND-004).

/** Estado operacional e carga enviados ao backend, em unidades internas (RN-006; ADR-013 C-2). */
export interface EvaluationInput {
  /** Configuração do guindaste avaliada (RN-001). */
  readonly configurationId: string
  readonly boomLengthM: number
  readonly boomAngleDeg: number
  readonly turretRotationDeg: number
  readonly cableLengthM: number
  readonly loadWeightKg: number
  // Leva E (contrato em docs/leva-e/contratos.md). Opcionais: ausentes = comportamento anterior.
  /** Patolas (TASK-054); o backend usa no risco de tombamento (TASK-055). */
  readonly outriggers?: OutriggerInput
  /** Inclinação residual do terreno sob o guindaste, em graus, depois do nivelamento (TASK-052/054). */
  readonly groundSlopeDeg?: number
  /** Acessórios de içamento pendurados no gancho (TASK-056; RN-014). */
  readonly accessoryIds?: readonly string[]
  /** Solo sob as 4 sapatas (dianteira esquerda e direita, traseira esquerda e direita; TASK-067). */
  readonly soilKinds?: readonly SoilKind[]
  /** Velocidade do vento, em m/s (TASK-067). */
  readonly windSpeedMs?: number
  /** Ids dos obstáculos no raio de giro (TASK-067). */
  readonly obstacleConflicts?: readonly string[]
}

/** Tipos de solo sob as sapatas (RN-015). */
export type SoilKind = 'rock' | 'compacted' | 'clay' | 'loose_fill'

/** Estado das patolas enviado ao backend (TASK-054). */
export interface OutriggerInput {
  /** Extensão das vigas, de 0 a 100 %. */
  readonly extensionPercent: number
  /** Macacos descidos e apoiados no chão. */
  readonly jacksSet: boolean
}

/** Situação da carga frente ao limite do modelo (RN-011; TASK-051). */
export type CapacityStatusLevel = 'OK' | 'WARNING' | 'OVER'

/** Limite de uso da capacidade do modelo aplicado pelo backend (RN-011; TASK-051). */
export interface CapacityLimitResult {
  /** Limite do modelo, de 1 a 100 %. */
  readonly limitPercent: number
  /** Capacidade da tabela × limite (kg). */
  readonly effectiveCapacityKg: number
  /** Peso comparado / capacidade efetiva × 100. */
  readonly limitUtilizationPercent: number
  /** Início da faixa de atenção, em % do limite. */
  readonly warningBandPercent: number
  readonly level: CapacityStatusLevel
  /** Fator de inclinação aplicado à capacidade efetiva (1 = sem efeito; RN-015). */
  readonly slopeFactor?: number
  /** Fator de vento aplicado à capacidade efetiva (1 = sem efeito; RN-015). */
  readonly windFactor?: number
}

/** Risco de tombamento por regras (RN-013; TASK-055). */
export type TippingRisk = 'LOW' | 'ATTENTION' | 'HIGH'

export type SafetyAlertSeverity = 'INFO' | 'ATTENTION' | 'CRITICAL'

/** Alerta de segurança devolvido pelo backend (TASK-055). */
export interface SafetyAlert {
  readonly code: string
  readonly severity: SafetyAlertSeverity
  readonly message: string
}

/** Acessório considerado no peso comparado (TASK-056; RN-014). */
export interface EvaluatedAccessory {
  readonly id: string
  readonly name: string
  readonly weightKg: number
}

/** Marca da consulta conservadora provisória (ADR-015). */
export const CONSERVATIVE_PROVISIONAL_STRATEGY = 'CONSERVATIVE_PROVISIONAL'

/** Marca da interpolação linear provisória (ADR-030; TASK-059). */
export const LINEAR_INTERPOLATION_STRATEGY = 'LINEAR_INTERPOLATION_PROVISIONAL'

/** Ponto da tabela de carga de onde veio a capacidade (ADR-015 item 4). */
export interface TabulatedPoint {
  readonly boomLengthM: number
  readonly workingRadiusM: number
  readonly maxCapacityKg: number
}

/** Capacidade admissível da tabela ativa (RN-004), como o backend a devolveu. */
export interface EvaluationCapacity {
  readonly maximumCapacityKg: number
  /**
   * Estratégia que produziu o valor. `CONSERVATIVE_PROVISIONAL` = consulta conservadora provisória
   * (ADR-015): o valor não é definitivo. `null` quando o backend não informou a marca.
   */
  readonly strategy: string | null
  /** Raio consultado na tabela, em metros; `null` quando não informado. */
  readonly queriedRadiusM: number | null
  readonly usedPoint: TabulatedPoint | null
}

/** Um motivo de "não avaliável" (RN-007), só como código: o texto está pendente (doc-fonte § 26). */
export interface EvaluationReason {
  readonly code: string
  /** Etapa de onde veio o motivo; só a resposta REST informa (`null` no WebSocket). */
  readonly category: string | null
}

interface EvaluationCommon {
  /** Raio de trabalho calculado no backend, em metros; `null` quando não pôde ser calculado. */
  readonly workingRadiusM: number | null
  readonly hookHeightM: number | null
  readonly capacity: EvaluationCapacity | null
  readonly loadChartId: string | null
  /** Versão da tabela usada (RN-005); `null` se a tabela não chegou a ser consultada. */
  readonly loadChartVersion: string | null
  /**
   * Zona de giro usada (ADR-018; TASK-046), escolhida pelo BACKEND pelo giro ψ (na fronteira, a de
   * menor capacidade). `null` sem zonas, ou quando o backend não informou.
   */
  readonly rotationZoneCode: string | null
  readonly rotationZoneName: string | null
  /** Peso do gancho considerado (kg); `null` quando o backend não informou (anterior à TASK-046). */
  readonly hookBlockWeightKg: number | null
  /**
   * Peso comparado com a capacidade: carga + gancho (kg; ADR-018 § 2). A utilização é
   * `comparedWeightKg / capacidade`. `null` quando o backend não informou.
   */
  readonly comparedWeightKg: number | null
  // Leva E (docs/leva-e/contratos.md). Opcionais: backend anterior não envia.
  /** TASK-051 (RN-011). */
  readonly capacityLimit?: CapacityLimitResult | null
  /** TASK-055 (RN-013). */
  readonly tippingRisk?: TippingRisk | null
  readonly alerts?: readonly SafetyAlert[]
  /** TASK-056 (RN-014): soma dos acessórios incluída no peso comparado. */
  readonly accessoriesWeightKg?: number | null
  readonly accessories?: readonly EvaluatedAccessory[]
}

/** A tabela suportou o estado e a carga foi comparada. "Avaliado" não quer dizer "seguro" (PEND-004). */
export interface EvaluatedResult extends EvaluationCommon {
  readonly kind: 'EVALUATED'
  readonly capacity: EvaluationCapacity
  /** `(carga + gancho) / capacidade × 100`, sem arredondamento (PEND-002; ADR-018 § 2). */
  readonly utilizationPercent: number
}

/** Não avaliável: sem utilização, só os motivos (RN-007; RF-020). */
export interface NotEvaluableResult extends EvaluationCommon {
  readonly kind: 'NOT_EVALUABLE'
  readonly reasons: readonly EvaluationReason[]
}

export type EvaluationResult = EvaluatedResult | NotEvaluableResult

/**
 * Estado da conexão em tempo real (doc-fonte § 17.2 `connectionStatus`). `rest` = implantação sem
 * canal em tempo real (ex.: Vercel), em que toda avaliação vai por REST (TASK-050).
 */
export type ConnectionStatus =
  'idle' | 'connecting' | 'connected' | 'reconnecting' | 'closed' | 'rest'

/**
 * Falha ao obter a avaliação: mensagem recusada pelo backend (`simulation.error`, HTTP 422/500),
 * falha de rede ou resposta fora do contrato. `code` é legível por máquina; `message`, por pessoa.
 */
export interface EvaluationError {
  readonly code: string
  readonly message: string
}
