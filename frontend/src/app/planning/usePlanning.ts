// Pedido do planejamento ao backend (TASK-075): guarda a recomendação e o estado do pedido. Resposta
// atrasada de um pedido antigo é descartada (vale a do último).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { PlanningRequest, PlanningResult } from '../../domain/planning/planning'
import { EvaluationClientError } from '../../infrastructure/api/evaluationRestClient'
import {
  createPlanningRestClient,
  type PlanningRestClient,
} from '../../infrastructure/api/planningRestClient'

export interface PlanningState {
  readonly status: 'idle' | 'loading' | 'ready' | 'error'
  readonly result: PlanningResult | null
  readonly error: string | null
}

const IDLE: PlanningState = { status: 'idle', result: null, error: null }

export function usePlanning(client?: PlanningRestClient): {
  readonly state: PlanningState
  plan(request: PlanningRequest): Promise<void>
  clear(): void
} {
  const defaultClient = useMemo(() => createPlanningRestClient(), [])
  const restClient = client ?? defaultClient
  const [state, setState] = useState<PlanningState>(IDLE)
  const controller = useRef<AbortController | null>(null)

  useEffect(() => () => controller.current?.abort(), [])

  const plan = useCallback(
    async (request: PlanningRequest) => {
      controller.current?.abort()
      const current = new AbortController()
      controller.current = current
      setState((previous) => ({ status: 'loading', result: previous.result, error: null }))
      try {
        const result = await restClient.recommend(request, current.signal)
        if (!current.signal.aborted) setState({ status: 'ready', result, error: null })
      } catch (error) {
        if (current.signal.aborted) return
        setState({
          status: 'error',
          result: null,
          error:
            error instanceof EvaluationClientError
              ? error.message
              : 'Não foi possível calcular o planejamento.',
        })
      }
    },
    [restClient],
  )

  const clear = useCallback(() => {
    controller.current?.abort()
    setState(IDLE)
  }, [])

  return { state, plan, clear }
}
