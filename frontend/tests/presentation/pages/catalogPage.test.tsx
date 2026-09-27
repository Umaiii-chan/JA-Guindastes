// @vitest-environment jsdom
// Página Catálogo (TASK-042; CA-1 e CA-4; TASK-044 CA-5): mestre-detalhe com busca e contagens,
// detalhe da configuração com a ficha técnica e a tabela ativa (rota de listagem), cadastros e
// alterações (PATCH) em Drawer com validação no campo. Backends falsos com dados FICTÍCIOS.

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AppProviders } from '../../../src/app/AppProviders'
import { AppRoutes } from '../../../src/app/AppRoutes'
import { createCatalogRestClient } from '../../../src/infrastructure/api/catalogRestClient'
import { createLoadChartRestClient } from '../../../src/infrastructure/api/loadChartRestClient'
import { CatalogPage } from '../../../src/presentation/pages/CatalogPage'
import { ToastProvider } from '../../../src/presentation/ui'
import { catalogFicticio, GEOMETRY_DTO_FICTICIA } from '../../fixtures/catalogFicticio'
import {
  createFakeCatalogFetch,
  jsonResponse,
  validationError,
} from '../../helpers/fakeCatalogFetch'
import { combineFetch, createFakeLoadChartFetch } from '../../helpers/fakeLoadChartFetch'

async function renderCatalog() {
  const result = render(
    <MemoryRouter initialEntries={['/catalogo']}>
      <AppProviders>
        <AppRoutes />
      </AppProviders>
    </MemoryRouter>,
  )
  // A sessão (TASK-040) é conferida antes de montar as páginas; sem /auth no backend falso, o app
  // cai no modo sem autenticação.
  await waitFor(() => expect(screen.queryByText('Conferindo a sessão…')).toBeNull())
  return result
}

function column(name: string) {
  return screen.getByRole('region', { name })
}

