// @vitest-environment jsdom
// Assistente de IA na tela (TASK-076): botão, prévia e aplicação do cenário, explicação, relatório
// imprimível e exportável, revisão de gravação. O servidor é um dublê: nada sai para a rede.

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AiContext, AI_DISABLED, type AiContextValue } from '../../../src/app/ai/aiContext'
import type { AiGateway, AiLiftReportRequest } from '../../../src/application/ai/ports'
import { AuthRequestError } from '../../../src/domain/auth/user'
import {
  AssistantButton,
  ExplainRecommendationButton,
  LiftReportButton,
  ReviewRecordingButton,
} from '../../../src/presentation/ai'
import { DRAFT } from '../../fixtures/aiDraft'

function fakeGateway(overrides: Partial<AiGateway> = {}): AiGateway {
  return {
    status: vi.fn(),
    scenarioFromText: vi.fn(async () => DRAFT),
    explainRecommendation: vi.fn(async () => ({
      markdown: '### Por que esta opção\nPorque alcança a entrega.',
      model: 'modelo-a',
      fallbackUsed: false,
    })),
    liftReport: vi.fn(async () => ({
      markdown: '# Relatório de içamento\n\n| Item | Valor |\n| --- | --- |\n| Raio | 9,2 m |',
      model: 'modelo-b',
      fallbackUsed: true,
    })),
    reviewRecording: vi.fn(async () => ({
      markdown: '# Revisão\n\nTudo registrado.',
      model: 'modelo-a',
      fallbackUsed: false,
    })),
    ...overrides,
  }
}

function withAi(gateway: AiGateway | null, children: ReactNode) {
  const value: AiContextValue =
    gateway === null
      ? AI_DISABLED
      : {
          enabled: true,
          status: {
            enabled: true,
            model: 'gemini-3.7-flash',
            fallbackModels: [],
            usageLimitPerHour: 20,
          },
          gateway,
        }
  return render(<AiContext.Provider value={value}>{children}</AiContext.Provider>)
}

afterEach(() => {
  cleanup()
  document.body.classList.remove('ai-printing')
  vi.restoreAllMocks()
})

describe('com a IA desligada', () => {
  it('nenhum controle do assistente aparece', () => {
    withAi(
      null,
      <>
        <AssistantButton onApply={vi.fn()} />
        <ExplainRecommendationButton recommendation={{ kind: 'single' }} />
        <LiftReportButton buildRequest={() => null} />
        <ReviewRecordingButton recordingId="g1" recordingName="Gravação" />
      </>,
    )

    expect(screen.queryByRole('button')).toBeNull()
  })
})

