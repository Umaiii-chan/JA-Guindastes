// Biblioteca de objetos reais no editor 3D do ambiente (TASK-072; ADR-036), com catálogo FICTÍCIO
// respondido no navegador (sem backend: a colisão é da cena). Coloca um barracão, árvores, um caminhão
// e um carro pela paleta "Biblioteca" e leva a carga para dentro do barracão pela porta; a lança alta
// atravessa o telhado e a carga contra a parede é barrada.
//
// E2E_SCREENSHOT_DIR (opcional) grava as capturas nessa pasta.

import type { Locator, Page } from '@playwright/test'

import { expect, test } from './auth.js'
import { chooseConfiguration, fillValidLoad, mockCatalog } from './catalogMock.js'

const SCREENSHOT_DIR = process.env.E2E_SCREENSHOT_DIR?.trim() ?? ''

async function openPositionStep(page: Page): Promise<void> {
  await mockCatalog(page)
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

async function setSlider(slider: Locator, value: number): Promise<void> {
  await slider.fill(String(value))
}

/** Escolhe o objeto na paleta, clica no chão e leva o objeto para (x, z) com o giro dado. */
async function placeFromLibrary(
  page: Page,
  category: string,
  label: string,
  id: string,
  at: { x: number; z: number; rotationDeg?: number },
): Promise<void> {
  await page
    .getByRole('group', { name: 'Ferramenta' })
    .getByRole('button', { name: 'Biblioteca', exact: true })
    .click()
  const palette = page.getByRole('group', { name: 'Biblioteca de objetos' })
  await palette.getByRole('button', { name: category }).click()
  await palette.getByRole('button', { name: new RegExp(`^${label}`) }).click()
  const canvas = page.locator('canvas').first()
  const box = await canvas.boundingBox()
  if (!box) throw new Error('sem canvas')
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.75)
  const item = page.getByRole('group', { name: `Objeto ${id}` })
  await expect(item).toBeVisible()
  const commit = async (name: string, value: number) => {
    const field = item.getByLabel(name)
    await field.fill(String(value))
    await field.press('Enter')
  }
  await commit('Centro X (m)', at.x)
  await commit('Centro Z (m)', at.z)
  if (at.rotationDeg !== undefined) await commit('Giro (°)', at.rotationDeg)
}

