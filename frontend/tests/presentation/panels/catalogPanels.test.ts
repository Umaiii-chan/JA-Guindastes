import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { EMPTY_SHEET_FORM } from '../../../src/application/catalog/catalogForms'
import {
  CatalogSelectionPanel,
  type CatalogSelectionPanelProps,
} from '../../../src/presentation/panels/CatalogSelectionPanel'
import { CraneControlPanel } from '../../../src/presentation/panels/CraneControlPanel'
import { TechnicalSheetFields } from '../../../src/presentation/panels/TechnicalSheetFields'
import { SHEET_FICTICIA } from '../../fixtures/catalogFicticio'

function textOf(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

const noop = () => undefined

const SELECTION: CatalogSelectionPanelProps = {
  manufacturers: {
    status: 'loaded',
    items: [{ id: 'FAB-A', name: 'Fabricante FICTÍCIO A' }],
    error: null,
  },
  cranes: {
    status: 'loaded',
    items: [{ id: 'GUI-A1', manufacturerId: 'FAB-A', modelName: 'Modelo FICTÍCIO A1' }],
    error: null,
  },
  configurations: {
    status: 'loaded',
    items: [
      { id: 'CFG-1', craneId: 'GUI-A1', name: 'Com ficha', geometry: SHEET_FICTICIA },
      { id: 'CFG-2', craneId: 'GUI-A1', name: 'Sem ficha', geometry: null },
    ],
    error: null,
  },
  selectedManufacturerId: 'FAB-A',
  selectedCraneId: 'GUI-A1',
  selectedConfigurationId: 'CFG-1',
  onSelectManufacturer: noop,
  onSelectCrane: noop,
  onSelectConfiguration: noop,
}

describe('CatalogSelectionPanel', () => {
  it('mostra as três listas, marca a configuração sem ficha e seleciona a escolhida', () => {
    const html = renderToStaticMarkup(createElement(CatalogSelectionPanel, SELECTION))

    expect(textOf(html)).toContain('Fabricante FICTÍCIO A')
    expect(textOf(html)).toContain('Modelo FICTÍCIO A1')
    expect(textOf(html)).toContain('Sem ficha (sem ficha técnica)')
    expect(html).toMatch(/<option value="CFG-1" selected="">Com ficha<\/option>/)
    expect(html).not.toMatch(/<select[^>]*disabled/)
  })

  it('sem fabricante escolhido, guindaste e configuração ficam desabilitados', () => {
    const html = renderToStaticMarkup(
      createElement(CatalogSelectionPanel, {
        ...SELECTION,
        cranes: { status: 'idle', items: [], error: null },
        configurations: { status: 'idle', items: [], error: null },
        selectedManufacturerId: null,
        selectedCraneId: null,
        selectedConfigurationId: null,
      }),
    )

    expect(html.match(/<select[^>]*disabled/g)).toHaveLength(2)
  })

  it('mostra carregando, lista vazia e erro', () => {
    const text = textOf(
      renderToStaticMarkup(
        createElement(CatalogSelectionPanel, {
          ...SELECTION,
          manufacturers: {
            status: 'error',
            items: [],
            error: 'Não foi possível falar com o servidor',
          },
          cranes: { status: 'loaded', items: [], error: null },
          configurations: { status: 'loading', items: [], error: null },
        }),
      ),
    )

    expect(text).toContain('Não foi possível falar com o servidor')
    expect(text).toContain('Nenhum guindaste cadastrado neste fabricante.')
    expect(text).toContain('Carregando…')
  })
})

describe('TechnicalSheetFields', () => {
  it('mostra o erro do servidor (422) embaixo do campo e marca o campo inválido', () => {
    const html = renderToStaticMarkup(
      createElement(TechnicalSheetFields, {
        values: EMPTY_SHEET_FORM,
        errors: {
          'geometry.boomLengthMinM': 'Input should be greater than or equal to 0',
          geometry: 'Value error, faixa de L inválida',
        },
        onChange: noop,
      }),
    )

    expect(textOf(html)).toContain(
      'L mín — lança recolhida (m) Input should be greater than or equal to 0',
    )
    expect(textOf(html)).toContain('Value error, faixa de L inválida')
    expect(html.match(/aria-invalid="true"/g)).toHaveLength(1)
  })
})

describe('CraneControlPanel', () => {
  it('mostra de onde vêm os limites e a observação do controle', () => {
    const text = textOf(
      renderToStaticMarkup(
        createElement(CraneControlPanel, {
          limits: null,
          state: null,
          notice: 'Limites e parâmetros a/h da ficha técnica de "Config FICTÍCIA".',
          notes: { cableLengthM: 'Máximo FICTÍCIO: a ficha não tem cabo máximo (c_max).' },
          onChange: noop,
        }),
      ),
    )

    expect(text).toContain('da ficha técnica de "Config FICTÍCIA"')
    expect(text).toContain('Máximo FICTÍCIO: a ficha não tem cabo máximo (c_max).')
  })
})
