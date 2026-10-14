// Sessão de avaliação em tempo real (TASK-032; doc-fonte §§ 15.4 e 17.2; ADR-010).
//
// Recebe o estado da tela, envia ao backend com debounce e um `sequence` crescente e guarda o
// último resultado. Regras:
//
// - `sequence` cresce a cada envio, nos dois transportes, e nunca volta (nem ao reconectar);
// - uma resposta com `sequence` menor ou igual ao da última aplicada é descartada (doc-fonte § 15.4);
// - com o WebSocket aberto, o estado vai por ele (ADR-010: ciclo interativo); sem ele, vai por REST
//   (`POST /api/v1/evaluations`), para a tela continuar mostrando o valor do backend (RN-008);
// - ao (re)conectar, o último estado é reenviado; ao cair com resposta pendente, ele vai por REST;
// - um erro limpa o resultado mostrado: um resultado antigo não pode parecer ser do estado atual;
// - sem resposta do WebSocket em `replyTimeoutMs`, o mesmo estado vai por REST (TASK-050);
// - com um envio sem resposta há mais de `slowAfterMs`, `slow` avisa a tela (ex.: o backend no plano
//   gratuito do Render acordando, ~1 min; known-gaps § 7), em vez de "atualizando…" sem explicação.
//
// Sem nível de alerta (PEND-004): o resultado é mostrado como o backend o devolveu.

import type {
  ConnectionStatus,
  EvaluationError,
  EvaluationInput,
  EvaluationResult,
} from '../../domain/evaluation/evaluation'
import { createDebouncer, type DebounceOptions } from './debounce'
import type { OneShotEvaluator, RealtimeChannelFactory, RealtimeMessage } from './ports'

export type EvaluationTransport = 'websocket' | 'rest'

export interface EvaluationSessionState {
  readonly connectionStatus: ConnectionStatus
  /** Último resultado do backend aplicado; `null` antes do primeiro, depois de erro ou sem estado. */
  readonly result: EvaluationResult | null
  readonly error: EvaluationError | null
  /** Há estado enviado (ou por enviar) mais novo que o mostrado. */
  readonly pending: boolean
  /** Por onde veio o que está sendo mostrado. */
  readonly transport: EvaluationTransport | null
  /** `sequence` do último envio (0 = nenhum). */
  readonly lastSentSequence: number
  /** `sequence` da última resposta aplicada (0 = nenhuma). */
  readonly lastAppliedSequence: number
  /** O último envio está sem resposta há mais de `slowAfterMs` (TASK-050). */
  readonly slow: boolean
}

export interface EvaluationSessionOptions {
  /** Ausente em implantações que usam somente REST (por exemplo, o frontend na Vercel). */
  readonly createRealtimeChannel?: RealtimeChannelFactory
  readonly oneShotEvaluator: OneShotEvaluator
  readonly debounce?: DebounceOptions
  /** Espera pela resposta do WebSocket antes de repetir o estado por REST. */
  readonly replyTimeoutMs?: number
  /** Tempo sem resposta a partir do qual a tela avisa que o backend está demorando. */
  readonly slowAfterMs?: number
}

/**
 * PROVISÓRIO — valor técnico sem requisito (RNF-003 ainda sem meta): 150 ms sem mudanças, ou no
 * máximo 400 ms durante mudanças contínuas.
 */
export const DEFAULT_DEBOUNCE: DebounceOptions = { waitMs: 150, maxWaitMs: 400 }

/** PROVISÓRIO — valores técnicos (TASK-050), sem requisito: uma resposta normal leva milissegundos. */
export const DEFAULT_REPLY_TIMEOUT_MS = 8000
export const DEFAULT_SLOW_AFTER_MS = 4000

const INITIAL_STATE: EvaluationSessionState = {
  connectionStatus: 'idle',
  result: null,
  error: null,
  pending: false,
  transport: null,
  lastSentSequence: 0,
  lastAppliedSequence: 0,
  slow: false,
}

type Outcome =
  | { readonly result: EvaluationResult; readonly error?: undefined }
  | { readonly error: EvaluationError; readonly result?: undefined }

export class EvaluationSession {
  private state: EvaluationSessionState = INITIAL_STATE
  private readonly listeners = new Set<() => void>()
  private readonly options: EvaluationSessionOptions
  private readonly debouncer
  private channel: ReturnType<RealtimeChannelFactory> | null = null
  private latestInput: EvaluationInput | null = null
  /** Invalida as respostas REST em voo quando a sessão para. */
  private generation = 0
  private replyTimer: ReturnType<typeof setTimeout> | null = null
  private slowTimer: ReturnType<typeof setTimeout> | null = null

  constructor(options: EvaluationSessionOptions) {
    this.options = options
    this.debouncer = createDebouncer(() => this.send(), options.debounce ?? DEFAULT_DEBOUNCE)
  }

  getState = (): EvaluationSessionState => this.state

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Abre o canal em tempo real. Pode ser chamada de novo depois de `stop()`. */
  start(): void {
    if (this.channel) return
    this.generation += 1
    const generation = this.generation
    if (!this.options.createRealtimeChannel) {
      this.setState({ connectionStatus: 'rest' })
      return
    }
    this.channel = this.options.createRealtimeChannel({
      onStatusChange: (status) => {
        if (generation === this.generation) this.handleStatusChange(status)
      },
      onMessage: (message) => {
        if (generation === this.generation) this.handleMessage(message)
      },
    })
    this.channel.connect()
  }

