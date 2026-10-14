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
  // O GLB do guindaste (4 MB, TASK-064) pode chegar depois dos comandos; ao trocar o modelo a cena
  // reavalia a colisão e apaga o alerta. Espera o arquivo chegar antes de comandar.
  const modelResponse = page.waitForResponse((response) =>
    response.url().includes('guindaste-80t.glb'),
  )
  await page.goto('/simulador')
  await chooseConfiguration(page)
  await page.getByRole('button', { name: 'Continuar para Carga' }).click()
  await fillValidLoad(page)
  await page.getByRole('button', { name: 'Continuar para Posição' }).click()
  await expect(page.getByLabel('Comprimento do cabo')).toBeEnabled()
  await modelResponse
  await page.waitForTimeout(1500) // interpretar o GLB e trocar o guindaste
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
  // O cabo parou antes do máximo, e o aviso «comando bloqueado» fica visível (TASK-069: ele dura 2 s
  // mesmo quando o controle de deslizar reenvia o valor arredondado, já seguro).
  await expect(page.getByRole('alert').filter({ hasText: /bloqueado/ })).toBeVisible()
  expect(Number.parseFloat(await cable.inputValue())).toBeLessThan(10)
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

test('TASK-063: nenhum comando (cabo, giro, lança) leva a carga ao chão ou para dentro do corpo', async ({
  page,
}) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await openPositionStep(page)
  const hookHeight = page
    .getByRole('region', { name: /Geometria/ })
    .locator('dt:text-is("Altura do gancho") + dd')
  // A guarda só mostra «Colisão da carga» (sem «bloqueado») quando o estado em si colide.
  const standingCollision = page.getByRole('alert').filter({ hasText: /^(?!.*bloqueado).*Colisão/ })

  // Cabo no fim: o gancho fica acima do chão (a carga não entra na terra).
  const cable = page.getByLabel('Comprimento do cabo')
  await cable.focus()
  await cable.press('End')
  expect(metersOf(await hookHeight.textContent())).toBeGreaterThan(1)

  // Gira a torre pelo curso todo com a lança baixa e o cabo longo: a carga não pode ficar dentro do
  // caminhão, da cabine ou da torre; todo comando termina num estado sem colisão.
  const turret = page.getByLabel('Giro da torre')
  const boom = page.getByLabel('Inclinação da lança')
  await boom.focus()
  await boom.press('Home')
  for (const key of ['Home', 'PageUp', 'PageUp', 'PageUp', 'End']) {
    await turret.focus()
    await turret.press(key)
    await expect(standingCollision).toHaveCount(0)
    expect(metersOf(await hookHeight.textContent())).toBeGreaterThan(1)
  }
  await boom.press('End')
  await expect(standingCollision).toHaveCount(0)
  expect(pageErrors).toEqual([])
})
