// Árvore do catálogo com contagens e busca (TASK-042), sobre o backend falso com dados FICTÍCIOS.

import { describe, expect, it } from 'vitest'

import {
  configurationCountOf,
  configurationsOf,
  countCatalogTree,
  cranesOf,
  filterCatalogTree,
  loadCatalogTree,
  normalizeSearch,
} from '../../../src/application/catalog/catalogTree'
import { createCatalogRestClient } from '../../../src/infrastructure/api/catalogRestClient'
import { catalogFicticio } from '../../fixtures/catalogFicticio'
import { createFakeCatalogFetch, jsonResponse } from '../../helpers/fakeCatalogFetch'

async function tree() {
  const client = createCatalogRestClient({ fetchFn: createFakeCatalogFetch(catalogFicticio()) })
  return loadCatalogTree(client)
}

describe('loadCatalogTree', () => {
  it('lê fabricantes, guindastes e configurações, com as contagens de cada nível', async () => {
    const loaded = await tree()

    expect(loaded.manufacturers.map((item) => item.id)).toEqual(['FAB-A', 'FAB-B'])
    expect(cranesOf(loaded, 'FAB-A').map((item) => item.id)).toEqual(['GUI-A1', 'GUI-A2'])
    expect(configurationsOf(loaded, 'GUI-A1')).toHaveLength(2)
    expect(configurationCountOf(loaded, 'FAB-A')).toBe(2)
    expect(countCatalogTree(loaded)).toEqual({ manufacturers: 2, cranes: 3, configurations: 3 })
    expect(cranesOf(loaded, null)).toEqual([])
  })

  it('rejeita com o erro da primeira lista que falhar', async () => {
    const client = createCatalogRestClient({
      fetchFn: createFakeCatalogFetch(catalogFicticio(), (_method, path) =>
        path.endsWith('/configurations') ? jsonResponse({ detail: 'falhou' }, 500) : undefined,
      ),
    })
    await expect(loadCatalogTree(client)).rejects.toMatchObject({ code: 'HTTP_ERROR' })
  })
})

describe('filterCatalogTree', () => {
  it('busca vazia devolve a árvore inteira', async () => {
    const loaded = await tree()
    expect(filterCatalogTree(loaded, '   ')).toBe(loaded)
  })

  it('termo de uma configuração mostra o caminho até ela, sem acentos nem maiúsculas', async () => {
    const filtered = filterCatalogTree(await tree(), 'ficticia b1')

    expect(filtered.manufacturers.map((item) => item.id)).toEqual(['FAB-B'])
    expect(cranesOf(filtered, 'FAB-B').map((item) => item.id)).toEqual(['GUI-B1'])
    expect(configurationsOf(filtered, 'GUI-B1').map((item) => item.id)).toEqual(['CFG-B1'])
  })

  it('termo de um guindaste mostra todas as configurações dele', async () => {
    const filtered = filterCatalogTree(await tree(), 'modelo fictício a1')

    expect(filtered.manufacturers.map((item) => item.id)).toEqual(['FAB-A'])
    expect(cranesOf(filtered, 'FAB-A').map((item) => item.id)).toEqual(['GUI-A1'])
    expect(configurationsOf(filtered, 'GUI-A1')).toHaveLength(2)
  })

  it('termo sem resultado esvazia a árvore', async () => {
    expect(countCatalogTree(filterCatalogTree(await tree(), 'inexistente'))).toEqual({
      manufacturers: 0,
      cranes: 0,
      configurations: 0,
    })
  })

  it('normaliza acentos e espaços', () => {
    expect(normalizeSearch('  Configuração  ')).toBe('configuracao')
  })
})
