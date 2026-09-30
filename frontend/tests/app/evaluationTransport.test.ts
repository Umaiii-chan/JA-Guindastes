import { describe, expect, it } from 'vitest'

import { evaluationTransportFromEnvironment } from '../../src/app/useEvaluationSession'

describe('evaluationTransportFromEnvironment', () => {
  it.each([undefined, '', 'websocket'])(
    'mantém WebSocket no desenvolvimento para o valor %s',
    (value) => {
      expect(evaluationTransportFromEnvironment(value)).toBe('websocket')
    },
  )

  it('seleciona REST para a build da Vercel', () => {
    expect(evaluationTransportFromEnvironment('rest')).toBe('rest')
  })

  it('recusa valor desconhecido', () => {
    expect(() => evaluationTransportFromEnvironment('automatico')).toThrow(
      "VITE_EVALUATION_TRANSPORT deve ser 'websocket' ou 'rest'.",
    )
  })
})
