import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { RealtimeMessage } from '../../../src/application/evaluation/ports'
import type { ConnectionStatus } from '../../../src/domain/evaluation/evaluation'
import {
  EvaluationSocket,
  evaluationWebSocketUrl,
} from '../../../src/infrastructure/websocket/evaluationSocket'
import { fakeWebSocketFactory } from '../../helpers/fakeWebSocket'
import { FICTICIO_INPUT, wsEvaluated } from '../../fixtures/evaluationResponses'

const URL = 'ws://localhost:5173/api/v1/ws/evaluation'
const DELAY_MS = 1000

function setup() {
  const factory = fakeWebSocketFactory()
  const statuses: ConnectionStatus[] = []
  const messages: RealtimeMessage[] = []
  const socket = new EvaluationSocket(
    { url: URL, createWebSocket: factory.create, reconnectDelayMs: DELAY_MS },
    { onStatusChange: (status) => statuses.push(status), onMessage: (m) => messages.push(m) },
  )
  return { factory, statuses, messages, socket }
}

describe('EvaluationSocket', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('monta a URL do WebSocket na mesma origem (ws/wss)', () => {
    expect(evaluationWebSocketUrl({ protocol: 'http:', host: 'localhost:5173' })).toBe(URL)
    expect(evaluationWebSocketUrl({ protocol: 'https:', host: 'exemplo.test' })).toBe(
      'wss://exemplo.test/api/v1/ws/evaluation',
    )
  })

  it('segue connecting → connected e só envia com a conexão aberta', () => {
    const { factory, statuses, socket } = setup()

    socket.connect()
    expect(factory.latest().url).toBe(URL)
    expect(socket.send(1, FICTICIO_INPUT)).toBe(false)

    factory.latest().acceptConnection()
    expect(socket.send(2, FICTICIO_INPUT)).toBe(true)

    expect(statuses).toEqual(['connecting', 'connected'])
    expect(factory.latest().sentMessages()).toEqual([
      expect.objectContaining({ type: 'simulation.state.changed', sequence: 2 }),
    ])
  })

  it('entrega as mensagens do servidor já traduzidas', () => {
    const { factory, messages, socket } = setup()
    socket.connect()
    factory.latest().acceptConnection()

    factory.latest().receive(wsEvaluated(2))
    factory.latest().receiveRaw(new ArrayBuffer(4))

    expect(messages.map((m) => m.kind)).toEqual(['evaluated', 'invalid'])
  })

  it('reconecta depois do intervalo quando a conexão cai', () => {
    const { factory, statuses, socket } = setup()
    socket.connect()
    factory.latest().acceptConnection()

    factory.latest().drop()
    expect(statuses.at(-1)).toBe('reconnecting')
    expect(socket.send(3, FICTICIO_INPUT)).toBe(false)
    expect(factory.sockets).toHaveLength(1)

    vi.advanceTimersByTime(DELAY_MS - 1)
    expect(factory.sockets).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(factory.sockets).toHaveLength(2)

    factory.latest().acceptConnection()
    expect(statuses).toEqual(['connecting', 'connected', 'reconnecting', 'connected'])
    expect(socket.send(4, FICTICIO_INPUT)).toBe(true)
  })

  it('continua tentando enquanto a conexão não abre, sem repetir o estado', () => {
    const { factory, statuses, socket } = setup()
    socket.connect()

    factory.latest().drop()
    vi.advanceTimersByTime(DELAY_MS)
    factory.latest().drop()
    vi.advanceTimersByTime(DELAY_MS)

    expect(factory.sockets).toHaveLength(3)
    expect(statuses).toEqual(['connecting', 'reconnecting'])
  })

  it('reconecta também quando criar o WebSocket lança', () => {
    const statuses: ConnectionStatus[] = []
    let attempts = 0
    const socket = new EvaluationSocket(
      {
        url: URL,
        createWebSocket: () => {
          attempts += 1
          throw new SyntaxError('URL inválida')
        },
        reconnectDelayMs: DELAY_MS,
      },
      { onStatusChange: (status) => statuses.push(status), onMessage: () => {} },
    )

    socket.connect()
    vi.advanceTimersByTime(DELAY_MS)

    expect(attempts).toBe(2)
    expect(statuses).toEqual(['connecting', 'reconnecting'])
    socket.close()
  })

  it('close() fecha sem reconectar e ignora eventos do socket antigo', () => {
    const { factory, statuses, messages, socket } = setup()
    socket.connect()
    const first = factory.latest()
    first.acceptConnection()

    socket.close()
    first.receive(wsEvaluated(1))
    vi.advanceTimersByTime(DELAY_MS * 5)

    expect(first.closedByClient).toBe(true)
    expect(factory.sockets).toHaveLength(1)
    expect(messages).toEqual([])
    expect(statuses).toEqual(['connecting', 'connected', 'closed'])
  })

  it('close() durante a espera cancela a reconexão', () => {
    const { factory, socket } = setup()
    socket.connect()
    factory.latest().drop()

    socket.close()
    vi.advanceTimersByTime(DELAY_MS * 5)

    expect(factory.sockets).toHaveLength(1)
    expect(socket.connectionStatus).toBe('closed')
  })
})
