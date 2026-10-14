// Assistente de IA na aplicação (TASK-076; ADR-039). O `AiProvider` pergunta ao backend se a IA está
// ativa (`GET /ai/status`); sem ela (ou com erro), `enabled` é falso e a tela esconde tudo do
// assistente. Sem provider acima (testes de página), age como "desligado".

import { createContext, useContext } from 'react'

import type { AiGateway, AiStatus } from '../../application/ai/ports'

export interface AiContextValue {
  /** O assistente está ativo neste ambiente. */
  readonly enabled: boolean
  /** Estado lido de `/ai/status`; `null` enquanto não chegou ou se a chamada falhou. */
  readonly status: AiStatus | null
  /** Cliente das chamadas; `null` com a IA desligada. */
  readonly gateway: AiGateway | null
}

export const AI_DISABLED: AiContextValue = { enabled: false, status: null, gateway: null }

export const AiContext = createContext<AiContextValue>(AI_DISABLED)

export function useAi(): AiContextValue {
  return useContext(AiContext)
}
