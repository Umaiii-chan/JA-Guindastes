// Tipo de carga no passo "Carga" (leva F), com catálogo FICTÍCIO respondido no navegador (sem backend):
// o modelo 3D do tipo escolhido é escalado para as medidas digitadas e desenhado no lugar da caixa, tanto
// pendurado no gancho quanto no chão (carga posicionada). A colisão continua pela caixa.
//
// E2E_SCREENSHOT_DIR (opcional) grava as capturas nessa pasta.

import type { Page } from '@playwright/test'

import { expect, test } from './auth.js'
import { chooseConfiguration, mockCatalog } from './catalogMock.js'

const SCREENSHOT_DIR = process.env.E2E_SCREENSHOT_DIR?.trim() ?? ''

async function openLoadStep(page: Page): Promise<void> {
  await mockCatalog(page)
  await page.goto('/simulador')
  await chooseConfiguration(page)
  await page.getByRole('button', { name: 'Continuar para Carga' }).click()
}

async function fillLoad(page: Page, dims: { l: string; w: string; h: string }): Promise<void> {
  const load = page.getByRole('region', { name: 'Carga' })
  await load.getByLabel('Descrição').fill('Carga FICTÍCIA de teste E2E')
  await load.getByLabel('Peso (kg)').fill('3000')
  await load.getByLabel('Comprimento (m)', { exact: true }).fill(dims.l)
  await load.getByLabel('Largura (m)', { exact: true }).fill(dims.w)
  await load.getByLabel('Altura (m)', { exact: true }).fill(dims.h)
}

test('o tipo de carga escolhido desenha o modelo no gancho, nas medidas digitadas', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.setViewportSize({ width: 1440, height: 900 })
  await openLoadStep(page)

  const load = page.getByRole('region', { name: 'Carga' })
  const type = load.getByLabel('Tipo de carga')
  // A caixa simples é o padrão e todos os tipos pedidos estão na lista.
  await expect(type).toHaveValue('caixa')
  const labels = await type.locator('option').allTextContents()
  expect(labels).toEqual([
    'Caixa simples',
    'Contêiner',
    'Viga de concreto',
    'Viga de concreto (calha)',
    'Feixe de tubos',
    'Gerador',
    'Transformador',
    'Caixa de madeira',
  ])

  // O modelo é pedido assim que a carga fica válida, ainda no passo "Carga".
  const modelResponse = page.waitForResponse(
    (response) => response.url().includes('cargas/conteiner.glb') && response.ok(),
  )
  await type.selectOption('conteiner')
  await fillLoad(page, { l: '6', w: '2.4', h: '2.6' })
  await modelResponse
  await page.getByRole('button', { name: 'Continuar para Posição' }).click()
  await expect(page.getByLabel('Comprimento do cabo')).toBeEnabled()
  // Lança baixa e cabo curto: a carga fica no ar, longe do guindaste e do chão. Se a carga encostasse
  // em algo, ela viraria a caixa vermelha do aviso de colisão, em vez do modelo.
  await page.getByLabel('Comprimento da lança').fill('24')
  await page.getByLabel('Inclinação da lança').fill('40')
  await page.getByLabel('Comprimento do cabo').fill('2')
  await page.waitForTimeout(2500)
  if (SCREENSHOT_DIR)
    await page.screenshot({ path: `${SCREENSHOT_DIR}/modelos-carga-conteiner.png` })

  // O tipo escolhido volta ao voltar para o passo "Carga" (rascunho).
  await page
    .getByRole('list', { name: 'Passos da simulação' })
    .getByRole('button', { name: /Passo 2/ })
    .click()
  await expect(page.getByRole('region', { name: 'Carga' }).getByLabel('Tipo de carga')).toHaveValue(
    'conteiner',
  )
  expect(pageErrors).toEqual([])
})

test('com a carga posicionada no chão, o modelo do tipo aparece apoiado no terreno', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.setViewportSize({ width: 1440, height: 900 })
  await openLoadStep(page)

  const load = page.getByRole('region', { name: 'Carga' })
  const modelResponse = page.waitForResponse(
    (response) => response.url().includes('cargas/transformador.glb') && response.ok(),
  )
  await load.getByLabel('Tipo de carga').selectOption('transformador')
  await fillLoad(page, { l: '4', w: '2.5', h: '4' })
  await modelResponse
  await page.getByRole('button', { name: 'Continuar para Posição' }).click()
  await expect(page.getByLabel('Comprimento do cabo')).toBeEnabled()

  // Editor: vista de cima e a carga posicionada no chão.
  await page.getByRole('button', { name: 'Topo' }).click()
  await page.getByRole('button', { name: 'Editar ambiente' }).click()
  const canvas = page.locator('.crane-viewport__canvas canvas')
  const box = (await canvas.boundingBox())!
  await page.getByRole('button', { name: 'Posicionar carga' }).click()
  await page.mouse.click(box.x + box.width / 2 + 110, box.y + box.height / 2 + 70)
  await page.getByRole('button', { name: 'Concluir' }).click()
  await page.waitForTimeout(2500)
  if (SCREENSHOT_DIR) await page.screenshot({ path: `${SCREENSHOT_DIR}/modelos-carga-no-chao.png` })
  expect(pageErrors).toEqual([])
})
