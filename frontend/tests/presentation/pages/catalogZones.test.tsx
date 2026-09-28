// @vitest-environment jsdom
// Página Catálogo com zonas de giro e peso do gancho (TASK-046; CA-4): editor de zonas com o atalho
// e a edição manual, validação local de cobertura, diagrama, campo do gancho, detalhe com a tabela
// ativa de cada zona e os erros 409 ROTATION_ZONE_IN_USE e 422 INVALID_ROTATION_ZONES. Backends
// falsos com dados FICTÍCIOS.

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AppProviders } from '../../../src/app/AppProviders'
import { AppRoutes } from '../../../src/app/AppRoutes'
import {
  catalogComZonasFicticio,
  catalogFicticio,
  ZONAS_DTO_FICTICIAS,
} from '../../fixtures/catalogFicticio'
import {
  createFakeCatalogFetch,
  type FakeCatalogData,
  type FakeCatalogOptions,
  jsonResponse,
} from '../../helpers/fakeCatalogFetch'
import {
  type ChartRow,
  combineFetch,
  createFakeLoadChartFetch,
} from '../../helpers/fakeLoadChartFetch'

const SOURCE = { file_type: 'text/csv', sha256: 'a', uri: 'local://a' }
const POINTS = [{ boom_length_m: 12, working_radius_m: 4, max_capacity_kg: 9000 }]

function chartRow(
  chartId: string,
  version: string,
  zone: string,
  status: ChartRow['status'],
): ChartRow {
  return {
    chart_id: chartId,
    version,
    configuration_id: 'CFG-A1-FICHA',
    status,
    points: POINTS,
    source: { ...SOURCE, file_name: `${chartId}.csv` },
    rotation_zone_code: zone,
  }
}

function stubBackend(
  data: FakeCatalogData,
  charts: ChartRow[] = [],
  options: FakeCatalogOptions = {},
  intercept?: Parameters<typeof createFakeCatalogFetch>[1],
) {
  const catalogFetch = createFakeCatalogFetch(data, intercept, options)
  vi.stubGlobal('fetch', combineFetch(catalogFetch, createFakeLoadChartFetch(charts)))
  const writes = () =>
    catalogFetch.mock.calls
      .filter(([, init]) => init?.method === 'PATCH' || init?.method === 'POST')
      .map(([url, init]) => ({
        method: init?.method,
        url: String(url),
        body: JSON.parse(String(init?.body)) as Record<string, unknown>,
      }))
  return { writes }
}

async function renderCatalog() {
  render(
    <MemoryRouter initialEntries={['/catalogo']}>
      <AppProviders>
        <AppRoutes />
      </AppProviders>
    </MemoryRouter>,
  )
  await waitFor(() => expect(screen.queryByText('Conferindo a sessão…')).toBeNull())
}

function column(name: string) {
  return screen.getByRole('region', { name })
}

async function openConfiguration() {
  fireEvent.click(await within(column('Fabricantes')).findByRole('button', { name: /FICTÍCIO A/ }))
  fireEvent.click(await within(column('Guindastes')).findByRole('button', { name: /A1/ }))
  fireEvent.click(await within(column('Configurações')).findByRole('button', { name: /com ficha/ }))
  return screen.findByRole('region', { name: 'Config FICTÍCIA com ficha' })
}

async function openEditDrawer() {
  const detail = await openConfiguration()
  fireEvent.click(within(detail).getByRole('button', { name: 'Editar' }))
  return screen.getByRole('dialog', { name: 'Editar configuração' })
}

