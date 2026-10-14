import { SCENE_COLORS, toCssHex } from './palette'

// Rótulos HTML da cena (CSS2D) no estilo de cota de desenho técnico (TASK-047; ADR-019): texto mono
// pequeno em tinta, linha de chamada fina, papel recortando a grade atrás do texto. Sem caixa com
// borda, sombra, vidro nem brilho. São só apoio visual (`aria-hidden`): os valores estão nos painéis.

/** Fonte mono dos rótulos (ADR-019: IBM Plex Mono, com as monos do sistema de reserva). */
export const LABEL_FONT_FAMILY =
  "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace"
/** Papel quase opaco atrás do texto: recorta a grade como num desenho, sem caixa nem borda. */
export const LABEL_KNOCKOUT = 'rgba(244, 241, 234, 0.88)'
/** Linha de chamada do rótulo do raio: sobe em 45° da âncora até o sublinhado do texto (px). */
export const LEADER_RISE_PX = 14

/** Partes do rótulo do raio que mudam com o valor e com a situação. */
export interface RadiusLabel {
  readonly element: HTMLDivElement
  /** Onde vai o texto (`R 8,27 m`); o elemento raiz também tem a linha de chamada e o ponto. */
  readonly text: HTMLSpanElement
  /** Pinta o sublinhado, a linha de chamada e o ponto com a cor da situação (`#rrggbb`). */
  paint(color: string): void
}

/**
 * Rótulo do raio: texto sublinhado e linha de chamada em 45° até um ponto sobre a âncora. O canto de
 * baixo à esquerda do elemento é o ponto: use `CSS2DObject.center.set(0, 1)`.
 */
export function createRadiusLabel(): RadiusLabel {
  const element = document.createElement('div')
  element.className = 'crane-viewport__radius-label'
  element.dataset.sceneLabel = 'working-radius'
  // O mesmo valor está no painel de geometria; aqui é só apoio visual.
  element.setAttribute('aria-hidden', 'true')
  Object.assign(element.style, {
    position: 'relative',
    padding: `0 0 ${LEADER_RISE_PX}px ${LEADER_RISE_PX}px`,
    pointerEvents: 'none',
    userSelect: 'none',
  } satisfies Partial<CSSStyleDeclaration>)

  const text = document.createElement('span')
  text.className = 'crane-viewport__radius-label-text'
  Object.assign(text.style, {
    display: 'block',
    font: `500 11px/1.25 ${LABEL_FONT_FAMILY}`,
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: '0.02em',
    color: toCssHex(SCENE_COLORS.labelText),
    background: LABEL_KNOCKOUT,
    padding: '1px 4px 2px',
    borderBottom: '1px solid',
    whiteSpace: 'nowrap',
  } satisfies Partial<CSSStyleDeclaration>)

  const leader = document.createElement('span')
  Object.assign(leader.style, {
    position: 'absolute',
    left: '0',
    bottom: '0',
    width: `${Math.SQRT2 * LEADER_RISE_PX}px`,
    height: '1px',
    transformOrigin: '0 50%',
    transform: 'rotate(-45deg)',
  } satisfies Partial<CSSStyleDeclaration>)

  const dot = document.createElement('span')
  Object.assign(dot.style, {
    position: 'absolute',
    left: '-2px',
    bottom: '-2px',
    width: '5px',
    height: '5px',
    borderRadius: '50%',
  } satisfies Partial<CSSStyleDeclaration>)

  element.append(text, leader, dot)
  return {
    element,
    text,
    paint(color) {
      text.style.borderBottomColor = color
      leader.style.background = color
      dot.style.background = color
    },
  }
}

/**
 * Rótulo curto de uma zona de giro (TASK-046), sobre o setor no chão: caixa alta pequena e espaçada,
 * em tinta secundária. O texto é o nome da zona, sem transformação (a caixa alta é só CSS).
 */
export function createZoneLabelElement(code: string, name: string): HTMLDivElement {
  const element = document.createElement('div')
  element.className = 'crane-viewport__zone-label'
  element.dataset.sceneLabel = 'rotation-zone'
  element.dataset.zoneCode = code
  element.textContent = name
  // O nome da zona atual também está no painel da avaliação; aqui é só apoio visual.
  element.setAttribute('aria-hidden', 'true')
  Object.assign(element.style, {
    font: `500 10px/1.25 ${LABEL_FONT_FAMILY}`,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: toCssHex(SCENE_COLORS.labelMutedText),
    background: LABEL_KNOCKOUT,
    padding: '1px 4px',
    borderBottom: '2px solid transparent',
    whiteSpace: 'nowrap',
    maxWidth: '200px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    pointerEvents: 'none',
    userSelect: 'none',
  } satisfies Partial<CSSStyleDeclaration>)
  return element
}

/**
 * Marca o rótulo da zona atual: texto em tinta e sublinhado em laranja-acento. O acento não vai no
 * texto porque, em 10 px sobre o papel, não chega ao contraste AA (3,8:1).
 */
export function paintZoneLabel(element: HTMLElement, active: boolean): void {
  element.dataset.active = active ? 'true' : 'false'
  const accent = toCssHex(SCENE_COLORS.zoneSectorActive)
  element.style.color = toCssHex(active ? SCENE_COLORS.labelText : SCENE_COLORS.labelMutedText)
  element.style.fontWeight = active ? '600' : '500'
  element.style.borderBottomColor = active ? accent : 'transparent'
}

/**
 * Etiqueta do guindaste ("Guindaste 2") sobre o chassi, para distinguir os guindastes quando há mais
 * de um no cenário (TASK-074). Mesmo estilo dos rótulos de zona, com sublinhado no acento.
 */
export function createCraneTagElement(text: string): HTMLDivElement {
  const element = document.createElement('div')
  element.className = 'crane-viewport__crane-tag'
  element.dataset.sceneLabel = 'crane-tag'
  element.textContent = text
  element.setAttribute('aria-hidden', 'true')
  Object.assign(element.style, {
    font: `600 10px/1.25 ${LABEL_FONT_FAMILY}`,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: toCssHex(SCENE_COLORS.labelText),
    background: LABEL_KNOCKOUT,
    padding: '1px 5px',
    borderBottom: `2px solid ${toCssHex(SCENE_COLORS.zoneSectorActive)}`,
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
    userSelect: 'none',
  } satisfies Partial<CSSStyleDeclaration>)
  return element
}
