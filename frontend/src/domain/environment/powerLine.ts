// Rede elétrica aérea no cenário e a distância mínima exigida (D4; TASK-107; ADR-051), sem Three.js.
//
// A tabela é a Tabela A do OSHA 29 CFR 1926.1408, conferida em osha.gov (ADR-051). É a MESMA do
// backend (`backend/app/domain/services/power_line.py`), que é quem avalia: aqui ela só serve para mostrar
// a distância exigida ao escolher a tensão e para desenhar a zona. A paridade é provada por uma tabela
// de casos única (`backend/tests/fixtures/power_line_clearance_cases.json`). O valor que segue "até"
// inclui a própria tensão.
//
//   até 50 kV ........................ 10 pés (3,05 m)
//   acima de 50 até 200 kV ........... 15 pés
//   acima de 200 até 350 kV .......... 20 pés
//   acima de 350 até 500 kV .......... 25 pés
//   acima de 500 até 750 kV .......... 35 pés
//   acima de 750 até 1000 kV ......... 45 pés
//
// NR-10 (instalações elétricas) e NR-11 (movimentação de materiais) são o contexto normativo
// brasileiro; não trazem uma tabela própria de distância de guindaste. Eixos da cena (ADR-013): Y para
// cima; X e Z no chão; metros (RN-006).

/** Trecho de rede: reta horizontal de (x1, z1) a (x2, z2), a `heightM` do chão, com a tensão nominal. */
export interface PowerLine {
  readonly id: string
  readonly label: string
  readonly x1M: number
  readonly z1M: number
  readonly x2M: number
  readonly z2M: number
  readonly heightM: number
  /** Tensão nominal fase-fase (kV): define a distância mínima. Entrada do ambiente (escolhida). */
  readonly voltageKv: number
}

/** No máximo este número de trechos por cenário (o mesmo limite do backend). */
export const MAX_POWER_LINES = 20
export const POWER_LINE_MAX_KV = 1000
export const POWER_LINE_MIN_HEIGHT_M = 0.5
export const POWER_LINE_MAX_HEIGHT_M = 200
/** Abaixo de 1,5× a mínima o içamento é crítico (ADR-051). */
export const POWER_LINE_ATTENTION_FACTOR = 1.5

/** Tensões que a lista do editor oferece (kV); o campo aceita qualquer valor de 0 a 1000 kV. */
export const POWER_LINE_VOLTAGE_OPTIONS_KV: readonly number[] = [
  0.38, 13.8, 34.5, 69, 138, 230, 345, 500, 765, 1000,
]
export const DEFAULT_POWER_LINE_VOLTAGE_KV = 13.8
export const DEFAULT_POWER_LINE_HEIGHT_M = 12

const FEET_M = 0.3048

/** Tabela A do OSHA 1926.1408: [limite superior da faixa em kV, distância mínima em m]. */
const TABLE_A: readonly (readonly [number, number])[] = [
  [50, 10 * FEET_M],
  [200, 15 * FEET_M],
  [350, 20 * FEET_M],
  [500, 25 * FEET_M],
  [750, 35 * FEET_M],
  [POWER_LINE_MAX_KV, 45 * FEET_M],
]

/** Tensão dentro da tabela (0 exclusive a 1000 kV)? */
export function isValidVoltageKv(voltageKv: number): boolean {
  return Number.isFinite(voltageKv) && voltageKv > 0 && voltageKv <= POWER_LINE_MAX_KV
}

/** Distância mínima (m) da rede de `voltageKv` kV; `null` se a tensão está fora da tabela. */
export function requiredClearanceM(voltageKv: number): number | null {
  if (!isValidVoltageKv(voltageKv)) return null
  for (const [upper, clearance] of TABLE_A) {
    if (voltageKv <= upper) return clearance
  }
  return null
}

/** Comprimento horizontal do trecho (m). */
export function powerLineLengthM(line: PowerLine): number {
  return Math.hypot(line.x2M - line.x1M, line.z2M - line.z1M)
}

/** Trecho dentro das regras do backend (pontos distintos, altura e tensão na faixa)? */
export function isValidPowerLine(line: PowerLine): boolean {
  const numbers = [line.x1M, line.z1M, line.x2M, line.z2M, line.heightM, line.voltageKv]
  return (
    numbers.every(Number.isFinite) &&
    powerLineLengthM(line) > 0 &&
    line.heightM >= POWER_LINE_MIN_HEIGHT_M &&
    line.heightM <= POWER_LINE_MAX_HEIGHT_M &&
    isValidVoltageKv(line.voltageKv)
  )
}

/** Rótulo curto da tensão: "13,8 kV". */
export function formatVoltageKv(voltageKv: number): string {
  return `${voltageKv.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kV`
}
