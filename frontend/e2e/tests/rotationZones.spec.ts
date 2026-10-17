// Zonas de giro e peso do gancho (TASK-046; CA-4..CA-7), com dados FICTÍCIOS.
//
// - "no navegador": catálogo com zonas e avaliação respondidos pelo próprio navegador (page.route).
//   A avaliação FALSA imita o contrato da TASK-046 (zona pelo ψ, carga + gancho); exercita a TELA
//   (editor e diagrama de zonas, HUD com zona e parcelas, setor destacado na cena), não a regra do
//   backend.
// - "com backend": o fluxo de verdade (CA-7). Cria uma configuração FICTÍCIA com duas zonas, importa e
//   ativa uma tabela FICTÍCIA em cada zona pela página Tabelas, gira a torre no simulador e confere que
//   a zona e a capacidade do backend mudam. PULADO, nunca aprovado em falso, sem E2E_BACKEND=1.
//
// E2E_SCREENSHOT_DIR (opcional) grava capturas das telas do modo "no navegador" nessa pasta.

import { fileURLToPath } from 'node:url'

import type { Page, Route } from '@playwright/test'

import { expect, hasBackend, test } from './auth.js'
import { createFicticioCatalog, GEOMETRY_FICTICIA } from './backendCatalog.js'
import { chooseConfiguration, fillValidLoad, mockCatalog, ZONAS_FICTICIAS } from './catalogMock.js'

const DEMO_DIR = fileURLToPath(new URL('../../../backend/app/demo_data/', import.meta.url))
const DEMO_V1 = `${DEMO_DIR}tabela_carga_ficticia_demo_v1.csv`
const DEMO_V2 = `${DEMO_DIR}tabela_carga_ficticia_demo_v2.csv`
const FILE_INPUT = 'Arquivo da tabela de carga (CSV ou XLSX)'
const SCREENSHOT_DIR = process.env.E2E_SCREENSHOT_DIR?.trim() ?? ''
const GANCHO_FICTICIO_KG = 150

async function capture(page: Page, name: string): Promise<void> {
  if (SCREENSHOT_DIR) await page.screenshot({ path: `${SCREENSHOT_DIR}/${name}.png` })
}

/** HUD do backend: o valor de uma métrica do topo (a primeira com o rótulo). */
function hudMetric(page: Page, label: string) {
  return page
    .getByRole('region', { name: /Avaliação/ })
    .locator(`dt:text-is("${label}") + dd`)
    .first()
}

function activeZoneLabel(page: Page) {
  return page.locator('[data-scene-label="rotation-zone"][data-active="true"]')
}

/** Passos 1 e 2 concluídos e o passo 3 (Posição) aberto, com os sliders. */
async function openPositionStep(
  page: Page,
  ids?: Parameters<typeof chooseConfiguration>[1],
): Promise<void> {
  await chooseConfiguration(page, ids)
  await page.getByRole('button', { name: 'Continuar para Carga' }).click()
  await fillValidLoad(page)
  await page.getByRole('button', { name: 'Continuar para Posição' }).click()
  await expect(page.getByLabel('Giro da torre')).toBeEnabled()
}

/**
 * Suspende a carga (cabo no mínimo) antes de girar. Com o gancho baixo, a carga de 2 m passa
 * raspando no chassi, e a guarda de colisão (RN-012; TASK-063) para o giro no último estado seguro,
 * antes da outra zona. Estes testes são das zonas, não da colisão.
 */
async function liftLoad(page: Page): Promise<void> {
  const cable = page.getByLabel('Comprimento do cabo')
  await cable.focus()
  await cable.press('Home')
}

/**
 * Avaliação FALSA no navegador, no contrato da TASK-046: zona pelo ψ (frontal de 305° a 55°),
 * capacidade FICTÍCIA por zona e carga + gancho comparados.
 */
