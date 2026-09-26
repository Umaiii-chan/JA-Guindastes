// Importação de tabela de carga pela página Tabelas (TASK-042; CA-5), com os CSVs FICTÍCIOS de
// demonstração de backend/app/demo_data/.
//
// - "no navegador": catálogo e rotas de tabela respondidos pelo próprio navegador (page.route), com
//   os pontos lidos do CSV de demonstração. Exercita a tela (arrastar e soltar, matriz, importar,
//   linha do tempo, Dialog de ativação), não o parser do backend.
// - "com backend": o fluxo de verdade contra a stack (validação, relatório de erros, gravação e
//   ativação). PULADO, nunca aprovado em falso, sem E2E_BACKEND=1.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { expect, type Page, type Route, test } from '@playwright/test'

import { chooseConfiguration, FICTICIO, mockCatalog } from './catalogMock.js'

const DEMO_DIR = fileURLToPath(new URL('../../../backend/app/demo_data/', import.meta.url))
const DEMO_V1 = `${DEMO_DIR}tabela_carga_ficticia_demo_v1.csv`
const DEMO_ERRORS = `${DEMO_DIR}tabela_carga_ficticia_demo_com_erros.csv`
const FILE_INPUT = 'Arquivo da tabela de carga (CSV ou XLSX)'

const hasBackend = process.env.E2E_BACKEND === '1'

/** Pontos do CSV canônico provisório (sem validação: o arquivo v1 de demonstração é válido). */
function demoPoints(path: string) {
  return readFileSync(path, 'utf8')
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((line) => {
      const [boom, radius, capacity] = line.split(',').map(Number)
      return { boom_length_m: boom, working_radius_m: radius, max_capacity_kg: capacity }
    })
}

/** Rotas das tabelas no navegador: /validate e /import devolvem os pontos do v1 FICTÍCIO. */
async function mockLoadCharts(page: Page): Promise<void> {
  const points = demoPoints(DEMO_V1)
  const stored = {
    chart_id: `${FICTICIO.configurationId}-v1`,
    version: 'v1',
    configuration_id: FICTICIO.configurationId,
    status: 'DRAFT',
    point_count: points.length,
    points,
    source: {
      file_name: 'tabela_carga_ficticia_demo_v1.csv',
      file_type: 'text/csv',
      sha256: 'e'.repeat(64),
      uri: `local://${'e'.repeat(64)}`,
    },
  }
  let current = { ...stored }
  const fulfill = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, json: body })

  await page.route('**/api/v1/load-charts/validate', (route) =>
    fulfill(route, { ...stored, issues: [] }),
  )
  await page.route('**/api/v1/load-charts/import', (route) => fulfill(route, current, 201))
  await page.route('**/api/v1/load-charts/*/activate', (route) => {
    current = { ...current, status: 'ACTIVE' }
    return fulfill(route, { ...current, superseded_chart_id: null })
  })
  await page.route(`**/api/v1/load-charts/${stored.chart_id}`, (route) => fulfill(route, current))
}

async function importAndActivate(page: Page, version: string): Promise<void> {
  await page.getByRole('button', { name: 'Importar como rascunho' }).click()
  await expect(page.getByText(`Versão ${version} importada`)).toBeVisible()

  const timeline = page.getByRole('list', { name: 'Linha do tempo das versões' })
  await expect(timeline.getByText('Rascunho')).toBeVisible()
  await timeline.getByRole('button', { name: `Ativar ${version}` }).click()

  const dialog = page.getByRole('dialog', { name: `Ativar a versão ${version}?` })
  await expect(dialog).toContainText('A capacidade calculada muda')
  await dialog.getByRole('button', { name: `Ativar ${version}` }).click()

  await expect(page.getByText(`Versão ${version} ativada`)).toBeVisible()
  await expect(timeline.locator('li[aria-current="true"]')).toContainText(version)
}

test.describe('importação de tabela de carga, no navegador', () => {
  test('solta o CSV FICTÍCIO, vê a matriz, importa e ativa com confirmação', async ({ page }) => {
    await mockCatalog(page)
    await mockLoadCharts(page)
    await page.goto('/tabelas')
    await chooseConfiguration(page)
    await expect(page.getByText('Nenhuma versão conhecida')).toBeVisible()

    await page.getByLabel(FILE_INPUT).setInputFiles(DEMO_V1)

    const matrix = page.getByRole('table', { name: /Prévia de tabela_carga_ficticia_demo_v1/ })
    await expect(matrix).toBeVisible()
    await expect(matrix.getByRole('rowheader', { name: '12 m' })).toBeVisible()
    await expect(matrix.getByRole('cell', { name: '12.000' })).toBeVisible()
    await expect(page.getByRole('list', { name: 'Legenda de cores da capacidade' })).toBeVisible()

    await importAndActivate(page, 'v1')
  })
})

test.describe('importação de tabela de carga, com backend', () => {
  test.skip(!hasBackend, 'precisa da stack com backend atrás de /api (defina E2E_BACKEND=1)')

  test('relatório de erros com linha e coluna; depois importa e ativa o v1', async ({ page }) => {
    // Catálogo FICTÍCIO novo a cada execução, para a versão v1 nunca repetir.
    const suffix = `${Date.now()}`
    const post = async (path: string, data: unknown) => {
      const response = await page.request.post(path, { data })
      expect(response.status(), `POST ${path}`).toBe(201)
      return (await response.json()) as { id: string }
    }
    const manufacturer = await post('/api/v1/manufacturers', {
      name: `Fabricante FICTÍCIO E2E ${suffix}`,
    })
    const crane = await post('/api/v1/cranes', {
      manufacturer_id: manufacturer.id,
      model_name: `Modelo FICTÍCIO E2E ${suffix}`,
    })
    const configuration = await post(`/api/v1/cranes/${crane.id}/configurations`, {
      name: `Config FICTÍCIA E2E ${suffix}`,
      geometry: null,
    })

    await page.goto('/tabelas')
    await chooseConfiguration(page, {
      manufacturerId: manufacturer.id,
      craneId: crane.id,
      configurationId: configuration.id,
    })

    await page.getByLabel(FILE_INPUT).setInputFiles(DEMO_ERRORS)
    const report = page.getByRole('table', {
      name: 'Problemas encontrados em tabela_carga_ficticia_demo_com_erros.csv',
    })
    await expect(report).toBeVisible()
    await expect(
      report.getByRole('row').filter({ hasText: 'working_radius_m' }).first(),
    ).toContainText('3')
    await expect(page.getByRole('button', { name: 'Importar como rascunho' })).toBeDisabled()

    await page.getByLabel(FILE_INPUT).setInputFiles(DEMO_V1)
    await expect(
      page.getByRole('table', { name: /Prévia de tabela_carga_ficticia_demo_v1/ }),
    ).toBeVisible()
    await importAndActivate(page, 'v1')
  })
})
