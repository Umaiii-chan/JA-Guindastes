// "Durante a simulação não retorna o resultado" (TASK-050), no navegador, com dados FICTÍCIOS.
// A avaliação FALSA imita a regra do ADR-029: lança entre colunas usa a próxima coluna mais longa.
//
// Catálogo e avaliação respondidos pelo próprio navegador (page.route). Exercita a TELA (slider livre
// com resultado e peso indo à avaliação sem o resto da carga), não a regra do backend.
//
// E2E_SCREENSHOT_DIR (opcional) grava a captura do simulador nessa pasta.

import type { Route } from '@playwright/test'

import { expect, hasBackend, test } from './auth.js'
import { chooseConfiguration, fillValidLoad, mockCatalog } from './catalogMock.js'

const SCREENSHOT_DIR = process.env.E2E_SCREENSHOT_DIR?.trim() ?? ''
const CHART_ID = 'LC-E2E-FICTICIA'
const TABULATED_LENGTHS = [12, 17, 22]

/** Avaliação FALSA (ADR-029): coluna igual ou a próxima mais longa; acima da maior, não avaliável. */
async function mockEvaluation(page: Parameters<typeof mockCatalog>[0], lengths: number[]) {
  await page.route('**/api/v1/evaluations', async (route: Route) => {
    const body = route.request().postDataJSON() as {
      configuration_id: string
      boom_length_m: number
      load_weight_kg: number
    }
    lengths.push(body.boom_length_m)
    const column = TABULATED_LENGTHS.find((length) => length >= body.boom_length_m - 1e-6)
    await route.fulfill({
      json:
        column !== undefined
          ? {
              status: 'EVALUATED',
              configuration_id: body.configuration_id,
              geometry: null,
              capacity: {
                maximum_capacity_kg: 8000,
                strategy: 'CONSERVATIVE_PROVISIONAL',
                queried_boom_length_m: body.boom_length_m,
                queried_working_radius_m: null,
                used_point: { boom_length_m: column, working_radius_m: 40, max_capacity_kg: 8000 },
              },
              utilization_percent: (body.load_weight_kg / 8000) * 100,
              load_chart_id: CHART_ID,
              load_chart_version: 'v1',
              reasons: [],
            }
          : {
              status: 'NOT_EVALUABLE',
              configuration_id: body.configuration_id,
              geometry: null,
              capacity: null,
              utilization_percent: null,
              load_chart_id: null,
              load_chart_version: null,
              reasons: [{ code: 'BOOM_LENGTH_ABOVE_CHART_MAX', category: 'EVALUATION' }],
            },
    })
  })
}

function hudMetric(page: Parameters<typeof mockCatalog>[0], label: string) {
  return page
    .getByRole('region', { name: /Avaliação/ })
    .locator(`dt:text-is("${label}") + dd`)
    .first()
}

test.describe('resultado da simulação, no navegador', () => {
  test.skip(hasBackend, 'com backend, a avaliação de verdade fica em evaluation.spec.ts')

  test('o peso sozinho já é avaliado e a lança livre continua avaliada entre colunas', async ({
    page,
  }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    const sentLengths: number[] = []
    await mockCatalog(page)
    await mockEvaluation(page, sentLengths)
    await page.goto('/simulador')

    await chooseConfiguration(page)
    await page.getByRole('button', { name: 'Continuar para Carga' }).click()
    // Só o peso: antes da TASK-050 a avaliação esperava a carga inteira (L-009).
    await page.getByRole('region', { name: 'Carga' }).getByLabel('Peso (kg)').fill('4000')
    await expect(hudMetric(page, 'Capacidade')).toHaveText('8.000 kg', { timeout: 15_000 })

    await fillValidLoad(page, '4000')
    await page.getByRole('button', { name: 'Continuar para Posição' }).click()
    const boom = page.getByLabel('Comprimento da lança')
    await expect(boom).toBeEnabled()

    // A lança anda livre, de 0,1 em 0,1 m, e o resultado continua chegando entre as colunas.
    await boom.focus()
    await boom.press('Home')
    await boom.press('ArrowRight')
    await boom.press('ArrowRight')
    await expect(boom).toHaveValue('10.2')
    await expect(hudMetric(page, 'Capacidade')).toHaveText('8.000 kg')
    await expect.poll(() => sentLengths.some((length) => Math.abs(length - 10.2) < 1e-6)).toBe(true)

    if (SCREENSHOT_DIR) {
      await page.screenshot({ path: `${SCREENSHOT_DIR}/simulador-lanca-livre.png` })
    }
    expect(pageErrors).toEqual([])
  })
})
