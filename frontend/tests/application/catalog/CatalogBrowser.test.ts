import { describe, expect, it } from 'vitest'

import {
  CatalogBrowser,
  selectedConfiguration,
} from '../../../src/application/catalog/CatalogBrowser'
import { createCatalogRestClient } from '../../../src/infrastructure/api/catalogRestClient'
import { catalogFicticio, SHEET_FICTICIA } from '../../fixtures/catalogFicticio'
import {
  createFakeCatalogFetch,
  deferred,
  jsonResponse,
  validationError,
} from '../../helpers/fakeCatalogFetch'

type Intercept = Parameters<typeof createFakeCatalogFetch>[1]

function browserWith(intercept?: Intercept) {
  const data = catalogFicticio()
  const fetchFn = createFakeCatalogFetch(data, intercept)
  const browser = new CatalogBrowser(createCatalogRestClient({ fetchFn }))
  return { browser, data, fetchFn }
}

const ids = (items: readonly { id: string }[]) => items.map((item) => item.id)

describe('CatalogBrowser — listas encadeadas', () => {
  it('fabricante → guindastes dele → configurações do guindaste → configuração escolhida', async () => {
    const { browser } = browserWith()

    await browser.loadManufacturers()
    expect(browser.getState().manufacturers.status).toBe('loaded')
    expect(ids(browser.getState().manufacturers.items)).toEqual(['FAB-A', 'FAB-B'])
    expect(browser.getState().cranes.status).toBe('idle')

    await browser.selectManufacturer('FAB-A')
    expect(ids(browser.getState().cranes.items)).toEqual(['GUI-A1', 'GUI-A2'])
    expect(browser.getState().configurations.status).toBe('idle')

    await browser.selectCrane('GUI-A1')
    expect(ids(browser.getState().configurations.items)).toEqual(['CFG-A1-FICHA', 'CFG-A1-SEM'])

    browser.selectConfiguration('CFG-A1-FICHA')
    expect(selectedConfiguration(browser.getState())?.geometry).toEqual(SHEET_FICTICIA)
  })

  it('trocar o fabricante limpa guindaste, configuração e a lista de configurações', async () => {
    const { browser } = browserWith()
    await browser.selectManufacturer('FAB-A')
    await browser.selectCrane('GUI-A1')
    browser.selectConfiguration('CFG-A1-SEM')

    await browser.selectManufacturer('FAB-B')

    const state = browser.getState()
    expect(ids(state.cranes.items)).toEqual(['GUI-B1'])
    expect(state.selectedCraneId).toBeNull()
    expect(state.selectedConfigurationId).toBeNull()
    expect(state.configurations).toEqual({ status: 'idle', items: [], error: null })
    expect(selectedConfiguration(state)).toBeNull()
  })

  it('escolher "nenhum" esvazia as listas de baixo', async () => {
    const { browser } = browserWith()
    await browser.selectManufacturer('FAB-A')
    await browser.selectCrane('GUI-A1')

    await browser.selectCrane(null)
    expect(browser.getState().configurations.status).toBe('idle')

    await browser.selectManufacturer(null)
    expect(browser.getState().cranes).toEqual({ status: 'idle', items: [], error: null })
  })

  it('enquanto carrega, a lista nova começa vazia (não mostra guindastes do fabricante anterior)', async () => {
    const pending = deferred<Response>()
    const { browser } = browserWith((method, path) =>
      method === 'GET' &&
      path === '/api/v1/cranes' &&
      browser.getState().selectedManufacturerId === 'FAB-B'
        ? pending.promise
        : undefined,
    )
    await browser.selectManufacturer('FAB-A')

    const loading = browser.selectManufacturer('FAB-B')

    expect(browser.getState().cranes).toEqual({ status: 'loading', items: [], error: null })
    pending.resolve(jsonResponse([{ id: 'GUI-B1', manufacturer_id: 'FAB-B', model_name: 'B1' }]))
    await loading
    expect(ids(browser.getState().cranes.items)).toEqual(['GUI-B1'])
  })

  it('descarta a resposta de um fabricante que já não está escolhido', async () => {
    const slowA = deferred<Response>()
    const { browser } = browserWith((method, path) =>
      method === 'GET' &&
      path === '/api/v1/cranes' &&
      browser.getState().selectedManufacturerId === 'FAB-A'
        ? slowA.promise
        : undefined,
    )

    const first = browser.selectManufacturer('FAB-A')
    await browser.selectManufacturer('FAB-B')
    slowA.resolve(jsonResponse([{ id: 'GUI-A1', manufacturer_id: 'FAB-A', model_name: 'A1' }]))
    await first

    expect(browser.getState().selectedManufacturerId).toBe('FAB-B')
    expect(ids(browser.getState().cranes.items)).toEqual(['GUI-B1'])
  })

  it('erro ao listar aparece na lista, com a mensagem do backend', async () => {
    const { browser } = browserWith((_method, path) =>
      path === '/api/v1/manufacturers' ? jsonResponse({ detail: 'Not Found' }, 404) : undefined,
    )

    await browser.loadManufacturers()

    expect(browser.getState().manufacturers).toEqual({
      status: 'error',
      items: [],
      error: 'Not Found',
    })
  })

  it('avisa os assinantes a cada mudança e para de avisar depois de cancelar', async () => {
    const { browser } = browserWith()
    let calls = 0
    const unsubscribe = browser.subscribe(() => {
      calls += 1
    })

    await browser.loadManufacturers()
    const afterLoad = calls
    unsubscribe()
    browser.selectConfiguration('X')

    expect(afterLoad).toBeGreaterThanOrEqual(2)
    expect(calls).toBe(afterLoad)
  })
})

