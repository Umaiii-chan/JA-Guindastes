// BackendEvaluationPanel com o limite de capacidade do modelo (TASK-051; RN-011). FICTÍCIO.

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { mapEvaluationResponse } from '../../../src/infrastructure/api/evaluationRestClient'
import {
  BackendEvaluationPanel,
  type BackendEvaluationPanelProps,
} from '../../../src/presentation/panels/BackendEvaluationPanel'
import { REST_EVALUATED } from '../../fixtures/evaluationResponses'

const BASE: BackendEvaluationPanelProps = {
  result: null,
  error: null,
  pending: false,
  transport: null,
  inputProblem: null,
}

function render(level: 'OK' | 'WARNING' | 'OVER', utilization: number): string {
  const result = mapEvaluationResponse({
    ...REST_EVALUATED,
    capacity_limit: {
      limit_percent: 85,
      effective_capacity_kg: 1700,
      limit_utilization_percent: utilization,
      warning_band_percent: 90,
      level,
    },
  })
  return renderToStaticMarkup(createElement(BackendEvaluationPanel, { ...BASE, result }))
}

function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

describe('BackendEvaluationPanel — limite de capacidade do modelo', () => {
  it('mostra o limite e a capacidade efetiva', () => {
    const shown = text(render('OK', 60))

    expect(shown).toContain('Limite do modelo 85 %')
    expect(shown).toContain('Capacidade efetiva 1.700 kg')
    expect(shown).toContain('Utilização do limite 60,00 %')
    expect(shown).toContain('do limite de 85 %')
  })

  it('a situação segue o nível: verde, amarela e vermelha', () => {
    expect(text(render('OK', 60))).toContain('Dentro da capacidade')
    expect(text(render('WARNING', 95))).toContain('Perto do limite')
    expect(text(render('OVER', 120))).toContain('Acima da capacidade')
    expect(text(render('OVER', 120))).toContain('acima do limite')
  })

  it('o medidor desenha as faixas verde e amarela até a faixa de atenção', () => {
    const html = render('OK', 60)

    expect(html).toMatch(/band-ok/)
    expect(html).toMatch(/band-warning/)
    // A régua mede o peso contra a capacidade efetiva.
    expect(html).toContain('aria-valuetext="60,0 %')
  })

  it('sem capacityLimit, continua só a faixa verde e sem as métricas do limite', () => {
    const result = mapEvaluationResponse(REST_EVALUATED)
    const html = renderToStaticMarkup(createElement(BackendEvaluationPanel, { ...BASE, result }))

    expect(html).toMatch(/band-ok/)
    expect(html).not.toMatch(/band-warning/)
    expect(text(html)).not.toContain('Limite do modelo')
  })
})
