// Painel da carga (TASK-034). Saiu de LoadChartImportPanel.test.ts quando o painel antigo de
// importação deu lugar à página Tabelas (TASK-042).

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { EMPTY_LOAD_FORM } from '../../../src/application/load/loadForm'
import { LoadPanel } from '../../../src/presentation/panels/LoadPanel'

function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

describe('LoadPanel', () => {
  it('mostra as validações provisórias da carga', () => {
    const visible = text(
      renderToStaticMarkup(
        createElement(LoadPanel, {
          values: { ...EMPTY_LOAD_FORM, weightKg: '0', lengthM: '1', cgAlongLengthM: '0.6' },
          onChange: () => undefined,
        }),
      ),
    )

    expect(visible).toContain('O peso deve ser um número maior que zero (kg).')
    expect(visible).toContain('Centro de gravidade fora da carga ao longo do comprimento')
    expect(visible).toContain('a avaliação aguarda uma carga válida')
  })

  it('carga válida: informa o peso que vai para a avaliação', () => {
    const visible = text(
      renderToStaticMarkup(
        createElement(LoadPanel, {
          values: {
            ...EMPTY_LOAD_FORM,
            description: 'Bloco fictício',
            weightKg: '1500',
            lengthM: '4',
            widthM: '2',
            heightM: '1',
          },
          onChange: () => undefined,
        }),
      ),
    )

    expect(visible).toContain('Carga válida: 1.500 kg vão para a avaliação.')
  })
})