describe('CatalogBrowser — cadastros', () => {
  it('fabricante criado entra na lista e fica escolhido', async () => {
    const { browser, data } = browserWith()
    await browser.loadManufacturers()

    const result = await browser.createManufacturer('Fabricante FICTÍCIO C')

    expect(result.ok).toBe(true)
    const created = data.manufacturers.find((row) => row.name === 'Fabricante FICTÍCIO C')
    expect(created).toBeDefined()
    const state = browser.getState()
    expect(ids(state.manufacturers.items)).toContain(created?.id)
    expect(state.selectedManufacturerId).toBe(created?.id)
    expect(state.cranes).toEqual({ status: 'loaded', items: [], error: null })
  })

  it('guindaste e configuração com ficha criados ficam escolhidos, e a ficha é a enviada', async () => {
    const { browser } = browserWith()
    await browser.selectManufacturer('FAB-B')

    const crane = await browser.createCrane('FAB-B', 'Modelo FICTÍCIO B2')
    expect(crane.ok).toBe(true)
    const craneId = browser.getState().selectedCraneId
    expect(craneId).not.toBeNull()
    expect(ids(browser.getState().cranes.items)).toContain(craneId)

    const configuration = await browser.createConfiguration(
      craneId as string,
      'Config FICTÍCIA B2',
      SHEET_FICTICIA,
    )

    expect(configuration.ok).toBe(true)
    const selected = selectedConfiguration(browser.getState())
    expect(selected?.name).toBe('Config FICTÍCIA B2')
    expect(selected?.geometry).toEqual(SHEET_FICTICIA)
  })

  it('422: devolve o erro com os campos e não muda a seleção', async () => {
    const { browser } = browserWith((method, path) =>
      method === 'POST' && path.endsWith('/configurations')
        ? jsonResponse(
            validationError(['geometry', 'boom_angle_max_deg'], 'Value error, θ fora da faixa'),
            422,
          )
        : undefined,
    )
    await browser.selectManufacturer('FAB-A')
    await browser.selectCrane('GUI-A1')
    browser.selectConfiguration('CFG-A1-SEM')

    const result = await browser.createConfiguration('GUI-A1', 'Config', SHEET_FICTICIA)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION')
    expect(result.error.fieldErrors).toEqual([
      { field: 'geometry.boomAngleMaxDeg', message: 'Value error, θ fora da faixa' },
    ])
    expect(browser.getState().selectedConfigurationId).toBe('CFG-A1-SEM')
    expect(ids(browser.getState().configurations.items)).toEqual(['CFG-A1-FICHA', 'CFG-A1-SEM'])
  })

  it('404 do guindaste inexistente volta como erro sem campo', async () => {
    const { browser } = browserWith()

    const result = await browser.createConfiguration('GUI-INEXISTENTE', 'Config', null)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
    expect(result.error.message).toBe('Guindaste GUI-INEXISTENTE não encontrado.')
  })
})
