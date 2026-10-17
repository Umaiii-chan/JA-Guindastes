// Tipos públicos do guindaste na cena. Não dependem de Three.js, para que a UI React possa usá-los
// (com `import type`) sem importar o pacote `three` (ADR-005).

import type {
  CraneGeometryParameters,
  OperationalGeometry,
} from '../../domain/geometry/operationalGeometry'

/** Faixa fechada [min, max] na unidade indicada pelo nome do campo que a contém. */
export interface NumericRange {
  readonly min: number
  readonly max: number
}

/**
 * Faixa do giro da torre. `continuous` marca o giro contínuo (a ficha não traz ψ_min/ψ_max; ADR-013
 * C-4): a faixa é só a forma de mostrar uma volta, o comando dá a volta (181° vira −179°) e o giro
 * vai pelo menor ângulo. Sem `continuous`, a faixa é um batente: o valor é limitado (clamp) e o
 * caminho fica dentro dela (TASK-092).
 */
export interface TurretRange extends NumericRange {
  readonly continuous?: boolean
}

/**
 * Limites de cada comando do `CraneController`; os valores recebidos são limitados (clamp) a eles,
 * menos o giro contínuo, que dá a volta (`TurretRange`).
 */
export interface CraneLimits {
  readonly turretRotationDeg: TurretRange
  readonly boomAngleDeg: NumericRange
  readonly boomLengthM: NumericRange
  readonly cableLengthM: NumericRange
}

/**
 * Com o que a cena monta o guindaste (TASK-033): limites dos comandos e parâmetros a e h. Vêm da ficha
 * técnica da configuração escolhida (ADR-013 C-4) ou, sem ficha, dos valores FICTÍCIOS da PoC. O
 * modelo provisório desenha a lança recolhida em `limits.boomLengthM.min` e toda estendida no `max`.
 */
export interface CraneSetup {
  readonly limits: CraneLimits
  readonly geometryParameters: CraneGeometryParameters
}

/**
 * Valores aplicados na cena, nas convenções do ADR-013 C-2: ψ = `turretRotationDeg`,
 * θ = `boomAngleDeg`, L = `boomLengthM` e c = `cableLengthM`. É estado visual: não é fonte de verdade
 * de geometria nem de capacidade (RN-008).
 */
export interface CraneState {
  readonly turretRotationDeg: number
  readonly boomAngleDeg: number
  readonly boomLengthM: number
  readonly cableLengthM: number
}

/**
 * Comandos estáveis do guindaste (doc-fonte § 17.3). Cada `set*` limita o valor à faixa de
 * `limits` e devolve o valor efetivamente aplicado.
 */
export interface CraneCommands {
  readonly limits: CraneLimits
  /** Parâmetros a e h usados em `getOperationalGeometry()` (na PoC, FICTÍCIOS). */
  readonly geometryParameters: CraneGeometryParameters
  getState(): CraneState
  /**
   * Geometria do estado atual pelas fórmulas do ADR-013 C-5, só para PRÉ-VISUALIZAÇÃO: o valor oficial
   * é o do backend, e capacidade e segurança nunca são decididas no frontend (ADR-013 C-7; RN-008).
   */
  getOperationalGeometry(): OperationalGeometry
  setTurretRotation(deg: number): number
  setBoomAngle(deg: number): number
  setBoomLength(m: number): number
  setCableLength(m: number): number
  /**
   * Aplica de uma vez os campos informados (todos limitados à faixa) e devolve o estado resultante.
   * Com a guarda de colisões da cena, o caminho do estado anterior ao pedido é varrido em passos
   * pequenos, como num comando de um eixo (TASK-092): se algum ponto colidir, o conjunto para no
   * último estado seguro do caminho (o giro contínuo vai pelo menor ângulo). Com `guarded: false` (a
   * reprodução de uma gravação, cujo estado já foi validado), nada é recuado; a cena só atualiza os
   * destaques de colisão.
   */
  setState(state: Partial<CraneState>, options?: { readonly guarded?: boolean }): CraneState
}
