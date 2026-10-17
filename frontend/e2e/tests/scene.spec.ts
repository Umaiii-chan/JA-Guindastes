// Casca, páginas, cena 3D e simulador guiado, sem depender do backend (TASK-036, adaptado às páginas
// da TASK-039). O catálogo é FICTÍCIO e respondido no navegador (catalogMock.ts). Roda contra o
// `vite preview` local e contra a stack Docker no CI. Com backend, o fixture `page` de auth.ts entra
// como o admin de E2E antes de cada teste (TASK-040); sem backend, a aplicação fica no modo sem
// autenticação.

import type { Locator, Page } from '@playwright/test'

import { expect, test } from './auth.js'
import {
  chooseConfiguration,
  fillValidLoad,
  mockCatalog,
  openResultDetails,
} from './catalogMock.js'

function geometryValue(page: Page, label: string): Locator {
  return page.getByRole('region', { name: /Geometria/ }).locator(`dt:text-is("${label}") + dd`)
}

async function open(page: Page, path: string): Promise<string[]> {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await mockCatalog(page)
  await page.goto(path)
  return pageErrors
}

/**
 * Passos 1 e 2 concluídos: abre o passo 3 (Posição). Os sliders ficam na barra de comando e a
 * geometria nos "Detalhes" do cartão de resultado (TASK-095), que o teste abre.
 */
async function openPositionStep(page: Page): Promise<void> {
  await chooseConfiguration(page)
  await page.getByRole('button', { name: 'Continuar para Carga' }).click()
  await fillValidLoad(page)
  await page.getByRole('button', { name: 'Continuar para Posição' }).click()
  await expect(page.getByLabel('Inclinação da lança')).toBeEnabled()
  await openResultDetails(page)
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

test('o Início carrega com a casca, os atalhos, o resumo do catálogo e os avisos', async ({
  page,
}) => {
  const pageErrors = await open(page, '/')

  await expect(page).toHaveTitle(/.+/)
  await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Simulador de Tabelas de Carga de Guindastes' }),
  ).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Atalhos' }).getByRole('link')).toHaveCount(3)
  await expect(page.getByRole('list', { name: 'Contagens do catálogo' })).toBeVisible()
  expect(pageErrors).toEqual([])
})

test('o trilho navega pelas páginas do ADR-017', async ({ page }) => {
  const pageErrors = await open(page, '/')
  const nav = page.getByRole('navigation', { name: 'Navegação principal' })

  for (const name of ['Catálogo', 'Tabelas', 'Usuários', 'Simulador', 'Início']) {
    await nav.getByRole('link', { name }).click()
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
    await expect(nav.getByRole('link', { name })).toHaveAttribute('aria-current', 'page')
  }
  await page.goto('/nao-existe')
  await expect(page.getByRole('heading', { level: 1, name: 'Página não encontrada' })).toBeVisible()
  expect(pageErrors).toEqual([])
})

test('a cena 3D aparece num canvas que ocupa a página do simulador', async ({ page }) => {
  const pageErrors = await open(page, '/simulador')

  const canvas = page.locator('canvas')
  await expect(canvas).toHaveCount(1)
  await expect(canvas).toBeVisible()
  const box = await canvas.boundingBox()
  expect(box?.width ?? 0).toBeGreaterThan(600)
  // Desde a TASK-095 a cena ocupa o palco inteiro e os painéis flutuam sobre ela.
  expect(box?.height ?? 0).toBeGreaterThan(300)
  await expect(page.getByText('Não foi possível iniciar a cena 3D')).toHaveCount(0)
  await expect(page.getByRole('group', { name: 'Status da conexão e câmera' })).toBeVisible()
  expect(pageErrors).toEqual([])
})

test('os passos liberam em sequência: guindaste → carga → posição', async ({ page }) => {
  const pageErrors = await open(page, '/simulador')
  const steps = page.getByRole('list', { name: 'Passos da simulação' })

  await expect(steps.getByRole('button', { name: /Passo 2/ })).toBeDisabled()
  await expect(steps.getByRole('button', { name: /Passo 3/ })).toBeDisabled()

  await chooseConfiguration(page)
  await expect(steps.getByRole('button', { name: /Passo 2/ })).toBeEnabled()
  await expect(steps.getByRole('button', { name: /Passo 3/ })).toBeDisabled()
  await page.getByRole('button', { name: 'Continuar para Carga' }).click()

  await fillValidLoad(page)
  await expect(page.getByText('Carga válida: 3.000 kg vão para a avaliação.')).toBeVisible()
  await page.getByRole('button', { name: 'Continuar para Posição' }).click()
  await expect(page.getByLabel('Inclinação da lança')).toBeEnabled()
  // 2 de 3; 3 de 3 se houver backend respondendo a avaliação.
  await expect(page.getByText(/^[23] de 3 passos concluídos$/)).toBeVisible()
  expect(pageErrors).toEqual([])
})

test('a inclinação da lança muda o raio de trabalho e a altura da ponta na pré-visualização', async ({
  page,
}) => {
  const pageErrors = await open(page, '/simulador')
  await openPositionStep(page)
  const slider = page.getByLabel('Inclinação da lança')

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
  await open(page, '/simulador')
  await openPositionStep(page)

  const [hookAtMin, hookAtMax] = await readAtBothEnds(
    page.getByLabel('Comprimento do cabo'),
    geometryValue(page, 'Altura do gancho'),
  )
  expect(hookAtMin).toMatch(/\d m$/)
  expect(hookAtMax).toMatch(/\d m$/)
})

test('sem configuração escolhida, o resultado pede a configuração', async ({ page }) => {
  await open(page, '/simulador')

  const result = page.getByRole('region', { name: /Avaliação/ })
  await expect(
    result.getByText(
      'Escolha a configuração (fabricante → guindaste → configuração) para avaliar.',
    ),
  ).toBeVisible()
  await expect(result.getByText('Sem avaliação')).toBeVisible()
})
