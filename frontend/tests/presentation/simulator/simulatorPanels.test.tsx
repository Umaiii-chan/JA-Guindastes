// @vitest-environment jsdom
// Painel de passos e barra de status do simulador guiado (TASK-039).

import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { guidedStepStatuses } from '../../../src/application/simulator/guidedSteps'
import { CameraPresetButtons } from '../../../src/presentation/simulator/CameraPresetButtons'
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
  it('mostra a conexão (o transporte do resultado fica no HUD; TASK-062)', () => {
    const { rerender } = render(
      <ConnectionStatusBar connectionStatus="connected" transport="websocket" pending={false} />,
    )
    const bar = screen.getByRole('group', { name: 'Status da conexão e câmera' })
    expect(within(bar).getByRole('status').textContent).toContain('Tempo real')
    expect(bar.textContent).toContain('Arraste para girar')

    rerender(<ConnectionStatusBar connectionStatus="reconnecting" transport="rest" pending />)
    expect(within(bar).getByRole('status').textContent).toContain('Reconectando…')
    expect(bar.textContent).toContain('atualizando')
  })

  it('os botões de câmera marcam a predefinição escolhida e avisam a escolha', () => {
    const onSelect = vi.fn()
    render(<CameraPresetButtons active="topo" onSelect={onSelect} />)
    const group = screen.getByRole('group', { name: 'Câmera' })
    expect(
      within(group)
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label')),
    ).toEqual(['Câmera em perspectiva', 'Câmera lateral', 'Câmera de topo', 'Câmera do operador'])
    expect(
      screen.getByRole('button', { name: 'Câmera de topo' }).getAttribute('aria-pressed'),
    ).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Câmera lateral' }))
    expect(onSelect).toHaveBeenCalledWith('lateral')
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
  })
})
