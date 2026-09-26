// Composição da sessão de avaliação com os transportes reais (TASK-032): WebSocket e `fetch` na
// mesma origem da página. Em desenvolvimento, o proxy do Vite leva `/api` ao backend; no container,
// o nginx (TASK-027).

import { useEffect, useState, useSyncExternalStore } from 'react'

import {
  EvaluationSession,
  type EvaluationSessionState,
} from '../application/evaluation/EvaluationSession'
import { createEvaluationRestClient } from '../infrastructure/api/evaluationRestClient'
import {
  EvaluationSocket,
  evaluationWebSocketUrl,
} from '../infrastructure/websocket/evaluationSocket'

function createBrowserEvaluationSession(): EvaluationSession {
  const url = evaluationWebSocketUrl(window.location)
  return new EvaluationSession({
    createRealtimeChannel: (handlers) =>
      new EvaluationSocket({ url, createWebSocket: (target) => new WebSocket(target) }, handlers),
    oneShotEvaluator: createEvaluationRestClient(),
  })
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
