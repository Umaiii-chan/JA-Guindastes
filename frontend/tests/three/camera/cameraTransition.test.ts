import { describe, expect, it } from 'vitest'

import type { CameraView } from '../../../src/three/camera/cameraPresets'
import {
  CameraTransition,
  easeInOutCubic,
  interpolateView,
} from '../../../src/three/camera/cameraTransition'
import { expectClose } from '../../helpers/expectClose'

const FROM: CameraView = { position: { x: 0, y: 10, z: 0 }, target: { x: 0, y: 0, z: 0 } }
const TO: CameraView = { position: { x: 10, y: 20, z: -10 }, target: { x: 2, y: 4, z: 6 } }

describe('cameraTransition', () => {
  it('suaviza de 0 a 1, simétrica no meio e presa às pontas', () => {
    expect(easeInOutCubic(0)).toBe(0)
    expect(easeInOutCubic(1)).toBe(1)
    expect(easeInOutCubic(0.5)).toBe(0.5)
    expect(easeInOutCubic(-1)).toBe(0)
    expect(easeInOutCubic(2)).toBe(1)
    expectClose(easeInOutCubic(0.25) + easeInOutCubic(0.75), 1, 1e-12)
    expect(easeInOutCubic(0.1)).toBeLessThan(0.1)
  })

  it('interpola posição e alvo juntos', () => {
    const middle = interpolateView(FROM, TO, 0.5)
    expect(middle.position).toEqual({ x: 5, y: 15, z: -5 })
    expect(middle.target).toEqual({ x: 1, y: 2, z: 3 })
  })

  it('vai de `from` a `to` na duração pedida e termina exatamente em `to`', () => {
    const transition = new CameraTransition(FROM, TO, 700, 1000)

    expect(transition.sample(1000)).toEqual({ view: interpolateView(FROM, TO, 0), done: false })
    const middle = transition.sample(1350)
    expect(middle.done).toBe(false)
    expect(middle.view.position.x).toBeCloseTo(5)
    expect(transition.sample(1700)).toEqual({ view: TO, done: true })
    expect(transition.sample(5000)).toEqual({ view: TO, done: true })
  })

  it('com duração zero (prefers-reduced-motion), já devolve a vista final', () => {
    expect(new CameraTransition(FROM, TO, 0, 1000).sample(1000)).toEqual({ view: TO, done: true })
  })
})
