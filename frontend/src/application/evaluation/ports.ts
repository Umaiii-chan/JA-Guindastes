// Portas da sessão de avaliação (TASK-032): o que ela precisa dos transportes, sem saber que são
// `fetch` e `WebSocket` (implementações em `src/infrastructure/`).

import type {
  ConnectionStatus,
  EvaluationError,
  EvaluationInput,
  EvaluationResult,
} from '../../domain/evaluation/evaluation'

/** Avaliação avulsa por requisição/resposta (REST, TASK-024). Rejeita com um `EvaluationError`. */
export interface OneShotEvaluator {
  evaluate(input: EvaluationInput): Promise<EvaluationResult>
}

/** Mensagem recebida pelo canal em tempo real, já traduzida. */
export type RealtimeMessage =
  | { readonly kind: 'evaluated'; readonly sequence: number; readonly result: EvaluationResult }
  | { readonly kind: 'error'; readonly sequence: number | null; readonly error: EvaluationError }
  /** O servidor mandou algo fora do contrato. */
  | { readonly kind: 'invalid'; readonly error: EvaluationError }

export interface RealtimeHandlers {
  onStatusChange(status: ConnectionStatus): void
  onMessage(message: RealtimeMessage): void
}

/** Canal em tempo real (WebSocket, TASK-025; ADR-010), com reconexão própria. */
export interface RealtimeChannel {
  connect(): void
  /** Fecha sem reconectar. */
  close(): void
  /** Envia o estado com o `sequence`; `false` se o canal não está aberto (nada foi enviado). */
  send(sequence: number, input: EvaluationInput): boolean
}

export type RealtimeChannelFactory = (handlers: RealtimeHandlers) => RealtimeChannel
