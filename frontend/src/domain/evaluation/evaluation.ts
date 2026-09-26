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
}

/** Marca da consulta conservadora provisória (ADR-015). */
export const CONSERVATIVE_PROVISIONAL_STRATEGY = 'CONSERVATIVE_PROVISIONAL'

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
}

/** A tabela suportou o estado e a carga foi comparada. "Avaliado" não quer dizer "seguro" (PEND-004). */
export interface EvaluatedResult extends EvaluationCommon {
  readonly kind: 'EVALUATED'
  readonly capacity: EvaluationCapacity
  /** `carga / capacidade × 100`, sem arredondamento (PEND-002). */
  readonly utilizationPercent: number
}

/** Não avaliável: sem utilização, só os motivos (RN-007; RF-020). */
export interface NotEvaluableResult extends EvaluationCommon {
  readonly kind: 'NOT_EVALUABLE'
  readonly reasons: readonly EvaluationReason[]
}

export type EvaluationResult = EvaluatedResult | NotEvaluableResult

/** Estado da conexão em tempo real (doc-fonte § 17.2 `connectionStatus`). */
export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'closed'

/**
 * Falha ao obter a avaliação: mensagem recusada pelo backend (`simulation.error`, HTTP 422/500),
 * falha de rede ou resposta fora do contrato. `code` é legível por máquina; `message`, por pessoa.
 */
export interface EvaluationError {
  readonly code: string
  readonly message: string
}
