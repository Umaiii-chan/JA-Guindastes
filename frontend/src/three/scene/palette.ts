// Cores da cena 3D (TASK-041; TASK-047), num lugar só, alinhadas aos tokens CSS do ADR-019.
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

/** Cores de situação do ADR-019: verde, âmbar (reservado, PEND-004), vermelho e cinza, sóbrios. */
export const STATUS_COLORS: Readonly<Record<EvaluationStatus, number>> = Object.freeze({
  ok: 0x2f6b3a,
  warning: 0xb7791f,
  over: 0xb42318,
  unknown: 0x77756d,
})

/** Papel e tinta do ADR-019 e o único acento (laranja-segurança): os mesmos valores dos tokens CSS. */
export const PAPER_INK = Object.freeze({
  /** Papel: fundo da página e da cena. */
  paper: 0xf4f1ea,
  /** Superfície: um tom acima do papel (quadros, fichas). */
  surface: 0xfbfaf6,
  ink: 0x1f1f1c,
  inkSecondary: 0x5c5a53,
  /** Linhas finas de desenho técnico. */
  line: 0xcfcab9,
  /** Acento: ação primária, foco e o elemento selecionado (na cena, a zona atual). */
  accent: 0xd9480f,
})

/** Cores da cena 3D como prancha técnica clara (ADR-019): papel milimetrado e traço de tinta. */
export const SCENE_COLORS = Object.freeze({
  /** Fundo e chão: o mesmo papel, sem céu nem horizonte desenhado. */
  background: PAPER_INK.paper,
  ground: PAPER_INK.paper,
  /** Terreno editável (TASK-052): um tom abaixo do papel, para o relevo aparecer sob a luz. */
  terrain: 0xe9e4d6,
  /** Obstáculos do cenário: bloco claro com arestas em tinta, como a carga. */
  obstacle: 0xd8d2c1,
  obstacleEdges: PAPER_INK.ink,
  /** Papel milimetrado: linhas de 1 m na cor das linhas e de 5 m um pouco mais fortes. */
  gridMinor: PAPER_INK.line,
  gridMajor: 0xb3ac98,
  /** Eixos de referência X e Z pela origem (ponto O), em tinta. */
  gridAxis: PAPER_INK.inkSecondary,
  /** Sombra projetada no chão: tinta, em baixa opacidade (`GROUND_SHADOW_OPACITY`). */
  shadow: PAPER_INK.ink,
  /** Arco de alcance (raio mínimo e máximo), em traço interrompido. */
  reachArc: PAPER_INK.inkSecondary,
  /** Linha radial do eixo de giro até o gancho, como linha de cota. */
  radial: PAPER_INK.inkSecondary,
  /** Carga pendurada no gancho: bloco claro com arestas em tinta. */
  load: 0xe2dccd,
  loadEdges: PAPER_INK.ink,
  /** Linhas (lingas) entre o gancho e a carga. */
  sling: PAPER_INK.inkSecondary,
  /** Texto dos rótulos de cota e o papel que recorta a grade por trás deles. */
  labelText: PAPER_INK.ink,
  labelMutedText: PAPER_INK.inkSecondary,
  labelBackground: PAPER_INK.paper,
  /**
   * Setores das zonas de giro no chão (TASK-046): traço de tinta secundária, e a zona atual no
   * acento laranja, que não disputa com as cores de situação (verde, âmbar, vermelho, cinza).
   */
  zoneSector: PAPER_INK.inkSecondary,
  zoneSectorActive: PAPER_INK.accent,
  zoneBoundary: PAPER_INK.inkSecondary,
})

/** Cores do solo pintado (TASK-066), em sRGB; a cena as desenha semitransparentes. */
export const SOIL_COLORS = Object.freeze({
  rock: 0x5b6b7a,
  compacted: 0xb08a3e,
  clay: 0xb4541f,
  loose_fill: 0x8a9a3b,
} as const)

/** Editor 3D do ambiente (TASK-066): cursor do pincel, seta do vento. */
export const EDITOR_COLORS = Object.freeze({
  brush: PAPER_INK.accent,
  wind: 0x2563a8,
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

/** Cor da situação como string CSS `#rrggbb`, para os tokens do ADR-019. */
export function statusCssColor(status: EvaluationStatus): string {
  return toCssHex(statusColor(status))
}
