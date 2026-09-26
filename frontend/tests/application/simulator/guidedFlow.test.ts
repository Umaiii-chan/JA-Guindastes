import { describe, expect, it } from 'vitest'

import { loadCatalogSummary } from '../../../src/application/catalog/catalogSummary'
import { evaluationStatus } from '../../../src/application/evaluation/evaluationStatus'
import {
  completedStepCount,
  guidedStepStatuses,
  nextStep,
  resolveActiveStep,
} from '../../../src/application/simulator/guidedSteps'
import { CatalogRequestError } from '../../../src/domain/catalog/catalog'
import { createCatalogRestClient } from '../../../src/infrastructure/api/catalogRestClient'
import { mapEvaluationResponse } from '../../../src/infrastructure/api/evaluationRestClient'
import { REST_EVALUATED, REST_NOT_EVALUABLE } from '../../fixtures/evaluationResponses'
import { catalogFicticio } from '../../fixtures/catalogFicticio'
import { createFakeCatalogFetch, jsonResponse } from '../../helpers/fakeCatalogFetch'

describe('passos do simulador guiado', () => {
  it('libera em sequência: só o primeiro por fazer fica "current"', () => {
    expect(
      guidedStepStatuses({ configurationChosen: false, loadValid: false, evaluated: false }),
    ).toEqual({ crane: 'current', load: 'pending', position: 'pending' })
    expect(
      guidedStepStatuses({ configurationChosen: true, loadValid: false, evaluated: false }),
    ).toEqual({ crane: 'complete', load: 'current', position: 'pending' })
    expect(
      guidedStepStatuses({ configurationChosen: true, loadValid: true, evaluated: false }),
    ).toEqual({ crane: 'complete', load: 'complete', position: 'current' })
    expect(
      guidedStepStatuses({ configurationChosen: true, loadValid: true, evaluated: true }),
    ).toEqual({ crane: 'complete', load: 'complete', position: 'complete' })
  })

  it('um passo anterior desfeito bloqueia os seguintes, mesmo que já estivessem feitos', () => {
    expect(
      guidedStepStatuses({ configurationChosen: false, loadValid: true, evaluated: true }),
    ).toEqual({ crane: 'current', load: 'pending', position: 'pending' })
  })

  it('o passo aberto volta ao primeiro por fazer quando o pedido está bloqueado', () => {
    const statuses = guidedStepStatuses({
      configurationChosen: true,
      loadValid: false,
      evaluated: false,
    })
    expect(resolveActiveStep(statuses, 'crane')).toBe('crane')
    expect(resolveActiveStep(statuses, 'load')).toBe('load')
    expect(resolveActiveStep(statuses, 'position')).toBe('load')
    const allDone = guidedStepStatuses({
      configurationChosen: true,
      loadValid: true,
      evaluated: true,
    })
    expect(resolveActiveStep(allDone, 'position')).toBe('position')
    expect(completedStepCount(allDone)).toBe(3)
  })

  it('nextStep segue a ordem e termina em null', () => {
    expect(nextStep('crane')).toBe('load')
    expect(nextStep('load')).toBe('position')
    expect(nextStep('position')).toBeNull()
  })
})

describe('situação do resultado (cor)', () => {
  const evaluatedAt = (utilization_percent: number) =>
    mapEvaluationResponse({ ...REST_EVALUATED, utilization_percent })

  it('até 100 % é ok (carga igual à capacidade conta como dentro, P-005); acima é over', () => {
    expect(evaluationStatus(evaluatedAt(75))).toBe('ok')
    expect(evaluationStatus(evaluatedAt(99.99))).toBe('ok')
    expect(evaluationStatus(evaluatedAt(100))).toBe('ok')
    expect(evaluationStatus(evaluatedAt(100.01))).toBe('over')
  })

  it('sem resultado ou "não avaliável" é unknown', () => {
    expect(evaluationStatus(null)).toBe('unknown')
    expect(evaluationStatus(mapEvaluationResponse(REST_NOT_EVALUABLE))).toBe('unknown')
  })
})

describe('resumo do catálogo (Início)', () => {
  it('conta fabricantes, guindastes, configurações e as com ficha', async () => {
    const client = createCatalogRestClient({ fetchFn: createFakeCatalogFetch(catalogFicticio()) })
    await expect(loadCatalogSummary(client)).resolves.toEqual({
      manufacturers: 2,
      cranes: 3,
      configurations: 3,
      configurationsWithSheet: 2,
    })
  })

  it('catálogo vazio dá zeros', async () => {
    const client = createCatalogRestClient({
      fetchFn: createFakeCatalogFetch({ manufacturers: [], cranes: [], configurations: [] }),
    })
    await expect(loadCatalogSummary(client)).resolves.toEqual({
      manufacturers: 0,
      cranes: 0,
      configurations: 0,
      configurationsWithSheet: 0,
    })
  })

  it('falha de uma lista rejeita com o erro do catálogo', async () => {
    const client = createCatalogRestClient({
      fetchFn: createFakeCatalogFetch(catalogFicticio(), (_method, path) =>
        path.endsWith('/configurations') ? jsonResponse({ detail: 'erro' }, 502) : undefined,
      ),
    })
    await expect(loadCatalogSummary(client)).rejects.toBeInstanceOf(CatalogRequestError)
  })
})
