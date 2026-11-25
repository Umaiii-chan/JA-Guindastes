// @vitest-environment jsdom
// Painel "Planejar operação": aviso de busca cortada pelo tempo (TASK-089, F-28). Dados FICTÍCIOS.

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type {
  PlanCraneDetail,
  PlanRecommendation,
  PlanningResult,
} from '../../../src/domain/planning/planning'
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
    onRestart: vi.fn(),
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

const RECOMMENDATION: PlanRecommendation = {
  kind: 'single',
  configurationIds: ['cfg-ficticia'],
  placements: [{ x: 0, z: 5, headingDeg: 0 }],
  maxLimitUtilizationPercent: 60,
  tippingRisk: 'LOW',
  valid: true,
  summary: 'FICTÍCIO',
  trajectory: [],
  notes: [],
  details: [
    {
      configurationId: 'cfg-ficticia',
      manufacturerId: 'fab',
      craneId: 'gui',
      label: 'Guindaste FICTÍCIO',
      shareKg: 1000,
      boomLengthM: 12,
      boomAnglePickDeg: 50,
      boomAngleDeliveryDeg: 50,
      pickRadiusM: 8,
      deliveryRadiusM: 8,
      swingDeg: 90,
      utilizationPercent: 60,
      transportHeightM: 2,
      crossedObstacleIds: [],
      slingLengthM: 3,
      slingAngleDeg: 60,
      slingDropM: 2,
    },
  ],
}

describe('PlanningPanel — repetir simulação (TASK-119)', () => {
  const withOption = (changes: Partial<PlanningPanelProps>): PlanningPanelProps => ({
    ...props({ recommendations: [RECOMMENDATION], notes: [], timedOut: false }),
    ...changes,
  })

  it('o botão "Repetir simulação" chama onRestart', () => {
    const onRestart = vi.fn()
    render(<PlanningPanel {...withOption({ canRun: true, onRestart })} />)

    fireEvent.click(screen.getByRole('button', { name: 'Repetir simulação' }))

    expect(onRestart).toHaveBeenCalledTimes(1)
  })

  it('o botão fica desabilitado quando não dá para executar (sem cena ou gravação em reprodução)', () => {
    render(<PlanningPanel {...withOption({ canRun: false })} />)

    const button = screen.getByRole('button', { name: 'Repetir simulação' }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
  })
})

describe('PlanningPanel', () => {
  it('avisa quando a busca do servidor parou no tempo limite', () => {
    render(<PlanningPanel {...props({ recommendations: [], notes: [], timedOut: true })} />)

    expect(screen.getByText(TIMED_OUT_TEXT)).toBeTruthy()
  })

  it('não avisa quando a busca foi completa', () => {
    render(<PlanningPanel {...props({ recommendations: [], notes: [], timedOut: false })} />)

    expect(screen.queryByText(TIMED_OUT_TEXT)).toBeNull()
  })

  describe('tandem recomendado porque um guindaste só não atende (TASK-120)', () => {
    const detail = (label: string, shareKg: number): PlanCraneDetail => ({
      configurationId: label,
      manufacturerId: 'fab',
      craneId: label,
      label,
      shareKg,
      boomLengthM: 20,
      boomAnglePickDeg: 60,
      boomAngleDeliveryDeg: 60,
      pickRadiusM: 8,
      deliveryRadiusM: 9,
      swingDeg: 90,
      utilizationPercent: 70,
      transportHeightM: 5,
      crossedObstacleIds: [],
      slingLengthM: 3,
      slingAngleDeg: 60,
      slingDropM: 2.5,
    })
    const tandem: PlanRecommendation = {
      kind: 'tandem',
      configurationIds: ['A', 'B'],
      placements: [
        { x: 0, z: 0, headingDeg: 0 },
        { x: 10, z: 0, headingDeg: 0 },
      ],
      maxLimitUtilizationPercent: 70,
      tippingRisk: 'LOW',
      valid: true,
      summary: 'dois guindastes',
      trajectory: [],
      notes: [],
      details: [detail('Guindaste A', 4000), detail('Guindaste B', 6000)],
    }

    it('avisa que nenhum guindaste sozinho atende e mostra a divisão da carga', () => {
      render(
        <PlanningPanel {...props({ recommendations: [tandem], notes: [], timedOut: false })} />,
      )

      expect(screen.getByText('Recomendamos operar com 2 guindastes')).toBeTruthy()
      expect(screen.getByText(/Guindaste 1: Guindaste A — 4\.000 kg da carga/)).toBeTruthy()
      expect(screen.getByText(/Guindaste 2: Guindaste B — 6\.000 kg da carga/)).toBeTruthy()
    })

    it('com um guindaste só na lista, não mostra o aviso', () => {
      const single: PlanRecommendation = {
        ...tandem,
        kind: 'single',
        details: [detail('Guindaste A', 10000)],
      }
      render(
        <PlanningPanel {...props({ recommendations: [single], notes: [], timedOut: false })} />,
      )

      expect(screen.queryByText('Recomendamos operar com 2 guindastes')).toBeNull()
    })

    it('tandem primeiro e um guindaste válido depois: avisa da faixa de atenção (TASK-123)', () => {
      const single: PlanRecommendation = {
        ...tandem,
        kind: 'single',
        details: [detail('Guindaste A', 10000)],
      }
      render(
        <PlanningPanel
          {...props({ recommendations: [tandem, single], notes: [], timedOut: false })}
        />,
      )

      expect(screen.getByText('Recomendamos operar com 2 guindastes')).toBeTruthy()
      expect(screen.getByText(/já na faixa de atenção do limite/)).toBeTruthy()
      expect(screen.queryByText(/Nenhum guindaste sozinho atende/)).toBeNull()
    })
  })
})
