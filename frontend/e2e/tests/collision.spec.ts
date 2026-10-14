// Colisões da carga (TASK-053; RN-012), com catálogo FICTÍCIO respondido no navegador. Sem backend:
// a colisão é da cena. Baixar o cabo até a carga tocar o chão para o cabo e mostra o alerta.
//
// E2E_SCREENSHOT_DIR (opcional) grava a captura nessa pasta.

import type { Page } from '@playwright/test'

import { expect, test } from './auth.js'
import { chooseConfiguration, fillValidLoad, mockCatalog } from './catalogMock.js'

const SCREENSHOT_DIR = process.env.E2E_SCREENSHOT_DIR?.trim() ?? ''

function metersOf(text: string | null): number {
  return Number.parseFloat((text ?? '').replace(/\./g, '').replace(',', '.'))
}

async function openPositionStep(page: Page): Promise<void> {
  await mockCatalog(page)
  await page.goto('/simulador')
  await chooseConfiguration(page)
  await page.getByRole('button', { name: 'Continuar para Carga' }).click()
  await fillValidLoad(page)
  await page.getByRole('button', { name: 'Continuar para Posição' }).click()
  await expect(page.getByLabel('Comprimento do cabo')).toBeEnabled()
}

test('baixar o cabo até a carga tocar o chão para o cabo e mostra o alerta de colisão', async ({
  page,
}) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await openPositionStep(page)
  const cable = page.getByLabel('Comprimento do cabo')
  const hookHeight = page
    .getByRole('region', { name: /Geometria/ })
    .locator('dt:text-is("Altura do gancho") + dd')

  // Sobe o cabo e a lança para a carga ficar solta, longe de tudo.
  await cable.focus()
  await cable.press('Home')
  await expect(page.getByRole('group', { name: 'Colisões' })).toHaveCount(0)

  // Vai ao máximo (40 m): o gancho iria bem abaixo do chão, então o cabo para no contato.
  await cable.press('End')

  await expect(
    page.getByRole('alert').filter({ hasText: 'Colisão: comando bloqueado' }),
  ).toBeVisible()
  await expect(page.getByText('A carga atingiria o terreno.')).toBeVisible()
  const height = metersOf(await hookHeight.textContent())
  // Carga de 2 m de altura pendurada por lingas: o gancho para acima do chão, nunca abaixo dele.
  expect(height).toBeGreaterThan(2)
  expect(height).toBeLessThan(8)
  if (SCREENSHOT_DIR) await page.screenshot({ path: `${SCREENSHOT_DIR}/colisao-cabo-no-chao.png` })

  // Soltar a carga do chão (cabo curto) limpa o alerta.
  await cable.press('Home')
  await expect(page.getByRole('group', { name: 'Colisões' })).toHaveCount(0)
  expect(pageErrors).toEqual([])
})
