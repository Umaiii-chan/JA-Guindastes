import { describe, expect, it } from 'vitest'

import { buildEvaluationInput } from '../../src/app/evaluationInput'
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
