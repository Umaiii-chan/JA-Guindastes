// Patolas (TASK-054), no navegador, com dados FICTÍCIOS. O teste cobre os controles, o aviso de
// "não prontas" e o envio de `outriggers` à avaliação; não há captura da cena com patolas.
//
// Desde a TASK-093 (F-27), o aviso e o estado enviado seguem o que a animação da cena já alcançou
// (vigas em 3 s, macacos em 1,5 s, nivelamento em 2 s), não o comando. Sem GPU, a cena roda no
// SwiftShader e cada quadro avança no máximo 0,1 s de animação, então as esperas que dependem dela
// têm folga de ANIMATION_TIMEOUT_MS.
//
// Catálogo e avaliação respondidos pelo próprio navegador (page.route).

import type { Route } from '@playwright/test'

import { expect, hasBackend, test } from './auth.js'
import { chooseConfiguration, fillValidLoad, mockCatalog } from './catalogMock.js'

/** Folga para a animação das patolas chegar ao comando no SwiftShader (até ~6,5 s com GPU). */
const ANIMATION_TIMEOUT_MS = 20_000

interface SentBody {
  outriggers?: { extension_percent: number; jacks_set: boolean }
}

test.describe('patolas, no navegador', () => {
  test.skip(hasBackend, 'com backend, o contrato é conferido nos testes do servidor')

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
    // A extensão de 100 % só vai à avaliação quando as vigas chegam lá no desenho (3 s).
    await expect
      .poll(() => sent.some((body) => body.outriggers?.extension_percent === 100), {
        timeout: ANIMATION_TIMEOUT_MS,
      })
      .toBe(true)

    await panel.getByRole('button', { name: 'Apoiar e nivelar' }).click()
    // O comando já pede patolas prontas, mas os macacos ainda descem: segue "não prontas".
    await expect(panel.getByText(/em movimento/)).toBeVisible()
    await expect(panel.getByText('Patolas não prontas')).toBeVisible()
    await expect(panel.getByText('Patolas prontas')).toBeVisible({ timeout: ANIMATION_TIMEOUT_MS })
    await expect.poll(() => sent.some((body) => body.outriggers?.jacks_set === true)).toBe(true)

    // Recolher deixa de valer na hora, sem esperar a animação.
    await panel.getByRole('button', { name: 'Recolher' }).click()
    await expect(panel.getByText('Patolas não prontas')).toBeVisible()
    expect(pageErrors).toEqual([])
  })
})
