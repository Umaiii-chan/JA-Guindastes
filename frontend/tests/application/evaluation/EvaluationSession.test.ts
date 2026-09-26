import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { EvaluationSession } from '../../../src/application/evaluation/EvaluationSession'
import type { OneShotEvaluator } from '../../../src/application/evaluation/ports'
import type { EvaluationInput, EvaluationResult } from '../../../src/domain/evaluation/evaluation'
import {
  createEvaluationRestClient,
  mapEvaluationResponse,
} from '../../../src/infrastructure/api/evaluationRestClient'
import { EvaluationSocket } from '../../../src/infrastructure/websocket/evaluationSocket'
import { fakeWebSocketFactory } from '../../helpers/fakeWebSocket'
import {
  FICTICIO_INPUT,
  REST_NOT_EVALUABLE,
  wsError,
  wsEvaluated,
  wsNotEvaluable,
} from '../../fixtures/evaluationResponses'

const WAIT_MS = 100
const MAX_WAIT_MS = 300
const RECONNECT_MS = 1000

interface Deferred {
  readonly input: EvaluationInput
  resolve(result: EvaluationResult): void
  reject(error: unknown): void
}

/** Avaliador REST falso: guarda cada chamada para o teste resolver quando quiser. */
function fakeOneShot() {
  const calls: Deferred[] = []
  const evaluator: OneShotEvaluator = {
    evaluate: (input) =>
      new Promise((resolve, reject) => {
        calls.push({ input, resolve, reject })
      }),
  }
  return { calls, evaluator }
}

function setup(oneShot: OneShotEvaluator = fakeOneShot().evaluator) {
  const factory = fakeWebSocketFactory()
  const session = new EvaluationSession({
    createRealtimeChannel: (handlers) =>
      new EvaluationSocket(
        {
          url: 'ws://test/api/v1/ws/evaluation',
          createWebSocket: factory.create,
          reconnectDelayMs: RECONNECT_MS,
        },
        handlers,
      ),
    oneShotEvaluator: oneShot,
    debounce: { waitMs: WAIT_MS, maxWaitMs: MAX_WAIT_MS },
  })
  return { factory, session }
}

/** Sessão iniciada com o WebSocket aberto. */
function connectedSetup() {
  const context = setup()
  context.session.start()
  context.factory.latest().acceptConnection()
  return context
}

const withLoad = (loadWeightKg: number): EvaluationInput => ({ ...FICTICIO_INPUT, loadWeightKg })

