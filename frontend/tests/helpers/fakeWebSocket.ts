import type { WebSocketLike } from '../../src/infrastructure/websocket/evaluationSocket'

/** `WebSocket` falso: o teste decide quando abre, cai e o que o servidor responde. */
export class FakeWebSocket implements WebSocketLike {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSED = 3

  readonly url: string
  readyState = FakeWebSocket.CONNECTING
  readonly sent: string[] = []
  closedByClient = false
  onopen: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null

  constructor(url: string) {
    this.url = url
  }

  send(data: string): void {
    if (this.readyState !== FakeWebSocket.OPEN) throw new Error('socket não está aberto')
    this.sent.push(data)
  }

  close(): void {
    this.closedByClient = true
    this.readyState = FakeWebSocket.CLOSED
  }

  /** Mensagens enviadas, já como objetos. */
  sentMessages(): { type: string; sequence: number; payload: Record<string, unknown> }[] {
    return this.sent.map((text) => JSON.parse(text))
  }

  // --- ações do "servidor" ---

  acceptConnection(): void {
    this.readyState = FakeWebSocket.OPEN
    this.onopen?.({} as Event)
  }

  receive(message: unknown): void {
    this.receiveRaw(JSON.stringify(message))
  }

  receiveRaw(data: unknown): void {
    this.onmessage?.({ data } as MessageEvent)
  }

  /** A conexão cai (ou a tentativa falha) sem o cliente ter pedido: `error` e depois `close`. */
  drop(): void {
    this.readyState = FakeWebSocket.CLOSED
    this.onerror?.({} as Event)
    this.onclose?.({} as CloseEvent)
  }
}

/** Fábrica que guarda cada `FakeWebSocket` criado. */
export function fakeWebSocketFactory() {
  const sockets: FakeWebSocket[] = []
  return {
    sockets,
    create: (url: string) => {
      const socket = new FakeWebSocket(url)
      sockets.push(socket)
      return socket
    },
    latest: () => {
      const socket = sockets.at(-1)
      if (!socket) throw new Error('nenhum socket criado')
      return socket
    },
  }
}
