import { describe, expect, it, vi } from 'vitest'

import { CatalogRequestError } from '../../../src/domain/catalog/catalog'
import { createCatalogRestClient } from '../../../src/infrastructure/api/catalogRestClient'
import {
  catalogFicticio,
  GEOMETRY_DTO_FICTICIA,
  SHEET_FICTICIA,
  SHEET_MINIMA_FICTICIA,
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

function clientAnswering(response: Response | Error) {
  const fetchFn = vi.fn<typeof fetch>(async () => {
    if (response instanceof Error) throw response
    return response
  })
  return { fetchFn, client: createCatalogRestClient({ fetchFn }) }
}

describe('cliente REST do catálogo — leituras', () => {
  it('lista fabricantes, guindastes do fabricante e configurações do guindaste', async () => {
    const fetchFn = createFakeCatalogFetch(catalogFicticio())
    const client = createCatalogRestClient({ fetchFn })

    expect(await client.listManufacturers()).toEqual([
      { id: 'FAB-A', name: 'Fabricante FICTÍCIO A' },
      { id: 'FAB-B', name: 'Fabricante FICTÍCIO B' },
    ])
    expect(await client.listCranes('FAB-B')).toEqual([
      { id: 'GUI-B1', manufacturerId: 'FAB-B', modelName: 'Modelo FICTÍCIO B1' },
    ])
    const configurations = await client.listConfigurations('GUI-A1')
    expect(configurations.map((item) => item.id)).toEqual(['CFG-A1-FICHA', 'CFG-A1-SEM'])
    expect(configurations[0].geometry).toEqual(SHEET_FICTICIA)
    expect(configurations[1].geometry).toBeNull()

    expect(fetchFn.mock.calls.map(([url, init]) => [String(url), init?.method])).toEqual([
      ['/api/v1/manufacturers', 'GET'],
      ['/api/v1/cranes?manufacturer_id=FAB-B', 'GET'],
      ['/api/v1/cranes/GUI-A1/configurations', 'GET'],
    ])
  })

  it('codifica ids na URL e usa o baseUrl', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => jsonResponse([]))
    const client = createCatalogRestClient({ fetchFn })
    const withBase = createCatalogRestClient({ fetchFn, baseUrl: 'http://api.invalid' })

    await client.listConfigurations('GUI/1 ?')
    await withBase.listCranes('FAB&1')

    expect(String(fetchFn.mock.calls[0][0])).toBe('/api/v1/cranes/GUI%2F1%20%3F/configurations')
    expect(String(fetchFn.mock.calls[1][0])).toBe(
      'http://api.invalid/api/v1/cranes?manufacturer_id=FAB%261',
    )
  })

  it('lê a ficha com os opcionais nulos (sem c_max e giro contínuo)', async () => {
    const { client } = clientAnswering(
      jsonResponse([
        {
          id: 'CFG-1',
          crane_id: 'GUI-1',
          name: 'Config FICTÍCIA',
          geometry: {
            ...GEOMETRY_DTO_FICTICIA,
            cable_length_max_m: null,
            turret_rotation_min_deg: null,
            turret_rotation_max_deg: null,
          },
        },
      ]),
    )

    const [configuration] = await client.listConfigurations('GUI-1')

    expect(configuration.geometry).toEqual(SHEET_MINIMA_FICTICIA)
  })

  it('resposta fora do contrato vira INVALID_RESPONSE com o caminho do campo', async () => {
    const { client } = clientAnswering(jsonResponse([{ id: 'FAB-1', name: 42 }]))

    const error = await rejection(client.listManufacturers())

    expect(error.code).toBe('INVALID_RESPONSE')
    expect(error.message).toContain('response[0].name')
  })
})

