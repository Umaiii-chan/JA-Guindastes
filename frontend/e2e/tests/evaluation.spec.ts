// Avaliação respondida pelo backend através do proxy /api (TASK-036). Precisa da stack com backend:
// os testes só rodam com E2E_BACKEND=1 (job "E2E" do CI) e são PULADOS, nunca aprovados em falso,
// quando ela não está disponível.

import { expect, type Page, test } from '@playwright/test'

const hasBackend = process.env.E2E_BACKEND === '1'
const seedConfigurationId = process.env.E2E_SEED_CONFIGURATION_ID?.trim() ?? ''

// Reasons do backend quando a configuração ou a tabela ativa não existem (evaluate_operation.py).
const MISSING_DATA_REASONS = ['CRANE_GEOMETRY_NOT_FOUND', 'ACTIVE_LOAD_CHART_NOT_FOUND']

async function requestEvaluation(page: Page, configurationId: string, loadWeightKg: string) {
  await page.goto('/')
  await expect(page.getByLabel('Inclinação da lança')).toBeEnabled()
  await page.getByLabel('Configuração (configuration_id)').fill(configurationId)
  await page.getByLabel('Peso da carga (kg)').fill(loadWeightKg)
  return page.getByRole('region', { name: /Avaliação/ })
}

test.describe('avaliação pelo backend', () => {
  test.skip(!hasBackend, 'precisa da stack com backend atrás de /api (defina E2E_BACKEND=1)')

  test('sem dados cadastrados para a configuração, a avaliação responde "não avaliável"', async ({
    page,
  }) => {
    // Id que nenhum seed usa: a resposta independe do que houver no banco.
    const panel = await requestEvaluation(page, 'e2e-configuracao-inexistente-FICTICIO', '1000')

    await expect(panel.getByText('Não avaliável', { exact: true })).toBeVisible({
      timeout: 15_000,
    })
    await expect(panel.locator('code', { hasText: 'CRANE_GEOMETRY_NOT_FOUND' })).toBeVisible()
    await expect(panel.getByText(/^Recebida por (WebSocket|REST)\.$/)).toBeVisible()
    await expect(panel.getByRole('alert')).toHaveCount(0)
  })

  test('com os dados semeados, a avaliação usa a configuração e a tabela ativa', async ({
    page,
  }) => {
    // Seed da TASK-035: o id da configuração semeada vem do ambiente, nunca fixado aqui.
    test.skip(
      seedConfigurationId === '',
      'fluxo com dados semeados: defina E2E_SEED_CONFIGURATION_ID (seed da TASK-035)',
    )
    const panel = await requestEvaluation(page, seedConfigurationId, '1000')

    const verdict = panel.getByText(/^(Avaliado|Não avaliável)$/)
    await expect(verdict).toBeVisible({ timeout: 15_000 })
    await expect(panel.getByRole('alert')).toHaveCount(0)
    // Com dado semeado, o backend não pode alegar configuração ou tabela ausentes.
    for (const reason of MISSING_DATA_REASONS) {
      await expect(panel.locator('code', { hasText: reason })).toHaveCount(0)
    }
  })
})
