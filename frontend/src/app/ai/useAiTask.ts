// Uma chamada ao assistente de IA com o estado que a tela precisa (TASK-076): ocioso, carregando,
// pronto ou com erro. A chamada parte de um clique (`run`), nunca de um efeito: assim o modo estrito
// do React não gasta uma segunda chamada do limite por hora. Uma resposta que chega depois de
// `reset` ou de outro `run` é descartada.

import { useCallback, useEffect, useRef, useState } from 'react'

export type AiTaskState<T> =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly result: T }
  | { readonly status: 'error'; readonly message: string }

export interface AiTask<T> {
  readonly state: AiTaskState<T>
  /** Dispara a chamada; só uma fica valendo por vez. */
  run(action: () => Promise<T>): void
  /** Volta a ocioso e ignora uma chamada em andamento. */
  reset(): void
}

export function useAiTask<T>(): AiTask<T> {
  const [state, setState] = useState<AiTaskState<T>>({ status: 'idle' })
  const ticket = useRef(0)
  useEffect(
    () => () => {
      ticket.current += 1
    },
    [],
  )

  const run = useCallback((action: () => Promise<T>) => {
    ticket.current += 1
    const mine = ticket.current
    setState({ status: 'loading' })
    action().then(
      (result) => {
        if (ticket.current === mine) setState({ status: 'ready', result })
      },
      (failure: unknown) => {
        if (ticket.current !== mine) return
        const message =
          failure instanceof Error && failure.message.trim() !== ''
            ? failure.message
            : 'Não foi possível falar com o assistente. Tente de novo.'
        setState({ status: 'error', message })
      },
    )
  }, [])

  const reset = useCallback(() => {
    ticket.current += 1
    setState({ status: 'idle' })
  }, [])

  return { state, run, reset }
}
