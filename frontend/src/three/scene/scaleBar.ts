import { SCENE_COLORS, toCssHex } from './palette'
import { LABEL_FONT_FAMILY } from './sceneLabels'

// Escala gráfica no canto de baixo à esquerda do quadro, como a barra de escala de uma prancha
// (TASK-047; ADR-019): traço de tinta, metade cheia e metade vazada, com "0" e o comprimento. Em
// perspectiva a escala varia com a profundidade: a barra vale para a distância do alvo da órbita
// (o centro do conjunto), e é exata na vista de topo, com o alvo no chão.

/** Comprimentos possíveis da barra (m); o de 5 m é o preferido. */
export const SCALE_BAR_LENGTHS_M: readonly number[] = [1, 2, 5, 10, 20, 50, 100]
export const PREFERRED_SCALE_BAR_M = 5
/** Largura da barra na tela (px): nem um traço perdido, nem uma régua que atravessa o quadro. */
export const SCALE_BAR_WIDTH_PX = Object.freeze({ min: 40, max: 220 })

/**
 * Pixels por metro na profundidade `distanceM`, para uma câmera com campo de visão vertical `fovDeg`
 * num quadro de `heightPx` de altura.
 */
export function pixelsPerMeter(distanceM: number, fovDeg: number, heightPx: number): number {
  if (!(distanceM > 0) || !(heightPx > 0)) return 0
  return heightPx / (2 * distanceM * Math.tan((fovDeg * Math.PI) / 360))
}

/**
 * Comprimento da barra (m): 5 m se couber na faixa de largura; senão, o comprimento mais próximo de 5
 * m que caiba. `null` sem escala válida.
 */
export function chooseScaleBarLength(pxPerMeter: number): number | null {
  if (!(pxPerMeter > 0) || !Number.isFinite(pxPerMeter)) return null
  const fits = (lengthM: number) => {
    const px = lengthM * pxPerMeter
    return px >= SCALE_BAR_WIDTH_PX.min && px <= SCALE_BAR_WIDTH_PX.max
  }
  if (fits(PREFERRED_SCALE_BAR_M)) return PREFERRED_SCALE_BAR_M
  const candidates = SCALE_BAR_LENGTHS_M.filter(fits)
  if (candidates.length === 0) return null
  return candidates.reduce((best, lengthM) =>
    Math.abs(Math.log(lengthM / PREFERRED_SCALE_BAR_M)) <
    Math.abs(Math.log(best / PREFERRED_SCALE_BAR_M))
      ? lengthM
      : best,
  )
}

/** Texto do comprimento, em pt-BR (`5 m`). */
function formatLength(lengthM: number): string {
  return `${lengthM.toLocaleString('pt-BR')} m`
}

export interface ScaleBar {
  readonly element: HTMLDivElement
  /** Comprimento desenhado agora (m), ou `null` com a barra oculta. */
  readonly lengthM: number | null
  /** Largura desenhada agora (px). */
  readonly widthPx: number
  /** Ajusta a barra à escala da tela; só mexe no DOM quando a largura ou o comprimento mudam. */
  update(pxPerMeter: number): void
}

/** Cria a escala gráfica (oculta até o primeiro `update`), para pôr sobre o canvas. */
export function createScaleBar(): ScaleBar {
  const ink = toCssHex(SCENE_COLORS.labelText)
  const element = document.createElement('div')
  element.className = 'crane-viewport__scale-bar'
  element.dataset.sceneLabel = 'scale-bar'
  // Só referência visual; os valores estão nos painéis.
  element.setAttribute('aria-hidden', 'true')
  Object.assign(element.style, {
    position: 'absolute',
    left: '20px',
    bottom: '18px',
    display: 'none',
    pointerEvents: 'none',
    userSelect: 'none',
  } satisfies Partial<CSSStyleDeclaration>)

  const numbers = document.createElement('div')
  Object.assign(numbers.style, {
    display: 'flex',
    justifyContent: 'space-between',
    font: `500 10px/1.2 ${LABEL_FONT_FAMILY}`,
    fontVariantNumeric: 'tabular-nums',
    color: ink,
    marginBottom: '3px',
    whiteSpace: 'nowrap',
  } satisfies Partial<CSSStyleDeclaration>)
  const zero = document.createElement('span')
  zero.textContent = '0'
  // O "0" fica centrado sobre a ponta esquerda da barra, como numa régua.
  zero.style.transform = 'translateX(-50%)'
  const end = document.createElement('span')
  end.style.transform = 'translateX(50%)'
  end.style.paddingLeft = '6px'
  numbers.append(zero, end)

  const bar = document.createElement('div')
  Object.assign(bar.style, {
    display: 'flex',
    height: '4px',
    border: `1px solid ${ink}`,
  } satisfies Partial<CSSStyleDeclaration>)
  const filled = document.createElement('span')
  Object.assign(filled.style, { flex: '1', background: ink } satisfies Partial<CSSStyleDeclaration>)
  const hollow = document.createElement('span')
  Object.assign(hollow.style, {
    flex: '1',
    background: 'rgba(244, 241, 234, 0.9)',
  } satisfies Partial<CSSStyleDeclaration>)
  bar.append(filled, hollow)

  element.append(numbers, bar)

  let lengthM: number | null = null
  let widthPx = 0
  return {
    element,
    get lengthM() {
      return lengthM
    },
    get widthPx() {
      return widthPx
    },
    update(pxPerMeter) {
      const nextLength = chooseScaleBarLength(pxPerMeter)
      const nextWidth = nextLength === null ? 0 : Math.round(nextLength * pxPerMeter)
      if (nextLength === lengthM && nextWidth === widthPx) return
      if (nextLength !== lengthM)
        end.textContent = nextLength === null ? '' : formatLength(nextLength)
      lengthM = nextLength
      widthPx = nextWidth
      element.style.display = nextLength === null ? 'none' : 'block'
      element.style.width = `${nextWidth}px`
    },
  }
}