  /** Fecha o canal, cancela o envio adiado e passa a ignorar respostas em voo. */
  stop(): void {
    this.generation += 1
    this.debouncer.cancel()
    this.clearTimers()
    this.channel?.close()
    this.channel = null
    this.setState({ connectionStatus: 'closed', pending: false, slow: false })
  }

  /** Novo estado da tela: será enviado depois do debounce. */
  update(input: EvaluationInput): void {
    this.latestInput = input
    this.debouncer.schedule()
    this.setState({ pending: true })
  }

  /**
   * Não há estado válido para avaliar (ex.: configuração vazia). Cancela o envio adiado, descarta as
   * respostas em voo e limpa o resultado.
   */
  clear(): void {
    this.latestInput = null
    this.debouncer.cancel()
    this.clearTimers()
    this.setState({
      result: null,
      error: null,
      pending: false,
      slow: false,
      transport: null,
      lastAppliedSequence: this.state.lastSentSequence,
    })
  }

  private send(): void {
    const input = this.latestInput
    if (!input) return
    const sequence = this.state.lastSentSequence + 1
    this.setState({ lastSentSequence: sequence, pending: true })
    this.watchSlowReply(sequence)

    if (this.channel?.send(sequence, input)) {
      this.armReplyTimeout(sequence, input)
      return
    }
    this.sendByRest(sequence, input)
  }

  private sendByRest(sequence: number, input: EvaluationInput): void {
    const generation = this.generation
    this.options.oneShotEvaluator.evaluate(input).then(
      (result) => {
        if (generation === this.generation) this.apply(sequence, 'rest', { result })
      },
      (error: unknown) => {
        if (generation === this.generation) this.apply(sequence, 'rest', { error: toError(error) })
      },
    )
  }

  /** O envio `sequence` ainda é o último e está sem resposta (nesta geração da sessão). */
  private isUnanswered(sequence: number, generation: number): boolean {
    return (
      generation === this.generation &&
      this.state.lastSentSequence === sequence &&
      this.state.lastAppliedSequence < sequence
    )
  }

  /** Aviso de demora do envio `sequence`. */
  private watchSlowReply(sequence: number): void {
    this.clearTimers()
    const generation = this.generation
    this.slowTimer = setTimeout(() => {
      this.slowTimer = null
      if (this.isUnanswered(sequence, generation)) this.setState({ slow: true })
    }, this.options.slowAfterMs ?? DEFAULT_SLOW_AFTER_MS)
  }

  /**
   * Enviado pelo WebSocket: se a resposta não vier (canal meio aberto, servidor sem responder), o
   * mesmo `sequence` vai por REST.
   */
  private armReplyTimeout(sequence: number, input: EvaluationInput): void {
    const generation = this.generation
    this.replyTimer = setTimeout(() => {
      this.replyTimer = null
      if (this.isUnanswered(sequence, generation)) this.sendByRest(sequence, input)
    }, this.options.replyTimeoutMs ?? DEFAULT_REPLY_TIMEOUT_MS)
  }

  private clearTimers(): void {
    if (this.replyTimer !== null) clearTimeout(this.replyTimer)
    if (this.slowTimer !== null) clearTimeout(this.slowTimer)
    this.replyTimer = null
    this.slowTimer = null
  }

  private handleStatusChange(status: ConnectionStatus): void {
    this.setState({ connectionStatus: status })
    const hasUnansweredState =
      this.latestInput !== null && this.state.lastAppliedSequence < this.state.lastSentSequence
    if (status === 'connected' && this.latestInput !== null) {
      // (Re)conectou: reenviar o último estado, já que a resposta anterior pode ter se perdido.
      this.debouncer.cancel()
      this.send()
    } else if (status === 'reconnecting' && hasUnansweredState && !this.debouncer.isPending) {
      // Caiu com resposta pendente: o último estado vai por REST.
      this.send()
    }
  }

  private handleMessage(message: RealtimeMessage): void {
    switch (message.kind) {
      case 'evaluated':
        this.apply(message.sequence, 'websocket', { result: message.result })
        return
      case 'error':
        if (message.sequence === null) this.showUnsequencedError(message.error)
        else this.apply(message.sequence, 'websocket', { error: message.error })
        return
      case 'invalid':
        this.showUnsequencedError(message.error)
        return
    }
  }

  private apply(sequence: number, transport: EvaluationTransport, outcome: Outcome): void {
    // Resposta antiga (ou de um `sequence` que esta sessão não enviou): descartada (§ 15.4).
    if (sequence <= this.state.lastAppliedSequence || sequence > this.state.lastSentSequence) {
      return
    }
    const answeredLatest = sequence === this.state.lastSentSequence
    if (answeredLatest) this.clearTimers()
    this.setState({
      lastAppliedSequence: sequence,
      result: outcome.result ?? null,
      error: outcome.error ?? null,
      transport,
      pending: !answeredLatest || this.debouncer.isPending,
      slow: answeredLatest ? false : this.state.slow,
    })
  }

  /** Erro sem `sequence` (o servidor não leu a mensagem): não dá para saber se é antigo; mostra. */
  private showUnsequencedError(error: EvaluationError): void {
    this.setState({ result: null, error, transport: 'websocket' })
  }

  private setState(patch: Partial<EvaluationSessionState>): void {
    this.state = { ...this.state, ...patch }
    for (const listener of this.listeners) listener()
  }
}

function toError(error: unknown): EvaluationError {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    typeof error.code === 'string' &&
    typeof error.message === 'string'
  ) {
    return { code: error.code, message: error.message }
  }
  return { code: 'UNEXPECTED_ERROR', message: 'Falha inesperada ao avaliar.' }
}
