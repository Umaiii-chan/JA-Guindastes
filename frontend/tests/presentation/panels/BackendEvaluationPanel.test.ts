import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { mapEvaluationResponse } from '../../../src/infrastructure/api/evaluationRestClient'
import {
  BackendEvaluationPanel,
  type BackendEvaluationPanelProps,
  PROVISIONAL_MARK,
} from '../../../src/presentation/panels/BackendEvaluationPanel'
import { REST_EVALUATED, REST_NOT_EVALUABLE } from '../../fixtures/evaluationResponses'

const BASE: BackendEvaluationPanelProps = {
  connectionStatus: 'connected',
  result: null,
  error: null,
  pending: false,
  transport: null,
  inputProblem: null,
}

/** Texto visível do painel (sem as tags). */
function renderText(props: Partial<BackendEvaluationPanelProps>): string {
  const html = renderToStaticMarkup(createElement(BackendEvaluationPanel, { ...BASE, ...props }))
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

describe('BackendEvaluationPanel', () => {
  it('mostra o resultado avaliado com capacidade, utilização, ponto usado e a marca provisória', () => {
    const text = renderText({
      result: mapEvaluationResponse(REST_EVALUATED),
      transport: 'websocket',
    })

    expect(text).toContain(PROVISIONAL_MARK)
    expect(text).toContain('Avaliado')
    expect(text).toContain('Capacidade admissível 2.000 kg')
    expect(text).toContain('Utilização 75,00 %')
    expect(text).toContain('Ponto tabelado usado L 20,00 m · R 21,50 m · 2.000 kg')
    expect(text).toContain('Raio consultado 18,82 m')
    expect(text).toContain('conservadora provisória (ADR-015)')
    expect(text).toContain('LC-FICTICIO-AVALIACAO-001 (versão FICTICIO-AVALIACAO-v1)')
    expect(text).toContain('Recebida por WebSocket')
  })

  it('mostra "não avaliável" com os motivos e sem utilização', () => {
    const text = renderText({
      result: mapEvaluationResponse(REST_NOT_EVALUABLE),
      transport: 'rest',
    })

    expect(text).toContain('Não avaliável')
    expect(text).toContain('CRANE_GEOMETRY_NOT_FOUND (EVALUATION)')
    expect(text).toContain('ACTIVE_LOAD_CHART_NOT_FOUND (EVALUATION)')
    expect(text).not.toContain('Utilização')
    expect(text).toContain(PROVISIONAL_MARK)
  })

  it('exibe o erro com código, em role="alert"', () => {
    const html = renderToStaticMarkup(
      createElement(BackendEvaluationPanel, {
        ...BASE,
        error: { code: 'NETWORK_ERROR', message: 'Não foi possível falar com o backend.' },
      }),
    )

    expect(html).toContain('role="alert"')
    expect(html).toContain('Não foi possível falar com o backend.')
    expect(html).toContain('NETWORK_ERROR')
  })

  it('mostra o estado da conexão, o "atualizando" e o problema da entrada', () => {
    expect(renderText({ connectionStatus: 'reconnecting', pending: true })).toMatch(
      /reconectando.*atualizando/,
    )
    expect(renderText({ inputProblem: 'Informe a configuração.' })).toContain(
      'Informe a configuração.',
    )
  })

  it('não mostra nível de alerta (PEND-004)', () => {
    const text = renderText({
      result: mapEvaluationResponse({ ...REST_EVALUATED, utilization_percent: 150 }),
    })

    expect(text).toContain('Utilização 150,00 %')
    expect(text).not.toMatch(/WARNING|CRITICAL|NORMAL|crítico|atenção/i)
  })
})
