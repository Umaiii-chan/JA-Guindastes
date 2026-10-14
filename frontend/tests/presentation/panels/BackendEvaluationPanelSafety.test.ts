// HUD da avaliação com o selo de risco de tombamento e os alertas (TASK-055; RN-013), com
// respostas FICTÍCIAS. O risco e as mensagens vêm do backend (RN-008).

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
  loadWeightKg: 1500,
}

function renderText(props: Partial<BackendEvaluationPanelProps>): string {
  return renderToStaticMarkup(createElement(BackendEvaluationPanel, { ...BASE, ...props }))
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const withSafety = (tippingRisk: string | null, alerts: unknown[]) =>
  mapEvaluationResponse({ ...REST_EVALUATED, tipping_risk: tippingRisk, alerts })

describe('selo de risco e alertas no HUD (TASK-055)', () => {
  it.each([
    ['LOW', 'Risco de tombamento: baixo'],
    ['ATTENTION', 'Risco de tombamento: atenção'],
    ['HIGH', 'Risco de tombamento: alto'],
  ])('mostra o selo do risco %s', (risk, label) => {
    expect(renderText({ result: withSafety(risk, []) })).toContain(label)
  })

  it('lista os alertas com a gravidade e a mensagem do backend', () => {
    const text = renderText({
      result: withSafety('HIGH', [
        {
          code: 'OUTRIGGERS_NOT_READY',
          severity: 'CRITICAL',
          message: 'Patolas a 50 %: a tabela exige patolas totalmente estendidas.',
        },
        {
          code: 'GROUND_SLOPE_NOT_INFORMED',
          severity: 'INFO',
          message: 'Inclinação do terreno não informada.',
        },
      ]),
    })

    expect(text).toContain('Crítico Patolas a 50 %: a tabela exige patolas totalmente estendidas.')
    expect(text).toContain('Informação Inclinação do terreno não informada.')
  })

  it('sem risco nem alertas (backend anterior), nada aparece', () => {
    const text = renderText({ result: mapEvaluationResponse(REST_EVALUATED) })

    expect(text).not.toContain('Risco de tombamento')
    expect(text).not.toContain('Informação')
  })

  it('com erro ou problema de entrada, o selo e os alertas somem', () => {
    const result = withSafety('HIGH', [{ code: 'X', severity: 'CRITICAL', message: 'Alerta X' }])

    expect(renderText({ result, inputProblem: 'Escolha a configuração.' })).not.toContain(
      'Risco de tombamento',
    )
    expect(
      renderText({ result, error: { code: 'NETWORK_ERROR', message: 'Falha de rede.' } }),
    ).not.toContain('Alerta X')
  })
})
