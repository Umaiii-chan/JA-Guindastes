import { describe, expect, it } from 'vitest'

import {
  configurationChanges,
  EMPTY_SHEET_FORM,
  formErrorsFromRequest,
  isConfigurationFormField,
  parseTechnicalSheet,
  sameTechnicalSheet,
  type SheetFormValues,
  unshownFieldErrors,
  validateRequiredName,
} from '../../../src/application/catalog/catalogForms'
import { CatalogRequestError } from '../../../src/domain/catalog/catalog'
import { SHEET_FICTICIA, SHEET_MINIMA_FICTICIA } from '../../fixtures/catalogFicticio'

/** Formulário preenchido com a ficha FICTÍCIA (textos como o `input type="number"` entrega). */
const FILLED: SheetFormValues = {
  boomPivotOffsetM: '0.8',
  boomPivotHeightM: '2.6',
  boomLengthMinM: '10',
  boomLengthMaxM: '30',
  boomAngleMinDeg: '5',
  boomAngleMaxDeg: '75',
  cableLengthMinM: '0.5',
  cableLengthMaxM: '40',
  turretRotationMinDeg: '-90',
  turretRotationMaxDeg: '90',
}

describe('formulário da ficha técnica', () => {
  it('lê a ficha completa', () => {
    expect(parseTechnicalSheet(FILLED)).toEqual({ sheet: SHEET_FICTICIA, errors: null })
  })

  it('opcionais em branco viram null (sem c_max e giro contínuo)', () => {
    const result = parseTechnicalSheet({
      ...FILLED,
      cableLengthMaxM: ' ',
      turretRotationMinDeg: '',
      turretRotationMaxDeg: '',
    })

    expect(result).toEqual({ sheet: SHEET_MINIMA_FICTICIA, errors: null })
  })

  it('aceita a negativo (pino atrás do eixo de giro) e zero', () => {
    expect(
      parseTechnicalSheet({ ...FILLED, boomPivotOffsetM: '-1.56' }).sheet?.boomPivotOffsetM,
    ).toBe(-1.56)
    expect(parseTechnicalSheet({ ...FILLED, boomPivotOffsetM: '0' }).errors).toBeNull()
  })

  it('obrigatórios em branco: um erro por campo', () => {
    const result = parseTechnicalSheet(EMPTY_SHEET_FORM)

    expect(result.sheet).toBeNull()
    expect(Object.keys(result.errors ?? {}).sort()).toEqual(
      [
        'geometry.boomAngleMaxDeg',
        'geometry.boomAngleMinDeg',
        'geometry.boomLengthMaxM',
        'geometry.boomLengthMinM',
        'geometry.boomPivotHeightM',
        'geometry.boomPivotOffsetM',
        'geometry.cableLengthMinM',
      ].sort(),
    )
    expect(result.errors?.['geometry.boomLengthMinM']).toBe('Obrigatório.')
  })

  it.each([
    [
      'número inválido',
      { boomPivotHeightM: 'abc' },
      'geometry.boomPivotHeightM',
      'Informe um número.',
    ],
    [
      'altura negativa',
      { boomPivotHeightM: '-1' },
      'geometry.boomPivotHeightM',
      'Não pode ser negativo.',
    ],
    [
      'cabo negativo',
      { cableLengthMinM: '-0.1' },
      'geometry.cableLengthMinM',
      'Não pode ser negativo.',
    ],
    [
      'L mín > L máx',
      { boomLengthMinM: '31' },
      'geometry.boomLengthMaxM',
      'O máximo não pode ser menor que o mínimo.',
    ],
    [
      'θ mín > θ máx',
      { boomAngleMinDeg: '80' },
      'geometry.boomAngleMaxDeg',
      'O máximo não pode ser menor que o mínimo.',
    ],
    [
      'só um limite de giro',
      { turretRotationMaxDeg: '' },
      'geometry.turretRotationMaxDeg',
      'Informe os dois limites de giro, ou nenhum (giro contínuo).',
    ],
  ] as const)('%s: erro no campo certo', (_name, patch, field, message) => {
    const result = parseTechnicalSheet({ ...FILLED, ...patch })

    expect(result.sheet).toBeNull()
    expect(result.errors?.[field]).toBe(message)
  })

  it('nome obrigatório recusa vazio e só espaços', () => {
    expect(validateRequiredName('')).toBe('Obrigatório.')
    expect(validateRequiredName('   ')).toBe('Obrigatório.')
    expect(validateRequiredName('Config FICTÍCIA')).toBeNull()
  })
})

describe('erros do servidor no formulário', () => {
  it('422: um erro por campo (o primeiro) e o resumo', () => {
    const error = new CatalogRequestError('VALIDATION', 'O servidor recusou os dados.', [
      { field: 'name', message: 'String should match pattern' },
      { field: 'geometry.boomLengthMinM', message: 'Input should be greater than or equal to 0' },
      { field: 'geometry.boomLengthMinM', message: 'segundo erro do mesmo campo' },
      { field: 'geometry', message: 'Value error, faixa de L inválida' },
    ])

    expect(formErrorsFromRequest(error)).toEqual({
      fieldErrors: {
        name: 'String should match pattern',
        'geometry.boomLengthMinM': 'Input should be greater than or equal to 0',
        geometry: 'Value error, faixa de L inválida',
      },
      message: 'O servidor recusou os dados.',
    })
  })

  it('409 sem campo fica só no resumo', () => {
    const error = new CatalogRequestError('CONFLICT', 'Já existe.')

    expect(formErrorsFromRequest(error)).toEqual({ fieldErrors: {}, message: 'Já existe.' })
  })

  it('erros de campos que o formulário não mostra aparecem na lista à parte', () => {
    const fieldErrors = {
      name: 'x',
      'geometry.boomLengthMinM': 'y',
      manufacturerId: 'Field required',
      '': 'sem campo',
    }

    expect(unshownFieldErrors(fieldErrors, isConfigurationFormField)).toEqual([
      'manufacturerId: Field required',
      'sem campo',
    ])
  })
})

describe('alteração de configuração', () => {
  const ORIGINAL = { id: 'CFG-1', craneId: 'GUI-1', name: 'Config', geometry: SHEET_FICTICIA }

  it('só manda o que mudou: nome aparado e ficha diferente', () => {
    expect(configurationChanges(ORIGINAL, ' Config ', SHEET_FICTICIA)).toEqual({})
    expect(configurationChanges(ORIGINAL, 'Outra', { ...SHEET_FICTICIA })).toEqual({
      name: 'Outra',
    })
    expect(configurationChanges(ORIGINAL, 'Config', SHEET_MINIMA_FICTICIA)).toEqual({
      geometry: SHEET_MINIMA_FICTICIA,
    })
  })

  it('nunca remove a ficha; sem ficha, a primeira ficha entra como mudança', () => {
    expect(configurationChanges(ORIGINAL, 'Config', null)).toEqual({})
    expect(configurationChanges({ ...ORIGINAL, geometry: null }, 'Config', SHEET_FICTICIA)).toEqual(
      { geometry: SHEET_FICTICIA },
    )
  })

  it('compara as fichas campo a campo', () => {
    expect(sameTechnicalSheet(SHEET_FICTICIA, { ...SHEET_FICTICIA })).toBe(true)
    expect(sameTechnicalSheet(SHEET_FICTICIA, SHEET_MINIMA_FICTICIA)).toBe(false)
    expect(sameTechnicalSheet(null, null)).toBe(true)
    expect(sameTechnicalSheet(SHEET_FICTICIA, null)).toBe(false)
  })
})
