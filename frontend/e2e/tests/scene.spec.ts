// Página, cena 3D e sliders, sem depender do backend (TASK-036). Roda contra o `vite preview` local
// e contra a stack Docker no CI.

import { expect, type Locator, type Page, test } from '@playwright/test'

const TITLE = 'Simulador de Tabelas de Carga de Guindastes'

function geometryValue(page: Page, label: string): Locator {
  return page.getByRole('region', { name: /Geometria/ }).locator(`dt:text-is("${label}") + dd`)
}

async function openApp(page: Page): Promise<string[]> {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.goto('/')
  return pageErrors
}

/** Leva o slider ao mínimo e ao máximo pelo teclado (eventos reais do navegador) e devolve o valor lido em cada ponta. */
async function readAtBothEnds(slider: Locator, value: Locator): Promise<[string, string]> {
  await slider.focus()
  await slider.press('Home')
  const atMin = (await value.textContent()) ?? ''
  await slider.press('End')
  await expect(value).not.toHaveText(atMin)
  const atMax = (await value.textContent()) ?? ''
  return [atMin, atMax]
}

test('a página carrega com o título e os painéis', async ({ page }) => {
  const pageErrors = await openApp(page)

  await expect(page).toHaveTitle(/.+/)
  await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Controles do guindaste' })).toBeVisible()
  await expect(page.getByRole('region', { name: /Geometria/ })).toBeVisible()
  await expect(page.getByRole('region', { name: /Avaliação/ })).toBeVisible()
  expect(pageErrors).toEqual([])
})

test('a cena 3D aparece num canvas e libera os sliders', async ({ page }) => {
  const pageErrors = await openApp(page)

  const canvas = page.locator('canvas')
  await expect(canvas).toHaveCount(1)
  await expect(canvas).toBeVisible()
  const box = await canvas.boundingBox()
  expect(box?.width ?? 0).toBeGreaterThan(0)
  expect(box?.height ?? 0).toBeGreaterThan(0)

  // Os sliders só habilitam quando a cena montou e entregou os comandos do guindaste.
  await expect(page.getByLabel('Inclinação da lança')).toBeEnabled()
  await expect(page.getByText('Não foi possível iniciar a cena 3D')).toHaveCount(0)
  expect(pageErrors).toEqual([])
})

test('a inclinação da lança muda o raio de trabalho e a altura da ponta na pré-visualização', async ({
  page,
}) => {
  const pageErrors = await openApp(page)
  const slider = page.getByLabel('Inclinação da lança')
  await expect(slider).toBeEnabled()

  const radius = geometryValue(page, 'Raio de trabalho')
  const tipHeight = geometryValue(page, 'Altura da ponta')
  await expect(radius).toHaveText(/\d m$/)

  await slider.focus()
  await slider.press('Home')
  const [radiusAtMin, tipAtMin] = [await radius.textContent(), await tipHeight.textContent()]
  await slider.press('End')
  await expect(radius).not.toHaveText(radiusAtMin ?? '')
  await expect(tipHeight).not.toHaveText(tipAtMin ?? '')
  expect(pageErrors).toEqual([])
})

test('o comprimento do cabo muda a altura do gancho na pré-visualização', async ({ page }) => {
  await openApp(page)
  const slider = page.getByLabel('Comprimento do cabo')
  await expect(slider).toBeEnabled()

  const [hookAtMin, hookAtMax] = await readAtBothEnds(
    slider,
    geometryValue(page, 'Altura do gancho'),
  )
  expect(hookAtMin).toMatch(/\d m$/)
  expect(hookAtMax).toMatch(/\d m$/)
})

test('sem configuração informada, o painel de avaliação pede a configuração', async ({ page }) => {
  await openApp(page)
  await expect(page.getByLabel('Inclinação da lança')).toBeEnabled()

  await expect(
    page
      .getByRole('region', { name: /Avaliação/ })
      .getByText('Escolha a configuração (fabricante → guindaste → configuração) para avaliar.'),
  ).toBeVisible()
})
