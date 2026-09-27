// HUD da avaliação com zona de giro e peso do gancho (TASK-046; CA-6), com respostas FICTÍCIAS.
// Tudo vem do backend: zona, gancho, peso comparado e utilização (RN-008).

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { mapEvaluationResponse } from '../../../src/infrastructure/api/evaluationRestClient'
import { parseServerMessage } from '../../../src/infrastructure/websocket/evaluationMessages'
import {
  BackendEvaluationPanel,
  type BackendEvaluationPanelProps,
} from '../../../src/presentation/panels/BackendEvaluationPanel'
import {
  REST_EVALUATED,
  REST_EVALUATED_ZONA,
  REST_NOT_EVALUABLE_ZONA,
  wsEvaluatedZona,
} from '../../fixtures/evaluationResponses'

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

describe('avaliação com zona de giro e gancho (TASK-046)', () => {
  it('REST e WebSocket leem a zona, o gancho e o peso comparado', () => {
    const rest = mapEvaluationResponse(REST_EVALUATED_ZONA)
    expect(rest).toMatchObject({
      rotationZoneCode: 'FRONTAL',
      rotationZoneName: 'Frontal FICTÍCIA',
      hookBlockWeightKg: 180,
      comparedWeightKg: 1680,
      utilizationPercent: 84,
    })
    const ws = parseServerMessage(JSON.stringify(wsEvaluatedZona(3)))
    expect(ws.kind).toBe('evaluated')
    expect(ws.kind === 'evaluated' && ws.result).toMatchObject({
      rotationZoneCode: 'LATERAL_TRASEIRA',
      rotationZoneName: 'Lateral e traseira FICTÍCIA',
      hookBlockWeightKg: 180,
      comparedWeightKg: 1680,
    })
  })

  it('o HUD mostra a zona atual e as parcelas carga + gancho = peso comparado', () => {
    const text = renderText({ result: mapEvaluationResponse(REST_EVALUATED_ZONA) })
    expect(text).toContain('Zona de giro Frontal FICTÍCIA')
    expect(text).toContain('Carga 1.500 kg + Gancho 180 kg = Peso comparado 1.680 kg')
    // A utilização é a do backend (84 %), não carga / capacidade (75 %).
    expect(text).toContain('Utilização 84,00 %')
    expect(text).toContain('Peso comparado (carga + gancho) 1.680 kg (gancho 180 kg)')
    expect(text).toContain('Zona de giro Frontal FICTÍCIA (FRONTAL)')
  })

  it('não avaliável por falta de tabela ativa na zona: mostra a zona nos motivos', () => {
    const text = renderText({ result: mapEvaluationResponse(REST_NOT_EVALUABLE_ZONA) })
    expect(text).toContain('Motivos (zona Lateral e traseira FICTÍCIA):')
    expect(text).toContain('ACTIVE_LOAD_CHART_NOT_FOUND (EVALUATION)')
  })

  it('sem zonas (resposta anterior à TASK-046): sem linha de zona, gancho e comparado "—"', () => {
    const text = renderText({ result: mapEvaluationResponse(REST_EVALUATED) })
    expect(text).not.toContain('Zona de giro')
    expect(text).toContain('Carga 1.500 kg + Gancho — = Peso comparado —')
  })
})
