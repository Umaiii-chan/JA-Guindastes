// Avaliação respondida pelo backend através do proxy /api (TASK-036, adaptado às telas das
// TASK-033/034 e ao simulador guiado da TASK-039). Precisa da stack com backend: os testes só rodam
// com E2E_BACKEND=1 (job "E2E" do CI) e são PULADOS, nunca aprovados em falso, quando ela não está
// disponível.

import { expect, test } from '@playwright/test'

import { chooseConfiguration, fillValidLoad } from './catalogMock.js'

const hasBackend = process.env.E2E_BACKEND === '1'
// Ids do seed FICTÍCIO da TASK-035 (backend/app/demo_seed.py), informados pelo ambiente do CI.
const seed = {
  manufacturerId: process.env.E2E_SEED_MANUFACTURER_ID?.trim() ?? '',
  craneId: process.env.E2E_SEED_CRANE_ID?.trim() ?? '',
  configurationId: process.env.E2E_SEED_CONFIGURATION_ID?.trim() ?? '',
}

// Reasons do backend quando a configuração ou a tabela ativa não existem (evaluate_operation.py).
const MISSING_DATA_REASONS = ['CRANE_GEOMETRY_NOT_FOUND', 'ACTIVE_LOAD_CHART_NOT_FOUND']

test.describe('avaliação pelo backend', () => {
  test.skip(!hasBackend, 'precisa da stack com backend atrás de /api (defina E2E_BACKEND=1)')

  test('o catálogo carrega do backend e, sem configuração escolhida, a avaliação não é enviada', async ({
    page,
  }) => {
    await page.goto('/simulador')
    const catalog = page.getByRole('region', { name: 'Guindaste e configuração' })
    await expect(catalog.getByLabel('Fabricante')).toBeVisible()
    await expect(catalog.getByRole('alert')).toHaveCount(0)
    await expect(
      page
        .getByRole('region', { name: /Avaliação/ })
        .getByText('Escolha a configuração (fabricante → guindaste → configuração) para avaliar.'),
    ).toBeVisible()
  })

  test('com os dados semeados, a avaliação usa a configuração e a tabela ativa', async ({
    page,
  }) => {
    test.skip(
      !seed.manufacturerId || !seed.craneId || !seed.configurationId,
      'fluxo com dados semeados: defina E2E_SEED_MANUFACTURER_ID, E2E_SEED_CRANE_ID e E2E_SEED_CONFIGURATION_ID (seed da TASK-035)',
    )
    await page.goto('/simulador')
    await chooseConfiguration(page, seed)
    await page.getByRole('button', { name: 'Continuar para Carga' }).click()
    await fillValidLoad(page)
    await page.getByRole('button', { name: 'Continuar para Posição' }).click()

    const panel = page.getByRole('region', { name: /Avaliação/ })
    // O backend respondeu com a configuração e a tabela ativa: "Avaliado" ou, fora do alcance da
    // tabela, "Não avaliável" por outro motivo, nunca por falta de dados.
    await expect(panel.getByText(/^(Avaliado|Não avaliável)$/)).toBeVisible({ timeout: 15_000 })
    await expect(panel.getByRole('alert')).toHaveCount(0)
    for (const reason of MISSING_DATA_REASONS) {
      await expect(panel.locator('code', { hasText: reason })).toHaveCount(0)
    }
  })
})
