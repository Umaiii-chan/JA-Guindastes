// @vitest-environment jsdom
// Tela do simulador com a cena como prioridade (TASK-095; ADR-045): folhas que escondem sem
// desmontar (F-20), Esc, abertura sozinha com passos pendentes, "Detalhes" do cartão, janelas em tela
// cheia (F-21), atalhos das vistas e o trilho recolhido no simulador.

import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { createElement, useState } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AppShell } from '../../../src/presentation/layout/AppShell'
import { SimulatorPage } from '../../../src/presentation/pages/SimulatorPage'
import { BackendEvaluationPanel } from '../../../src/presentation/panels/BackendEvaluationPanel'
import { CameraPresetButtons } from '../../../src/presentation/simulator/CameraPresetButtons'
import { CollapsibleSection } from '../../../src/presentation/simulator/CollapsibleSection'
import type { SimulatorSetupSummary } from '../../../src/presentation/simulator/layout/ContextChip'
import { Dialog, PortalTargetContext } from '../../../src/presentation/ui'
import { mapEvaluationResponse } from '../../../src/infrastructure/api/evaluationRestClient'
import { REST_EVALUATED } from '../../fixtures/evaluationResponses'

const DONE: SimulatorSetupSummary = {
  crane: 'Modelo A1 · Config',
  load: '1.500 kg',
  done: 3,
  total: 3,
  incomplete: false,
}

/** Contador com estado próprio: se a folha desmontasse, ele voltaria a zero. */
function Counter() {
  const [count, setCount] = useState(0)
  return (
    <button type="button" onClick={() => setCount((value) => value + 1)}>
      Contagem {count}
    </button>
  )
}

function renderPage(props: Partial<Parameters<typeof SimulatorPage>[0]> = {}) {
  return render(
    <SimulatorPage
      viewport={<div data-testid="cena" />}
      steps={<p>passos da simulação</p>}
      setup={DONE}
      result={<p>ficha do resultado</p>}
      geometry={<p>geometria da prévia</p>}
      statusBar={<div role="group" aria-label="Status da conexão e câmera" />}
      commandBar={<p>barra de comando</p>}
      planning={<Counter />}
      environment={
        <CollapsibleSection id="environment" title="Ambiente" summary="Terreno plano">
          lista do ambiente
        </CollapsibleSection>
      }
      {...props}
    />,
  )
}

beforeEach(() => window.localStorage.clear())

describe('SimulatorPage — folhas sobre a cena', () => {
  it('abre uma folha por vez pela barra de ferramentas; fechada, a folha esconde sem desmontar', () => {
    renderPage()
    const toolbar = screen.getByRole('navigation', { name: 'Painéis do simulador' })
    const planning = within(toolbar).getByRole('button', { name: 'Planejar' })
    expect(planning.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(planning)
    expect(planning.getAttribute('aria-expanded')).toBe('true')
    const sheet = screen.getByRole('region', { name: 'Planejar operação' })
    expect(planning.getAttribute('aria-controls')).toBe(sheet.id)
    fireEvent.click(within(sheet).getByRole('button', { name: 'Contagem 0' }))
    expect(within(sheet).getByRole('button', { name: 'Contagem 1' })).toBeTruthy()

    // Abrir outra folha fecha a primeira, que continua montada com o estado (F-20).
    fireEvent.click(within(toolbar).getByRole('button', { name: /^Ambiente/ }))
    expect(planning.getAttribute('aria-expanded')).toBe('false')
    const hiddenSheet = document.getElementById(sheet.id)
    expect(hiddenSheet?.hidden).toBe(true)
    expect(hiddenSheet?.textContent).toContain('Contagem 1')

    fireEvent.click(planning)
    expect(screen.getByRole('button', { name: 'Contagem 1' })).toBeTruthy()
  })

  it('Esc fecha a folha aberta e devolve o foco ao botão dela', () => {
    renderPage()
    const button = screen.getByRole('button', { name: 'Planejar' })
    fireEvent.click(button)
    screen.getByRole('button', { name: 'Contagem 0' }).focus()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(button)
  })

  it('com passos pendentes, a folha Configurar já abre; o chip resume a operação e a abre', () => {
    renderPage({ setup: { ...DONE, crane: '', load: '', done: 0, incomplete: true } })
    const setup = screen.getByRole('button', { name: 'Configurar' })
    expect(setup.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('passos da simulação')).toBeTruthy()
    const chip = screen.getByRole('button', { name: /Escolha o guindaste e descreva a carga/ })
    expect(chip.textContent).toContain('0/3')
  })

  it('sem passos pendentes, abre com a cena livre; o chip abre Configurar', () => {
    renderPage()
    expect(screen.getByRole('button', { name: 'Configurar' }).getAttribute('aria-expanded')).toBe(
      'false',
    )
    fireEvent.click(screen.getByRole('button', { name: /Modelo A1 · Config · 1\.500 kg/ }))
    expect(screen.getByRole('button', { name: 'Configurar' }).getAttribute('aria-expanded')).toBe(
      'true',
    )
  })

  it('dentro de uma folha, a seção recolhível mostra o resumo sem repetir o título', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /^Ambiente/ }))
    const sheet = screen.getByRole('region', { name: 'Ambiente' })
    expect(sheet.textContent).toContain('Terreno plano')
    expect(sheet.textContent).toContain('lista do ambiente')
    expect(within(sheet).queryByRole('button', { name: /Terreno plano/ })).toBeNull()
  })

  it('"Ocultar painéis" marca o palco (o CSS esconde os painéis) sem desmontar nada', () => {
    renderPage()
    const stage = screen.getByTestId('cena').parentElement?.parentElement
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar painéis' }))
    expect(stage?.hasAttribute('data-panels-hidden')).toBe(true)
    expect(screen.getByTestId('cena')).toBeTruthy()
    expect(screen.getByText('barra de comando')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar painéis' }))
    expect(stage?.hasAttribute('data-panels-hidden')).toBe(false)
  })
})

