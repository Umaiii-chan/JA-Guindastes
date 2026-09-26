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
    // O medidor continua na tela (rótulo "Utilização"), mas sem valor (TASK-039).
    expect(text).not.toMatch(/Utilização \d/)
    expect(text).toContain('sem utilização')
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

  it('mostra o "atualizando" e o problema da entrada (a conexão fica na barra de status)', () => {
    expect(renderText({ pending: true })).toContain('atualizando')
    const waiting = renderText({ inputProblem: 'Informe a configuração.' })
    expect(waiting).toContain('Informe a configuração.')
    expect(waiting).toContain('Sem avaliação')
  })

  it('não mostra nível de alerta (PEND-004)', () => {
    const text = renderText({
      result: mapEvaluationResponse({ ...REST_EVALUATED, utilization_percent: 150 }),
    })

    expect(text).toContain('Utilização 150,00 %')
    expect(text).not.toMatch(/WARNING|CRITICAL|NORMAL|crítico|atenção/i)
  })

  it('situação com cor: abaixo, igual e acima de 100 % e "não avaliável" (TASK-039)', () => {
    const situation = (props: Partial<BackendEvaluationPanelProps>) =>
      renderToStaticMarkup(createElement(BackendEvaluationPanel, { ...BASE, ...props })).match(
        /data-tone="(\w+)"[^>]*>(?:<span[^>]*><\/span>)?<span>([^<]+)</,
      )
    const at = (utilization_percent: number) =>
      mapEvaluationResponse({ ...REST_EVALUATED, utilization_percent })

    expect(situation({ result: at(75) })?.slice(1)).toEqual(['ok', 'Dentro da capacidade'])
    expect(situation({ result: at(100) })?.slice(1)).toEqual(['warning', 'No limite da capacidade'])
    expect(situation({ result: at(150) })?.slice(1)).toEqual(['danger', 'Acima da capacidade'])
    expect(situation({ result: mapEvaluationResponse(REST_NOT_EVALUABLE) })?.slice(1)).toEqual([
      'neutral',
      'Não avaliável',
    ])
  })

  it('mostra a carga enviada ao lado da capacidade e o medidor com a utilização', () => {
    const html = renderToStaticMarkup(
      createElement(BackendEvaluationPanel, {
        ...BASE,
        result: mapEvaluationResponse(REST_EVALUATED),
        loadWeightKg: 1500,
      }),
    )
    expect(html).toMatch(/role="meter"[^>]*aria-valuenow="75"/)
    expect(html.replace(/<[^>]+>/g, ' ')).toMatch(/Carga\s+1\.500 kg/)
  })
})
