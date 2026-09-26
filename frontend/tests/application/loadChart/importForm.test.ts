import { describe, expect, it } from 'vitest'

import { validateImportForm } from '../../../src/application/loadChart/importForm'

const FILE = new File(['FICTÍCIO'], 'tabela-ficticia.csv', { type: 'text/csv' })

describe('validateImportForm', () => {
  it('monta a requisição com os campos sem espaços nas pontas', () => {
    const { request, problems } = validateImportForm({
      file: FILE,
      configurationId: ' CFG-FICTICIA ',
      chartId: 'TAB-FICTICIA-1 ',
      version: ' v2',
    })

    expect(problems).toEqual([])
    expect(request).toEqual({
      file: FILE,
      fileName: 'tabela-ficticia.csv',
      configurationId: 'CFG-FICTICIA',
      chartId: 'TAB-FICTICIA-1',
      version: 'v2',
    })
  })

  it('lista um problema para cada campo ausente e não monta a requisição', () => {
    const { request, problems } = validateImportForm({
      file: null,
      configurationId: '',
      chartId: '  ',
      version: '',
    })

    expect(request).toBeNull()
    expect(problems).toHaveLength(4)
  })
})
