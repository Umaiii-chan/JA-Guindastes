import { describe, expect, it } from 'vitest'

import { buildEvaluationInput } from '../../src/app/evaluationInput'
import { toEvaluationRequestDto } from '../../src/infrastructure/api/evaluationContract'
import { toStateChangedMessage } from '../../src/infrastructure/websocket/evaluationMessages'

// FICTÍCIO: estado de sliders só para testar o envio das patolas.
const STATE = { turretRotationDeg: 10, boomAngleDeg: 30, boomLengthM: 20, cableLengthM: 1 }

describe('patolas no envio da avaliação', () => {
  it('sem patolas, o corpo REST e a mensagem WebSocket não ganham o campo', () => {
    const { input } = buildEvaluationInput(STATE, 'CFG', '100')

    expect(toEvaluationRequestDto(input!)).not.toHaveProperty('outriggers')
    expect(toStateChangedMessage(1, input!).payload).not.toHaveProperty('outriggers')
  })

  it('com patolas, envia extension_percent e jacks_set em snake_case', () => {
    const { input } = buildEvaluationInput(STATE, 'CFG', '100', {
      extensionPercent: 100,
      jacksSet: true,
    })
    const expected = { extension_percent: 100, jacks_set: true }

    expect(toEvaluationRequestDto(input!).outriggers).toEqual(expected)
    expect(toStateChangedMessage(2, input!).payload.outriggers).toEqual(expected)
  })
})