describe('cartão de resultado — Detalhes', () => {
  it('fechado, os detalhes ficam no HTML (escondidos); "Detalhes" abre a ficha e a geometria', () => {
    renderPage({
      result: (
        <BackendEvaluationPanel
          result={mapEvaluationResponse(REST_EVALUATED)}
          error={null}
          pending={false}
          transport="rest"
          inputProblem={null}
          loadWeightKg={1500}
        />
      ),
    })
    const card = screen.getByRole('complementary', { name: 'Resultado da avaliação' })
    const toggle = within(card).getByRole('button', { name: 'Detalhes' })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    const ids = (toggle.getAttribute('aria-controls') ?? '').split(' ')
    expect(ids).toHaveLength(2)
    const [details, extra] = ids.map((id) => document.getElementById(id))
    expect(details?.hidden).toBe(true)
    expect(details?.textContent).toContain('Capacidade admissível')
    expect(extra?.hidden).toBe(true)
    expect(extra?.textContent).toContain('geometria da prévia')

    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(details?.hidden).toBe(false)
    expect(extra?.hidden).toBe(false)
  })

  it('sem o cartão, a ficha abre os próprios detalhes', () => {
    const html = renderToStaticMarkup(
      createElement(BackendEvaluationPanel, {
        result: mapEvaluationResponse(REST_EVALUATED),
        error: null,
        pending: false,
        transport: null,
        inputProblem: null,
      }),
    )
    expect(html).toMatch(/aria-expanded="false"[^>]*>.*Detalhes/)
    expect(html).toContain('hidden=""')
  })
})

describe('janelas em tela cheia (F-21)', () => {
  it('o Dialog monta no alvo do contexto, e não no body', () => {
    const target = document.createElement('div')
    document.body.append(target)
    render(
      <PortalTargetContext.Provider value={target}>
        <Dialog open onClose={() => undefined} title="Janela de teste">
          conteúdo
        </Dialog>
      </PortalTargetContext.Provider>,
    )
    expect(target.querySelector('[role="dialog"]')?.textContent).toContain('Janela de teste')
    target.remove()
  })

  it('na tela cheia do simulador, as janelas vão para dentro do palco', () => {
    const requestFullscreen = vi.fn(() => Promise.resolve())
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
      configurable: true,
      value: requestFullscreen,
    })
    renderPage({
      dialogs: (
        <Dialog open onClose={() => undefined} title="Adicionar guindaste">
          formulário
        </Dialog>
      ),
    })
    const stage = screen.getByTestId('cena').parentElement?.parentElement
    expect(stage?.querySelector('[role="dialog"]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Tela cheia' }))
    expect(requestFullscreen).toHaveBeenCalled()
    expect(stage?.querySelector('[role="dialog"]')?.textContent).toContain('Adicionar guindaste')
  })
})

describe('atalhos das vistas', () => {
  it('teclas 1–4 escolhem a vista, mas não dentro de um campo', () => {
    const onSelect = vi.fn()
    render(
      <>
        <CameraPresetButtons active={null} onSelect={onSelect} shortcuts />
        <input aria-label="campo" />
      </>,
    )
    fireEvent.keyDown(document.body, { key: '3' })
    expect(onSelect).toHaveBeenLastCalledWith('topo')
    fireEvent.keyDown(screen.getByLabelText('campo'), { key: '1' })
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Câmera de topo' }).title).toContain('tecla 3')
  })
})

describe('trilho no simulador', () => {
  it('começa recolhido no simulador e guarda a escolha à parte', () => {
    act(() => {
      render(
        <MemoryRouter initialEntries={['/simulador']}>
          <AppShell userMenu={null}>
            <p>palco</p>
          </AppShell>
        </MemoryRouter>,
      )
    })
    const toggle = screen.getByRole('button', { name: 'Expandir menu' })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(toggle)
    expect(window.localStorage.getItem('ja-guindastes.rail-collapsed.stage')).toBe('0')
  })
})
