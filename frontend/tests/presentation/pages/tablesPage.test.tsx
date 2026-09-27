// @vitest-environment jsdom
// Página Tabelas de carga (TASK-042; CA-2, CA-3 e CA-4), com os backends de catálogo e de tabelas
// falsos e os CSVs FICTÍCIOS de demonstração (backend/app/demo_data/).

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AppProviders } from '../../../src/app/AppProviders'
import { AppRoutes } from '../../../src/app/AppRoutes'
import { createLoadChartRestClient } from '../../../src/infrastructure/api/loadChartRestClient'
import { TablesPage } from '../../../src/presentation/pages/TablesPage'
import { ToastProvider } from '../../../src/presentation/ui'
import { catalogFicticio } from '../../fixtures/catalogFicticio'
import { createFakeCatalogFetch, jsonResponse } from '../../helpers/fakeCatalogFetch'
import { combineFetch, createFakeLoadChartFetch } from '../../helpers/fakeLoadChartFetch'

function demoCsv(name: string): File {
  // Os testes rodam em frontend/ (npm test).
  const path = resolve(process.cwd(), '../backend/app/demo_data', name)
  return new File([readFileSync(path, 'utf8')], name, { type: 'text/csv' })
}

async function renderTables() {
  const result = render(
    <MemoryRouter initialEntries={['/tabelas']}>
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

async function chooseConfiguration() {
  const selection = screen.getByRole('region', { name: 'Guindaste e configuração' })
  await within(selection).findByRole('option', { name: 'Fabricante FICTÍCIO A' })
  fireEvent.change(within(selection).getByLabelText('Fabricante'), { target: { value: 'FAB-A' } })
  await within(selection).findByRole('option', { name: 'Modelo FICTÍCIO A1' })
  fireEvent.change(within(selection).getByLabelText('Guindaste'), { target: { value: 'GUI-A1' } })
  await within(selection).findByRole('option', { name: /Config FICTÍCIA com ficha/ })
  fireEvent.change(within(selection).getByLabelText('Configuração'), {
    target: { value: 'CFG-A1-FICHA' },
  })
}

function drop(file: File) {
  fireEvent.change(screen.getByLabelText('Arquivo da tabela de carga (CSV ou XLSX)'), {
    target: { files: [file] },
  })
}

let loadChartFetch: ReturnType<typeof createFakeLoadChartFetch>

beforeEach(() => {
  loadChartFetch = createFakeLoadChartFetch()
  vi.stubGlobal('fetch', combineFetch(createFakeCatalogFetch(catalogFicticio()), loadChartFetch))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('página Tabelas', () => {
  it('sem configuração: pede a escolha, e a linha do tempo explica', async () => {
    await renderTables()
    expect(screen.getByRole('heading', { level: 1, name: 'Tabelas' })).toBeTruthy()
    expect(screen.getByText('Escolha a configuração')).toBeTruthy()
    expect(screen.getByText('Escolha uma configuração')).toBeTruthy()
  })

  it('arquivo com erros: relatório em tabela com linha e coluna, sem liberar a importação', async () => {
    await renderTables()
    await chooseConfiguration()
    expect(await screen.findByText('Nenhuma versão importada')).toBeTruthy()

    drop(demoCsv('tabela_carga_ficticia_demo_com_erros.csv'))

    const report = await screen.findByRole('table', {
      name: 'Problemas encontrados em tabela_carga_ficticia_demo_com_erros.csv',
    })
    const rows = within(report).getAllByRole('row').slice(1)
    const cells = rows.map((row) =>
      within(row)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    )
    expect(cells).toContainEqual([
      '3',
      'working_radius_m',
      'Valor não numérico: "abc".INVALID_NUMBER',
    ])
    expect(cells.some(([line, column]) => line === '4' && column === 'max_capacity_kg')).toBe(true)
    expect(
      screen
        .getByText(/problemas encontrados/)
        .closest('[data-status]')
        ?.getAttribute('data-status'),
    ).toBe('invalid')
    expect(
      (screen.getByRole('button', { name: 'Importar como rascunho' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true)
  })

  it('arquivo válido: prévia da matriz colorida; importar; ativar com confirmação e toast', async () => {
    await renderTables()
    await chooseConfiguration()
    await screen.findByText('Nenhuma versão importada')

    drop(demoCsv('tabela_carga_ficticia_demo_v1.csv'))

    // Validação prévia: /validate, sem gravar.
    const matrix = await screen.findByRole('table', {
      name: /Prévia de tabela_carga_ficticia_demo_v1\.csv/,
    })
    expect(loadChartFetch.mock.calls.map(([url]) => String(url))).toContain(
      '/api/v1/load-charts/validate',
    )
    expect(within(matrix).getAllByRole('columnheader')[1].textContent).toBe('1 m')
    const firstRow = within(matrix).getAllByRole('row')[1]
    expect(within(firstRow).getByRole('rowheader').textContent).toBe('12 m')
    const cell = within(firstRow).getAllByRole('cell')[0]
    expect(cell.textContent).toBe('12.000')
    expect(cell.getAttribute('data-band')).toBe('4')
    expect(screen.getByRole('list', { name: 'Legenda de cores da capacidade' })).toBeTruthy()

    // Versão e id sugeridos.
    expect((screen.getByLabelText(/^Versão/) as HTMLInputElement).value).toBe('v1')
    expect((screen.getByLabelText(/^Id da tabela/) as HTMLInputElement).value).toBe(
      'CFG-A1-FICHA-v1',
    )

    const listings = () =>
      loadChartFetch.mock.calls.filter(([url]) => String(url).endsWith('/load-charts')).length
    const beforeImport = listings()
    fireEvent.click(screen.getByRole('button', { name: 'Importar como rascunho' }))
    expect(await screen.findByText('Versão v1 importada')).toBeTruthy()

    // Depois de importar, a lista é relida da rota nova.
    const timeline = await screen.findByRole('list', { name: 'Linha do tempo das versões' })
    await within(timeline).findByText('Rascunho')
    expect(listings()).toBe(beforeImport + 1)

    fireEvent.click(within(timeline).getByRole('button', { name: 'Ativar v1' }))
    const dialog = screen.getByRole('dialog', { name: 'Ativar a versão v1?' })
    expect(dialog.textContent).toContain('A capacidade calculada muda')
    expect(dialog.textContent).toContain('não tem versão ativa hoje')

    fireEvent.click(within(dialog).getByRole('button', { name: 'Ativar v1' }))
    expect(await screen.findByText('Versão v1 ativada')).toBeTruthy()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    const active = await within(timeline).findByText('Ativa')
    expect(active.closest('li')?.getAttribute('aria-current')).toBe('true')
    // Depois de ativar, também.
    expect(listings()).toBe(beforeImport + 2)
  })

  it('segunda versão: o Dialog compara com a ativa; a antiga vira Substituída', async () => {
    await renderTables()
    await chooseConfiguration()
    await screen.findByText('Nenhuma versão importada')

    for (const version of ['v1', 'v2']) {
      const name = `tabela_carga_ficticia_demo_${version}.csv`
      drop(demoCsv(name))
      await screen.findByRole('table', {
        name: new RegExp(`^Prévia de tabela_carga_ficticia_demo_${version}`),
      })
      fireEvent.click(screen.getByRole('button', { name: 'Importar como rascunho' }))
      await screen.findByText(`Versão ${version} importada`)
      if (version === 'v1') {
        const timeline = await screen.findByRole('list', { name: 'Linha do tempo das versões' })
        fireEvent.click(await within(timeline).findByRole('button', { name: 'Ativar v1' }))
        fireEvent.click(
          within(screen.getByRole('dialog')).getByRole('button', { name: 'Ativar v1' }),
        )
        await screen.findByText('Versão v1 ativada')
        await within(timeline).findByText('Ativa')
      }
    }

    const timeline = screen.getByRole('list', { name: 'Linha do tempo das versões' })
    fireEvent.click(await within(timeline).findByRole('button', { name: 'Ativar v2' }))
    const dialog = screen.getByRole('dialog', { name: 'Ativar a versão v2?' })
    expect(dialog.textContent).toContain('A v1, ativa hoje, passa a Substituída')
    const comparison = within(dialog).getByLabelText('Comparação com a versão ativa')
    expect(comparison.textContent).toContain('27 diminuem (até −10 %)')

    fireEvent.click(within(dialog).getByRole('button', { name: 'Ativar v2' }))
    expect(await screen.findByText('Versão v2 ativada')).toBeTruthy()
    await waitFor(() => expect(within(timeline).getByText('Substituída')).toBeTruthy())
  })

  it('falha na ativação: toast de erro e a lista é relida', async () => {
    await renderTables()
    await chooseConfiguration()
    await screen.findByText('Nenhuma versão importada')
    drop(demoCsv('tabela_carga_ficticia_demo_v1.csv'))
    await screen.findByRole('table', { name: /Prévia de/ })
    fireEvent.click(screen.getByRole('button', { name: 'Importar como rascunho' }))
    await screen.findByText('Versão v1 importada')

    loadChartFetch.mockImplementationOnce(async () =>
      jsonResponse({ detail: 'mudou ao mesmo tempo' }, 409),
    )
    const timeline = await screen.findByRole('list', { name: 'Linha do tempo das versões' })
    fireEvent.click(await within(timeline).findByRole('button', { name: 'Ativar v1' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Ativar v1' }))

    const alert = await screen.findByText('Não foi possível ativar a v1')
    expect(alert.closest('[role="alert"]')?.textContent).toContain('mudou ao mesmo tempo')
  })

  it('linha do tempo pela rota nova: tabelas gravadas em outro lugar, a mais recente primeiro e a ativa na matriz', async () => {
    const source = { file_type: 'text/csv', sha256: 'a', uri: 'local://a' }
    loadChartFetch = createFakeLoadChartFetch([
      {
        chart_id: 'TAB-V6',
        version: 'v6',
        configuration_id: 'CFG-A1-FICHA',
        status: 'SUPERSEDED',
        points: [{ boom_length_m: 12, working_radius_m: 4, max_capacity_kg: 8000 }],
        source: { ...source, file_name: 'v6.csv' },
      },
      {
        chart_id: 'TAB-V7',
        version: 'v7',
        configuration_id: 'CFG-A1-FICHA',
        status: 'ACTIVE',
        points: [
          { boom_length_m: 12, working_radius_m: 4, max_capacity_kg: 9000 },
          { boom_length_m: 12, working_radius_m: 6, max_capacity_kg: 7000 },
        ],
        source: { ...source, file_name: 'v7.csv' },
      },
      {
        chart_id: 'TAB-V8',
        version: 'v8',
        configuration_id: 'CFG-A1-FICHA',
        status: 'DRAFT',
        points: [{ boom_length_m: 12, working_radius_m: 4, max_capacity_kg: 9500 }],
        source: { ...source, file_name: 'v8.csv' },
      },
      {
        chart_id: 'TAB-OUTRA',
        version: 'v1',
        configuration_id: 'CFG-A1-SEM',
        status: 'ACTIVE',
        points: [{ boom_length_m: 12, working_radius_m: 4, max_capacity_kg: 1 }],
        source: { ...source, file_name: 'outra.csv' },
      },
    ])
    vi.stubGlobal('fetch', combineFetch(createFakeCatalogFetch(catalogFicticio()), loadChartFetch))
    await renderTables()
    await chooseConfiguration()

    const timeline = await screen.findByRole('list', { name: 'Linha do tempo das versões' })
    const items = within(timeline).getAllByRole('listitem')
    expect(items.map((item) => item.getAttribute('data-status'))).toEqual([
      'DRAFT',
      'ACTIVE',
      'SUPERSEDED',
    ])
    expect(items[1].getAttribute('aria-current')).toBe('true')
    expect(items[1].textContent).toContain('v7')
    expect(items[1].textContent).toContain('Pontos2')
    expect(loadChartFetch.mock.calls.map(([url]) => String(url))).toContain(
      '/api/v1/configurations/CFG-A1-FICHA/load-charts',
    )
    // O contorno da TASK-042 saiu: nada de acompanhar pelo id nem de localStorage.
    expect(screen.queryByLabelText(/Acompanhar uma tabela pelo id/)).toBeNull()
    expect(window.localStorage.getItem('ja-guindastes.known-load-charts.v1')).toBeNull()

    // A matriz da ativa vem do GET /load-charts/{id} (a listagem não traz os pontos).
    const matrix = await screen.findByRole('table', { name: /Versão v7/ })
    expect(
      within(matrix)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual(['9.000', '7.000'])
    fireEvent.click(within(items[2]).getByRole('button', { name: 'Ver matriz' }))
    expect(await screen.findByRole('table', { name: /Versão v6/ })).toBeTruthy()
    // Sugere a versão seguinte à maior da configuração.
    expect((screen.getByRole('textbox', { name: /^Versão/ }) as HTMLInputElement).value).toBe(
      'v9',
    )
  })

  it('configuração que sumiu (404 na listagem): alerta com a mensagem', async () => {
    loadChartFetch = createFakeLoadChartFetch([], { configurationIds: [] })
    vi.stubGlobal('fetch', combineFetch(createFakeCatalogFetch(catalogFicticio()), loadChartFetch))
    await renderTables()
    await chooseConfiguration()
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Não foi possível ler as versões')
    expect(alert.textContent).toContain('A configuração não existe mais (HTTP 404)')
  })

  it('XLSX passa pela conferência local e fica para a importação; outro formato é recusado', async () => {
    await renderTables()
    await chooseConfiguration()
    await screen.findByText('Nenhuma versão importada')

    drop(new File(['PK'], 'tabela.xlsx'))
    expect(await screen.findByText(/O conteúdo é validado na importação/)).toBeTruthy()
    expect(
      (screen.getByRole('button', { name: 'Importar como rascunho' }) as HTMLButtonElement)
        .disabled,
    ).toBe(false)

    await act(async () => drop(new File(['x'], 'tabela.pdf')))
    expect(screen.getByText(/não é CSV nem XLSX/)).toBeTruthy()
    expect(loadChartFetch.mock.calls.some(([url]) => String(url).endsWith('/validate'))).toBe(false)
  })

  it('erro ao ler as versões: alerta com "Tentar de novo", que relê a lista', async () => {
    let failing = true
    const working = createFakeLoadChartFetch()
    loadChartFetch.mockImplementation(async (input, init) => {
      if (failing) throw new TypeError('rede')
      return working(input, init)
    })
    await renderTables()
    await chooseConfiguration()
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Não foi possível ler as versões')
    failing = false
    fireEvent.click(within(alert).getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByText('Nenhuma versão importada')).toBeTruthy()
  })
})

describe('TablesPage somente leitura', () => {
  it('sem permissão de edição: sem área de importação nem botão Ativar', async () => {
    const gateway = createLoadChartRestClient({
      fetchFn: createFakeLoadChartFetch([
        {
          chart_id: 'TAB-D',
          version: 'v1',
          configuration_id: 'CFG-X',
          status: 'DRAFT',
          points: [{ boom_length_m: 12, working_radius_m: 4, max_capacity_kg: 9000 }],
          source: { file_name: 'd.csv', file_type: 'text/csv', sha256: 'a', uri: 'local://a' },
        },
      ]),
    })
    render(
      <MemoryRouter>
        <ToastProvider>
          <TablesPage
            selection={{
              manufacturers: { status: 'loaded', items: [], error: null },
              cranes: { status: 'idle', items: [], error: null },
              configurations: { status: 'idle', items: [], error: null },
              selectedManufacturerId: null,
              selectedCraneId: null,
              selectedConfigurationId: null,
              onSelectManufacturer: () => undefined,
              onSelectCrane: () => undefined,
              onSelectConfiguration: () => undefined,
            }}
            configuration={{ id: 'CFG-X', craneId: 'GUI-X', name: 'Config X', geometry: null }}
            gateway={gateway}
            canEdit={false}
          />
        </ToastProvider>
      </MemoryRouter>,
    )
    expect(screen.getAllByText('Somente leitura').length).toBeGreaterThan(0)
    expect(screen.queryByLabelText('Arquivo da tabela de carga (CSV ou XLSX)')).toBeNull()
    const timeline = await screen.findByRole('list', { name: 'Linha do tempo das versões' })
    expect(within(timeline).getByText('Rascunho')).toBeTruthy()
    expect(within(timeline).queryByRole('button', { name: /Ativar/ })).toBeNull()
    expect(within(timeline).getByRole('button', { name: 'Ver matriz' })).toBeTruthy()
  })
})
