// Catálogo FICTÍCIO respondido no próprio navegador (page.route), para os testes da casca e do
// simulador guiado rodarem sem backend (TASK-039). Não há capacidade aqui: a avaliação continua
// sendo do backend, e os testes que dependem dela ficam em evaluation.spec.ts.

import type { Page } from '@playwright/test'

export const FICTICIO = {
  manufacturerId: 'FAB-E2E-FICTICIO',
  craneId: 'GUI-E2E-FICTICIO',
  configurationId: 'CFG-E2E-FICTICIA',
} as const

const SHEET_FICTICIA = {
  boom_pivot_offset_m: 0.8,
  boom_pivot_height_m: 2.6,
  boom_length_min_m: 10,
  boom_length_max_m: 30,
  boom_angle_min_deg: 5,
  boom_angle_max_deg: 75,
  cable_length_min_m: 0.5,
  cable_length_max_m: 40,
  turret_rotation_min_deg: -90,
  turret_rotation_max_deg: 90,
}

export async function mockCatalog(page: Page): Promise<void> {
  await page.route('**/api/v1/manufacturers', (route) =>
    route.fulfill({ json: [{ id: FICTICIO.manufacturerId, name: 'Fabricante FICTÍCIO E2E' }] }),
  )
  await page.route('**/api/v1/cranes?*', (route) =>
    route.fulfill({
      json: [
        {
          id: FICTICIO.craneId,
          manufacturer_id: FICTICIO.manufacturerId,
          model_name: 'Modelo FICTÍCIO E2E',
        },
      ],
    }),
  )
  await page.route('**/api/v1/cranes/*/configurations', (route) =>
    route.fulfill({
      json: [
        {
          id: FICTICIO.configurationId,
          crane_id: FICTICIO.craneId,
          name: 'Config FICTÍCIA E2E',
          geometry: SHEET_FICTICIA,
        },
      ],
    }),
  )
}

/** Escolhe a configuração no passo 1 do simulador (já em /simulador). */
export async function chooseConfiguration(
  page: Page,
  ids: { manufacturerId: string; craneId: string; configurationId: string } = FICTICIO,
): Promise<void> {
  const selection = page.getByRole('region', { name: 'Guindaste e configuração' })
  await selection.getByLabel('Fabricante').selectOption(ids.manufacturerId)
  await selection.getByLabel('Guindaste').selectOption(ids.craneId)
  await selection.getByLabel('Configuração').selectOption(ids.configurationId)
}

/** Preenche uma carga FICTÍCIA válida no passo 2. */
export async function fillValidLoad(page: Page, weightKg = '3000'): Promise<void> {
  const load = page.getByRole('region', { name: 'Carga' })
  await load.getByLabel('Descrição').fill('Carga FICTÍCIA de teste E2E')
  await load.getByLabel('Peso (kg)').fill(weightKg)
  await load.getByLabel('Comprimento (m)', { exact: true }).fill('2')
  await load.getByLabel('Largura (m)', { exact: true }).fill('2')
  await load.getByLabel('Altura (m)', { exact: true }).fill('2')
}
