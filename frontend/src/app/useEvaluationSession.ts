// Composição da sessão de avaliação com os transportes reais (TASK-032): WebSocket e `fetch` na
// mesma origem da página. Em desenvolvimento, o proxy do Vite leva `/api` ao backend; no container,
// o nginx (TASK-027).

import { useEffect, useState, useSyncExternalStore } from 'react'

import {
  EvaluationSession,
  type EvaluationSessionState,
} from '../application/evaluation/EvaluationSession'
import type { RealtimeHandlers } from '../application/evaluation/ports'
import { createEvaluationRestClient } from '../infrastructure/api/evaluationRestClient'
import {
  EvaluationSocket,
  evaluationWebSocketUrl,
} from '../infrastructure/websocket/evaluationSocket'

function createBrowserEvaluationSession(): EvaluationSession {
  const transport = evaluationTransportFromEnvironment(import.meta.env.VITE_EVALUATION_TRANSPORT)
  const createRealtimeChannel =
    transport === 'websocket'
      ? (handlers: RealtimeHandlers) =>
          new EvaluationSocket(
            {
              url: evaluationWebSocketUrl(window.location),
              createWebSocket: (target) => new WebSocket(target),
            },
            handlers,
          )
      : undefined
  return new EvaluationSession({
    createRealtimeChannel,
    oneShotEvaluator: createEvaluationRestClient(),
  })
}

export function evaluationTransportFromEnvironment(
  value: string | undefined,
): 'websocket' | 'rest' {
  if (value === undefined || value === '' || value === 'websocket') return 'websocket'
  if (value === 'rest') return 'rest'
  throw new Error("VITE_EVALUATION_TRANSPORT deve ser 'websocket' ou 'rest'.")
}

export function useEvaluationSession(): {
  readonly session: EvaluationSession
  readonly state: EvaluationSessionState
} {
  const [session] = useState(createBrowserEvaluationSession)
  const state = useSyncExternalStore(session.subscribe, session.getState)

  useEffect(() => {
    session.start()
    return () => session.stop()
  }, [session])

  return { session, state }
}
