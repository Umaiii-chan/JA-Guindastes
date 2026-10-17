// @vitest-environment jsdom
// Painel dos comandos do guindaste com giro contínuo (TASK-092; F-22): o slider "Giro da torre"
// continua de −180° a 180°, com o mesmo nome acessível (usado nos testes E2E), e as setas nas pontas
// dão a volta. Com limites de giro, a ponta trava. Limites FICTÍCIOS (ADR-012).

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { CraneControlPanel } from '../../../src/presentation/panels/CraneControlPanel'
import { PROVISIONAL_CRANE_LIMITS } from '../../../src/three/crane/provisionalCraneSpec'
import type { CraneLimits, CraneState } from '../../../src/three/crane/types'

const STATE: CraneState = {
  turretRotationDeg: 180,
  boomAngleDeg: 35,
  boomLengthM: 12,
  cableLengthM: 5,
}

function renderPanel(limits: CraneLimits, state: CraneState = STATE) {
  const onChange = vi.fn()
  render(
    <CraneControlPanel
      limits={limits}
      state={state}
      notice="Limites FICTÍCIOS."
      onChange={onChange}
    />,
  )
  return { onChange, turret: screen.getByLabelText('Giro da torre') as HTMLInputElement }
}

describe('CraneControlPanel e o giro contínuo', () => {
  it('o slider do giro segue de −180° a 180°, com o rótulo de sempre', () => {
    const { turret } = renderPanel(PROVISIONAL_CRANE_LIMITS)

    expect(turret.min).toBe('-180')
    expect(turret.max).toBe('180')
    expect(turret.getAttribute('aria-valuetext')).toBe('180°')
  })

  it('giro contínuo: a seta na ponta pede 181°, e o comando dá a volta', () => {
    const { onChange, turret } = renderPanel(PROVISIONAL_CRANE_LIMITS)

    fireEvent.keyDown(turret, { key: 'ArrowRight' })

    expect(onChange).toHaveBeenCalledWith('turretRotationDeg', 181)
  })

  it('com limites de giro, a ponta trava; os outros sliders não dão a volta', () => {
    const limited: CraneLimits = {
      ...PROVISIONAL_CRANE_LIMITS,
      turretRotationDeg: { min: -90, max: 90 },
    }
    // Os dois na ponta de cima: giro em 90° (batente) e inclinação em 80° (máximo FICTÍCIO).
    const { onChange, turret } = renderPanel(limited, {
      ...STATE,
      turretRotationDeg: 90,
      boomAngleDeg: 80,
    })

    fireEvent.keyDown(turret, { key: 'ArrowRight' })
    fireEvent.keyDown(screen.getByLabelText('Inclinação da lança'), { key: 'ArrowRight' })

    expect(onChange).not.toHaveBeenCalled()
  })
})