async function mockZoneEvaluation(page: Page): Promise<void> {
  await page.route('**/api/v1/evaluations', async (route: Route) => {
    const body = route.request().postDataJSON() as {
      configuration_id: string
      turret_rotation_deg: number
      load_weight_kg: number
    }
    const psi = ((body.turret_rotation_deg % 360) + 360) % 360
    const front = psi >= 305 || psi < 55
    const zone = front ? ZONAS_FICTICIAS[0] : ZONAS_FICTICIAS[1]
    const capacity = front ? 5000 : 2500
    const compared = body.load_weight_kg + GANCHO_FICTICIO_KG
    await route.fulfill({
      json: {
        status: 'EVALUATED',
        configuration_id: body.configuration_id,
        geometry: null,
        capacity: {
          maximum_capacity_kg: capacity,
          strategy: 'CONSERVATIVE_PROVISIONAL',
          queried_boom_length_m: null,
          queried_working_radius_m: null,
          used_point: null,
        },
        utilization_percent: (compared / capacity) * 100,
        load_chart_id: `LC-FICTICIO-${zone.code}`,
        load_chart_version: 'v1',
        reasons: [],
        rotation_zone_code: zone.code,
        rotation_zone_name: zone.name,
        hook_block_weight_kg: GANCHO_FICTICIO_KG,
        compared_weight_kg: compared,
      },
    })
  })
}

test.describe('zonas de giro, no navegador', () => {
  test('simulador: o HUD mostra a zona e as parcelas; girar a torre troca a zona e a capacidade', async ({
    page,
  }) => {
    // Com backend, o WebSocket da avaliação chega nele (a rota falsa só cobre o REST).
    test.skip(hasBackend, 'com backend, o teste "com backend" abaixo cobre o fluxo de verdade')
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    await mockCatalog(page, {
      rotationZones: ZONAS_FICTICIAS,
      hookBlockWeightKg: GANCHO_FICTICIO_KG,
    })
    await mockZoneEvaluation(page)
    await page.goto('/simulador')
    await openPositionStep(page)

    // ψ = 0 (frente): zona frontal, na cena e no HUD.
    await expect(activeZoneLabel(page)).toHaveText('Frontal FICTÍCIA')
    await expect(hudMetric(page, 'Zona de giro')).toHaveText('Frontal FICTÍCIA', {
      timeout: 15_000,
    })
    await expect(hudMetric(page, 'Capacidade')).toHaveText('5.000 kg')
    await expect(hudMetric(page, 'Gancho')).toHaveText('150 kg')
    await expect(hudMetric(page, 'Peso comparado')).toHaveText('3.150 kg')
    await capture(page, 'simulador-zona-frontal')

    // Giro até a ponta (90°, lado esquerdo): zona lateral e traseira.
    await liftLoad(page)
    const turret = page.getByLabel('Giro da torre')
    await turret.focus()
    await turret.press('End')
    await expect(turret).toHaveValue('90')
    await expect(activeZoneLabel(page)).toHaveText('Lateral e traseira FICTÍCIA')
    await expect(hudMetric(page, 'Zona de giro')).toHaveText('Lateral e traseira FICTÍCIA')
    await expect(hudMetric(page, 'Capacidade')).toHaveText('2.500 kg')
    await expect(page.locator('[data-scene-label="rotation-zone"]')).toHaveCount(2)
    await capture(page, 'simulador-zona-lateral')
    expect(pageErrors).toEqual([])
  })

  test('catálogo: o atalho de zonas preenche o editor e desenha o diagrama', async ({ page }) => {
    await mockCatalog(page)
    await page.route('**/api/v1/configurations/*/load-charts', (route) =>
      route.fulfill({ json: { items: [], active_chart_id: null, active_charts: [] } }),
    )
    await page.goto('/catalogo')
    const column = (name: string) => page.getByRole('region', { name })
    await column('Fabricantes')
      .getByRole('button', { name: /FICTÍCIO E2E/ })
      .click()
    await column('Guindastes')
      .getByRole('button', { name: /FICTÍCIO E2E/ })
      .click()
    await column('Configurações')
      .getByRole('button', { name: /FICTÍCIA E2E/ })
      .click()
    const detail = page.getByRole('region', { name: 'Config FICTÍCIA E2E' })
    await detail.getByRole('button', { name: 'Editar' }).click()

    const drawer = page.getByRole('dialog', { name: 'Editar configuração' })
    await drawer.getByRole('button', { name: 'Frontal 110° + lateral e traseira 250°' }).click()
    const rows = drawer.getByRole('list', { name: 'Zonas de giro' }).getByRole('listitem')
    await expect(rows).toHaveCount(2)
    await expect(rows.nth(0).getByLabel(/^Início/)).toHaveValue('305')
    await expect(rows.nth(0).getByLabel(/^Fim/)).toHaveValue('55')
    await expect(drawer.getByRole('img', { name: /Frontal 305° → 55° \(110°\)/ })).toBeVisible()
    await drawer.getByLabel(/Peso do gancho/).fill('150')

    // Lacuna: mensagem clara e sem gravar.
    await rows.nth(0).getByLabel(/^Fim/).fill('50')
    await expect(drawer.getByRole('alert')).toContainText('Falta cobrir de 50° a 55°')
    await capture(page, 'catalogo-editor-zonas-erro')
    await rows.nth(0).getByLabel(/^Fim/).fill('55')
    await expect(drawer.getByText('Zonas de giro inválidas')).toHaveCount(0)
    await drawer.getByRole('group', { name: 'Zonas de giro' }).scrollIntoViewIfNeeded()
    await capture(page, 'catalogo-editor-zonas')
  })
})

