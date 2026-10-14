// Cliente REST das tabelas: zona de giro na importação e nas respostas (TASK-046 § 3). FICTÍCIO.

import { describe, expect, it, vi } from 'vitest'

import type { LoadChartImportRequest } from '../../../src/application/loadChart/ports'
import {
  createLoadChartRestClient,
  LoadChartClientError,
  ZONE_IMPORT_ERROR_CODES,
} from '../../../src/infrastructure/api/loadChartRestClient'
import { jsonResponse } from '../../helpers/fakeCatalogFetch'
import { createFakeLoadChartFetch } from '../../helpers/fakeLoadChartFetch'
import { IMPORTED_DRAFT } from '../../fixtures/loadChartResponses'

const CSV = 'boom_length_m,working_radius_m,max_capacity_kg\n12,4,9000\n12,8,5500\n'

function request(patch: Partial<LoadChartImportRequest> = {}): LoadChartImportRequest {
  return {
    file: new Blob([CSV], { type: 'text/csv' }),
    fileName: 'tabela-ficticia.csv',
    configurationId: 'CFG-ZONAS',
    chartId: 'TAB-FRONTAL-1',
    version: 'v1',
    ...patch,
  }
}

async function rejection(promise: Promise<unknown>): Promise<LoadChartClientError> {
  const error = await promise.then(
    () => {
      throw new Error('esperava rejeição')
    },
    (caught: unknown) => caught,
  )
  expect(error).toBeInstanceOf(LoadChartClientError)
  return error as LoadChartClientError
}

