// @vitest-environment jsdom
// Página Tabelas com zonas de giro (TASK-046; CA-5): a importação pede a zona, a linha do tempo
// mostra a zona de cada versão e a ativa por zona, o Dialog de ativação compara com a ativa da mesma
// zona, e os erros ROTATION_ZONE_REQUIRED, UNKNOWN_ROTATION_ZONE e ROTATION_ZONE_NOT_ALLOWED.
// Backends falsos e CSVs FICTÍCIOS de demonstração (backend/app/demo_data/).

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AppProviders } from '../../../src/app/AppProviders'
import { AppRoutes } from '../../../src/app/AppRoutes'
import { catalogComZonasFicticio } from '../../fixtures/catalogFicticio'
import { createFakeCatalogFetch } from '../../helpers/fakeCatalogFetch'
import {
  type ChartRow,
  combineFetch,
  createFakeLoadChartFetch,
  type FakeLoadChartOptions,
  parseCsvFicticio,
} from '../../helpers/fakeLoadChartFetch'

const ZONES = { 'CFG-A1-FICHA': ['FRONTAL', 'LATERAL_TRASEIRA'] }

function demoCsvText(name: string): string {
  return readFileSync(resolve(process.cwd(), '../backend/app/demo_data', name), 'utf8')
}

function demoCsv(name: string): File {
  return new File([demoCsvText(name)], name, { type: 'text/csv' })
}

function chartRow(
  chartId: string,
  version: string,
  zone: string,
  status: ChartRow['status'],
  csv: string,
): ChartRow {
  return {
    chart_id: chartId,
    version,
    configuration_id: 'CFG-A1-FICHA',
    status,
    points: parseCsvFicticio(demoCsvText(csv)).points,
    source: { file_name: csv, file_type: 'text/csv', sha256: 'a', uri: 'local://a' },
    rotation_zone_code: zone,
  }
}

function stubBackend(charts: ChartRow[] = [], options: FakeLoadChartOptions = {}) {
  const loadChartFetch = createFakeLoadChartFetch(charts, {
    zonesByConfiguration: ZONES,
    ...options,
  })
  vi.stubGlobal(
    'fetch',
    combineFetch(createFakeCatalogFetch(catalogComZonasFicticio()), loadChartFetch),
  )
  const imports = () =>
    loadChartFetch.mock.calls
      .filter(([url]) => String(url).endsWith('/import'))
      .map(([, init]) => (init?.body as FormData).get('rotation_zone_code'))
  return { imports }
}

