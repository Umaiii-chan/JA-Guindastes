// @vitest-environment jsdom
// Cartão de resultado: recomenda 2 guindastes quando um só não atende (TASK-120; ADR-053).

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { mapEvaluationResponse } from '../../../src/infrastructure/api/evaluationRestClient'
import { BackendEvaluationPanel } from '../../../src/presentation/panels/BackendEvaluationPanel'
import {
  type SimulatorLayout,
  SimulatorLayoutContext,
} from '../../../src/presentation/simulator/layout/simulatorLayout'
import { REST_EVALUATED, REST_NOT_EVALUABLE } from '../../fixtures/evaluationResponses'

const TITLE = 'Recomendamos operar com 2 guindastes'

function renderCard(response: object, layout: SimulatorLayout | null) {
  return render(
    <SimulatorLayoutContext.Provider value={layout}>
      <BackendEvaluationPanel
        result={mapEvaluationResponse(response as typeof REST_EVALUATED)}
        error={null}
        pending={false}
        transport="rest"
        inputProblem={null}
      />
    </SimulatorLayoutContext.Provider>,
  )
}

function layoutWith(openSheet = vi.fn()): SimulatorLayout {
  return { activeSheet: null, openSheet, closeSheet: vi.fn() }
}

describe('cartão de resultado com um guindaste que não atende', () => {
  it('acima da capacidade: recomenda 2 guindastes e o botão abre a folha Planejar', () => {
    const openSheet = vi.fn()
    renderCard({ ...REST_EVALUATED, utilization_percent: 140 }, layoutWith(openSheet))

    expect(screen.getByText(TITLE)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Planejar com 2 guindastes' }))
    expect(openSheet).toHaveBeenCalledWith('planning')
  })

  it('raio além da tabela (não avaliável): recomenda 2 guindastes', () => {
    renderCard(
      {
        ...REST_NOT_EVALUABLE,
        reasons: [{ code: 'RADIUS_ABOVE_CHART_MAX', category: 'CAPACITY' }],
      },
      layoutWith(),
    )
    expect(screen.getByText(TITLE)).toBeTruthy()
  })

  it('dentro da capacidade: não recomenda', () => {
    renderCard(REST_EVALUATED, layoutWith())
    expect(screen.queryByText(TITLE)).toBeNull()
  })

  it('não avaliável por falta de tabela: dois guindastes não resolvem, não recomenda', () => {
    renderCard(REST_NOT_EVALUABLE, layoutWith())
    expect(screen.queryByText(TITLE)).toBeNull()
  })

  it('fora do simulador (sem folhas), não mostra o botão sem destino', () => {
    renderCard({ ...REST_EVALUATED, utilization_percent: 140 }, null)
    expect(screen.queryByText(TITLE)).toBeNull()
  })
})