function zonesList(drawer: HTMLElement) {
  return within(drawer).getByRole('list', { name: 'Zonas de giro' })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('página Catálogo — zonas de giro e gancho (TASK-046)', () => {
  it('o detalhe mostra o gancho, as zonas com o setor e a tabela ativa de cada uma', async () => {
    stubBackend(catalogComZonasFicticio(), [
      chartRow('F1', 'v1', 'FRONTAL', 'ACTIVE'),
      chartRow('L1', 'v2', 'LATERAL_TRASEIRA', 'SUPERSEDED'),
      chartRow('L2', 'v3', 'LATERAL_TRASEIRA', 'DRAFT'),
    ])
    await renderCatalog()
    const detail = await openConfiguration()

    expect(within(detail).getByText('180 kg')).toBeTruthy()
    const table = await within(detail).findByRole('table', {
      name: 'Zonas de giro e a tabela ativa de cada uma',
    })
    await waitFor(() =>
      expect(
        within(table)
          .getAllByRole('row')
          .slice(1)
          .map((row) => row.textContent),
      ).toEqual([
        'Frontal FICTÍCIAFRONTAL305° → 55° (110°)v1 F1.csv',
        'Lateral e traseira FICTÍCIALATERAL_TRASEIRA55° → 305° (250°)nenhuma',
      ]),
    )
    expect(within(detail).getByRole('img', { name: /Setores das zonas de giro/ })).toBeTruthy()
    // A matriz mostrada é a da primeira zona com tabela ativa.
    expect(
      await within(detail).findByRole('table', {
        name: /^Tabela ativa v1 da zona Frontal FICTÍCIA:/,
      }),
    ).toBeTruthy()
  })

  it('sem zonas, o detalhe continua como antes e o gancho aparece como não informado', async () => {
    stubBackend(catalogFicticio())
    await renderCatalog()
    const detail = await openConfiguration()
    expect(within(detail).getByText('não informado (conta como 0 kg)')).toBeTruthy()
    expect(within(detail).getByRole('heading', { name: 'Tabela de carga ativa' })).toBeTruthy()
    expect(within(detail).queryByRole('table', { name: /Zonas de giro/ })).toBeNull()
  })

  it('atalho "Frontal 110° + lateral e traseira 250°" e peso do gancho: grava no PATCH', async () => {
    const { writes } = stubBackend(catalogFicticio())
    await renderCatalog()
    const drawer = await openEditDrawer()

    expect(within(drawer).getByText('Sem zonas: uma tabela vale para todo o giro.')).toBeTruthy()
    fireEvent.click(
      within(drawer).getByRole('button', { name: 'Frontal 110° + lateral e traseira 250°' }),
    )
    const rows = within(zonesList(drawer)).getAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect((within(rows[0]).getByLabelText(/^Início/) as HTMLInputElement).value).toBe('305')
    expect((within(rows[0]).getByLabelText(/^Fim/) as HTMLInputElement).value).toBe('55')
    expect((within(rows[1]).getByLabelText(/^Início/) as HTMLInputElement).value).toBe('55')
    expect((within(rows[1]).getByLabelText(/^Fim/) as HTMLInputElement).value).toBe('305')
    expect(within(drawer).getByRole('img', { name: /Frontal 305° → 55° \(110°\)/ })).toBeTruthy()

    fireEvent.change(within(drawer).getByLabelText(/Peso do gancho/), { target: { value: '180' } })
    fireEvent.click(within(drawer).getByRole('button', { name: 'Salvar alterações' }))

    expect(await screen.findByText('Configuração alterada')).toBeTruthy()
    expect(
      screen.getByText(
        'As zonas de giro e o peso do gancho novos valem para as próximas avaliações.',
      ),
    ).toBeTruthy()
    expect(writes()).toEqual([
      {
        method: 'PATCH',
        url: '/api/v1/configurations/CFG-A1-FICHA',
        body: {
          rotation_zones: [
            { code: 'FRONTAL', name: 'Frontal', start_deg: 305, end_deg: 55 },
            { code: 'LATERAL_TRASEIRA', name: 'Lateral e traseira', start_deg: 55, end_deg: 305 },
          ],
          hook_block_weight_kg: 180,
        },
      },
    ])
    const detail = await screen.findByRole('region', { name: 'Config FICTÍCIA com ficha' })
    expect(await within(detail).findByText('180 kg')).toBeTruthy()
  })

  it('edição manual: lacuna na cobertura dá mensagem clara e não grava; corrigir libera', async () => {
    const { writes } = stubBackend(catalogFicticio())
    await renderCatalog()
    const drawer = await openEditDrawer()

    fireEvent.click(within(drawer).getByRole('button', { name: 'Adicionar zona' }))
    fireEvent.click(within(drawer).getByRole('button', { name: 'Adicionar zona' }))
    const rows = within(zonesList(drawer)).getAllByRole('listitem')
    const fill = (row: HTMLElement, code: string, name: string, start: string, end: string) => {
      fireEvent.change(within(row).getByLabelText(/^Código/), { target: { value: code } })
      fireEvent.change(within(row).getByLabelText(/^Nome/), { target: { value: name } })
      fireEvent.change(within(row).getByLabelText(/^Início/), { target: { value: start } })
      fireEvent.change(within(row).getByLabelText(/^Fim/), { target: { value: end } })
    }
    fill(rows[0], 'frente', 'Frente FICTÍCIA', '0', '170')
    fill(rows[1], 'RESTO', 'Resto FICTÍCIO', '180', '0')
    // O código é digitado em maiúsculas.
    expect((within(rows[0]).getByLabelText(/^Código/) as HTMLInputElement).value).toBe('FRENTE')

    const alert = within(drawer).getByRole('alert')
    expect(alert.textContent).toContain('Zonas de giro inválidas')
    expect(alert.textContent).toContain('Falta cobrir de 170° a 180°')
    fireEvent.click(within(drawer).getByRole('button', { name: 'Salvar alterações' }))
    expect(within(drawer).getByText('Corrija os campos indicados.')).toBeTruthy()
    expect(writes()).toEqual([])

    fireEvent.change(within(rows[0]).getByLabelText(/^Fim/), { target: { value: '180' } })
    expect(within(drawer).queryByText('Zonas de giro inválidas')).toBeNull()
    fireEvent.click(within(drawer).getByRole('button', { name: 'Salvar alterações' }))
    expect(await screen.findByText('Configuração alterada')).toBeTruthy()
    expect(writes()[0].body.rotation_zones).toEqual([
      { code: 'FRENTE', name: 'Frente FICTÍCIA', start_deg: 0, end_deg: 180 },
      { code: 'RESTO', name: 'Resto FICTÍCIO', start_deg: 180, end_deg: 0 },
    ])
  })

  it('uma zona só não basta; "Sem zonas" volta a uma tabela para todo o giro', async () => {
    stubBackend(catalogFicticio())
    await renderCatalog()
    const drawer = await openEditDrawer()
    fireEvent.click(within(drawer).getByRole('button', { name: 'Adicionar zona' }))
    const [row] = within(zonesList(drawer)).getAllByRole('listitem')
    fireEvent.change(within(row).getByLabelText(/^Código/), { target: { value: 'TUDO' } })
    fireEvent.change(within(row).getByLabelText(/^Nome/), { target: { value: 'Tudo' } })
    fireEvent.change(within(row).getByLabelText(/^Início/), { target: { value: '0' } })
    fireEvent.change(within(row).getByLabelText(/^Fim/), { target: { value: '0' } })
    expect(within(drawer).getByRole('alert').textContent).toContain('pelo menos 2 zonas')

    fireEvent.click(within(drawer).getByRole('button', { name: 'Sem zonas' }))
    expect(within(drawer).queryByRole('alert')).toBeNull()
    expect(within(drawer).getByText('Sem zonas: uma tabela vale para todo o giro.')).toBeTruthy()
  })

  it('peso do gancho negativo é recusado no campo', async () => {
    stubBackend(catalogFicticio())
    await renderCatalog()
    const drawer = await openEditDrawer()
    fireEvent.change(within(drawer).getByLabelText(/Peso do gancho/), { target: { value: '-5' } })
    expect(within(drawer).getByText('Não pode ser negativo.')).toBeTruthy()
  })

  it('409 ROTATION_ZONE_IN_USE: explica no editor e no resumo, sem fechar o Drawer', async () => {
    const { writes } = stubBackend(catalogComZonasFicticio(), [], {
      zonesInUse: { 'CFG-A1-FICHA': ['FRONTAL', 'LATERAL_TRASEIRA'] },
    })
    await renderCatalog()
    const drawer = await openEditDrawer()
    const rows = within(zonesList(drawer)).getAllByRole('listitem')
    expect(rows).toHaveLength(2)
    fireEvent.change(within(rows[0]).getByLabelText(/^Código/), { target: { value: 'FRENTE' } })
    fireEvent.click(within(drawer).getByRole('button', { name: 'Salvar alterações' }))

    // Sem tabela ativa na lista, grava direto (sem confirmação), e o backend recusa com 409.
    const notices = await within(drawer).findAllByRole('alert')
    const text = notices.map((notice) => notice.textContent).join(' ')
    expect(text).toContain('ROTATION_ZONE_IN_USE')
    expect(text).toContain('Mantenha o código dessa zona')
    expect(screen.getByRole('dialog', { name: 'Editar configuração' })).toBeTruthy()
    expect(writes()).toHaveLength(1)
  })

  it('sem zonas e com tabelas importadas: o atalho e a adição ficam desabilitados, com aviso', async () => {
    const zoneless: ChartRow = { ...chartRow('T1', 'v1', 'X', 'DRAFT'), rotation_zone_code: null }
    const { writes } = stubBackend(catalogFicticio(), [zoneless])
    await renderCatalog()
    const detail = await openConfiguration()
    await within(detail).findByText(/1 versão importada/)
    fireEvent.click(within(detail).getByRole('button', { name: 'Editar' }))
    const drawer = screen.getByRole('dialog', { name: 'Editar configuração' })

    expect(
      within(drawer).getByText(
        'Esta configuração já tem tabelas importadas sem zona. Crie outra configuração para usar zonas de giro.',
      ),
    ).toBeTruthy()
    const preset = within(drawer).getByRole('button', {
      name: 'Frontal 110° + lateral e traseira 250°',
    }) as HTMLButtonElement
    const add = within(drawer).getByRole('button', { name: 'Adicionar zona' }) as HTMLButtonElement
    expect(preset.disabled).toBe(true)
    expect(add.disabled).toBe(true)
    // O resto da configuração continua editável.
    fireEvent.change(within(drawer).getByLabelText(/Peso do gancho/), { target: { value: '90' } })
    fireEvent.click(within(drawer).getByRole('button', { name: 'Salvar alterações' }))
    expect(await screen.findByText('Configuração alterada')).toBeTruthy()
    expect(writes()[0].body).toEqual({ hook_block_weight_kg: 90 })
  })

  it('409 ZONELESS_LOAD_CHARTS_EXIST: explica no editor e no resumo, sem fechar o Drawer', async () => {
    // A lista lida está vazia (ex.: outra aba importou depois), então o editor não bloqueia antes.
    const { writes } = stubBackend(catalogFicticio(), [], { zonelessChartsIn: ['CFG-A1-FICHA'] })
    await renderCatalog()
    const drawer = await openEditDrawer()
    fireEvent.click(
      within(drawer).getByRole('button', { name: 'Frontal 110° + lateral e traseira 250°' }),
    )
    fireEvent.click(within(drawer).getByRole('button', { name: 'Salvar alterações' }))

    const notices = await within(drawer).findAllByRole('alert')
    const text = notices.map((notice) => notice.textContent).join(' ')
    expect(text).toContain('ZONELESS_LOAD_CHARTS_EXIST')
    expect(text).toContain('Crie outra configuração para usar zonas de giro.')
    expect(notices.some((notice) => notice.textContent?.includes('Zonas de giro inválidas'))).toBe(
      true,
    )
    expect(screen.getByRole('dialog', { name: 'Editar configuração' })).toBeTruthy()
    expect(writes()).toHaveLength(1)
  })

  it('422 INVALID_ROTATION_ZONES do backend vai para o editor de zonas', async () => {
    stubBackend(catalogFicticio(), [], {}, (method) =>
      method === 'PATCH'
        ? jsonResponse(
            { detail: 'as zonas se sobrepõem (backend)', code: 'INVALID_ROTATION_ZONES' },
            422,
          )
        : undefined,
    )
    await renderCatalog()
    const drawer = await openEditDrawer()
    fireEvent.click(
      within(drawer).getByRole('button', { name: 'Frontal 110° + lateral e traseira 250°' }),
    )
    fireEvent.click(within(drawer).getByRole('button', { name: 'Salvar alterações' }))

    const zonesAlert = await within(drawer).findByText('as zonas se sobrepõem (backend)')
    expect(zonesAlert.closest('[role="alert"]')?.textContent).toContain('Zonas de giro inválidas')
    expect(
      within(drawer).getByText(
        'O backend recusou as zonas de giro (HTTP 422 INVALID_ROTATION_ZONES).',
      ),
    ).toBeTruthy()
  })

  it('com tabela ativa, mudar as zonas pede confirmação que explica a mudança', async () => {
    const data = catalogComZonasFicticio()
    const { writes } = stubBackend(data, [chartRow('F1', 'v1', 'FRONTAL', 'ACTIVE')])
    await renderCatalog()
    const detail = await openConfiguration()
    await within(detail).findByRole('table', { name: /Tabela ativa v1/ })
    fireEvent.click(within(detail).getByRole('button', { name: 'Editar' }))
    const drawer = screen.getByRole('dialog', { name: 'Editar configuração' })
    const rows = within(zonesList(drawer)).getAllByRole('listitem')
    fireEvent.change(within(rows[0]).getByLabelText(/^Nome/), { target: { value: 'Frente' } })
    fireEvent.click(within(drawer).getByRole('button', { name: 'Salvar alterações' }))

    const confirm = screen.getByRole('dialog', {
      name: 'Mudar as zonas de giro ou o gancho de Config FICTÍCIA com ficha?',
    })
    expect(confirm.textContent).toContain(
      'As zonas de giro passam a ser Frente, Lateral e traseira',
    )
    fireEvent.click(within(confirm).getByRole('button', { name: 'Salvar as alterações' }))
    expect(await screen.findByText('Configuração alterada')).toBeTruthy()
    expect(writes()[0].body).toEqual({
      rotation_zones: [{ ...ZONAS_DTO_FICTICIAS[0], name: 'Frente' }, ZONAS_DTO_FICTICIAS[1]],
    })
  })

  it('nova configuração com zonas e gancho: vão no POST', async () => {
    const { writes } = stubBackend(catalogFicticio())
    await renderCatalog()
    fireEvent.click(
      await within(column('Fabricantes')).findByRole('button', { name: /FICTÍCIO A/ }),
    )
    fireEvent.click(await within(column('Guindastes')).findByRole('button', { name: /A1/ }))
    fireEvent.click(
      within(column('Configurações')).getByRole('button', { name: /Nova configuração/ }),
    )
    const drawer = screen.getByRole('dialog', { name: 'Nova configuração' })
    fireEvent.change(within(drawer).getByLabelText(/Nome da configuração/), {
      target: { value: 'Config FICTÍCIA com zonas' },
    })
    fireEvent.click(within(drawer).getByRole('checkbox'))
    fireEvent.click(
      within(drawer).getByRole('button', { name: 'Frontal 110° + lateral e traseira 250°' }),
    )
    fireEvent.change(within(drawer).getByLabelText(/Peso do gancho/), { target: { value: '90' } })
    fireEvent.click(within(drawer).getByRole('button', { name: 'Cadastrar' }))

    expect(
      await screen.findByText('Configuração "Config FICTÍCIA com zonas" cadastrada'),
    ).toBeTruthy()
    const [post] = writes()
    expect(post.method).toBe('POST')
    expect(post.body).toEqual({
      name: 'Config FICTÍCIA com zonas',
      geometry: null,
      rotation_zones: [
        { code: 'FRONTAL', name: 'Frontal', start_deg: 305, end_deg: 55 },
        { code: 'LATERAL_TRASEIRA', name: 'Lateral e traseira', start_deg: 55, end_deg: 305 },
      ],
      hook_block_weight_kg: 90,
    })
  })
})
