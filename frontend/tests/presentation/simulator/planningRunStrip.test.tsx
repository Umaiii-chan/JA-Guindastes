// @vitest-environment jsdom
// Faixa flutuante da execução do planejamento (TASK-104; ADR-048): com a trajetória rodando ou o passo
// a passo ativo, a execução aparece sobre a cena mesmo com a folha "Planejar" fechada; fora do
// simulador, fica no próprio painel como antes.

import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { SimulatorPage } from '../../../src/presentation/pages/SimulatorPage'
import {
  PlanningPanel,
  type PlanningGuideView,
  type PlanningPanelProps,
  type PlanningPlaybackView,
} from '../../../src/presentation/simulator/PlanningPanel'

const playback = (overrides: Partial<PlanningPlaybackView> = {}): PlanningPlaybackView => ({
  playing: false,
  progress: 0,
  phase: null,
  speed: 1,
  speeds: [1, 2, 4],
  onSpeed: vi.fn(),
  onStart: vi.fn(),
  onStop: vi.fn(),
  ...overrides,
})

const guide = (overrides: Partial<PlanningGuideView> = {}): PlanningGuideView => ({
  active: false,
  finished: false,
  counter: 'Passo 2 de 5',
  title: 'Girar',
  actions: ['Gire a torre para a esquerda'],
  doneText: 'Giro feito.',
  reached: false,
  manual: false,
  onStart: vi.fn(),
  onExit: vi.fn(),
  onConfirm: vi.fn(),
  onSkip: vi.fn(),
  onPrevious: vi.fn(),
  ...overrides,
})

function panelProps(overrides: Partial<PlanningPanelProps> = {}): PlanningPanelProps {
  return {
    pick: { x: 0, z: 8, rotationYDeg: 0 },
    delivery: { x: 5, z: -6, rotationYDeg: 0, radiusM: 2 },
    onPickChange: vi.fn(),
    onDeliveryChange: vi.fn(),
    loadReady: true,
    status: 'idle',
    error: null,
    result: null,
    selectedIndex: 0,
    onSelect: vi.fn(),
    onPlan: vi.fn(),
    onApply: vi.fn(),
    applying: false,
    applied: true,
    canRun: true,
    playback: playback(),
    guide: guide(),
    ...overrides,
  } as PlanningPanelProps
}

function renderInSimulator(props: PlanningPanelProps) {
  return render(
    <SimulatorPage
      viewport={<div data-testid="cena" />}
      steps={<p>passos</p>}
      result={<p>resultado</p>}
      statusBar={<div />}
      planning={<PlanningPanel {...props} />}
    />,
  )
}

describe('faixa da execução do planejamento', () => {
  it('trajetória rodando: Parar, fase, progresso e velocidade na faixa, com a folha fechada', () => {
    const onStop = vi.fn()
    renderInSimulator(
      panelProps({
        playback: playback({ playing: true, progress: 0.4, phase: 'engatar', onStop }),
      }),
    )
    const strip = screen.getByRole('region', { name: 'Execução do planejamento' })
    expect(
      within(strip).getByRole('progressbar', { name: 'Andamento da trajetória' }),
    ).toHaveProperty('ariaValueNow', '40')
    expect(within(strip).getByRole('group', { name: 'Velocidade' })).toBeTruthy()
    fireEvent.click(within(strip).getByRole('button', { name: 'Parar' }))
    expect(onStop).toHaveBeenCalledOnce()
    // Sem duplicar o nome acessível: só a faixa tem "Parar" enquanto a folha está fechada.
    expect(screen.getAllByRole('button', { name: 'Parar' })).toHaveLength(1)
  })

  it('passo a passo ativo: próxima ação e botões na faixa', () => {
    const onSkip = vi.fn()
    renderInSimulator(panelProps({ guide: guide({ active: true, onSkip }) }))
    const strip = screen.getByRole('region', { name: 'Execução do planejamento' })
    const status = within(strip).getByRole('status', { name: 'Passo a passo' })
    expect(status.textContent).toContain('Passo 2 de 5 · Girar')
    expect(status.textContent).toContain('Gire a torre para a esquerda')
    fireEvent.click(within(strip).getByRole('button', { name: 'Pular passo' }))
    expect(onSkip).toHaveBeenCalledOnce()
    expect(screen.getAllByRole('status', { name: 'Passo a passo' })).toHaveLength(1)
  })

  it('sem execução nem passo a passo, não há faixa', () => {
    renderInSimulator(panelProps())
    expect(screen.queryByRole('region', { name: 'Execução do planejamento' })).toBeNull()
  })

  it('fora do simulador, a execução continua no próprio painel', () => {
    const { rerender } = render(
      <PlanningPanel {...panelProps({ playback: playback({ playing: true, progress: 0.2 }) })} />,
    )
    // Só se mostra o painel completo quando há recomendação; o passo a passo aparece sempre.
    rerender(<PlanningPanel {...panelProps({ guide: guide({ active: true }) })} />)
    expect(screen.getByRole('status', { name: 'Passo a passo' })).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Execução do planejamento' })).toBeNull()
  })
})