async function openConfiguration() {
  fireEvent.click(await within(column('Fabricantes')).findByRole('button', { name: /FICTÍCIO A/ }))
  fireEvent.click(await within(column('Guindastes')).findByRole('button', { name: /A1/ }))
  fireEvent.click(await within(column('Configurações')).findByRole('button', { name: /com ficha/ }))
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    combineFetch(createFakeCatalogFetch(catalogFicticio()), createFakeLoadChartFetch()),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('página Catálogo', () => {
  it('carregando → colunas com contagens e totais', async () => {
    await renderCatalog()
    expect(screen.getByText('Carregando fabricantes…')).toBeTruthy()

    const manufacturers = await within(column('Fabricantes')).findAllByRole('button', {
      name: /Fabricante FICTÍCIO/,
    })
    expect(manufacturers.map((item) => item.textContent)).toEqual([
      'Fabricante FICTÍCIO A2 guindastes · 2 configurações',
      'Fabricante FICTÍCIO B1 guindaste · 1 configuração',
    ])
    expect(screen.getByRole('list', { name: 'Totais do catálogo' }).textContent).toBe(
      '2 fabricantes3 guindastes3 configurações',
    )
    expect(within(column('Guindastes')).getByText('Escolha um fabricante')).toBeTruthy()
  })

  it('mestre-detalhe: fabricante → guindaste → configuração, com ficha técnica e tabela ativa', async () => {
    await renderCatalog()
    await openConfiguration()

    expect(
      within(column('Guindastes')).getByRole('button', { name: /A1/ }).getAttribute('aria-current'),
    ).toBe('true')
    expect(within(column('Configurações')).getByText('sem ficha')).toBeTruthy()

    const detail = await screen.findByRole('region', { name: 'Config FICTÍCIA com ficha' })
    expect(within(detail).getByText('0,8 m')).toBeTruthy()
    expect(within(detail).getByText('2,6 m')).toBeTruthy()
    const limits = within(detail).getByRole('table', { name: /Limites/ })
    expect(within(limits).getByRole('row', { name: /Comprimento da lança/ }).textContent).toContain(
      '10 m30 m',
    )
    expect(within(limits).getByRole('row', { name: /Giro da torre/ }).textContent).toContain(
      '-90°90°',
    )
    expect(await within(detail).findByText('Nenhuma tabela ativa')).toBeTruthy()
    expect(
      within(detail)
        .getByRole('link', { name: 'Importar e gerenciar versões' })
        .getAttribute('href'),
    ).toBe('/tabelas')
  })

  it('mostra a tabela ativa da configuração pela rota nova, com a matriz', async () => {
    const source = { file_type: 'text/csv', sha256: 'a', uri: 'local://a' }
    const loadChartFetch = createFakeLoadChartFetch([
      {
        chart_id: 'TAB-ATIVA',
        version: 'v3',
        configuration_id: 'CFG-A1-FICHA',
        status: 'ACTIVE',
        points: [
          { boom_length_m: 12, working_radius_m: 4, max_capacity_kg: 9000 },
          { boom_length_m: 12, working_radius_m: 6, max_capacity_kg: 7000 },
        ],
        source: { ...source, file_name: 'v3.csv' },
      },
      {
        // Versão maior, mas rascunho: não é a ativa.
        chart_id: 'TAB-RASCUNHO',
        version: 'v4',
        configuration_id: 'CFG-A1-FICHA',
        status: 'DRAFT',
        points: [{ boom_length_m: 12, working_radius_m: 4, max_capacity_kg: 1 }],
        source: { ...source, file_name: 'v4.csv' },
      },
    ])
    vi.stubGlobal('fetch', combineFetch(createFakeCatalogFetch(catalogFicticio()), loadChartFetch))
    await renderCatalog()
    await openConfiguration()

    const detail = await screen.findByRole('region', { name: 'Config FICTÍCIA com ficha' })
    expect(await within(detail).findByText('v3')).toBeTruthy()
    const matrix = await within(detail).findByRole('table', { name: /Tabela ativa v3/ })
    expect(
      within(matrix)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual(['9.000', '7.000'])
    const urls = loadChartFetch.mock.calls.map(([url]) => String(url))
    expect(urls).toContain('/api/v1/configurations/CFG-A1-FICHA/load-charts')
    expect(urls).toContain('/api/v1/load-charts/TAB-ATIVA')
    expect(urls).not.toContain('/api/v1/load-charts/TAB-RASCUNHO')
  })

  it('versões importadas, nenhuma ativa: o detalhe diz isso', async () => {
    vi.stubGlobal(
      'fetch',
      combineFetch(
        createFakeCatalogFetch(catalogFicticio()),
        createFakeLoadChartFetch([
          {
            chart_id: 'TAB-RASCUNHO',
            version: 'v1',
            configuration_id: 'CFG-A1-FICHA',
            status: 'DRAFT',
            points: [{ boom_length_m: 12, working_radius_m: 4, max_capacity_kg: 1 }],
            source: { file_name: 'v1.csv', file_type: 'text/csv', sha256: 'a', uri: 'local://a' },
          },
        ]),
      ),
    )
    await renderCatalog()
    await openConfiguration()
    const detail = await screen.findByRole('region', { name: 'Config FICTÍCIA com ficha' })
    expect(await within(detail).findByText('Nenhuma tabela ativa')).toBeTruthy()
    expect(within(detail).getByText(/Há 1 versão importada, nenhuma ativa/)).toBeTruthy()
  })

  it('busca filtra os três níveis e destaca o termo; sem resultado, orienta', async () => {
    await renderCatalog()
    await screen.findByRole('list', { name: 'Fabricantes' })
    const search = screen.getByRole('searchbox', { name: 'Buscar no catálogo' })

    fireEvent.change(search, { target: { value: 'b1' } })
    const items = within(screen.getByRole('list', { name: 'Fabricantes' })).getAllByRole('button')
    expect(items.map((item) => item.textContent)).toEqual([
      'Fabricante FICTÍCIO B1 guindaste · 1 configuração',
    ])

    fireEvent.change(search, { target: { value: 'fabricante fictício a' } })
    expect(column('Fabricantes').querySelector('mark')?.textContent).toBe('Fabricante FICTÍCIO A')

    fireEvent.change(search, { target: { value: 'nada disso' } })
    expect(within(column('Fabricantes')).getByText('Nenhum fabricante encontrado')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Limpar a busca' }))
    expect(
      within(screen.getByRole('list', { name: 'Fabricantes' })).getAllByRole('button'),
    ).toHaveLength(2)
  })

  it('setas movem o foco dentro da lista', async () => {
    await renderCatalog()
    const [first, second] = await within(column('Fabricantes')).findAllByRole('button', {
      name: /Fabricante FICTÍCIO/,
    })
    first.focus()
    fireEvent.keyDown(first, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(second)
    fireEvent.keyDown(second, { key: 'Home' })
    expect(document.activeElement).toBe(first)
  })

  it('novo fabricante em Drawer: erro no campo, depois grava, notifica e escolhe', async () => {
    await renderCatalog()
    await screen.findByRole('list', { name: 'Fabricantes' })
    fireEvent.click(screen.getAllByRole('button', { name: 'Novo fabricante' })[0])

    const drawer = screen.getByRole('dialog', { name: 'Novo fabricante' })
    fireEvent.click(within(drawer).getByRole('button', { name: 'Cadastrar' }))
    expect(within(drawer).getByText('Obrigatório.')).toBeTruthy()
    expect(
      within(drawer)
        .getByLabelText(/Nome do fabricante/)
        .getAttribute('aria-invalid'),
    ).toBe('true')

    fireEvent.change(within(drawer).getByLabelText(/Nome do fabricante/), {
      target: { value: 'Fabricante FICTÍCIO C' },
    })
    expect(within(drawer).queryByText('Obrigatório.')).toBeNull()
    fireEvent.click(within(drawer).getByRole('button', { name: 'Cadastrar' }))

    expect(await screen.findByText('Fabricante "Fabricante FICTÍCIO C" cadastrado')).toBeTruthy()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    const created = await within(column('Fabricantes')).findByRole('button', {
      name: /Fabricante FICTÍCIO C/,
    })
    await waitFor(() => expect(created.getAttribute('aria-current')).toBe('true'))
  })

  it('nova configuração: a ficha valida no campo enquanto se digita', async () => {
    await renderCatalog()
    fireEvent.click(
      await within(column('Fabricantes')).findByRole('button', { name: /FICTÍCIO A/ }),
    )
    fireEvent.click(await within(column('Guindastes')).findByRole('button', { name: /A1/ }))
    await within(column('Configurações')).findAllByRole('button')
    fireEvent.click(
      within(column('Configurações')).getByRole('button', { name: 'Nova configuração' }),
    )

    const drawer = screen.getByRole('dialog', { name: 'Nova configuração' })
    expect(drawer.textContent).toContain('Guindaste: Modelo FICTÍCIO A1.')
    fireEvent.change(within(drawer).getByLabelText(/^h — altura/), { target: { value: '-1' } })
    expect(within(drawer).getByText('Não pode ser negativo.')).toBeTruthy()
    fireEvent.change(within(drawer).getByLabelText(/^L mín/), { target: { value: '20' } })
    fireEvent.change(within(drawer).getByLabelText(/^L máx/), { target: { value: '10' } })
    expect(within(drawer).getByText('O máximo não pode ser menor que o mínimo.')).toBeTruthy()
  })

  it('editar configuração: formulário preenchido, sem aviso de cópia; Esc fecha sem gravar', async () => {
    await renderCatalog()
    await openConfiguration()
    const detail = await screen.findByRole('region', { name: 'Config FICTÍCIA com ficha' })
    fireEvent.click(within(detail).getByRole('button', { name: 'Editar' }))

    const drawer = screen.getByRole('dialog', { name: 'Editar configuração' })
    expect(within(drawer).queryByText('A edição grava uma cópia')).toBeNull()
    expect((within(drawer).getByLabelText(/Nome da configuração/) as HTMLInputElement).value).toBe(
      'Config FICTÍCIA com ficha',
    )
    expect((within(drawer).getByLabelText(/^a —/) as HTMLInputElement).value).toBe('0.8')
    // A ficha pode ser alterada, não removida (o PATCH não aceita geometry: null).
    expect(within(drawer).queryByRole('checkbox')).toBeNull()
    expect(within(drawer).getByRole('button', { name: 'Salvar alterações' })).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('catálogo vazio: orienta a cadastrar o primeiro fabricante', async () => {
    vi.stubGlobal(
      'fetch',
      combineFetch(
        createFakeCatalogFetch({ manufacturers: [], cranes: [], configurations: [] }),
        createFakeLoadChartFetch(),
      ),
    )
    await renderCatalog()
    expect(await screen.findByText('O catálogo está vazio')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Cadastrar fabricante' })).toBeTruthy()
  })

  it('erro do backend: alerta e "Tentar de novo" recarrega', async () => {
    let failing = true
    vi.stubGlobal(
      'fetch',
      combineFetch(
        createFakeCatalogFetch(catalogFicticio(), () =>
          failing ? jsonResponse({ detail: 'Bad Gateway' }, 502) : undefined,
        ),
        createFakeLoadChartFetch(),
      ),
    )
    await renderCatalog()
    const alert = await screen.findByText('Não foi possível ler o catálogo')
    failing = false
    fireEvent.click(
      within(alert.closest('[role="alert"]') as HTMLElement).getByRole('button', {
        name: 'Tentar de novo',
      }),
    )
    const list = await screen.findByRole('list', { name: 'Fabricantes' })
    expect(within(list).getAllByRole('button')).toHaveLength(2)
  })
})

describe('página Catálogo — edição com PATCH (TASK-044)', () => {
  const ACTIVE_CHART = {
    chart_id: 'TAB-ATIVA',
    version: 'v3',
    configuration_id: 'CFG-A1-FICHA',
    status: 'ACTIVE' as const,
    points: [{ boom_length_m: 12, working_radius_m: 4, max_capacity_kg: 9000 }],
    source: { file_name: 'v3.csv', file_type: 'text/csv', sha256: 'a', uri: 'local://a' },
  }

  function stubBackend(charts: Parameters<typeof createFakeLoadChartFetch>[0] = []) {
    const data = catalogFicticio()
    const catalogFetch = createFakeCatalogFetch(data)
    vi.stubGlobal('fetch', combineFetch(catalogFetch, createFakeLoadChartFetch(charts)))
    const patches = () =>
      catalogFetch.mock.calls
        .filter(([, init]) => init?.method === 'PATCH')
        .map(([url, init]) => ({
          url: String(url),
          body: JSON.parse(String(init?.body)) as unknown,
        }))
    return { data, patches }
  }

  async function openEditor() {
    await renderCatalog()
    await openConfiguration()
    const detail = await screen.findByRole('region', { name: 'Config FICTÍCIA com ficha' })
    return { detail }
  }

  it('renomear a configuração grava no próprio item, sem criar outro', async () => {
    const { data, patches } = stubBackend()
    const { detail } = await openEditor()
    fireEvent.click(within(detail).getByRole('button', { name: 'Editar' }))
    const drawer = screen.getByRole('dialog', { name: 'Editar configuração' })
    fireEvent.change(within(drawer).getByLabelText(/Nome da configuração/), {
      target: { value: 'Config FICTÍCIA renomeada' },
    })
    fireEvent.click(within(drawer).getByRole('button', { name: 'Salvar alterações' }))

    expect(await screen.findByText('Configuração alterada')).toBeTruthy()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(patches()).toEqual([
      { url: '/api/v1/configurations/CFG-A1-FICHA', body: { name: 'Config FICTÍCIA renomeada' } },
    ])
    expect(data.configurations).toHaveLength(3)
    expect(await screen.findByRole('region', { name: 'Config FICTÍCIA renomeada' })).toBeTruthy()
  })

  it('mudar a ficha de uma configuração com tabela ativa pede confirmação; voltar mantém o formulário', async () => {
    const { patches } = stubBackend([ACTIVE_CHART])
    const { detail } = await openEditor()
    await within(detail).findByRole('table', { name: /Tabela ativa v3/ })
    fireEvent.click(within(detail).getByRole('button', { name: 'Editar' }))
    let drawer = screen.getByRole('dialog', { name: 'Editar configuração' })
    fireEvent.change(within(drawer).getByLabelText(/^h — altura/), { target: { value: '3.1' } })
    fireEvent.click(within(drawer).getByRole('button', { name: 'Salvar alterações' }))

    let confirm = screen.getByRole('dialog', {
      name: 'Mudar a ficha técnica de Config FICTÍCIA com ficha?',
    })
    expect(confirm.textContent).toContain('As avaliações seguintes desta configuração mudam')
    expect(confirm.textContent).toContain('A tabela ativa (v3) continua a mesma')
    expect(patches()).toEqual([])

    fireEvent.click(within(confirm).getByRole('button', { name: 'Voltar ao formulário' }))
    drawer = screen.getByRole('dialog', { name: 'Editar configuração' })
    expect((within(drawer).getByLabelText(/^h — altura/) as HTMLInputElement).value).toBe('3.1')

    fireEvent.click(within(drawer).getByRole('button', { name: 'Salvar alterações' }))
    confirm = screen.getByRole('dialog', { name: /Mudar a ficha técnica/ })
    fireEvent.click(within(confirm).getByRole('button', { name: 'Salvar a ficha nova' }))

    expect(await screen.findByText('Configuração alterada')).toBeTruthy()
    expect(
      screen.getByText(
        'A ficha nova vale para as próximas avaliações; as tabelas de carga não mudaram.',
      ),
    ).toBeTruthy()
    const [patch] = patches()
    expect(patch.url).toBe('/api/v1/configurations/CFG-A1-FICHA')
    expect(patch.body).toEqual({ geometry: { ...GEOMETRY_DTO_FICTICIA, boom_pivot_height_m: 3.1 } })
    const updated = await screen.findByRole('region', { name: 'Config FICTÍCIA com ficha' })
    expect(await within(updated).findByText('3,1 m')).toBeTruthy()
  })

  it('sem tabela ativa, mudar a ficha grava direto', async () => {
    const { patches } = stubBackend()
    const { detail } = await openEditor()
    await within(detail).findByText('Nenhuma tabela ativa')
    fireEvent.click(within(detail).getByRole('button', { name: 'Editar' }))
    const drawer = screen.getByRole('dialog', { name: 'Editar configuração' })
    fireEvent.change(within(drawer).getByLabelText(/^h — altura/), { target: { value: '3.1' } })
    fireEvent.click(within(drawer).getByRole('button', { name: 'Salvar alterações' }))

    expect(await screen.findByText('Configuração alterada')).toBeTruthy()
    expect(screen.queryByRole('dialog', { name: /Mudar a ficha técnica/ })).toBeNull()
    expect(patches()).toHaveLength(1)
  })

  it('nada mudou: avisa no Drawer e não chama o backend', async () => {
    const { patches } = stubBackend()
    const { detail } = await openEditor()
    fireEvent.click(within(detail).getByRole('button', { name: 'Editar' }))
    const drawer = screen.getByRole('dialog', { name: 'Editar configuração' })
    fireEvent.click(within(drawer).getByRole('button', { name: 'Salvar alterações' }))
    expect(within(drawer).getByText('Nada mudou: não há o que salvar.')).toBeTruthy()
    expect(patches()).toEqual([])
  })

  it('nome igual ao de outra configuração é aceito (sem 409)', async () => {
    const { patches } = stubBackend()
    const { detail } = await openEditor()
    fireEvent.click(within(detail).getByRole('button', { name: 'Editar' }))
    const drawer = screen.getByRole('dialog', { name: 'Editar configuração' })
    const nameInput = within(drawer).getByLabelText(/Nome da configuração/)

    // Nomes não são únicos no backend (sem 409): o nome de outra configuração é aceito.
    fireEvent.change(nameInput, { target: { value: 'Config FICTÍCIA sem ficha' } })
    fireEvent.click(within(drawer).getByRole('button', { name: 'Salvar alterações' }))
    expect(await screen.findByText('Configuração alterada')).toBeTruthy()
    expect(patches()).toEqual([
      { url: '/api/v1/configurations/CFG-A1-FICHA', body: { name: 'Config FICTÍCIA sem ficha' } },
    ])
  })

  it('422 do backend num campo da ficha vai para o campo', async () => {
    const data = catalogFicticio()
    vi.stubGlobal(
      'fetch',
      combineFetch(
        createFakeCatalogFetch(data, (method) =>
          method === 'PATCH'
            ? jsonResponse(
                validationError(['geometry', 'boom_angle_max_deg'], 'Value error, θ fora da faixa'),
                422,
              )
            : undefined,
        ),
        createFakeLoadChartFetch(),
      ),
    )
    const { detail } = await openEditor()
    await within(detail).findByText('Nenhuma tabela ativa')
    fireEvent.click(within(detail).getByRole('button', { name: 'Editar' }))
    const drawer = screen.getByRole('dialog', { name: 'Editar configuração' })
    fireEvent.change(within(drawer).getByLabelText(/^θ máx/), { target: { value: '80' } })
    fireEvent.click(within(drawer).getByRole('button', { name: 'Salvar alterações' }))
    expect(await within(drawer).findByText('Value error, θ fora da faixa')).toBeTruthy()
    expect(
      within(drawer)
        .getByLabelText(/^θ máx/)
        .getAttribute('aria-invalid'),
    ).toBe('true')
  })

  it('404: o item sumiu — toast, Drawer fechado e catálogo relido', async () => {
    const { data } = stubBackend()
    await renderCatalog()
    fireEvent.click(
      await within(column('Fabricantes')).findByRole('button', { name: /FICTÍCIO B/ }),
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Editar o fabricante Fabricante FICTÍCIO B' }),
    )
    const drawer = screen.getByRole('dialog', { name: 'Editar fabricante' })
    data.manufacturers = data.manufacturers.filter((row) => row.id !== 'FAB-B')
    fireEvent.change(within(drawer).getByLabelText(/Nome do fabricante/), {
      target: { value: 'Fabricante FICTÍCIO B+' },
    })
    fireEvent.click(within(drawer).getByRole('button', { name: 'Salvar alterações' }))

    expect(await screen.findByText('O fabricante não existe mais')).toBeTruthy()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() =>
      expect(
        within(column('Fabricantes')).queryByRole('button', { name: /FICTÍCIO B/ }),
      ).toBeNull(),
    )
  })

  it('renomear o guindaste atualiza a coluna', async () => {
    const { patches } = stubBackend()
    await renderCatalog()
    fireEvent.click(
      await within(column('Fabricantes')).findByRole('button', { name: /FICTÍCIO A/ }),
    )
    fireEvent.click(await within(column('Guindastes')).findByRole('button', { name: /A1/ }))
    fireEvent.click(
      await screen.findByRole('button', { name: 'Editar o guindaste Modelo FICTÍCIO A1' }),
    )
    const drawer = screen.getByRole('dialog', { name: 'Editar guindaste' })
    fireEvent.change(within(drawer).getByLabelText(/Modelo do guindaste/), {
      target: { value: 'Modelo FICTÍCIO A1 revisto' },
    })
    fireEvent.click(within(drawer).getByRole('button', { name: 'Salvar alterações' }))

    expect(
      await screen.findByText('Guindaste renomeado para "Modelo FICTÍCIO A1 revisto"'),
    ).toBeTruthy()
    expect(patches()).toEqual([
      { url: '/api/v1/cranes/GUI-A1', body: { model_name: 'Modelo FICTÍCIO A1 revisto' } },
    ])
    expect(
      await within(column('Guindastes')).findByRole('button', { name: /A1 revisto/ }),
    ).toBeTruthy()
  })
})

describe('CatalogPage somente leitura', () => {
  it('sem permissão de edição: navega, mas sem botões de cadastro nem edição', async () => {
    const catalogGateway = createCatalogRestClient({
      fetchFn: createFakeCatalogFetch(catalogFicticio()),
    })
    const noop = () => undefined
    const reject = () => Promise.reject(new Error('não deveria gravar'))
    render(
      <MemoryRouter>
        <ToastProvider>
          <CatalogPage
            selection={{
              selectedManufacturerId: 'FAB-A',
              selectedCraneId: 'GUI-A1',
              selectedConfigurationId: 'CFG-A1-FICHA',
              onSelectManufacturer: noop,
              onSelectCrane: noop,
              onSelectConfiguration: noop,
            }}
            catalogGateway={catalogGateway}
            loadChartGateway={createLoadChartRestClient({ fetchFn: createFakeLoadChartFetch() })}
            canEdit={false}
            onCreateManufacturer={reject}
            onCreateCrane={reject}
            onCreateConfiguration={reject}
            onUpdateManufacturer={reject}
            onUpdateCrane={reject}
            onUpdateConfiguration={reject}
          />
        </ToastProvider>
      </MemoryRouter>,
    )
    expect(await screen.findByRole('region', { name: 'Config FICTÍCIA com ficha' })).toBeTruthy()
    expect(screen.getByText('Somente leitura')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Novo|Nova|Editar|Cadastrar/ })).toBeNull()
  })
})
