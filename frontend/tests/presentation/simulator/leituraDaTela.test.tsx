// @vitest-environment jsdom
// Ajustes de leitura da tela do simulador (TASK-104): limites e observação dos sliders compactos, ordem
// de foco, selo do resultado com os painéis ocultos e ícones de conexão.

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { SimulatorPage } from '../../../src/presentation/pages/SimulatorPage'
import { ConnectionStatusBar } from '../../../src/presentation/simulator/ConnectionStatusBar'
import { ResultSeal } from '../../../src/presentation/simulator/layout/ResultSeal'
import { Slider } from '../../../src/presentation/ui'
import { Dialog } from '../../../src/presentation/ui'

describe('slider compacto', () => {
  it('mostra os limites no HTML e a observação num botão focável ligado ao controle', () => {
    render(
      <Slider
        label="Comprimento do cabo"
        shortLabel="Cabo"
        compact
        value={5}
        min={1}
        max={30}
        onChange={() => undefined}
        note="Cabo máximo FICTÍCIO"
      />,
    )
    expect(screen.getByText('30')).toBeTruthy()
    expect(screen.getByText('1')).toBeTruthy()
    const mark = screen.getByRole('button', { name: 'Ver observação' })
    const noteId = mark.getAttribute('aria-describedby') as string
    expect(document.getElementById(noteId)?.textContent).toBe('Cabo máximo FICTÍCIO')
    // O rótulo do controle continua único (os E2E o procuram por trecho do texto).
    expect(screen.getAllByLabelText(/comprimento do cabo/i)).toHaveLength(1)
    expect(screen.getByLabelText('Comprimento do cabo').getAttribute('aria-describedby')).toBe(
      noteId,
    )
  })
})

describe('tela do simulador', () => {
  const page = () =>
    render(
      <SimulatorPage
        viewport={<div />}
        steps={<p>passos</p>}
        result={<p>resultado</p>}
        resultSeal={<ResultSeal items={[{ tone: 'danger', label: 'Acima da capacidade' }]} />}
        statusBar={<button type="button">vista</button>}
      />,
    )

  it('a barra do topo vem antes da barra de ferramentas no DOM (ordem de foco = ordem visual)', () => {
    page()
    const top = screen.getByRole('button', { name: 'vista' })
    const toolbar = screen.getByRole('button', { name: 'Configurar' })
    expect(top.compareDocumentPosition(toolbar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('o selo de situação fica na página; o cartão some com "Ocultar painéis", o selo não', () => {
    const { container } = page()
    const seal = screen.getByRole('status', { name: 'Situação do resultado' })
    expect(seal.textContent).toContain('Acima da capacidade')
    fireEvent.click(screen.getByRole('button', { name: /Ocultar os painéis|Ocultar painéis/ }))
    const stage = container.firstElementChild as HTMLElement
    expect(stage.hasAttribute('data-panels-hidden')).toBe(true)
    expect(seal.closest('[class*="hideable"]')).toBeNull()
  })

  it('janela aberta não é remontada ao sair da tela cheia (mantém o que foi digitado)', () => {
    const { rerender } = render(
      <SimulatorPage
        viewport={<div />}
        steps={<p>passos</p>}
        result={<p>resultado</p>}
        statusBar={<div />}
        dialogs={
          <Dialog open title="Janela" onClose={() => undefined}>
            <input aria-label="nome" />
          </Dialog>
        }
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Tela cheia|Simulação em tela cheia/ }))
    const input = screen.getByLabelText('nome') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'abc' } })
    fireEvent.click(screen.getByRole('button', { name: /Sair da tela cheia/ }))
    rerender(
      <SimulatorPage
        viewport={<div />}
        steps={<p>passos</p>}
        result={<p>resultado</p>}
        statusBar={<div />}
        dialogs={
          <Dialog open title="Janela" onClose={() => undefined}>
            <input aria-label="nome" />
          </Dialog>
        }
      />,
    )
    expect((screen.getByLabelText('nome') as HTMLInputElement).value).toBe('abc')
  })
})

describe('conexão compacta', () => {
  it('cada estado tem um ícone próprio, além do texto para leitor de tela', () => {
    const shapes = new Set<string>()
    for (const status of ['reconnecting', 'closed', 'connected'] as const) {
      const { container, unmount } = render(
        <ConnectionStatusBar connectionStatus={status} transport={null} pending={false} compact />,
      )
      shapes.add(container.querySelector('svg')?.getAttribute('class') ?? '')
      unmount()
    }
    expect(shapes.size).toBe(3)
  })

  it('a célula "atualizando…" fica montada sem avaliação em curso, só escondida (sem empurrar a barra)', () => {
    const { rerender } = render(
      <ConnectionStatusBar connectionStatus="rest" transport="rest" pending={false} compact />,
    )
    const idle = screen.getByText('atualizando…', { ignore: undefined, selector: 'span' })
    const cell = idle.closest('[aria-hidden]') as HTMLElement
    expect(cell.style.visibility).toBe('hidden')
    expect(cell.getAttribute('aria-hidden')).toBe('true')

    rerender(<ConnectionStatusBar connectionStatus="rest" transport="rest" pending compact />)
    expect(screen.getByText('atualizando…').closest('[aria-hidden]')).toBe(cell)
    expect(cell.style.visibility).toBe('visible')
  })

  it('"atualizando…" mostra o indicador e deixa o texto para leitor de tela (sem reservar largura de texto)', () => {
    render(<ConnectionStatusBar connectionStatus="rest" transport="rest" pending compact />)
    const text = screen.getByText('atualizando…')
    expect(text.className).toContain('visually-hidden')
    expect((text.closest('[aria-hidden]') as HTMLElement).style.visibility).toBe('visible')
  })
})
