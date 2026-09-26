// Tipos públicos do guindaste na cena. Não dependem de Three.js, para que a UI React possa usá-los
// (com `import type`) sem importar o pacote `three` (ADR-005).

/** Faixa fechada [min, max] na unidade indicada pelo nome do campo que a contém. */
export interface NumericRange {
  readonly min: number
  readonly max: number
}

/** Limites de cada comando do `CraneController`; os valores recebidos são limitados (clamp) a eles. */
export interface CraneLimits {
  readonly turretRotationDeg: NumericRange
  readonly boomAngleDeg: NumericRange
  readonly boomLengthM: NumericRange
  readonly cableLengthM: NumericRange
}

/** Valores aplicados na cena. É estado visual: não é fonte de verdade de geometria nem de capacidade. */
export interface CraneState {
  readonly turretRotationDeg: number
  readonly boomAngleDeg: number
  readonly boomLengthM: number
  readonly cableLengthM: number
}

/**
 * Comandos estáveis do guindaste (doc-fonte § 17.3). Cada `set*` limita o valor à faixa de
 * `limits` e devolve o valor efetivamente aplicado. `getOperationalGeometry()` ainda não existe:
 * depende do aceite do ADR-013.
 */
export interface CraneCommands {
  readonly limits: CraneLimits
  getState(): CraneState
  setTurretRotation(deg: number): number
  setBoomAngle(deg: number): number
  setBoomLength(m: number): number
  setCableLength(m: number): number
}
