// Tipo de carga no formulário e no rascunho (leva F): campo opcional e aditivo; só escolhe o desenho.

import { describe, expect, it } from 'vitest'

import {
  EMPTY_LOAD_FORM,
  loadDimensionsOf,
  type LoadFormValues,
  validateLoadForm,
} from '../../../src/application/load/loadForm'
import { sameLoad } from '../../../src/domain/collision/loadBox'

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

describe('tipo de carga no formulário', () => {
  it('o formulário antigo, sem o campo, continua válido e sem tipo', () => {
    expect(EMPTY_LOAD_FORM.cargoType).toBeUndefined()
    const { load, problems } = validateLoadForm(VALID)
    expect(problems).toEqual({})
    expect(load).not.toHaveProperty('cargoType')
  })

  it('o tipo escolhido vai para a carga válida, sem mudar o peso, as medidas nem os problemas', () => {
    const plain = validateLoadForm(VALID)
    const typed = validateLoadForm({ ...VALID, cargoType: 'conteiner' })
    expect(typed.problems).toEqual({})
    expect(typed.load).toEqual({ ...plain.load, cargoType: 'conteiner' })
  })

  it('a caixa simples e um tipo desconhecido (rascunho de outra versão) valem como sem tipo', () => {
    expect(validateLoadForm({ ...VALID, cargoType: 'caixa' }).load).not.toHaveProperty('cargoType')
    expect(validateLoadForm({ ...VALID, cargoType: 'nao-existe' }).load).not.toHaveProperty(
      'cargoType',
    )
  })

  it('o tipo não torna válida uma carga incompleta', () => {
    const { load, problems } = validateLoadForm({ ...EMPTY_LOAD_FORM, cargoType: 'gerador' })
    expect(load).toBeNull()
    expect(Object.keys(problems).sort()).toEqual(
      ['description', 'heightM', 'lengthM', 'weightKg', 'widthM'].sort(),
    )
  })
})

describe('medidas da carga para a cena', () => {
  it('leva as medidas e, só quando há, o tipo', () => {
    const plain = validateLoadForm(VALID).load!
    expect(loadDimensionsOf(plain)).toEqual({ lengthM: 4, widthM: 2, heightM: 1 })
    const typed = validateLoadForm({ ...VALID, cargoType: 'transformador' }).load!
    expect(loadDimensionsOf(typed)).toEqual({
      lengthM: 4,
      widthM: 2,
      heightM: 1,
      cargoType: 'transformador',
    })
  })

  it('o tipo conta na comparação: mesmas medidas, outro tipo, é outra carga', () => {
    const base = { lengthM: 4, widthM: 2, heightM: 1 }
    expect(sameLoad(base, { ...base })).toBe(true)
    expect(sameLoad(base, { ...base, cargoType: 'conteiner' })).toBe(false)
    expect(sameLoad({ ...base, cargoType: 'conteiner' }, { ...base, cargoType: 'conteiner' })).toBe(
      true,
    )
    expect(sameLoad({ ...base, cargoType: 'conteiner' }, { ...base, cargoType: 'gerador' })).toBe(
      false,
    )
  })
})
