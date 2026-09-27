// Cores da cena 3D (TASK-041), num lugar só, para a TASK-039 alinhar os tokens CSS do ADR-017.
//
// Sem Three.js (ADR-005): a UI React pode importar daqui os tipos e os valores em CSS. As cores são
// sRGB em hexadecimal (0xRRGGBB), como nos tokens CSS; o Three.js as converte para o espaço linear.

/**
 * Situação mostrada na cena: `ok` (permitido), `warning` (atenção), `over` (acima da capacidade) ou
 * `unknown` (não avaliável ou sem resultado). A cena só pinta: quem decide a situação é o resultado
 * do backend, traduzido pela UI (RN-008; ADR-013 C-7).
 */
export type EvaluationStatus = 'ok' | 'warning' | 'over' | 'unknown'

export const EVALUATION_STATUSES: readonly EvaluationStatus[] = ['ok', 'warning', 'over', 'unknown']

/** Cores de situação do ADR-017: verde, âmbar, vermelho e cinza. */
export const STATUS_COLORS: Readonly<Record<EvaluationStatus, number>> = Object.freeze({
  ok: 0x22c55e,
  warning: 0xf5a524,
  over: 0xef4444,
  unknown: 0x8b95a3,
})

/** Cores do ambiente escuro, grafite-azulado (ADR-017). */
export const SCENE_COLORS = Object.freeze({
  /** Topo do céu. */
  skyZenith: 0x0a0f17,
  /** Horizonte: também é a cor da névoa, para o chão sumir no céu sem emenda. */
  skyHorizon: 0x222c3a,
  // Com a luz da cena, o chão iluminado fica perto da cor da névoa: horizonte sem faixa.
  ground: 0x262e3a,
  gridMinor: 0x2b3542,
  gridMajor: 0x46566b,
  /** Arco de alcance (raio mínimo e máximo), em linha tênue. */
  reachArc: 0x6b7b90,
  /** Carga pendurada no gancho. */
  load: 0x55606e,
  loadEdges: 0x9fb0c4,
  /** Linhas (lingas) entre o gancho e a carga. */
  sling: 0x9aa3ab,
  /** Texto e fundo do rótulo do raio. */
  labelText: 0xe6edf3,
  labelBackground: 0x0b0f15,
  /**
   * Setores das zonas de giro no chão (TASK-046): tênues, e o atual mais forte. Azul do acento do
   * ADR-017, para não disputar com as cores de situação (verde, âmbar, vermelho, cinza).
   */
  zoneSector: 0x3b82f6,
  zoneSectorActive: 0x60a5fa,
  zoneBoundary: 0x6b7b90,
})

/** Situação válida ou `unknown` para qualquer outro valor (inclusive `undefined`). */
export function normalizeEvaluationStatus(value: unknown): EvaluationStatus {
  return EVALUATION_STATUSES.includes(value as EvaluationStatus)
    ? (value as EvaluationStatus)
    : 'unknown'
}

/** Cor da situação em sRGB hexadecimal (0xRRGGBB). */
export function statusColor(status: EvaluationStatus): number {
  return STATUS_COLORS[normalizeEvaluationStatus(status)]
}

/** Cor como string CSS `#rrggbb`. */
export function toCssHex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`
}

/** Cor da situação como string CSS `#rrggbb`, para os tokens do ADR-017. */
export function statusCssColor(status: EvaluationStatus): string {
  return toCssHex(statusColor(status))
}
