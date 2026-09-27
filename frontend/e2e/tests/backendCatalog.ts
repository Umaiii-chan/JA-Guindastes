// Cadastros FICTÍCIOS criados pela API nos testes com backend (TASK-042, TASK-044): um fabricante, um
// guindaste e uma configuração novos a cada execução, para os nomes e versões nunca repetirem entre
// execuções. Precisa do login feito (fixture `page` de auth.ts) e manda o cabeçalho contra CSRF.

import { readFileSync } from 'node:fs'
import { basename } from 'node:path'

import { type APIRequestContext, expect } from '@playwright/test'

import { CSRF_HEADERS } from './auth.js'

/** Ficha FICTÍCIA (ADR-013 C-4), no formato do backend. */
export const GEOMETRY_FICTICIA = {
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

export interface FicticioCatalog {
  readonly manufacturerId: string
  readonly manufacturerName: string
  readonly craneId: string
  readonly craneName: string
  readonly configurationId: string
  readonly configurationName: string
}

async function post(request: APIRequestContext, path: string, data: unknown) {
  const response = await request.post(path, { data, headers: CSRF_HEADERS })
  expect(response.status(), `POST ${path}`).toBe(201)
  return (await response.json()) as { id: string }
}

/** Campos da configuração da TASK-046 (zonas de giro e peso do gancho), no formato do backend. */
export interface ConfigurationZoneFields {
  readonly rotation_zones?: readonly {
    code: string
    name: string
    start_deg: number
    end_deg: number
  }[]
  readonly hook_block_weight_kg?: number
}

export async function createFicticioCatalog(
  request: APIRequestContext,
  geometry: typeof GEOMETRY_FICTICIA | null = null,
  zoneFields: ConfigurationZoneFields = {},
): Promise<FicticioCatalog> {
  const suffix = `${Date.now()}`
  const manufacturerName = `Fabricante FICTÍCIO E2E ${suffix}`
  const craneName = `Modelo FICTÍCIO E2E ${suffix}`
  const configurationName = `Config FICTÍCIA E2E ${suffix}`
  const manufacturer = await post(request, '/api/v1/manufacturers', { name: manufacturerName })
  const crane = await post(request, '/api/v1/cranes', {
    manufacturer_id: manufacturer.id,
    model_name: craneName,
  })
  const configuration = await post(request, `/api/v1/cranes/${crane.id}/configurations`, {
    name: configurationName,
    geometry,
    ...zoneFields,
  })
  return {
    manufacturerId: manufacturer.id,
    manufacturerName,
    craneId: crane.id,
    craneName,
    configurationId: configuration.id,
    configurationName,
  }
}

/** Importa e ativa uma tabela pela API (multipart do `/import`, depois `/activate`). */
export async function importAndActivateViaApi(
  request: APIRequestContext,
  configurationId: string,
  csvPath: string,
  version: string,
): Promise<string> {
  const chartId = `${configurationId}-${version}`
  const imported = await request.post('/api/v1/load-charts/import', {
    headers: CSRF_HEADERS,
    multipart: {
      file: { name: basename(csvPath), mimeType: 'text/csv', buffer: readFileSync(csvPath) },
      configuration_id: configurationId,
      chart_id: chartId,
      version,
    },
  })
  expect(imported.status(), 'POST /api/v1/load-charts/import').toBe(201)
  const activated = await request.post(
    `/api/v1/load-charts/${encodeURIComponent(chartId)}/activate`,
    {
      headers: CSRF_HEADERS,
    },
  )
  expect(activated.status(), 'POST /activate').toBe(200)
  return chartId
}