describe('createLoadChartRestClient — zonas de giro', () => {
  it('a importação manda rotation_zone_code só quando há zona; a validação prévia nunca', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () =>
      jsonResponse({ ...IMPORTED_DRAFT, rotation_zone_code: 'FRONTAL' }, 201),
    )
    const client = createLoadChartRestClient({ fetchFn })

    const outcome = await client.importChart(request({ rotationZoneCode: 'FRONTAL' }))
    await client.importChart(request({ rotationZoneCode: null }))
    await client.importChart(request({ rotationZoneCode: '  ' }))
    fetchFn.mockResolvedValueOnce(jsonResponse({ ...IMPORTED_DRAFT, issues: [] }, 200))
    await client.validateChart(request({ rotationZoneCode: 'FRONTAL' }))

    const zoneOf = (index: number) =>
      (fetchFn.mock.calls[index][1]?.body as FormData).get('rotation_zone_code')
    expect(zoneOf(0)).toBe('FRONTAL')
    expect(zoneOf(1)).toBeNull()
    expect(zoneOf(2)).toBeNull()
    expect(zoneOf(3)).toBeNull()
    expect(outcome.kind === 'IMPORTED' && outcome.chart.rotationZoneCode).toBe('FRONTAL')
  })

  it.each([
    [ZONE_IMPORT_ERROR_CODES.required, null, /escolha a zona desta tabela/],
    [ZONE_IMPORT_ERROR_CODES.unknown, 'OUTRA', /não existe nesta configuração/],
  ])('422 %s vira erro com o mesmo código', async (code, zone, message) => {
    const fetchFn = createFakeLoadChartFetch([], {
      zonesByConfiguration: { 'CFG-ZONAS': ['FRONTAL', 'LATERAL_TRASEIRA'] },
    })
    const error = await rejection(
      createLoadChartRestClient({ fetchFn }).importChart(request({ rotationZoneCode: zone })),
    )
    expect(error.code).toBe(code)
    expect(error.httpStatus).toBe(422)
    expect(error.message).toMatch(message)
  })

  it('422 ROTATION_ZONE_NOT_ALLOWED numa configuração sem zonas', async () => {
    const fetchFn = createFakeLoadChartFetch()
    const error = await rejection(
      createLoadChartRestClient({ fetchFn }).importChart(request({ rotationZoneCode: 'FRONTAL' })),
    )
    expect(error.code).toBe(ZONE_IMPORT_ERROR_CODES.notAllowed)
    expect(error.message).toMatch(/não tem zonas de giro/)
  })

  it('o código da zona também é reconhecido no relatório (issues) e no 422 do FastAPI', async () => {
    const asReport = vi.fn<typeof fetch>(async () =>
      jsonResponse(
        {
          status: 'INVALID',
          issues: [
            {
              code: 'ROTATION_ZONE_REQUIRED',
              message: 'zona obrigatória',
              line: null,
              column: null,
            },
          ],
        },
        422,
      ),
    )
    const asFastApi = vi.fn<typeof fetch>(async () =>
      jsonResponse(
        {
          detail: [
            {
              type: 'UNKNOWN_ROTATION_ZONE',
              loc: ['body', 'rotation_zone_code'],
              msg: 'zona desconhecida',
            },
          ],
        },
        422,
      ),
    )
    const fromReport = await rejection(
      createLoadChartRestClient({ fetchFn: asReport }).importChart(request()),
    )
    const fromFastApi = await rejection(
      createLoadChartRestClient({ fetchFn: asFastApi }).importChart(request()),
    )
    expect(fromReport.code).toBe('ROTATION_ZONE_REQUIRED')
    expect(fromFastApi.code).toBe('UNKNOWN_ROTATION_ZONE')
  })

  it('a versão é única na configuração, somando as zonas: 409 entre zonas', async () => {
    const fetchFn = createFakeLoadChartFetch([], {
      zonesByConfiguration: { 'CFG-ZONAS': ['FRONTAL', 'LATERAL_TRASEIRA'] },
    })
    const client = createLoadChartRestClient({ fetchFn })
    await client.importChart(request({ rotationZoneCode: 'FRONTAL' }))
    const error = await rejection(
      client.importChart(
        request({ chartId: 'TAB-LATERAL-1', rotationZoneCode: 'LATERAL_TRASEIRA' }),
      ),
    )
    expect(error.httpStatus).toBe(409)
  })

  it('a listagem traz as ativas na ordem das zonas cadastradas', async () => {
    const source = { file_name: 'f.csv', file_type: 'text/csv', sha256: 'a', uri: 'local://a' }
    const points = [{ boom_length_m: 12, working_radius_m: 4, max_capacity_kg: 9000 }]
    const base = { configuration_id: 'CFG-ZONAS', points, source, status: 'ACTIVE' as const }
    const fetchFn = createFakeLoadChartFetch(
      [
        { ...base, chart_id: 'L1', version: 'v2', rotation_zone_code: 'LATERAL_TRASEIRA' },
        { ...base, chart_id: 'F1', version: 'v1', rotation_zone_code: 'FRONTAL' },
      ],
      { zonesByConfiguration: { 'CFG-ZONAS': ['FRONTAL', 'LATERAL_TRASEIRA'] } },
    )
    const listing = await createLoadChartRestClient({ fetchFn }).listConfigurationCharts(
      'CFG-ZONAS',
    )
    expect(listing.activeChartId).toBeNull()
    expect(listing.activeCharts.map((item) => item.rotationZoneCode)).toEqual([
      'FRONTAL',
      'LATERAL_TRASEIRA',
    ])
  })

  it('a ativação numa zona substitui só a ativa daquela zona (backend falso)', async () => {
    const source = { file_name: 'f.csv', file_type: 'text/csv', sha256: 'a', uri: 'local://a' }
    const points = [{ boom_length_m: 12, working_radius_m: 4, max_capacity_kg: 9000 }]
    const base = { configuration_id: 'CFG-ZONAS', points, source }
    const fetchFn = createFakeLoadChartFetch([
      { ...base, chart_id: 'F1', version: 'v1', status: 'ACTIVE', rotation_zone_code: 'FRONTAL' },
      {
        ...base,
        chart_id: 'L1',
        version: 'v2',
        status: 'ACTIVE',
        rotation_zone_code: 'LATERAL_TRASEIRA',
      },
      { ...base, chart_id: 'F2', version: 'v3', status: 'DRAFT', rotation_zone_code: 'FRONTAL' },
    ])
    const client = createLoadChartRestClient({ fetchFn })

    const activation = await client.activateChart('F2')
    const listing = await client.listConfigurationCharts('CFG-ZONAS')

    expect(activation.supersededChartId).toBe('F1')
    expect(activation.chart.rotationZoneCode).toBe('FRONTAL')
    expect(listing.activeCharts).toEqual([
      { rotationZoneCode: 'FRONTAL', chartId: 'F2' },
      { rotationZoneCode: 'LATERAL_TRASEIRA', chartId: 'L1' },
    ])
  })
})
