// Estado das patolas (leva E; TASK-054; contrato em docs/leva-e/contratos.md). Sem Three.js.

export interface OutriggerState {
  /** Extensão das vigas, de 0 (recolhidas) a 100 % (totalmente estendidas). */
  readonly extensionPercent: number
  /** Macacos descidos e apoiados no chão. */
  readonly jacksSet: boolean
  /** Correção de nível aplicada pelos macacos (graus), de 0 até o máximo do modelo. */
  readonly levelingDeg: number
}

export const RETRACTED_OUTRIGGERS: OutriggerState = {
  extensionPercent: 0,
  jacksSet: false,
  levelingDeg: 0,
}

/** A tabela de carga pressupõe patolas totalmente estendidas e apoiadas (RN-013; PEND-005). */
export function outriggersReady(state: OutriggerState): boolean {
  return state.extensionPercent >= 100 && state.jacksSet
}

/** Inclinação que sobra depois do nivelamento: o terreno menos a correção, nunca negativa. */
export function residualSlopeDeg(terrainSlopeDeg: number, state: OutriggerState): number {
  return Math.max(0, terrainSlopeDeg - (state.jacksSet ? state.levelingDeg : 0))
}
