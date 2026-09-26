// @vitest-environment jsdom
// Painel de passos e barra de status do simulador guiado (TASK-039).

import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { guidedStepStatuses } from '../../../src/application/simulator/guidedSteps'
import { ConnectionStatusBar } from '../../../src/presentation/simulator/ConnectionStatusBar'
import { GuidedStepsPanel } from '../../../src/presentation/simulator/GuidedStepsPanel'

const CONTENT = {
  crane: <p>seleção do guindaste</p>,
  load: <p>formulário da carga</p>,
  position: <p>controles da posição</p>,
}

describe('GuidedStepsPanel', () => {
  it('mostra o progresso, o conteúdo do passo aberto e bloqueia os seguintes', () => {
    render(
      <GuidedStepsPanel
        statuses={guidedStepStatuses({
          configurationChosen: false,
          loadValid: false,
          evaluated: false,
        })}
        activeStep="crane"
        onSelectStep={vi.fn()}
        content={CONTENT}
      />,
    )
    expect(screen.getByText('0 de 3 passos concluídos')).toBeTruthy()
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0')
    expect(screen.getByText('seleção do guindaste')).toBeTruthy()
    expect(screen.queryByText('formulário da carga')).toBeNull()
    const steps = within(screen.getByRole('list', { name: 'Passos da simulação' }))
    expect(steps.getByRole('button', { name: /Passo 2.*bloqueado/ })).toHaveProperty(
      'disabled',
      true,
    )
    expect(screen.queryByRole('button', { name: /Continuar/ })).toBeNull()
  })

  it('passo concluído: resumo, botão "Continuar" e troca de passo pelo cabeçalho', () => {
    const onSelectStep = vi.fn()
    render(
      <GuidedStepsPanel
        statuses={guidedStepStatuses({
          configurationChosen: true,
          loadValid: false,
          evaluated: false,
        })}
        activeStep="crane"
        onSelectStep={onSelectStep}
        content={CONTENT}
        summaries={{ crane: 'Fabricante FICTÍCIO A · Modelo A1 · Config' }}
      />,
    )
    expect(screen.getByText('1 de 3 passos concluídos')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Continuar para Carga' }))
    expect(onSelectStep).toHaveBeenCalledWith('load')
    fireEvent.click(screen.getByRole('button', { name: /Passo 2.*em andamento/ }))
    expect(onSelectStep).toHaveBeenLastCalledWith('load')
  })

  it('com outro passo aberto, o concluído mostra o resumo do que foi escolhido', () => {
    render(
      <GuidedStepsPanel
        statuses={guidedStepStatuses({
          configurationChosen: true,
          loadValid: true,
          evaluated: false,
        })}
        activeStep="position"
        onSelectStep={vi.fn()}
        content={CONTENT}
        summaries={{ crane: 'FAB A · A1 · Config', load: 'Viga FICTÍCIA · 1.500 kg' }}
      />,
    )
    expect(screen.getByText('FAB A · A1 · Config')).toBeTruthy()
    expect(screen.getByText('Viga FICTÍCIA · 1.500 kg')).toBeTruthy()
    expect(screen.getByText('controles da posição')).toBeTruthy()
  })
})

describe('ConnectionStatusBar', () => {
  it('mostra a conexão e por onde veio o último resultado', () => {
    const { rerender } = render(
      <ConnectionStatusBar connectionStatus="connected" transport="websocket" pending={false} />,
    )
    const bar = screen.getByRole('group', { name: 'Status da conexão e câmera' })
    expect(within(bar).getByRole('status').textContent).toContain('Tempo real (WebSocket)')
    expect(bar.textContent).toContain('Último resultado por WebSocket')
    expect(bar.textContent).toContain('Arraste para girar')

    rerender(<ConnectionStatusBar connectionStatus="reconnecting" transport="rest" pending />)
    expect(within(bar).getByRole('status').textContent).toContain(
      'Reconectando — avaliação por REST',
    )
    expect(bar.textContent).toContain('Último resultado por REST')
    expect(bar.textContent).toContain('atualizando')
  })

  it('aceita as ações de câmera no lugar da dica (encaixe da TASK-041)', () => {
    render(
      <ConnectionStatusBar
        connectionStatus="idle"
        transport={null}
        pending={false}
        cameraActions={<button type="button">Topo</button>}
      />,
    )
    expect(screen.getByRole('button', { name: 'Topo' })).toBeTruthy()
    expect(screen.queryByText(/Arraste para girar/)).toBeNull()
    expect(screen.getByText('Nenhuma avaliação recebida')).toBeTruthy()
  })
})
