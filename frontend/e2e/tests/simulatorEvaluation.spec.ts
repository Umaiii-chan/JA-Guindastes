// "Durante a simulação não retorna o resultado" (TASK-050), no navegador, com dados FICTÍCIOS.
//
// Catálogo, tabela ativa e avaliação respondidos pelo próprio navegador (page.route). A avaliação
// FALSA imita a regra do backend que causava o problema: só avalia um comprimento de lança que seja
// coluna da tabela (ADR-015; known-gaps L-004). Exercita a TELA (slider encaixando nas colunas e o
// peso indo à avaliação sem o resto da carga), não a regra do backend.
//
// E2E_SCREENSHOT_DIR (opcional) grava a captura do simulador nessa pasta.

import type { Route } from '@playwright/test'

import { expect, hasBackend, test } from './auth.js'
import { chooseConfiguration, FICTICIO, fillValidLoad, mockCatalog } from './catalogMock.js'

const SCREENSHOT_DIR = process.env.E2E_SCREENSHOT_DIR?.trim() ?? ''
const CHART_ID = 'LC-E2E-FICTICIA'
const TABULATED_LENGTHS = [12, 17, 22]

async function mockActiveChart(page: Parameters<typeof mockCatalog>[0]): Promise<void> {
  await page.route('**/api/v1/configurations/*/load-charts', (route) =>
    route.fulfill({
      json: {
        items: [],
        active_chart_id: CHART_ID,
        active_charts: [{ rotation_zone_code: null, chart_id: CHART_ID }],
      },
    }),
  )
  await page.route(`**/api/v1/load-charts/${CHART_ID}`, (route) =>
    route.fulfill({
      json: {
        chart_id: CHART_ID,
        version: 'v1',
        configuration_id: FICTICIO.configurationId,
        status: 'ACTIVE',
        point_count: TABULATED_LENGTHS.length * 2,
        points: TABULATED_LENGTHS.flatMap((length) => [
          { boom_length_m: length, working_radius_m: 3, max_capacity_kg: 8000 },
          { boom_length_m: length, working_radius_m: 40, max_capacity_kg: 8000 },
        ]),
        source: { file_name: 'tabela-ficticia-e2e.csv' },
        rotation_zone_code: null,
      },
    }),
  )
}

/** Avaliação FALSA: "não avaliável" fora das colunas, capacidade FICTÍCIA de 8.000 kg nelas. */
async function mockEvaluation(page: Parameters<typeof mockCatalog>[0], lengths: number[]) {
  await page.route('**/api/v1/evaluations', async (route: Route) => {
    const body = route.request().postDataJSON() as {
      configuration_id: string
      boom_length_m: number
      load_weight_kg: number
    }
    lengths.push(body.boom_length_m)
    const tabulated = TABULATED_LENGTHS.includes(body.boom_length_m)
    await route.fulfill({
      json: tabulated
        ? {
            status: 'EVALUATED',
            configuration_id: body.configuration_id,
            geometry: null,
            capacity: {
              maximum_capacity_kg: 8000,
              strategy: 'CONSERVATIVE_PROVISIONAL',
              queried_boom_length_m: body.boom_length_m,
              queried_working_radius_m: null,
              used_point: null,
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
            reasons: [{ code: 'BOOM_LENGTH_NOT_IN_CHART', category: 'EVALUATION' }],
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

test.describe('resultado da simulação, no navegador (TASK-050)', () => {
  test.skip(hasBackend, 'com backend, a avaliação de verdade fica em evaluation.spec.ts')

  test('o peso sozinho já é avaliado e a lança encaixa nas colunas da tabela', async ({ page }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    const sentLengths: number[] = []
    await mockCatalog(page)
    await mockActiveChart(page)
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
    await expect(
      page.getByText('Encaixa nos comprimentos da tabela ativa: 12 · 17 · 22 m.'),
    ).toBeVisible()

    // A seta (passo de 0,1 m) leva à próxima coluna, não a um comprimento sem tabela.
    await boom.focus()
    await boom.press('Home')
    await expect(boom).toHaveValue('12')
    await boom.press('ArrowRight')
    await expect(boom).toHaveValue('17')
    await boom.press('End')
    await expect(boom).toHaveValue('22')
    await boom.press('ArrowLeft')
    await expect(boom).toHaveValue('17')

    await expect(hudMetric(page, 'Capacidade')).toHaveText('8.000 kg')
    expect(sentLengths.length).toBeGreaterThan(0)
    expect(sentLengths.every((length) => TABULATED_LENGTHS.includes(length))).toBe(true)
    if (SCREENSHOT_DIR) {
      await page.screenshot({ path: `${SCREENSHOT_DIR}/simulador-lanca-tabelada.png` })
    }
    expect(pageErrors).toEqual([])
  })
})
