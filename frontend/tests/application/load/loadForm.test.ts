import { describe, expect, it } from 'vitest'

import {
  EMPTY_LOAD_FORM,
  type LoadFormValues,
  loadWeightTextForEvaluation,
  validateLoadForm,
} from '../../../src/application/load/loadForm'

// FICTÍCIO: carga de exemplo, não é de nenhuma operação real.
const VALID: LoadFormValues = {
  description: 'Bloco fictício',
  weightKg: '1500',
  lengthM: '4',
  widthM: '2',
  heightM: '1',
  cgAlongLengthM: '',
  cgAlongWidthM: '',
  cgAlongHeightM: '',
}

describe('validateLoadForm', () => {
  it('aceita a carga válida sem centro de gravidade', () => {
    const { load, problems } = validateLoadForm(VALID)

    expect(problems).toEqual({})
    expect(load).toEqual({
      description: 'Bloco fictício',
      weightKg: 1500,
      lengthM: 4,
      widthM: 2,
      heightM: 1,
      centerOfGravity: null,
    })
  })

  it('aceita o centro de gravidade dentro da caixa, com as faces incluídas', () => {
    const { load } = validateLoadForm({
      ...VALID,
      cgAlongLengthM: '2',
      cgAlongWidthM: '-1',
      cgAlongHeightM: '0',
    })

    expect(load?.centerOfGravity).toEqual({ alongLengthM: 2, alongWidthM: -1, alongHeightM: 0 })
  })

  it.each(['0', '-5', '', 'abc', 'Infinity'])('recusa o peso %j (precisa ser > 0)', (weight) => {
    const { load, problems } = validateLoadForm({ ...VALID, weightKg: weight })

    expect(load).toBeNull()
    expect(problems.weightKg).toContain('maior que zero')
  })

  it.each([
    ['lengthM', 'O comprimento'],
    ['widthM', 'A largura'],
    ['heightM', 'A altura'],
  ] as const)('recusa %s igual a zero', (field, name) => {
    const { load, problems } = validateLoadForm({ ...VALID, [field]: '0' })

    expect(load).toBeNull()
    expect(problems[field]).toBe(`${name} deve ser um número maior que zero (m).`)
  })

  it('recusa a descrição vazia', () => {
    const { load, problems } = validateLoadForm({ ...VALID, description: '   ' })

    expect(load).toBeNull()
    expect(problems.description).toBeDefined()
  })

  it('recusa o centro de gravidade fora da caixa', () => {
    const { load, problems } = validateLoadForm({
      ...VALID,
      cgAlongLengthM: '2.01',
      cgAlongWidthM: '0',
      cgAlongHeightM: '0',
    })

    expect(load).toBeNull()
    expect(problems.cgAlongLengthM).toContain('fora da carga ao longo do comprimento')
    expect(problems.cgAlongLengthM).toContain('meia aresta de 2 m')
  })

  it('recusa o centro de gravidade informado pela metade', () => {
    const { load, problems } = validateLoadForm({ ...VALID, cgAlongLengthM: '1' })

    expect(load).toBeNull()
    expect(problems.cgAlongWidthM).toContain('três coordenadas')
    expect(problems.cgAlongHeightM).toContain('três coordenadas')
    expect(problems.cgAlongLengthM).toBeUndefined()
  })

  it('o formulário vazio tem problema em todos os campos obrigatórios', () => {
    const { problems } = validateLoadForm(EMPTY_LOAD_FORM)

    expect(Object.keys(problems).sort()).toEqual(
      ['description', 'heightM', 'lengthM', 'weightKg', 'widthM'].sort(),
    )
  })
})

describe('loadWeightTextForEvaluation', () => {
  it('devolve o peso da carga válida para a avaliação', () => {
    expect(loadWeightTextForEvaluation({ ...VALID, weightKg: ' 1500.5 ' })).toBe('1500.5')
  })

  it('devolve vazio quando o peso é inválido (a avaliação aguarda)', () => {
    expect(loadWeightTextForEvaluation({ ...VALID, weightKg: '0' })).toBe('')
    expect(loadWeightTextForEvaluation({ ...VALID, weightKg: '' })).toBe('')
    expect(loadWeightTextForEvaluation({ ...VALID, weightKg: 'abc' })).toBe('')
  })

  it('devolve o peso válido mesmo com os outros campos incompletos (TASK-050, L-009)', () => {
    expect(loadWeightTextForEvaluation({ ...EMPTY_LOAD_FORM, weightKg: '2500' })).toBe('2500')
    expect(loadWeightTextForEvaluation({ ...VALID, heightM: '' })).toBe(
      String(Number(VALID.weightKg)),
    )
  })
})