describe('cliente REST do catálogo — cadastros', () => {
  it('envia os pedidos de criação com os nomes de campo do backend', async () => {
    const fetchFn = createFakeCatalogFetch(catalogFicticio())
    const client = createCatalogRestClient({ fetchFn })

    const manufacturer = await client.createManufacturer('Fabricante FICTÍCIO C')
    const crane = await client.createCrane({
      manufacturerId: manufacturer.id,
      modelName: 'Modelo FICTÍCIO C1',
    })
    const configuration = await client.createConfiguration(crane.id, {
      name: 'Config FICTÍCIA C1',
      geometry: SHEET_MINIMA_FICTICIA,
    })
    await client.createConfiguration(crane.id, { name: 'Sem ficha', geometry: null })

    const posts = fetchFn.mock.calls.map(([url, init]) => ({
      url: String(url),
      method: init?.method,
      body: JSON.parse(String(init?.body)) as unknown,
    }))
    expect(posts[0]).toEqual({
      url: '/api/v1/manufacturers',
      method: 'POST',
      body: { name: 'Fabricante FICTÍCIO C' },
    })
    expect(posts[1].body).toEqual({
      manufacturer_id: manufacturer.id,
      model_name: 'Modelo FICTÍCIO C1',
    })
    expect(posts[2].url).toBe(`/api/v1/cranes/${crane.id}/configurations`)
    expect(posts[2].body).toEqual({
      name: 'Config FICTÍCIA C1',
      geometry: {
        ...GEOMETRY_DTO_FICTICIA,
        cable_length_max_m: null,
        turret_rotation_min_deg: null,
        turret_rotation_max_deg: null,
      },
    })
    expect(posts[3].body).toEqual({ name: 'Sem ficha', geometry: null })
    expect(configuration).toEqual({
      id: configuration.id,
      craneId: crane.id,
      name: 'Config FICTÍCIA C1',
      geometry: SHEET_MINIMA_FICTICIA,
    })
  })

  it('422: cada item do detail vira erro de campo com o nome do frontend', async () => {
    const { client } = clientAnswering(
      jsonResponse(
        {
          detail: [
            ...(validationError(['name'], 'String should match pattern') as { detail: unknown[] })
              .detail,
            ...(
              validationError(
                ['geometry', 'boom_length_min_m'],
                'Input should be greater than or equal to 0',
              ) as { detail: unknown[] }
            ).detail,
            ...(
              validationError(['geometry'], 'Value error, faixa de L inválida') as {
                detail: unknown[]
              }
            ).detail,
          ],
        },
        422,
      ),
    )

    const error = await rejection(
      client.createConfiguration('GUI-1', { name: ' ', geometry: SHEET_FICTICIA }),
    )

    expect(error.code).toBe('VALIDATION')
    expect(error.fieldErrors).toEqual([
      { field: 'name', message: 'String should match pattern' },
      { field: 'geometry.boomLengthMinM', message: 'Input should be greater than or equal to 0' },
      { field: 'geometry', message: 'Value error, faixa de L inválida' },
    ])
  })

  it('422 no guindaste: model_name vira modelName', async () => {
    const { client } = clientAnswering(
      jsonResponse(validationError(['model_name'], 'Field required'), 422),
    )

    const error = await rejection(client.createCrane({ manufacturerId: 'FAB-1', modelName: '' }))

    expect(error.fieldErrors).toEqual([{ field: 'modelName', message: 'Field required' }])
  })

  it.each([
    [404, 'NOT_FOUND', 'Guindaste GUI-X não encontrado.'],
    [409, 'CONFLICT', 'Já existe um registro com o id FICTICIO.'],
  ] as const)('%i vira %s com o detail do backend', async (status, code, detail) => {
    const { client } = clientAnswering(jsonResponse({ detail }, status))

    const error = await rejection(
      client.createConfiguration('GUI-X', { name: 'Config', geometry: null }),
    )

    expect(error.code).toBe(code)
    expect(error.message).toBe(detail)
    expect(error.fieldErrors).toEqual([])
  })

  it('outro HTTP vira HTTP_ERROR e falha de rede vira NETWORK_ERROR', async () => {
    const http = await rejection(
      clientAnswering(new Response('erro', { status: 500 })).client.listManufacturers(),
    )
    const network = await rejection(
      clientAnswering(new TypeError('Failed to fetch')).client.listManufacturers(),
    )

    expect(http.code).toBe('HTTP_ERROR')
    expect(http.message).toContain('HTTP 500')
    expect(network.code).toBe('NETWORK_ERROR')
  })
})