test('TASK-072: barracão, árvores, caminhão e carro; a carga entra pela porta do barracão', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.setViewportSize({ width: 1440, height: 900 })
  await openPositionStep(page)

  // Guindaste de frente para onde ficará o barracão, lança quase horizontal e carga baixa: a lança
  // passa pela porta e a carga fica dentro dele. (Primeiro o guindaste: com o barracão já no lugar,
  // a guarda de colisão barraria os comandos que levam o gancho de encontro ao telhado.)
  await setSlider(page.getByLabel('Giro da torre'), 0)
  await setSlider(page.getByLabel('Comprimento do cabo'), 0.5)
  await setSlider(page.getByLabel('Comprimento da lança'), 18)
  await setSlider(page.getByLabel('Inclinação da lança'), 5)
  await page.waitForTimeout(500)

  // Abre a seção "Ambiente" (os campos numéricos de cada objeto ficam nela) e liga o editor.
  const environment = page.getByRole('button', { name: /^Ambiente/ })
  if ((await environment.getAttribute('aria-expanded')) !== 'true') await environment.click()
  await page.getByRole('button', { name: 'Editar ambiente' }).click()

  // A paleta lista as categorias com miniaturas ou ícones.
  await page
    .getByRole('group', { name: 'Ferramenta' })
    .getByRole('button', { name: 'Biblioteca', exact: true })
    .click()
  const palette = page.getByRole('group', { name: 'Biblioteca de objetos' })
  await expect(palette).toBeVisible()
  for (const category of ['Vegetação', 'Construções', 'Veículos', 'Guindastes', 'Outros']) {
    await expect(palette.getByRole('button', { name: category })).toBeVisible()
  }
  // As miniaturas saem dos próprios modelos; esperar a primeira garante que a paleta já as mostra.
  await expect(palette.locator('img').first()).toBeVisible({ timeout: 60_000 })
  if (SCREENSHOT_DIR) await page.screenshot({ path: `${SCREENSHOT_DIR}/biblioteca-paleta.png` })

  // Barracão com a porta virada para o guindaste (giro de 180°), árvores, caminhão e carro.
  await placeFromLibrary(page, 'Construções', 'Galpão com frente aberta', 'barracao-aberto-1', {
    x: 0,
    z: 25,
    rotationDeg: 180,
  })
  // O objeto recém-colocado fica selecionado, com o contorno e o gizmo na base.
  if (SCREENSHOT_DIR) await page.screenshot({ path: `${SCREENSHOT_DIR}/barracao-selecionado.png` })
  await placeFromLibrary(page, 'Vegetação', 'Árvore \\(carvalho\\)', 'arvore-carvalho-1', {
    x: -16,
    z: 12,
  })
  await placeFromLibrary(page, 'Vegetação', 'Pinheiro', 'pinheiro-1', { x: 17, z: 18 })
  await placeFromLibrary(page, 'Vegetação', 'Palmeira', 'palmeira-1', { x: -15, z: 30 })
  await placeFromLibrary(page, 'Veículos', 'Caminhão plataforma', 'caminhao-plataforma-1', {
    x: 13,
    z: -8,
    rotationDeg: 90,
  })
  await placeFromLibrary(page, 'Veículos', 'Carro \\(sedã\\)', 'sedan-1', {
    x: -11,
    z: -9,
    rotationDeg: -30,
  })
  await page.getByRole('button', { name: 'Concluir' }).click()
  await page.getByRole('button', { name: 'Perspectiva' }).click()
  await page.waitForTimeout(1200)

  // A carga está dentro do barracão, e a lança passou pela porta: nada a avisar.
  await page.waitForTimeout(800)
  // O grupo «Colisões» fica sempre sobre a cena (TASK-078; TASK-082); aqui, sem nenhum aviso.
  await expect(page.getByRole('group', { name: 'Colisões' }).getByRole('listitem')).toHaveCount(0)
  await page.getByRole('button', { name: 'Topo' }).click()
  await page.waitForTimeout(1200)
  if (SCREENSHOT_DIR) {
    await page.screenshot({ path: `${SCREENSHOT_DIR}/carga-dentro-do-barracao-topo.png` })
  }
  await page.getByRole('button', { name: 'Operador' }).click()
  await page.waitForTimeout(1200)
  if (SCREENSHOT_DIR) {
    await page.screenshot({ path: `${SCREENSHOT_DIR}/carga-dentro-do-barracao-operador.png` })
  }
  await page.getByRole('button', { name: 'Lateral' }).click()
  await page.waitForTimeout(1200)
  if (SCREENSHOT_DIR) {
    await page.screenshot({ path: `${SCREENSHOT_DIR}/carga-dentro-do-barracao-lateral.png` })
  }
  await page.getByRole('button', { name: 'Perspectiva' }).click()
  await page.waitForTimeout(1200)

  // Lança alta sobre o barracão: baixar o cabo leva a carga de encontro ao telhado, e o comando é
  // barrado com o nome do barracão no aviso.
  await setSlider(page.getByLabel('Inclinação da lança'), 40)
  await setSlider(page.getByLabel('Comprimento da lança'), 30)
  await setSlider(page.getByLabel('Comprimento do cabo'), 12)
  await expect(page.getByRole('alert').filter({ hasText: /bloqueado/ })).toBeVisible()
  await expect(
    page.getByRole('group', { name: 'Colisões' }).getByText(/Galpão com frente aberta/),
  ).toBeVisible()
  if (SCREENSHOT_DIR) {
    await page.screenshot({ path: `${SCREENSHOT_DIR}/carga-barrada-pelo-telhado.png` })
  }
  expect(pageErrors).toEqual([])
})