describe('Assistente', () => {
  it('descreve, vê a prévia, aplica e mostra qual modelo respondeu', async () => {
    const gateway = fakeGateway({
      scenarioFromText: vi.fn(async () => ({ ...DRAFT, fallbackUsed: true, model: 'reserva-x' })),
    })
    const onApply = vi.fn()
    withAi(gateway, <AssistantButton onApply={onApply} />)

    fireEvent.click(screen.getByRole('button', { name: 'Assistente' }))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Descreva a operação'), {
      target: { value: '  içar uma viga de 8 t  ' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Gerar cenário' }))

    await screen.findByLabelText('Prévia do cenário')
    expect(gateway.scenarioFromText).toHaveBeenCalledWith('içar uma viga de 8 t')
    expect(screen.getByText(/Carga: Viga FICTÍCIA, 8.000 kg/)).toBeTruthy()
    expect(screen.getByText('Largura estimada.')).toBeTruthy()
    expect(screen.getByTestId('ai-model-note').textContent).toMatch(/reserva-x.*modelo reserva/)
    expect(onApply).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Aplicar no simulador' }))

    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ model: 'reserva-x' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('não gera sem texto nem acima do limite', () => {
    const gateway = fakeGateway()
    withAi(gateway, <AssistantButton onApply={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Assistente' }))
    const generate = screen.getByRole('button', { name: 'Gerar cenário' }) as HTMLButtonElement
    expect(generate.disabled).toBe(true)

    fireEvent.change(screen.getByLabelText('Descreva a operação'), {
      target: { value: 'a'.repeat(1501) },
    })

    expect(generate.disabled).toBe(true)
    expect(screen.getByText('1501 / 1500')).toBeTruthy()
    expect(gateway.scenarioFromText).not.toHaveBeenCalled()
  })

  it('o exemplo preenche o campo', () => {
    withAi(fakeGateway(), <AssistantButton onApply={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Assistente' }))

    fireEvent.click(screen.getByRole('button', { name: 'Usar um exemplo' }))

    expect((screen.getByLabelText('Descreva a operação') as HTMLTextAreaElement).value).toMatch(
      /barracão/,
    )
  })

  it('mostra a mensagem amigável do servidor e deixa tentar de novo', async () => {
    const scenarioFromText = vi
      .fn<AiGateway['scenarioFromText']>()
      .mockRejectedValueOnce(
        new AuthRequestError(
          'AI_UNAVAILABLE',
          'O serviço de IA está sobrecarregado no momento. Tente de novo em alguns instantes.',
          503,
        ),
      )
      .mockResolvedValueOnce(DRAFT)
    withAi(fakeGateway({ scenarioFromText }), <AssistantButton onApply={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Assistente' }))
    fireEvent.change(screen.getByLabelText('Descreva a operação'), { target: { value: 'içar' } })

    fireEvent.click(screen.getByRole('button', { name: 'Gerar cenário' }))

    expect((await screen.findByRole('alert')).textContent).toMatch(/sobrecarregado/)
    fireEvent.click(screen.getByRole('button', { name: 'Gerar cenário' }))
    await screen.findByLabelText('Prévia do cenário')
    expect(scenarioFromText).toHaveBeenCalledTimes(2)
  })

  it('fica desligado durante a reprodução de uma gravação', () => {
    withAi(fakeGateway(), <AssistantButton onApply={vi.fn()} disabled />)

    expect((screen.getByRole('button', { name: 'Assistente' }) as HTMLButtonElement).disabled).toBe(
      true,
    )
  })
})

describe('Explicar', () => {
  it('manda a recomendação e o contexto e mostra o texto', async () => {
    const gateway = fakeGateway()
    withAi(
      gateway,
      <ExplainRecommendationButton
        recommendation={{ kind: 'single', max_limit_utilization_percent: 61 }}
        context={{ load: 8000 }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Explicar' }))

    await screen.findByText('Porque alcança a entrega.')
    expect(gateway.explainRecommendation).toHaveBeenCalledWith(
      { kind: 'single', max_limit_utilization_percent: 61 },
      { load: 8000 },
    )
    expect(screen.getByRole('heading', { name: 'Por que esta opção' })).toBeTruthy()
    // Explicação é só leitura: sem imprimir nem exportar.
    expect(screen.queryByRole('button', { name: 'Imprimir' })).toBeNull()
    fireEvent.click(screen.getAllByRole('button', { name: 'Fechar' }).at(-1) as HTMLElement)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

const REQUEST: AiLiftReportRequest = {
  evaluation: {
    configurationId: 'CFG-1',
    boomLengthM: 18,
    boomAngleDeg: 62,
    turretRotationDeg: 90,
    cableLengthM: 5,
    loadWeightKg: 8000,
  },
  load: { description: 'Viga', lengthM: 6, widthM: 0.4, heightM: 0.6 },
}

describe('Relatório de içamento', () => {
  it('fica desabilitado sem dados para o relatório', () => {
    const gateway = fakeGateway()
    withAi(gateway, <LiftReportButton buildRequest={() => null} />)

    const button = screen.getByRole('button', {
      name: 'Gerar relatório de içamento',
    }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    fireEvent.click(button)
    expect(gateway.liftReport).not.toHaveBeenCalled()
  })

  it('mostra o relatório com a tabela, prepara a impressão e exporta em .md', async () => {
    const gateway = fakeGateway()
    withAi(gateway, <LiftReportButton buildRequest={() => REQUEST} />)

    fireEvent.click(screen.getByRole('button', { name: 'Gerar relatório de içamento' }))

    const dialog = await screen.findByRole('dialog')
    await within(dialog).findByText('9,2 m')
    expect(gateway.liftReport).toHaveBeenCalledWith(REQUEST)
    // O título do diálogo e o título do próprio relatório.
    expect(within(dialog).getAllByRole('heading', { name: 'Relatório de içamento' })).toHaveLength(
      2,
    )
    expect(within(dialog).getByRole('table')).toBeTruthy()
    expect(within(dialog).getByTestId('ai-model-note').textContent).toMatch(/modelo-b.*reserva/)

    // Impressão: cópia própria no body e classe que esconde o resto do app no `@media print`.
    expect(document.body.classList.contains('ai-printing')).toBe(true)
    const printCopy = document.body.querySelector(':scope > .ai-print-root')
    expect(printCopy?.textContent).toContain('Relatório de içamento')
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Imprimir' }))
    expect(print).toHaveBeenCalledOnce()

    // Exportação: arquivo .md com o texto do relatório.
    let blob: Blob | null = null
    URL.createObjectURL = vi.fn((value: Blob | MediaSource) => {
      blob = value as Blob
      return 'blob:teste'
    })
    URL.revokeObjectURL = vi.fn()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Exportar .md' }))
    expect(click).toHaveBeenCalledOnce()
    const exported = blob as Blob | null
    expect(exported?.type).toMatch(/markdown/)
    expect(await exported?.text()).toContain('# Relatório de içamento')

    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Fechar' }).at(-1) as HTMLElement)
    expect(document.body.classList.contains('ai-printing')).toBe(false)
    expect(document.body.querySelector('.ai-print-root')).toBeNull()
  })

  it('"Gerar de novo" refaz a chamada', async () => {
    const gateway = fakeGateway()
    withAi(gateway, <LiftReportButton buildRequest={() => REQUEST} />)
    fireEvent.click(screen.getByRole('button', { name: 'Gerar relatório de içamento' }))
    await screen.findAllByText('9,2 m')

    fireEvent.click(screen.getByRole('button', { name: 'Gerar de novo' }))

    await waitFor(() => expect(gateway.liftReport).toHaveBeenCalledTimes(2))
  })
})

describe('Revisar gravação', () => {
  it('pede a revisão pelo id e mostra o texto', async () => {
    const gateway = fakeGateway()
    withAi(gateway, <ReviewRecordingButton recordingId="g-7" recordingName="Teste de içamento" />)

    fireEvent.click(screen.getByRole('button', { name: 'Revisar Teste de içamento' }))

    await within(screen.getByRole('dialog')).findByText('Tudo registrado.')
    expect(gateway.reviewRecording).toHaveBeenCalledWith('g-7')
    expect(screen.getByRole('dialog').textContent).toMatch(/Revisão da gravação Teste de içamento/)
  })
})
