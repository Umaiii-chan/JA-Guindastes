// Patolas (TASK-054), no navegador, com dados FICTÍCIOS. O modelo 3D atual não traz as patolas, então
// o teste cobre os controles, o aviso de "não prontas" e o envio de `outriggers` à avaliação; não há
// captura da cena com patolas.
//
// Catálogo e avaliação respondidos pelo próprio navegador (page.route).

import type { Route } from '@playwright/test'

import { expect, hasBackend, test } from './auth.js'
import { chooseConfiguration, fillValidLoad, mockCatalog } from './catalogMock.js'

interface SentBody {
  outriggers?: { extension_percent: number; jacks_set: boolean }
}

test.describe('patolas, no navegador (TASK-054)', () => {
  test.skip(hasBackend, 'com backend, o contrato é conferido nos testes do backend')

  test('estender, apoiar e nivelar avisam enquanto não prontas e vão à avaliação', async ({
    page,
  }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    const sent: SentBody[] = []
    await mockCatalog(page)
    await page.route('**/api/v1/evaluations', async (route: Route) => {
      sent.push(route.request().postDataJSON() as SentBody)
      await route.fulfill({
        json: {
          status: 'NOT_EVALUABLE',
          configuration_id: 'x',
          geometry: null,
          capacity: null,
          utilization_percent: null,
          load_chart_id: null,
          load_chart_version: null,
          reasons: [{ code: 'BOOM_LENGTH_ABOVE_CHART_MAX', category: 'EVALUATION' }],
        },
      })
    })
    await page.goto('/simulador')
    await chooseConfiguration(page)
    await page.getByRole('button', { name: 'Continuar para Carga' }).click()
    await fillValidLoad(page, '4000')
    await page.getByRole('button', { name: 'Continuar para Posição' }).click()

    const panel = page.getByRole('region', { name: 'Patolas' })
    await expect(panel.getByText('Patolas não prontas')).toBeVisible()
    await expect
      .poll(() => sent.some((body) => body.outriggers?.extension_percent === 0))
      .toBe(true)

    await panel.getByRole('button', { name: 'Estender' }).click()
    await expect(panel.getByText('Patolas não prontas')).toBeVisible()
    await expect
      .poll(() => sent.some((body) => body.outriggers?.extension_percent === 100))
      .toBe(true)

    await panel.getByRole('button', { name: 'Apoiar e nivelar' }).click()
    await expect(panel.getByText('Patolas prontas')).toBeVisible()
    await expect.poll(() => sent.some((body) => body.outriggers?.jacks_set === true)).toBe(true)

    await panel.getByRole('button', { name: 'Recolher' }).click()
    await expect(panel.getByText('Patolas não prontas')).toBeVisible()
    expect(pageErrors).toEqual([])
  })
})
