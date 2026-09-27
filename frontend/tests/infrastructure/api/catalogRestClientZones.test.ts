// Cliente REST do catálogo: zonas de giro e peso do gancho (TASK-046 § 3), com dados FICTÍCIOS.

import { describe, expect, it, vi } from 'vitest'

import { CatalogRequestError } from '../../../src/domain/catalog/catalog'
import { createCatalogRestClient } from '../../../src/infrastructure/api/catalogRestClient'
import {
  catalogComZonasFicticio,
  catalogFicticio,
  GANCHO_FICTICIO_KG,
  ZONAS_DTO_FICTICIAS,
  ZONAS_FICTICIAS,
} from '../../fixtures/catalogFicticio'
import {
  createFakeCatalogFetch,
  jsonResponse,
  validationError,
} from '../../helpers/fakeCatalogFetch'

async function rejection(promise: Promise<unknown>): Promise<CatalogRequestError> {
  const error = await promise.then(
    () => {
      throw new Error('esperava rejeição')
    },
    (reason: unknown) => reason,
  )
  expect(error).toBeInstanceOf(CatalogRequestError)
  return error as CatalogRequestError
}

function clientAnswering(response: Response) {
  const fetchFn = vi.fn<typeof fetch>(async () => response)
  return createCatalogRestClient({ fetchFn })
}

describe('cliente REST do catálogo — zonas de giro e gancho (TASK-046)', () => {
  it('lê rotation_zones e hook_block_weight_kg; ausentes = sem zonas e sem gancho', async () => {
    const fetchFn = createFakeCatalogFetch(catalogComZonasFicticio())
    const [withZones, withoutZones] = await createCatalogRestClient({
      fetchFn,
    }).listConfigurations('GUI-A1')
    expect(withZones.rotationZones).toEqual(ZONAS_FICTICIAS)
    expect(withZones.hookBlockWeightKg).toBe(GANCHO_FICTICIO_KG)
    expect(withoutZones.rotationZones).toEqual([])
    expect(withoutZones.hookBlockWeightKg).toBeNull()
  })

  it('cria com zonas e gancho em snake_case; sem eles, o corpo não muda', async () => {
    const fetchFn = createFakeCatalogFetch(catalogFicticio())
    const client = createCatalogRestClient({ fetchFn })
    const created = await client.createConfiguration('GUI-A1', {
      name: 'Com zonas',
      geometry: null,
      rotationZones: ZONAS_FICTICIAS,
      hookBlockWeightKg: 180,
    })
    await client.createConfiguration('GUI-A1', { name: 'Sem zonas', geometry: null })
    const bodies = fetchFn.mock.calls.map(([, init]) => JSON.parse(String(init?.body)) as unknown)
    expect(bodies[0]).toEqual({
      name: 'Com zonas',
      geometry: null,
      rotation_zones: ZONAS_DTO_FICTICIAS,
      hook_block_weight_kg: 180,
    })
    expect(bodies[1]).toEqual({ name: 'Sem zonas', geometry: null })
    expect(created.rotationZones).toEqual(ZONAS_FICTICIAS)
    expect(created.hookBlockWeightKg).toBe(180)
  })

  it('PATCH: lista vazia remove as zonas com null explícito; gancho null apaga', async () => {
    const fetchFn = createFakeCatalogFetch(catalogComZonasFicticio())
    const client = createCatalogRestClient({ fetchFn })
    const updated = await client.updateConfiguration('CFG-A1-FICHA', {
      rotationZones: [],
      hookBlockWeightKg: null,
    })
    expect(JSON.parse(String(fetchFn.mock.calls[0][1]?.body))).toEqual({
      rotation_zones: null,
      hook_block_weight_kg: null,
    })
    expect(updated.rotationZones).toEqual([])
    expect(updated.hookBlockWeightKg).toBeNull()
  })

  it('409 ROTATION_ZONE_IN_USE vira CONFLICT com apiCode e mensagem clara', async () => {
    const fetchFn = createFakeCatalogFetch(catalogComZonasFicticio(), undefined, {
      zonesInUse: { 'CFG-A1-FICHA': ['FRONTAL'] },
    })
    const error = await rejection(
      createCatalogRestClient({ fetchFn }).updateConfiguration('CFG-A1-FICHA', {
        rotationZones: [
          { code: 'FRENTE', name: 'Frente', startDeg: 305, endDeg: 55 },
          ZONAS_FICTICIAS[1],
        ],
      }),
    )
    expect(error.code).toBe('CONFLICT')
    expect(error.apiCode).toBe('ROTATION_ZONE_IN_USE')
    expect(error.message).toMatch(/já tem tabelas de carga/)
    expect(error.message).toMatch(/Mantenha o código/)
  })

  it.each([
    ['{detail, code}', { detail: 'as zonas devem cobrir 360°', code: 'INVALID_ROTATION_ZONES' }],
    [
      '{detail: {code, message}}',
      { detail: { code: 'INVALID_ROTATION_ZONES', message: 'as zonas devem cobrir 360°' } },
    ],
    [
      '422 do FastAPI',
      {
        detail: [
          {
            type: 'value_error',
            loc: ['body', 'rotation_zones'],
            msg: 'Value error, INVALID_ROTATION_ZONES: as zonas devem cobrir 360°',
          },
        ],
      },
    ],
  ])('422 INVALID_ROTATION_ZONES (%s) vira erro do campo rotationZones', async (_label, body) => {
    const error = await rejection(
      clientAnswering(jsonResponse(body, 422)).updateConfiguration('CFG-1', {
        rotationZones: ZONAS_FICTICIAS,
      }),
    )
    expect(error.code).toBe('VALIDATION')
    expect(error.apiCode).toBe('INVALID_ROTATION_ZONES')
    expect(error.fieldErrors[0].field).toBe('rotationZones')
    expect(error.fieldErrors[0].message).toMatch(/as zonas devem cobrir 360°/)
  })

  it('422 de um campo de uma zona usa o caminho do frontend', async () => {
    const error = await rejection(
      clientAnswering(
        jsonResponse(
          validationError(['rotation_zones', 1, 'start_deg'], 'Input should be less than 360'),
          422,
        ),
      ).updateConfiguration('CFG-1', { rotationZones: ZONAS_FICTICIAS }),
    )
    expect(error.apiCode).toBeNull()
    expect(error.fieldErrors).toEqual([
      { field: 'rotationZones.1.startDeg', message: 'Input should be less than 360' },
    ])
  })

  it('o backend falso também recusa zonas que não cobrem 360° (422)', async () => {
    const fetchFn = createFakeCatalogFetch(catalogFicticio())
    const error = await rejection(
      createCatalogRestClient({ fetchFn }).createConfiguration('GUI-A1', {
        name: 'Zonas ruins',
        geometry: null,
        rotationZones: [ZONAS_FICTICIAS[0], { ...ZONAS_FICTICIAS[1], endDeg: 300 }],
      }),
    )
    expect(error.apiCode).toBe('INVALID_ROTATION_ZONES')
  })
})
