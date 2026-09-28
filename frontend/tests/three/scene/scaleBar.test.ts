// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import {
  chooseScaleBarLength,
  createScaleBar,
  pixelsPerMeter,
  PREFERRED_SCALE_BAR_M,
  SCALE_BAR_WIDTH_PX,
} from '../../../src/three/scene/scaleBar'
import { expectClose } from '../../helpers/expectClose'

describe('scaleBar', () => {
  it('pixels por metro na distância do alvo: com FOV de 90°, a altura do quadro cobre 2·d', () => {
    expectClose(pixelsPerMeter(10, 90, 800), 40, 1e-9)
    expect(pixelsPerMeter(0, 50, 800)).toBe(0)
    expect(pixelsPerMeter(10, 50, 0)).toBe(0)
  })

  it('prefere a barra de 5 m e troca de comprimento só quando ela não cabe', () => {
    expect(chooseScaleBarLength(20)).toBe(PREFERRED_SCALE_BAR_M)
    // Muito de perto: 5 m passaria do máximo; fica o comprimento mais próximo que cabe.
    expect(chooseScaleBarLength(100)).toBe(2)
    // Muito de longe: 5 m viraria um traço.
    expect(chooseScaleBarLength(3)).toBe(20)
    expect(chooseScaleBarLength(0)).toBeNull()
    expect(chooseScaleBarLength(Number.NaN)).toBeNull()
    for (const pxPerMeter of [3, 8, 20, 44, 100]) {
      const length = chooseScaleBarLength(pxPerMeter)!
      expect(length * pxPerMeter).toBeGreaterThanOrEqual(SCALE_BAR_WIDTH_PX.min)
      expect(length * pxPerMeter).toBeLessThanOrEqual(SCALE_BAR_WIDTH_PX.max)
    }
  })

  it('desenha a barra em tinta no canto de baixo, sem capturar o mouse, com "0" e o comprimento', () => {
    const bar = createScaleBar()
    expect(bar.element.style.display).toBe('none')
    expect(bar.element.getAttribute('aria-hidden')).toBe('true')
    expect(bar.element.style.pointerEvents).toBe('none')
    expect(bar.element.style.left).not.toBe('')
    expect(bar.element.style.bottom).not.toBe('')

    bar.update(24)

    expect(bar.lengthM).toBe(5)
    expect(bar.widthPx).toBe(120)
    expect(bar.element.style.display).toBe('block')
    expect(bar.element.style.width).toBe('120px')
    expect(bar.element.textContent).toBe('05 m')
    expect(bar.element.style.boxShadow).toBe('')

    bar.update(0)
    expect(bar.lengthM).toBeNull()
    expect(bar.element.style.display).toBe('none')
  })
})
