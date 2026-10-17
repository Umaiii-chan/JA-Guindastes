// Clique no chão na vista Topo sem depender do enquadramento (TASK-104; ADR-048): a câmera centra o
// guindaste na ÁREA LIVRE do quadro (descontados os painéis sobre a cena) e a escala depende da altura
// livre. O centro vem das variáveis `--frame-inset-*` do palco e a escala, da escala gráfica da cena
// (exata no Topo, com o alvo no chão).

import type { Page } from '@playwright/test'

export interface TopGround {
  /** Pixels por metro. */
  readonly pxPerMeter: number
  /** Pixel da página onde está o eixo de giro (X = Z = 0 do guindaste na origem). */
  readonly origin: { readonly x: number; readonly y: number }
  /** Pixel da página para um ponto do chão (X para a direita, Z para baixo na tela). */
  at(xM: number, zM: number): { x: number; y: number }
}

export async function topGround(page: Page): Promise<TopGround> {
  const canvas = page.locator('.crane-viewport__canvas canvas')
  const box = (await canvas.boundingBox())!
  const measured = await page.evaluate(() => {
    const stage = document.querySelector<HTMLElement>('[data-simulator-stage]')
    const style = stage ? getComputedStyle(stage) : null
    const inset = (side: string) =>
      parseFloat(style?.getPropertyValue(`--frame-inset-${side}`) ?? '0') || 0
    const bar = document.querySelector<HTMLElement>('.crane-viewport__scale-bar')
    const label = bar?.firstElementChild?.lastElementChild?.textContent ?? ''
    const widthPx = bar?.children[1]?.getBoundingClientRect().width ?? 0
    return {
      top: inset('top'),
      right: inset('right'),
      bottom: inset('bottom'),
      left: inset('left'),
      lengthM: parseFloat(label.replace(/\./g, '').replace(',', '.')),
      widthPx,
    }
  })
  if (!(measured.lengthM > 0) || !(measured.widthPx > 0)) {
    throw new Error('Escala gráfica da cena não encontrada na vista Topo.')
  }
  const pxPerMeter = measured.widthPx / measured.lengthM
  const origin = {
    x: box.x + measured.left + (box.width - measured.left - measured.right) / 2,
    y: box.y + measured.top + (box.height - measured.top - measured.bottom) / 2,
  }
  return {
    pxPerMeter,
    origin,
    at: (xM, zM) => ({ x: origin.x + xM * pxPerMeter, y: origin.y + zM * pxPerMeter }),
  }
}
