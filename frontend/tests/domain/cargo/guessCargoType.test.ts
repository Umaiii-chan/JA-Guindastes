import { describe, expect, it } from 'vitest'

import { guessCargoType } from '../../../src/domain/cargo/cargoTypes'

describe('guessCargoType', () => {
  it('picks the 3D model type from the words of the description', () => {
    expect(guessCargoType('Transformador de energia')).toBe('transformador')
    expect(guessCargoType('gerador diesel')).toBe('gerador')
    expect(guessCargoType('Contêiner de 20 pés')).toBe('conteiner')
    expect(guessCargoType('feixe de tubos de aço')).toBe('feixe-tubos')
    expect(guessCargoType('Viga de concreto em calha')).toBe('viga-concreto-calha')
    expect(guessCargoType('viga pré-moldada')).toBe('viga-concreto')
    expect(guessCargoType('Caixa de madeira com peças')).toBe('caixa-madeira')
  })

  it('returns undefined when no known word appears', () => {
    expect(guessCargoType('tanque metálico')).toBeUndefined()
  })
})
