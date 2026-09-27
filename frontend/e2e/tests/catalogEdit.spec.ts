// Edição de cadastro pela página Catálogo (TASK-044; CA-5 e CA-6): "Editar" grava no próprio item
// (PATCH), e mudar a ficha técnica de uma configuração com tabela ativa pede confirmação. Precisa da
// stack com backend: PULADO, nunca aprovado em falso, sem E2E_BACKEND=1. O fixture `page` de auth.ts
// entra como o admin de E2E. Dados FICTÍCIOS criados pela API a cada execução.

import { fileURLToPath } from 'node:url'

import type { Page } from '@playwright/test'

import { expect, hasBackend, test } from './auth.js'
import {
  createFicticioCatalog,
  type FicticioCatalog,
  GEOMETRY_FICTICIA,
  importAndActivateViaApi,
} from './backendCatalog.js'

const DEMO_V1 = fileURLToPath(
  new URL('../../../backend/app/demo_data/tabela_carga_ficticia_demo_v1.csv', import.meta.url),
)

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function openConfiguration(page: Page, catalog: FicticioCatalog): Promise<void> {
  await page.goto('/catalogo')
  const column = (name: string) => page.getByRole('region', { name })
  await column('Fabricantes')
    .getByRole('button', { name: new RegExp(escapeRegExp(catalog.manufacturerName)) })
    .click()
  await column('Guindastes')
    .getByRole('button', { name: new RegExp(escapeRegExp(catalog.craneName)) })
    .click()
  await column('Configurações')
    .getByRole('button', { name: new RegExp(escapeRegExp(catalog.configurationName)) })
    .click()
}

test.describe('edição de cadastro, com backend', () => {
  test.skip(!hasBackend, 'precisa da stack com backend atrás de /api (defina E2E_BACKEND=1)')

  test('renomeia a configuração e troca a ficha com confirmação, sem criar item novo', async ({
    page,
  }) => {
    const catalog = await createFicticioCatalog(page.request, GEOMETRY_FICTICIA)
    await importAndActivateViaApi(page.request, catalog.configurationId, DEMO_V1, 'v1')
    await openConfiguration(page, catalog)

    let detail = page.getByRole('region', { name: catalog.configurationName })
    await expect(detail.getByRole('table', { name: /Tabela ativa v1/ })).toBeVisible()

    // 1. Renomear: PATCH só com o nome.
    const renamed = `${catalog.configurationName} renomeada`
    await detail.getByRole('button', { name: 'Editar' }).click()
    let drawer = page.getByRole('dialog', { name: 'Editar configuração' })
    await expect(drawer.getByText('A edição grava uma cópia')).toHaveCount(0)
    await drawer.getByLabel(/Nome da configuração/).fill(renamed)
    await drawer.getByRole('button', { name: 'Salvar alterações' }).click()
    await expect(page.getByText('Configuração alterada')).toBeVisible()
    detail = page.getByRole('region', { name: renamed })
    await expect(detail).toBeVisible()

    // 2. Trocar a ficha de uma configuração com tabela ativa: confirmação antes de gravar.
    await detail.getByRole('button', { name: 'Editar' }).click()
    drawer = page.getByRole('dialog', { name: 'Editar configuração' })
    await drawer.getByLabel(/^h — altura/).fill('3.1')
    await drawer.getByRole('button', { name: 'Salvar alterações' }).click()
    const confirm = page.getByRole('dialog', { name: `Mudar a ficha técnica de ${renamed}?` })
    await expect(confirm).toContainText('As avaliações seguintes desta configuração mudam')
    await expect(confirm).toContainText('A tabela ativa (v1) continua a mesma')
    await confirm.getByRole('button', { name: 'Salvar a ficha nova' }).click()
    await expect(
      page.getByText(
        'A ficha nova vale para as próximas avaliações; as tabelas de carga não mudaram.',
      ),
    ).toBeVisible()
    await expect(detail.getByText('3,1 m')).toBeVisible()

    // O backend guardou no próprio item: mesma configuração, nome e ficha novos, a ficha inteira
    // (opcionais preservados) e nenhuma configuração a mais.
    const listing = await page.request.get(`/api/v1/cranes/${catalog.craneId}/configurations`)
    expect(listing.status()).toBe(200)
    const configurations = (await listing.json()) as {
      id: string
      name: string
      geometry: typeof GEOMETRY_FICTICIA | null
    }[]
    expect(configurations).toHaveLength(1)
    expect(configurations[0].id).toBe(catalog.configurationId)
    expect(configurations[0].name).toBe(renamed)
    expect(configurations[0].geometry).toEqual({ ...GEOMETRY_FICTICIA, boom_pivot_height_m: 3.1 })

    // A tabela ativa não mudou.
    const charts = await page.request.get(
      `/api/v1/configurations/${catalog.configurationId}/load-charts`,
    )
    expect(((await charts.json()) as { active_chart_id: string | null }).active_chart_id).toBe(
      `${catalog.configurationId}-v1`,
    )
  })

  test('renomeia o fabricante pelo detalhe vazio', async ({ page }) => {
    const catalog = await createFicticioCatalog(page.request)
    await page.goto('/catalogo')
    await page
      .getByRole('region', { name: 'Fabricantes' })
      .getByRole('button', { name: new RegExp(escapeRegExp(catalog.manufacturerName)) })
      .click()
    await page
      .getByRole('button', { name: `Editar o fabricante ${catalog.manufacturerName}` })
      .click()
    const drawer = page.getByRole('dialog', { name: 'Editar fabricante' })
    const renamed = `${catalog.manufacturerName} revisto`
    await drawer.getByLabel(/Nome do fabricante/).fill(renamed)
    await drawer.getByRole('button', { name: 'Salvar alterações' }).click()
    await expect(page.getByText(`Fabricante renomeado para "${renamed}"`)).toBeVisible()
    await expect(
      page
        .getByRole('region', { name: 'Fabricantes' })
        .getByRole('button', { name: new RegExp(escapeRegExp(renamed)) }),
    ).toBeVisible()
  })
})