describe('EvaluationSession', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  describe('debounce', () => {
    it('mudanças seguidas em menos que o intervalo enviam só o último estado', () => {
      const { factory, session } = connectedSetup()

      session.update(withLoad(1000))
      vi.advanceTimersByTime(WAIT_MS / 2)
      session.update(withLoad(1100))
      vi.advanceTimersByTime(WAIT_MS / 2)
      session.update(withLoad(1200))
      expect(factory.latest().sent).toHaveLength(0)
      expect(session.getState().pending).toBe(true)

      vi.advanceTimersByTime(WAIT_MS)

      const sent = factory.latest().sentMessages()
      expect(sent).toHaveLength(1)
      expect(sent[0]).toMatchObject({ sequence: 1, payload: { load_weight_kg: 1200 } })
    })
  })

  describe('sequence', () => {
    it('cresce a cada envio e a resposta correspondente é aplicada', () => {
      const { factory, session } = connectedSetup()

      session.update(withLoad(1000))
      vi.advanceTimersByTime(WAIT_MS)
      session.update(withLoad(1500))
      vi.advanceTimersByTime(WAIT_MS)
      expect(
        factory
          .latest()
          .sentMessages()
          .map((m) => m.sequence),
      ).toEqual([1, 2])

      factory.latest().receive(wsEvaluated(2, 75))

      const state = session.getState()
      expect(state.result).toMatchObject({ kind: 'EVALUATED', utilizationPercent: 75 })
      expect(state.lastAppliedSequence).toBe(2)
      expect(state.pending).toBe(false)
      expect(state.transport).toBe('websocket')
    })

    it('descarta resposta com sequence antiga que chega depois da nova', () => {
      const { factory, session } = connectedSetup()
      session.update(withLoad(1000))
      vi.advanceTimersByTime(WAIT_MS)
      session.update(withLoad(1500))
      vi.advanceTimersByTime(WAIT_MS)

      factory.latest().receive(wsEvaluated(2, 75))
      factory.latest().receive(wsEvaluated(1, 50))
      factory.latest().receive(wsError(1))

      const state = session.getState()
      expect(state.result).toMatchObject({ utilizationPercent: 75 })
      expect(state.error).toBeNull()
      expect(state.lastAppliedSequence).toBe(2)
    })

    it('aplica resposta intermediária enquanto a mais nova não chega, e segue pendente', () => {
      const { factory, session } = connectedSetup()
      session.update(withLoad(1000))
      vi.advanceTimersByTime(WAIT_MS)
      session.update(withLoad(1500))
      vi.advanceTimersByTime(WAIT_MS)

      factory.latest().receive(wsEvaluated(1, 50))

      expect(session.getState()).toMatchObject({ lastAppliedSequence: 1, pending: true })
    })

    it('ignora sequence que a sessão não enviou', () => {
      const { factory, session } = connectedSetup()
      session.update(withLoad(1000))
      vi.advanceTimersByTime(WAIT_MS)

      factory.latest().receive(wsEvaluated(99))

      expect(session.getState().result).toBeNull()
    })
  })

  describe('resultado e erro', () => {
    it('mostra "não avaliável" com os motivos', () => {
      const { factory, session } = connectedSetup()
      session.update(FICTICIO_INPUT)
      vi.advanceTimersByTime(WAIT_MS)

      factory.latest().receive(wsNotEvaluable(1))

      expect(session.getState().result).toMatchObject({
        kind: 'NOT_EVALUABLE',
        reasons: [{ code: 'CRANE_GEOMETRY_NOT_FOUND' }, { code: 'ACTIVE_LOAD_CHART_NOT_FOUND' }],
      })
    })

    it('simulation.error do estado atual é exibido e limpa o resultado anterior', () => {
      const { factory, session } = connectedSetup()
      session.update(withLoad(1000))
      vi.advanceTimersByTime(WAIT_MS)
      factory.latest().receive(wsEvaluated(1))
      session.update(withLoad(-1))
      vi.advanceTimersByTime(WAIT_MS)

      factory.latest().receive(wsError(2, 'INVALID_MESSAGE'))

      expect(session.getState()).toMatchObject({
        result: null,
        error: { code: 'INVALID_MESSAGE', message: 'Mensagem inválida.' },
      })
    })

    it('erro sem sequence e mensagem inválida do servidor também são exibidos', () => {
      const { factory, session } = connectedSetup()
      factory.latest().receive(wsError(null, 'MALFORMED_MESSAGE'))
      expect(session.getState().error?.code).toBe('MALFORMED_MESSAGE')

      factory.latest().receiveRaw('não é json')
      expect(session.getState().error?.code).toBe('INVALID_SERVER_MESSAGE')
    })

    it('clear() descarta respostas em voo e limpa a tela', () => {
      const { factory, session } = connectedSetup()
      session.update(FICTICIO_INPUT)
      vi.advanceTimersByTime(WAIT_MS)

      session.clear()
      factory.latest().receive(wsEvaluated(1))

      expect(session.getState()).toMatchObject({ result: null, error: null, pending: false })
    })
  })

  describe('reconexão', () => {
    it('ao reconectar, reenvia o último estado com um sequence novo', () => {
      const { calls, evaluator } = fakeOneShot()
      const { factory, session } = setup(evaluator)
      session.start()
      factory.latest().acceptConnection()
      session.update(FICTICIO_INPUT)
      vi.advanceTimersByTime(WAIT_MS)
      factory.latest().receive(wsEvaluated(1))

      factory.latest().drop()
      expect(session.getState().connectionStatus).toBe('reconnecting')
      vi.advanceTimersByTime(RECONNECT_MS)
      factory.latest().acceptConnection()

      expect(session.getState().connectionStatus).toBe('connected')
      expect(factory.sockets).toHaveLength(2)
      expect(factory.latest().sentMessages()).toEqual([
        expect.objectContaining({
          sequence: 2,
          payload: expect.objectContaining({ load_weight_kg: 1500 }),
        }),
      ])
      expect(calls).toHaveLength(0)
    })

    it('caindo com resposta pendente, o último estado vai por REST', async () => {
      const { calls, evaluator } = fakeOneShot()
      const { factory, session } = setup(evaluator)
      session.start()
      factory.latest().acceptConnection()
      session.update(FICTICIO_INPUT)
      vi.advanceTimersByTime(WAIT_MS)

      factory.latest().drop()

      expect(calls).toHaveLength(1)
      calls[0].resolve(mapEvaluationResponse(REST_NOT_EVALUABLE))
      await Promise.resolve()
      expect(session.getState()).toMatchObject({
        lastAppliedSequence: 2,
        transport: 'rest',
        result: { kind: 'NOT_EVALUABLE' },
        pending: false,
      })
    })
  })

  describe('sem WebSocket', () => {
    it('avalia por REST com o cliente real e fetch falso', async () => {
      const fetchFn = vi.fn<typeof fetch>(
        async () => new Response(JSON.stringify(REST_NOT_EVALUABLE), { status: 200 }),
      )
      const { session } = setup(createEvaluationRestClient({ fetchFn }))
      session.start()

      session.update(FICTICIO_INPUT)
      await vi.advanceTimersByTimeAsync(WAIT_MS)

      expect(fetchFn).toHaveBeenCalledOnce()
      expect(session.getState()).toMatchObject({
        connectionStatus: 'connecting',
        transport: 'rest',
        result: { kind: 'NOT_EVALUABLE' },
      })
    })

    it('descarta resposta REST antiga que chega depois da nova', async () => {
      const { calls, evaluator } = fakeOneShot()
      const { session } = setup(evaluator)
      session.start()
      session.update(withLoad(1000))
      vi.advanceTimersByTime(WAIT_MS)
      session.update(withLoad(1500))
      vi.advanceTimersByTime(WAIT_MS)

      calls[1].resolve(mapEvaluationResponse(REST_NOT_EVALUABLE))
      await Promise.resolve()
      calls[0].reject({ code: 'NETWORK_ERROR', message: 'falha de rede' })
      await Promise.resolve()

      expect(session.getState()).toMatchObject({
        lastAppliedSequence: 2,
        error: null,
        result: { kind: 'NOT_EVALUABLE' },
      })
    })

    it('erro do REST é exibido', async () => {
      const { calls, evaluator } = fakeOneShot()
      const { session } = setup(evaluator)
      session.start()
      session.update(FICTICIO_INPUT)
      vi.advanceTimersByTime(WAIT_MS)

      calls[0].reject({ code: 'NETWORK_ERROR', message: 'Não foi possível falar com o backend.' })
      await Promise.resolve()

      expect(session.getState().error).toEqual({
        code: 'NETWORK_ERROR',
        message: 'Não foi possível falar com o backend.',
      })
    })

    it('depois de stop(), ignora a resposta REST em voo e fecha o canal', async () => {
      const { calls, evaluator } = fakeOneShot()
      const { factory, session } = setup(evaluator)
      session.start()
      session.update(FICTICIO_INPUT)
      vi.advanceTimersByTime(WAIT_MS)

      session.stop()
      calls[0].resolve(mapEvaluationResponse(REST_NOT_EVALUABLE))
      await Promise.resolve()

      expect(factory.latest().closedByClient).toBe(true)
      expect(session.getState()).toMatchObject({ connectionStatus: 'closed', result: null })
    })
  })

  it('avisa os assinantes a cada mudança de estado', () => {
    const { session } = setup()
    const listener = vi.fn()
    const unsubscribe = session.subscribe(listener)

    session.start()
    expect(listener).toHaveBeenCalled()
    unsubscribe()
    listener.mockClear()
    session.update(FICTICIO_INPUT)
    expect(listener).not.toHaveBeenCalled()
  })
})