// Ids do seed FICTÍCIO (backend/app/demo_seed.py), informados pelo ambiente do CI.
const seed = {
  manufacturerId: process.env.E2E_SEED_MANUFACTURER_ID?.trim() ?? '',
  craneId: process.env.E2E_SEED_CRANE_ID?.trim() ?? '',
  configurationId: process.env.E2E_SEED_CONFIGURATION_ID?.trim() ?? '',
}

test.describe('zonas de giro, com backend', () => {
  test.skip(!hasBackend, 'precisa da stack com backend atrás de /api (defina E2E_BACKEND=1)')

  test('seed de demonstração: pose inicial na frontal e giro de 180° na lateral e traseira (docs/demo.md)', async ({
    page,
  }) => {
    test.skip(
      !seed.manufacturerId || !seed.craneId || !seed.configurationId,
      'fluxo com dados semeados: defina E2E_SEED_MANUFACTURER_ID, E2E_SEED_CRANE_ID e E2E_SEED_CONFIGURATION_ID',
    )
    await page.goto('/simulador')
    await openPositionStep(page, seed)
    // Cenário A: R = 0,46 + 12·cos 35° ≈ 10,29 m (TASK-069), interpolado entre 10 m (4 200 kg) e
    // 11 m (3 800 kg) → 4 084 kg (ADR-030); 3 000 kg + gancho 200 kg = 3 200 kg → 78,35 %.
    await expect(hudMetric(page, 'Zona de giro')).toHaveText('Frontal', {
      timeout: 15_000,
    })
    await expect(hudMetric(page, 'Capacidade')).toHaveText('4.084 kg')
    await expect(hudMetric(page, 'Gancho')).toHaveText('200 kg')
    await expect(hudMetric(page, 'Peso comparado')).toHaveText('3.200 kg')
    await expect(hudMetric(page, 'Utilização')).toHaveText('78,35 %')

    // Cenário F: −180° é o mesmo giro que 180° (traseira) → lateral e traseira (v1 × 0,8), 3 267 kg →
    // 97,94 %. O raio não muda ao subir o gancho, então a capacidade também não.
    await liftLoad(page)
    const turret = page.getByLabel('Giro da torre')
    await turret.focus()
    await turret.press('Home')
    await expect(hudMetric(page, 'Zona de giro')).toHaveText('Lateral e traseira', {
      timeout: 15_000,
    })
    await expect(hudMetric(page, 'Capacidade')).toHaveText('3.267 kg')
    await expect(hudMetric(page, 'Utilização')).toHaveText('97,94 %')
    await expect(activeZoneLabel(page)).toHaveText('Lateral e traseira')
  })

  test('tabelas FICTÍCIAS em duas zonas: girar a torre muda a zona e a capacidade', async ({
    page,
  }) => {
    const catalog = await createFicticioCatalog(page.request, GEOMETRY_FICTICIA, {
      rotation_zones: ZONAS_FICTICIAS,
      hook_block_weight_kg: GANCHO_FICTICIO_KG,
    })
    const ids = {
      manufacturerId: catalog.manufacturerId,
      craneId: catalog.craneId,
      configurationId: catalog.configurationId,
    }

    // Tabelas: v1 na zona frontal e v2 (capacidades × 0,9) na lateral e traseira, cada uma ativada.
    await page.goto('/tabelas')
    await chooseConfiguration(page, ids)
    await expect(page.getByText('Nenhuma versão importada')).toBeVisible()
    const timeline = page.getByRole('list', { name: 'Linha do tempo das versões' })
    for (const [file, version, zone] of [
      [DEMO_V1, 'v1', ZONAS_FICTICIAS[0]],
      [DEMO_V2, 'v2', ZONAS_FICTICIAS[1]],
    ] as const) {
      await page.getByLabel(FILE_INPUT).setInputFiles(file)
      await expect(
        page.getByRole('table', { name: /^Prévia de tabela_carga_ficticia/ }),
      ).toBeVisible()
      await page.getByLabel(/^Zona de giro/).selectOption(zone.code)
      await page.getByRole('button', { name: 'Importar como rascunho' }).click()
      await expect(page.getByText(`Versão ${version} importada`)).toBeVisible()
      await timeline.getByRole('button', { name: `Ativar ${version}` }).click()
      const dialog = page.getByRole('dialog', { name: `Ativar a versão ${version}?` })
      await expect(dialog).toContainText(`zona ${zone.name}`)
      await dialog.getByRole('button', { name: `Ativar ${version}` }).click()
      await expect(page.getByText(`Versão ${version} ativada na zona ${zone.name}`)).toBeVisible()
    }
    // As duas continuam ativas, cada uma na sua zona.
    await expect(timeline.locator('li[aria-current="true"]')).toHaveCount(2)
    const listing = await page.request.get(
      `/api/v1/configurations/${catalog.configurationId}/load-charts`,
    )
    const body = (await listing.json()) as {
      active_charts: { rotation_zone_code: string | null; chart_id: string }[]
    }
    expect(body.active_charts.map((item) => item.rotation_zone_code).sort()).toEqual([
      'FRONTAL',
      'LATERAL_TRASEIRA',
    ])

    // Simulador: ψ = 0 na frente, depois 90° (esquerda).
    await page.goto('/simulador')
    await openPositionStep(page, ids)
    const zone = hudMetric(page, 'Zona de giro')
    const capacity = hudMetric(page, 'Capacidade')
    await expect(zone).toHaveText(ZONAS_FICTICIAS[0].name, { timeout: 15_000 })
    await expect(capacity).toHaveText(/\d kg$/)
    const frontCapacity = await capacity.textContent()
    // O peso comparado é carga + gancho (3.000 + 150), vindo do backend.
    await expect(hudMetric(page, 'Peso comparado')).toHaveText('3.150 kg')
    await expect(activeZoneLabel(page)).toHaveText(ZONAS_FICTICIAS[0].name)

    await liftLoad(page)
    const turret = page.getByLabel('Giro da torre')
    await turret.focus()
    await turret.press('End')
    await expect(zone).toHaveText(ZONAS_FICTICIAS[1].name, { timeout: 15_000 })
    await expect(capacity).not.toHaveText(frontCapacity ?? '')
    await expect(capacity).toHaveText(/\d kg$/)
    await expect(activeZoneLabel(page)).toHaveText(ZONAS_FICTICIAS[1].name)
  })
})