async function renderTables() {
  render(
    <MemoryRouter initialEntries={['/tabelas']}>
      <AppProviders>
        <AppRoutes />
      </AppProviders>
    </MemoryRouter>,
  )
  await waitFor(() => expect(screen.queryByText('Conferindo a sessão…')).toBeNull())
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

async function dropValid(name = 'tabela_carga_ficticia_demo_v1.csv') {
  fireEvent.change(screen.getByLabelText('Arquivo da tabela de carga (CSV ou XLSX)'), {
    target: { files: [demoCsv(name)] },
  })
  await screen.findByRole('table', { name: new RegExp(`^Prévia de ${name.replace('.', '\\.')}`) })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('página Tabelas — zonas de giro', () => {
  it('a importação pede a zona; sem ela não envia; com ela, manda rotation_zone_code', async () => {
    const { imports } = stubBackend()
    await renderTables()
    await chooseConfiguration()
    await screen.findByText('Nenhuma versão importada')
    await dropValid()

    const zoneSelect = screen.getByLabelText(/^Zona de giro/) as HTMLSelectElement
    expect(
      within(zoneSelect)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual([
      'Escolha a zona…',
      'Frontal FICTÍCIA (305° → 55° (110°))',
      'Lateral e traseira FICTÍCIA (55° → 305° (250°))',
    ])
    fireEvent.click(screen.getByRole('button', { name: 'Importar como rascunho' }))
    expect(await screen.findByText('Escolha a zona de giro desta tabela.')).toBeTruthy()
    expect(imports()).toEqual([])

    fireEvent.change(zoneSelect, { target: { value: 'FRONTAL' } })
    // O id sugerido leva a zona, para não confundir as tabelas das zonas.
    expect((screen.getByLabelText(/^Id da tabela/) as HTMLInputElement).value).toBe(
      'CFG-A1-FICHA-FRONTAL-v1',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Importar como rascunho' }))
    expect(await screen.findByText('Versão v1 importada')).toBeTruthy()
    expect(imports()).toEqual(['FRONTAL'])

    const timeline = await screen.findByRole('list', { name: 'Linha do tempo das versões' })
    const item = (await within(timeline).findByText('Rascunho')).closest('li') as HTMLElement
    expect(item.textContent).toContain('ZonaFrontal FICTÍCIA FRONTAL')
    // Depois de importar, a zona volta a ser pedida.
    expect((screen.getByLabelText(/^Zona de giro/) as HTMLSelectElement).value).toBe('')
  })

  it('linha do tempo: a zona de cada versão e a ativa destacada por zona', async () => {
    stubBackend([
      chartRow('F1', 'v1', 'FRONTAL', 'ACTIVE', 'tabela_carga_ficticia_demo_v1.csv'),
      chartRow('L1', 'v2', 'LATERAL_TRASEIRA', 'ACTIVE', 'tabela_carga_ficticia_demo_v2.csv'),
      chartRow('F2', 'v3', 'FRONTAL', 'DRAFT', 'tabela_carga_ficticia_demo_v2.csv'),
    ])
    await renderTables()
    await chooseConfiguration()

    const timeline = await screen.findByRole('list', { name: 'Linha do tempo das versões' })
    await waitFor(() =>
      expect(timeline.querySelectorAll('li[aria-current="true"]')).toHaveLength(2),
    )
    const current = [...timeline.querySelectorAll('li[aria-current="true"]')].map(
      (item) => item.querySelector('[class*="activeHint"]')?.textContent,
    )
    expect(current).toEqual([
      'vale para a avaliação na zona Lateral e traseira FICTÍCIA',
      'vale para a avaliação na zona Frontal FICTÍCIA',
    ])
    const summary = screen.getByRole('list', { name: 'Tabela ativa por zona' })
    expect(summary.textContent).toBe('Frontal FICTÍCIA: v1Lateral e traseira FICTÍCIA: v2')
  })

  it('o Dialog de ativação compara com a ativa da MESMA zona; as outras zonas não mudam', async () => {
    stubBackend([
      chartRow('F1', 'v1', 'FRONTAL', 'ACTIVE', 'tabela_carga_ficticia_demo_v1.csv'),
      chartRow('L1', 'v2', 'LATERAL_TRASEIRA', 'ACTIVE', 'tabela_carga_ficticia_demo_v2.csv'),
      chartRow('F2', 'v3', 'FRONTAL', 'DRAFT', 'tabela_carga_ficticia_demo_v2.csv'),
    ])
    await renderTables()
    await chooseConfiguration()
    const timeline = await screen.findByRole('list', { name: 'Linha do tempo das versões' })

    fireEvent.click(await within(timeline).findByRole('button', { name: 'Ativar v3' }))
    const dialog = screen.getByRole('dialog', { name: 'Ativar a versão v3?' })
    expect(dialog.textContent).toContain('A capacidade calculada muda na zona Frontal FICTÍCIA')
    expect(dialog.textContent).toContain('A v1, ativa hoje nesta zona, passa a Substituída')
    expect(dialog.textContent).not.toContain('A v2')
    expect(dialog.textContent).toContain('As tabelas ativas das outras zonas não mudam.')
    const comparison = await within(dialog).findByLabelText(
      'Comparação com a versão ativa da zona Frontal FICTÍCIA',
    )
    // v1 → v2 FICTÍCIAS: a mesma comparação do teste sem zonas.
    expect(comparison.textContent).toContain('27 diminuem (até −10 %)')

    fireEvent.click(within(dialog).getByRole('button', { name: 'Ativar v3' }))
    expect(await screen.findByText('Versão v3 ativada na zona Frontal FICTÍCIA')).toBeTruthy()
    await waitFor(() =>
      expect(screen.getByRole('list', { name: 'Tabela ativa por zona' }).textContent).toBe(
        'Frontal FICTÍCIA: v3Lateral e traseira FICTÍCIA: v2',
      ),
    )
  })

  it('a primeira versão de uma zona não compara com a ativa de outra zona', async () => {
    stubBackend([
      chartRow('F1', 'v1', 'FRONTAL', 'ACTIVE', 'tabela_carga_ficticia_demo_v1.csv'),
      chartRow('L1', 'v2', 'LATERAL_TRASEIRA', 'DRAFT', 'tabela_carga_ficticia_demo_v2.csv'),
    ])
    await renderTables()
    await chooseConfiguration()
    const timeline = await screen.findByRole('list', { name: 'Linha do tempo das versões' })
    fireEvent.click(await within(timeline).findByRole('button', { name: 'Ativar v2' }))
    const dialog = screen.getByRole('dialog', { name: 'Ativar a versão v2?' })
    expect(dialog.textContent).toContain(
      'A zona Lateral e traseira FICTÍCIA não tem versão ativa hoje: esta passa a ser a primeira.',
    )
    expect(within(dialog).queryByLabelText(/Comparação com a versão ativa/)).toBeNull()
  })

  it('422 UNKNOWN_ROTATION_ZONE vai para o campo da zona', async () => {
    stubBackend([], { zonesByConfiguration: { 'CFG-A1-FICHA': ['OUTRA_ZONA', 'MAIS_UMA'] } })
    await renderTables()
    await chooseConfiguration()
    await screen.findByText('Nenhuma versão importada')
    await dropValid()
    fireEvent.change(screen.getByLabelText(/^Zona de giro/), { target: { value: 'FRONTAL' } })
    fireEvent.click(screen.getByRole('button', { name: 'Importar como rascunho' }))

    const field = (await screen.findAllByText(/UNKNOWN_ROTATION_ZONE/))[0]
    expect(field.textContent).toContain('A zona escolhida não existe nesta configuração')
    expect(screen.getAllByText('A importação falhou').length).toBeGreaterThan(0)
  })

  it('422 ROTATION_ZONE_NOT_ALLOWED: o servidor não tem zonas nesta configuração', async () => {
    stubBackend([], { zonesByConfiguration: {} })
    await renderTables()
    await chooseConfiguration()
    await screen.findByText('Nenhuma versão importada')
    await dropValid()
    fireEvent.change(screen.getByLabelText(/^Zona de giro/), { target: { value: 'FRONTAL' } })
    fireEvent.click(screen.getByRole('button', { name: 'Importar como rascunho' }))

    const alerts = await screen.findAllByText(/ROTATION_ZONE_NOT_ALLOWED/)
    expect(alerts[0].textContent).toContain('não tem zonas de giro no servidor')
  })
})
