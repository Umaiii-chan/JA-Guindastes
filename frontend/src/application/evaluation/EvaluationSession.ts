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
// - um erro limpa o resultado mostrado: um resultado antigo não pode parecer ser do estado atual.
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
}

export interface EvaluationSessionOptions {
  readonly createRealtimeChannel: RealtimeChannelFactory
  readonly oneShotEvaluator: OneShotEvaluator
  readonly debounce?: DebounceOptions
}

/**
 * PROVISÓRIO — valor técnico sem requisito (RNF-003 ainda sem meta): 150 ms sem mudanças, ou no
 * máximo 400 ms durante mudanças contínuas.
 */
export const DEFAULT_DEBOUNCE: DebounceOptions = { waitMs: 150, maxWaitMs: 400 }

const INITIAL_STATE: EvaluationSessionState = {
  connectionStatus: 'idle',
  result: null,
  error: null,
  pending: false,
  transport: null,
  lastSentSequence: 0,
  lastAppliedSequence: 0,
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
    this.channel?.close()
    this.channel = null
    this.setState({ connectionStatus: 'closed', pending: false })
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
    this.setState({
      result: null,
      error: null,
      pending: false,
      transport: null,
      lastAppliedSequence: this.state.lastSentSequence,
    })
  }

  private send(): void {
    const input = this.latestInput
    if (!input) return
    const sequence = this.state.lastSentSequence + 1
    this.setState({ lastSentSequence: sequence, pending: true })

    if (this.channel?.send(sequence, input)) return

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
    this.setState({
      lastAppliedSequence: sequence,
      result: outcome.result ?? null,
      error: outcome.error ?? null,
      transport,
      pending: sequence < this.state.lastSentSequence || this.debouncer.isPending,
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
