// Avaliação do içamento com dois guindastes no backend (TASK-074; RN-016): a cada mudança do estado
// dos dois guindastes (com debounce), `POST /api/v1/evaluations/tandem`. O resultado mostrado é
// sempre o do backend (RN-008); um erro limpa o resultado, para um valor antigo não parecer atual.

import { useEffect, useState } from 'react'

import type { EvaluationError } from '../../domain/evaluation/evaluation'
import type { TandemInput, TandemResult } from '../../domain/tandem/tandemEvaluation'
import { createTandemRestClient } from '../../infrastructure/api/tandemRestClient'

/** PROVISÓRIO — valor técnico: espera sem mudanças antes de pedir a avaliação. */
export const TANDEM_DEBOUNCE_MS = 150

export interface TandemEvaluationState {
  readonly result: TandemResult | null
  readonly error: EvaluationError | null
  /** Há um estado mais novo que o mostrado a caminho do backend. */
  readonly pending: boolean
}

const IDLE: TandemEvaluationState = { result: null, error: null, pending: false }

interface Answer {
  /** Pedido a que esta resposta se refere. */
  readonly key: string
  readonly result: TandemResult | null
  readonly error: EvaluationError | null
}

export function useTandemEvaluation(input: TandemInput | null): TandemEvaluationState {
  const [client] = useState(() => createTandemRestClient())
  const [answer, setAnswer] = useState<Answer | null>(null)
  const key = input === null ? null : JSON.stringify(input)

  useEffect(() => {
    if (key === null) return
    const request = JSON.parse(key) as TandemInput
    let cancelled = false
    const timer = setTimeout(() => {
      client
        .evaluate(request)
        .then((result) => {
          if (!cancelled) setAnswer({ key, result, error: null })
        })
        .catch((error: unknown) => {
          if (cancelled) return
          const code =
            typeof error === 'object' && error !== null && 'code' in error
              ? String((error as { code: unknown }).code)
              : 'ERRO'
          const message = error instanceof Error ? error.message : 'Falha ao avaliar o içamento.'
          setAnswer({ key, result: null, error: { code, message } })
        })
    }, TANDEM_DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [client, key])

  if (key === null || answer === null) return key === null ? IDLE : { ...IDLE, pending: true }
  return { result: answer.result, error: answer.error, pending: answer.key !== key }
}
