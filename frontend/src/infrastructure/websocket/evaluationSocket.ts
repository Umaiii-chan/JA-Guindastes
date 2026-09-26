// Canal WebSocket da avaliação (TASK-025; ADR-010) com reconexão simples.
//
// Reconexão: se a conexão cai (ou não abre) sem `close()` do cliente, o estado vai para
// `reconnecting` e uma nova conexão é tentada depois de `reconnectDelayMs`, até abrir ou até
// `close()`. Sem backoff exponencial nem limite de tentativas (não há requisito; ver handoff).

import type { ConnectionStatus, EvaluationInput } from '../../domain/evaluation/evaluation'
import type { RealtimeChannel, RealtimeHandlers } from '../../application/evaluation/ports'
import {
  EVALUATION_WEBSOCKET_PATH,
  INVALID_SERVER_MESSAGE,
  parseServerMessage,
  toStateChangedMessage,
} from './evaluationMessages'

/** O pedaço da API `WebSocket` do navegador que o canal usa (permite um falso nos testes). */
export interface WebSocketLike {
  readonly readyState: number
  onopen: ((event: Event) => void) | null
  onclose: ((event: CloseEvent) => void) | null
  onerror: ((event: Event) => void) | null
  onmessage: ((event: MessageEvent) => void) | null
  send(data: string): void
  close(): void
}

export type WebSocketFactory = (url: string) => WebSocketLike

/** `WebSocket.OPEN`, sem depender do global (que não existe no Node dos testes). */
const OPEN = 1

/** PROVISÓRIO — valor técnico sem requisito: espera entre tentativas de reconexão. */
export const DEFAULT_RECONNECT_DELAY_MS = 2000

export interface EvaluationSocketOptions {
  readonly url: string
  readonly createWebSocket: WebSocketFactory
  readonly reconnectDelayMs?: number
}

/** URL do WebSocket na mesma origem da página (`ws:` em `http:`, `wss:` em `https:`). */
export function evaluationWebSocketUrl(location: {
  readonly protocol: string
  readonly host: string
}): string {
  const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${scheme}//${location.host}${EVALUATION_WEBSOCKET_PATH}`
}

export class EvaluationSocket implements RealtimeChannel {
  private readonly options: EvaluationSocketOptions
  private readonly handlers: RealtimeHandlers
  private socket: WebSocketLike | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined
  private status: ConnectionStatus = 'idle'
  private wanted = false

  constructor(options: EvaluationSocketOptions, handlers: RealtimeHandlers) {
    this.options = options
    this.handlers = handlers
  }

  get connectionStatus(): ConnectionStatus {
    return this.status
  }

  connect(): void {
    if (this.wanted) return
    this.wanted = true
    this.setStatus('connecting')
    this.open()
  }

  close(): void {
    this.wanted = false
    clearTimeout(this.reconnectTimer)
    this.reconnectTimer = undefined
    const socket = this.socket
    this.socket = null
    if (socket) {
      detach(socket)
      socket.close()
    }
    this.setStatus('closed')
  }

  send(sequence: number, input: EvaluationInput): boolean {
    const socket = this.socket
    if (!socket || socket.readyState !== OPEN || this.status !== 'connected') return false
    try {
      socket.send(JSON.stringify(toStateChangedMessage(sequence, input)))
      return true
    } catch {
      return false
    }
  }

  private open(): void {
    let socket: WebSocketLike
    try {
      socket = this.options.createWebSocket(this.options.url)
    } catch {
      this.scheduleReconnect()
      return
    }
    this.socket = socket
    socket.onopen = () => {
      if (this.socket === socket) this.setStatus('connected')
    }
    socket.onmessage = (event) => {
      if (this.socket !== socket) return
      if (typeof event.data !== 'string') {
        this.handlers.onMessage({
          kind: 'invalid',
          error: { code: INVALID_SERVER_MESSAGE, message: 'Mensagem do servidor não é texto.' },
        })
        return
      }
      this.handlers.onMessage(parseServerMessage(event.data))
    }
    // O `close` sempre vem depois do `error`: a reconexão fica só no `onclose`.
    socket.onerror = () => {}
    socket.onclose = () => {
      if (this.socket !== socket) return
      detach(socket)
      this.socket = null
      this.scheduleReconnect()
    }
  }

  private scheduleReconnect(): void {
    if (!this.wanted) return
    this.setStatus('reconnecting')
    clearTimeout(this.reconnectTimer)
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined
      if (this.wanted) this.open()
    }, this.options.reconnectDelayMs ?? DEFAULT_RECONNECT_DELAY_MS)
  }

  private setStatus(status: ConnectionStatus): void {
    if (this.status === status) return
    this.status = status
    this.handlers.onStatusChange(status)
  }
}

function detach(socket: WebSocketLike): void {
  socket.onopen = null
  socket.onmessage = null
  socket.onerror = null
  socket.onclose = null
}
