import { describe, expect, it } from 'vitest'

import { buildEvaluationInput, residualGroundSlopeDeg } from '../../src/app/evaluationInput'
import type { OutriggerState } from '../../src/domain/crane/outriggers'
import type { CraneState } from '../../src/three/crane/types'

// FICTÍCIO: estado de sliders só para testar a montagem do envio.
const STATE: CraneState = {
  turretRotationDeg: 10,
  boomAngleDeg: 30,
  boomLengthM: 20,
  cableLengthM: 1,
}

describe('buildEvaluationInput', () => {
  it('junta o estado dos sliders, a configuração (sem espaços nas pontas) e a carga', () => {
    expect(buildEvaluationInput(STATE, '  CFG-FICTICIA  ', '1500.5')).toEqual({
      input: {
        configurationId: 'CFG-FICTICIA',
        boomLengthM: 20,
        boomAngleDeg: 30,
        turretRotationDeg: 10,
        cableLengthM: 1,
        loadWeightKg: 1500.5,
      },
      problem: null,
    })
  })

  it.each([
    ['sem cena', null, 'CFG', '1', /cena/],
    ['configuração vazia', STATE, '   ', '1', /configuração/],
    ['carga vazia', STATE, 'CFG', '', /peso da carga/],
    ['carga negativa', STATE, 'CFG', '-1', /peso da carga/],
    ['carga não numérica', STATE, 'CFG', 'abc', /peso da carga/],
  ])('%s: não envia e diz por quê', (_name, state, configurationId, load, message) => {
    const result = buildEvaluationInput(state, configurationId, load)

    expect(result.input).toBeNull()
    expect(result.problem).toMatch(message)
  })
})

// FICTÍCIO: patolas e nivelamento só para testar a inclinação enviada (RN-013; TASK-094).
const SET_AND_LEVELED: OutriggerState = { extensionPercent: 100, jacksSet: true, levelingDeg: 3 }
const JACKS_UP: OutriggerState = { extensionPercent: 100, jacksSet: false, levelingDeg: 3 }

describe('residualGroundSlopeDeg', () => {
  it('desconta o nivelamento dos macacos apoiados: 2° de terreno com 3° de nivelamento → 0°', () => {
    expect(residualGroundSlopeDeg(2, SET_AND_LEVELED)).toBe(0)
    expect(residualGroundSlopeDeg(4, SET_AND_LEVELED)).toBe(1)
  })

  it('sem os macacos apoiados, vale a inclinação do terreno', () => {
    expect(residualGroundSlopeDeg(2, JACKS_UP)).toBe(2)
    expect(
      residualGroundSlopeDeg(2, { extensionPercent: 0, jacksSet: false, levelingDeg: 0 }),
    ).toBe(2)
  })

  it('terreno plano continua sem o campo', () => {
    expect(residualGroundSlopeDeg(undefined, SET_AND_LEVELED)).toBeUndefined()
  })

  it('arredonda a centésimos, sem resto de ponto flutuante', () => {
    expect(residualGroundSlopeDeg(1.3, { ...SET_AND_LEVELED, levelingDeg: 1.1 })).toBe(0.2)
  })

  it('o residual 0° vai ao backend (terreno inclinado e nivelado não é terreno plano)', () => {
    const slope = residualGroundSlopeDeg(2, SET_AND_LEVELED)
    const result = buildEvaluationInput(STATE, 'CFG', '1', undefined, [], slope)

    expect(result.input?.groundSlopeDeg).toBe(0)
  })
})
