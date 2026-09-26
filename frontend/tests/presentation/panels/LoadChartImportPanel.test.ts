import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { LoadChartGateway } from '../../../src/application/loadChart/ports'
import { EMPTY_LOAD_FORM } from '../../../src/application/load/loadForm'
import {
  createLoadChartRestClient,
  LoadChartClientError,
} from '../../../src/infrastructure/api/loadChartRestClient'
import {
  LoadChartImportPanel,
  LoadChartImportReport,
  type LoadChartImportReportProps,
} from '../../../src/presentation/panels/LoadChartImportPanel'
import { LoadPanel } from '../../../src/presentation/panels/LoadPanel'
import {
  ACTIVATED_FIRST,
  ACTIVATED_SUPERSEDING,
  IMPORTED_DRAFT,
  INVALID_REPORT,
} from '../../fixtures/loadChartResponses'

const REQUEST = {
  file: new Blob(['FICTÍCIO']),
  fileName: 'tabela-ficticia.csv',
  configurationId: 'CFG-FICTICIA',
  chartId: 'TAB-FICTICIA-1',
  version: 'v2',
}

const BASE: LoadChartImportReportProps = {
  formProblems: [],
  outcome: null,
  activation: null,
  error: null,
  busy: null,
}

function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function renderReport(props: Partial<LoadChartImportReportProps>): string {
  return renderToStaticMarkup(createElement(LoadChartImportReport, { ...BASE, ...props }))
}

/** Gateway REST com `fetch` falso que responde sempre `body` com `status`. */
function gatewayAnswering(body: unknown, status: number): LoadChartGateway {
  return createLoadChartRestClient({
    fetchFn: async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
  })
}

describe('LoadChartImportReport', () => {
  it('201: mostra status DRAFT, os pontos e o botão Ativar', async () => {
    const outcome = await gatewayAnswering(IMPORTED_DRAFT, 201).importChart(REQUEST)

    const html = renderReport({ outcome })
    const visible = text(html)

    expect(visible).toContain('Tabela importada com status DRAFT')
    expect(visible).toContain('2 ponto(s) importado(s)')
    expect(visible).toContain('15,5')
    expect(visible).toContain('5.000')
    expect(html).toMatch(/<button[^>]*>Ativar<\/button>/)
  })

  it('422: mostra o relatório com linha, coluna, código e mensagem, sem botão Ativar', async () => {
    const outcome = await gatewayAnswering(INVALID_REPORT, 422).importChart(REQUEST)

    const html = renderReport({ outcome })
    const visible = text(html)

    expect(visible).toContain('status INVALID')
    expect(visible).toContain('Relatório de inconsistências (2)')
    expect(visible).toContain('Linha Coluna Código Mensagem')
    expect(visible).toContain('— max_capacity_kg MISSING_COLUMN Coluna obrigatória ausente')
    expect(visible).toContain('3 working_radius_m INVALID_NUMBER Valor não numérico')
    expect(html).not.toContain('Ativar')
  })

  it('415: mostra a mensagem clara do erro', async () => {
    const error = await gatewayAnswering({ detail: 'formato não suportado' }, 415)
      .importChart(REQUEST)
      .catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(LoadChartClientError)

    const visible = text(renderReport({ error: error as LoadChartClientError }))

    expect(visible).toContain(
      'Formato de arquivo não reconhecido (HTTP 415): envie um CSV ou XLSX.',
    )
  })

  it('ativação: mostra a tabela ACTIVE e a substituída como SUPERSEDED', async () => {
    const outcome = await gatewayAnswering(IMPORTED_DRAFT, 201).importChart(REQUEST)
    const activation = await gatewayAnswering(ACTIVATED_SUPERSEDING, 200).activateChart(
      'TAB-FICTICIA-1',
    )

    const html = renderReport({ outcome, activation })
    const visible = text(html)

    expect(visible).toContain('Tabela ativada: status ACTIVE')
    expect(visible).toContain('Tabela substituída: TAB-FICTICIA-0 — agora SUPERSEDED')
    expect(html).not.toContain('>Ativar<')
  })

  it('ativação sem tabela anterior: diz que nenhuma foi substituída', async () => {
    const activation = await gatewayAnswering(ACTIVATED_FIRST, 200).activateChart('TAB-FICTICIA-1')

    expect(text(renderReport({ activation }))).toContain('nenhuma foi substituída')
  })

  it('mostra os problemas do formulário antes de enviar', () => {
    expect(text(renderReport({ formProblems: ['Informe a versão da tabela.'] }))).toContain(
      'Informe a versão da tabela.',
    )
  })
})

describe('LoadChartImportPanel', () => {
  const gateway = gatewayAnswering(IMPORTED_DRAFT, 201)

  it('usa a configuração recebida por prop, sem campo próprio', () => {
    const visible = text(
      renderToStaticMarkup(
        createElement(LoadChartImportPanel, { gateway, configurationId: 'CFG-FICTICIA' }),
      ),
    )

    expect(visible).toContain('Configuração: CFG-FICTICIA')
    expect(visible).not.toContain('Configuração (configuration_id)')
  })

  it('sem a prop, mostra o campo de configuração', () => {
    const visible = text(renderToStaticMarkup(createElement(LoadChartImportPanel, { gateway })))

    expect(visible).toContain('Configuração (configuration_id)')
    expect(visible).toContain('Arquivo (CSV ou XLSX)')
  })
})

describe('LoadPanel', () => {
  it('mostra as validações provisórias da carga', () => {
    const visible = text(
      renderToStaticMarkup(
        createElement(LoadPanel, {
          values: { ...EMPTY_LOAD_FORM, weightKg: '0', lengthM: '1', cgAlongLengthM: '0.6' },
          onChange: () => undefined,
        }),
      ),
    )

    expect(visible).toContain('O peso deve ser um número maior que zero (kg).')
    expect(visible).toContain('Centro de gravidade fora da carga ao longo do comprimento')
    expect(visible).toContain('a avaliação aguarda uma carga válida')
  })

  it('carga válida: informa o peso que vai para a avaliação', () => {
    const visible = text(
      renderToStaticMarkup(
        createElement(LoadPanel, {
          values: {
            ...EMPTY_LOAD_FORM,
            description: 'Bloco fictício',
            weightKg: '1500',
            lengthM: '4',
            widthM: '2',
            heightM: '1',
          },
          onChange: () => undefined,
        }),
      ),
    )

    expect(visible).toContain('Carga válida: 1.500 kg vão para a avaliação.')
  })
})
