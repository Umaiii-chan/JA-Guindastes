// @vitest-environment jsdom
// Painel "Planejar operação": aviso de busca cortada pelo tempo (TASK-089, F-28). Dados FICTÍCIOS.

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { PlanningResult } from '../../../src/domain/planning/planning'
import {
  PlanningPanel,
  type PlanningPanelProps,
} from '../../../src/presentation/simulator/PlanningPanel'

const TIMED_OUT_TEXT = /A busca parou no tempo limite/

function props(result: PlanningResult): PlanningPanelProps {
  return {
    pick: { x: -7.5, z: 0, rotationYDeg: 0 },
    delivery: { x: 7.5, z: 0, rotationYDeg: 0, radiusM: 1.5 },
    onPickChange: vi.fn(),
    onDeliveryChange: vi.fn(),
    loadReady: true,
    status: 'ready',
    error: null,
    result,
    selectedIndex: 0,
    onSelect: vi.fn(),
    onPlan: vi.fn(),
    onApply: vi.fn(),
    applying: false,
    applied: false,
    canRun: false,
    playback: {
      playing: false,
      progress: 0,
      phase: null,
      speed: 1,
      speeds: [1, 2, 4],
      onSpeed: vi.fn(),
      onStart: vi.fn(),
      onStop: vi.fn(),
    },
    guide: {
      active: false,
      finished: false,
      counter: '',
      title: '',
      actions: [],
      doneText: '',
      reached: false,
      manual: false,
      onStart: vi.fn(),
      onExit: vi.fn(),
      onConfirm: vi.fn(),
      onSkip: vi.fn(),
      onPrevious: vi.fn(),
    },
  }
}

describe('PlanningPanel', () => {
  it('avisa quando a busca do servidor parou no tempo limite', () => {
    render(<PlanningPanel {...props({ recommendations: [], notes: [], timedOut: true })} />)

    expect(screen.getByText(TIMED_OUT_TEXT)).toBeTruthy()
  })

  it('não avisa quando a busca foi completa', () => {
    render(<PlanningPanel {...props({ recommendations: [], notes: [], timedOut: false })} />)

    expect(screen.queryByText(TIMED_OUT_TEXT)).toBeNull()
  })
})
