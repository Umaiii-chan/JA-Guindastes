// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import { PAPER_INK, toCssHex } from '../../../src/three/scene/palette'
import {
  createRadiusLabel,
  createZoneLabelElement,
  LABEL_FONT_FAMILY,
  paintZoneLabel,
} from '../../../src/three/scene/sceneLabels'

/** O jsdom normaliza cores para `rgb(r, g, b)`. */
function rgb(hex: number): string {
  return `rgb(${(hex >> 16) & 0xff}, ${(hex >> 8) & 0xff}, ${hex & 0xff})`
}

describe('sceneLabels', () => {
  it('rótulo do raio no estilo de cota: texto mono em tinta, sem caixa, sombra nem vidro', () => {
    const label = createRadiusLabel()
    label.text.textContent = 'R 8,27 m'

    expect(label.element.dataset.sceneLabel).toBe('working-radius')
    expect(label.element.getAttribute('aria-hidden')).toBe('true')
    expect(label.element.textContent).toBe('R 8,27 m')
    expect(label.text.style.fontFamily).toContain('IBM Plex Mono')
    expect(LABEL_FONT_FAMILY).toMatch(/monospace$/)
    expect(label.text.style.color).toBe(rgb(PAPER_INK.ink))
    for (const element of [label.element, label.text]) {
      expect(element.style.boxShadow).toBe('')
      expect(element.style.borderRadius).toBe('')
      expect(element.style.getPropertyValue('backdrop-filter')).toBe('')
    }
  })

  it('pinta o sublinhado e a linha de chamada com a cor da situação', () => {
    const label = createRadiusLabel()
    label.paint('#b42318')

    expect(label.text.style.borderBottomColor).toBe(rgb(0xb42318))
    const [, leader, dot] = [...label.element.children] as HTMLElement[]
    expect(leader.style.background).toContain(rgb(0xb42318))
    expect(dot.style.background).toContain(rgb(0xb42318))
  })

  it('rótulo da zona: o texto é o nome (a caixa alta é só CSS); a atual ganha o sublinhado laranja', () => {
    const element = createZoneLabelElement('FRONTAL', 'Frontal FICTÍCIA')
    expect(element.textContent).toBe('Frontal FICTÍCIA')
    expect(element.style.textTransform).toBe('uppercase')

    paintZoneLabel(element, true)
    expect(element.dataset.active).toBe('true')
    expect(element.style.borderBottomColor).toBe(rgb(PAPER_INK.accent))
    // Texto em tinta: o acento em 10 px sobre o papel não passaria no AA.
    expect(element.style.color).toBe(rgb(PAPER_INK.ink))

    paintZoneLabel(element, false)
    expect(element.dataset.active).toBe('false')
    expect(element.style.borderBottomColor).toBe('transparent')
    expect(element.style.color).toBe(rgb(PAPER_INK.inkSecondary))
    expect(toCssHex(PAPER_INK.accent)).toBe('#d9480f')
  })
})
