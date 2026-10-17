// Coleta e entrega da carga (TASK-073; ADR-035), no navegador, com catálogo e avaliação FICTÍCIOS
// respondidos pelo próprio navegador: posicionar a carga e a entrega no editor, ir até a carga,
// engatar, levar, soltar no alvo e ver "Entregue". O peso só vai à avaliação depois de engatar.
//
// Não há como ler a posição do gancho na cena, então o teste usa a própria dica do painel ("faltam
// X m") como medida e busca a posição pelos controles, como uma pessoa faria olhando a tela.
//
// E2E_SCREENSHOT_DIR (opcional) grava as capturas nessa pasta.

import type { Locator, Page, Route } from '@playwright/test'

import { expect, hasBackend, test } from './auth.js'
import { chooseConfiguration, fillValidLoad, mockCatalog } from './catalogMock.js'
import { topGround } from './topView.js'

const SCREENSHOT_DIR = process.env.E2E_SCREENSHOT_DIR?.trim() ?? ''
const WEIGHT_KG = 3000

test.describe('coleta e entrega da carga', () => {
  test.skip(hasBackend, 'usa catálogo e avaliação respondidos pelo navegador')
  test.setTimeout(180_000)

  async function shot(page: Page, name: string): Promise<void> {
    if (SCREENSHOT_DIR) await page.screenshot({ path: `${SCREENSHOT_DIR}/${name}.png` })
  }

  function strip(page: Page): Locator {
    return page.getByRole('region', { name: 'Coleta e entrega da carga' })
  }

  /** Distância citada na dica como "(faltam X m)"; sem ela, o gancho já está no lugar (0). */
  async function missingMeters(page: Page): Promise<number> {
    const text = (await strip(page).getByRole('status').textContent()) ?? ''
    const match = /faltam ([\d.,]+) m/.exec(text)
    return match ? Number.parseFloat((match[1] ?? '0').replace(/\./g, '').replace(',', '.')) : 0
  }

  async function settle(page: Page): Promise<void> {
    await page.waitForTimeout(90)
  }

  /** Procura o valor do controle que deixa a dica mais perto de "nada falta". */
  async function minimise(
    page: Page,
    slider: Locator,
    from: number,
    to: number,
    step: number,
  ): Promise<void> {
    const min = Number(await slider.getAttribute('min'))
    const max = Number(await slider.getAttribute('max'))
    const clamp = (value: number) => Math.round(Math.min(max, Math.max(min, value)) * 10) / 10
    let best = { value: clamp(from), missing: Number.POSITIVE_INFINITY }
    for (let value = from; value <= to + 1e-9; value += step) {
      await slider.fill(String(clamp(value)))
      await settle(page)
      const missing = await missingMeters(page)
      if (missing < best.missing) best = { value: clamp(value), missing }
    }
    await slider.fill(String(best.value))
    await settle(page)
  }

  test('posicionar, engatar, levar e soltar no alvo mostra "Entregue"', async ({ page }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    await page.setViewportSize({ width: 1600, height: 1000 })

    // Avaliação FALSA que só anota o peso recebido.
    const weights: number[] = []
    await mockCatalog(page)
    await page.route('**/api/v1/evaluations', async (route: Route) => {
      const body = route.request().postDataJSON() as {
        configuration_id: string
        boom_length_m: number
        load_weight_kg: number
      }
      weights.push(body.load_weight_kg)
      await route.fulfill({
        json: {
          status: 'EVALUATED',
          configuration_id: body.configuration_id,
          geometry: null,
          capacity: {
            maximum_capacity_kg: 8000,
            strategy: 'CONSERVATIVE_PROVISIONAL',
            queried_boom_length_m: body.boom_length_m,
            queried_working_radius_m: null,
            used_point: { boom_length_m: 22, working_radius_m: 40, max_capacity_kg: 8000 },
          },
          utilization_percent: (body.load_weight_kg / 8000) * 100,
          load_chart_id: 'LC-E2E-FICTICIA',
          load_chart_version: 'v1',
          reasons: [],
        },
      })
    })
    // Gravações FALSAS: guarda o que o navegador envia e devolve na reprodução.
    const saved = { body: null as Record<string, unknown> | null }
    const summary = () => ({
      id: 'gravacao-ficticia',
      name: 'Entrega FICTÍCIA',
      author_user_id: 'u1',
      author_display_name: 'Pessoa FICTÍCIA',
      created_at: '2026-10-14T12:00:00Z',
      duration_ms: saved.body?.duration_ms ?? 0,
      configuration_id: saved.body?.configuration_id ?? '',
      load_chart_refs: saved.body?.load_chart_refs ?? [],
      frame_count: (saved.body?.frames as unknown[] | undefined)?.length ?? 0,
    })
    await page.route('**/api/v1/simulations', async (route: Route) => {
      if (route.request().method() === 'POST') {
        saved.body = route.request().postDataJSON() as Record<string, unknown>
        await route.fulfill({ status: 201, json: summary() })
      } else {
        await route.fulfill({ json: { items: saved.body ? [summary()] : [] } })
      }
    })
    await page.route('**/api/v1/simulations/*', async (route: Route) => {
      await route.fulfill({
        json: { ...summary(), scenario: saved.body?.scenario ?? null, frames: saved.body?.frames },
      })
    })
    const modelResponse = page.waitForResponse((response) =>
      response.url().includes('guindaste-80t.glb'),
    )
    await page.goto('/simulador')
    await chooseConfiguration(page)
    await page.getByRole('button', { name: 'Continuar para Carga' }).click()
    await fillValidLoad(page, String(WEIGHT_KG))
    await page.getByRole('button', { name: 'Continuar para Posição' }).click()
    await modelResponse
    await page.waitForTimeout(1500) // interpretar o GLB e trocar o guindaste

    // Antes de posicionar, é o modo livre: a carga já está no gancho e o peso entra na avaliação.
    await expect(strip(page)).toContainText('Modo livre')
    await expect.poll(() => weights.at(-1)).toBe(WEIGHT_KG)

    // Editor: vista de cima, posicionar a carga e o ponto de entrega.
    await page.getByRole('button', { name: 'Topo' }).click()
    // Espera a câmera chegar à vista de cima: o clique no chão depende do enquadramento final.
    await page.waitForTimeout(1200)
    await page.getByRole('button', { name: 'Editar ambiente' }).click()
    const ground = await topGround(page)
    const placeCargo = async (x: number, y: number) => {
      await page.getByRole('button', { name: 'Posicionar carga' }).click()
      await page.mouse.click(x, y)
      await settle(page)
    }
    // Perto do guindaste (cerca de 15 m): +13 m em X e +8,4 m em Z, e a entrega espelhada em X. Os
    // pixels vêm da escala e do centro livre da vista de cima (TASK-104), não do centro do quadro.
    const cargoAt = ground.at(13, 8.4)
    const deliveryAt = ground.at(-13, 8.4)
    await placeCargo(cargoAt.x, cargoAt.y)
    await expect(strip(page)).toContainText('Agora marque onde a carga deve chegar')
    await page.getByRole('button', { name: 'Ponto de entrega' }).click()
    await page.mouse.click(deliveryAt.x, deliveryAt.y)
    await settle(page)
    await expect(strip(page).getByRole('button', { name: 'Engatar' })).toBeDisabled()
    // Com a carga no chão, só o gancho e os acessórios entram na avaliação.
    await expect.poll(() => weights.at(-1)).toBe(0)
    await shot(page, 'task-073-posicionar-carga-e-entrega')

    // A mesma cena em perspectiva: a carga apoiada no terreno e o alvo no chão.
    await page.getByRole('button', { name: 'Perspectiva' }).click()
    await page.waitForTimeout(1200)
    await shot(page, 'task-073-perspectiva-carga-e-entrega')
    await page.getByRole('button', { name: 'Topo' }).click()
    await page.waitForTimeout(1200)

    // Aproxima o gancho da carga pelos controles: gira a torre e ajusta a lança.
    await page.getByRole('button', { name: 'Concluir' }).click()
    const turret = page.getByLabel('Giro da torre')
    const boomLength = page.getByLabel('Comprimento da lança')
    const cable = page.getByLabel('Comprimento do cabo')
    // Começa a gravar: engatar, soltar e a posição da carga vão nos quadros.
    const recordingPanel = page.getByRole('region', { name: 'Gravação de simulações' })
    await recordingPanel.getByRole('button', { name: 'Gravar' }).click()
    const approach = async (): Promise<void> => {
      await minimise(page, turret, -90, 90, 10)
      const lengthMin = Number(await boomLength.getAttribute('min'))
      const lengthMax = Number(await boomLength.getAttribute('max'))
      await minimise(page, boomLength, lengthMin, lengthMax, 1)
      for (let round = 0; round < 3; round += 1) {
        const angle = Number(await turret.inputValue())
        await minimise(page, turret, angle - 6, angle + 6, 1)
        const length = Number(await boomLength.inputValue())
        await minimise(page, boomLength, length - 1, length + 1, 0.1)
      }
    }
    await cable.press('Home')
    await approach()
    expect(await missingMeters(page)).toBeLessThan(0.5)

    // Baixa o cabo: o gancho para ao tocar o topo da carga e o botão Engatar é liberado.
    await cable.press('End')
    await settle(page)
    const engage = strip(page).getByRole('button', { name: 'Engatar' })
    await expect(engage).toBeEnabled()
    await shot(page, 'task-073-pronto-para-engatar')

    await engage.click()
    // Engatada ainda no chão: a dica já manda levar e soltar.
    await expect(strip(page)).toContainText('Toque em Soltar')
    await expect(engage).toBeDisabled()
    // Engatada, o peso entra na avaliação.
    await expect.poll(() => weights.at(-1)).toBe(WEIGHT_KG)
    await cable.press('Home')
    await settle(page)
    await shot(page, 'task-073-carga-no-gancho')

    // Leva até o alvo, do outro lado: gira e ajusta a lança até a dica dizer que chegou.
    await approach()
    expect(await missingMeters(page)).toBeLessThan(1.5)

    // Baixa até o chão e solta.
    await cable.press('End')
    await settle(page)
    const release = strip(page).getByRole('button', { name: 'Soltar' })
    await expect(release).toBeEnabled()
    await shot(page, 'task-073-pronto-para-soltar')
    await release.click()
    await expect(strip(page)).toContainText('Entregue')
    await expect(strip(page)).toContainText(/em \d+:\d{2},\d/)
    await expect.poll(() => weights.at(-1)).toBe(0)
    await shot(page, 'task-073-entregue')

    // Para, salva e reproduz: os quadros trazem a carga e a reprodução mostra engatar e soltar.
    await recordingPanel.getByRole('button', { name: 'Parar' }).click()
    await recordingPanel.getByLabel('Nome da gravação').fill('Entrega FICTÍCIA')
    await recordingPanel.getByRole('button', { name: 'Salvar' }).click()
    await expect.poll(() => saved.body !== null).toBe(true)
    const frames = (saved.body?.frames ?? []) as { cargo?: { phase: string; result: string } }[]
    expect(frames.some((frame) => frame.cargo?.phase === 'hooked')).toBe(true)
    expect(frames.at(-1)?.cargo).toMatchObject({ phase: 'ground', result: 'delivered' })
    expect(saved.body?.scenario).toMatchObject({
      cargo: expect.anything(),
      delivery: expect.anything(),
    })

    // Desde a TASK-095, as gravações salvas ficam numa folha da barra de ferramentas e o player
    // numa faixa sobre a cena; Gravar, Parar e Salvar seguem na barra de comando.
    await page.getByRole('button', { name: 'Gravações salvas' }).click()
    await page.getByRole('button', { name: 'Reproduzir Entrega FICTÍCIA' }).click()
    const player = page.getByRole('group', { name: 'Reprodução' })
    await expect(player).toBeVisible()
    await expect(player.locator('button[data-kind="engage"]')).toHaveCount(1)
    await expect(player.locator('button[data-kind="release"]')).toHaveCount(1)
    await player.locator('button[data-kind="engage"]').click()
    await page.waitForTimeout(400)
    await shot(page, 'task-073-reproducao-carga-engatada')
    await player.locator('button[data-kind="release"]').click()
    await page.waitForTimeout(400)
    await shot(page, 'task-073-reproducao-carga-entregue')

    expect(pageErrors).toEqual([])
  })
})
