// Debounce com espera máxima (ADR-010: "debounce/throttle, sequence IDs" contra resposta atrasada).
//
// `schedule()` adia a chamada até `waitMs` sem novas chamadas; durante mudanças contínuas (arrastar
// um slider), chama no máximo a cada `maxWaitMs`, para a tela não ficar sem resposta enquanto o
// usuário arrasta.

export interface DebounceOptions {
  readonly waitMs: number
  /** Espera máxima desde a primeira chamada adiada; `>= waitMs`. */
  readonly maxWaitMs: number
}

export interface Debouncer {
  schedule(): void
  /** Chama agora, se houver chamada adiada. */
  flush(): void
  cancel(): void
  readonly isPending: boolean
}

export function createDebouncer(callback: () => void, options: DebounceOptions): Debouncer {
  if (!(options.waitMs >= 0) || !(options.maxWaitMs >= options.waitMs)) {
    throw new RangeError('debounce: esperado 0 <= waitMs <= maxWaitMs.')
  }
  let waitTimer: ReturnType<typeof setTimeout> | undefined
  let maxWaitTimer: ReturnType<typeof setTimeout> | undefined

  const clearTimers = () => {
    clearTimeout(waitTimer)
    clearTimeout(maxWaitTimer)
    waitTimer = undefined
    maxWaitTimer = undefined
  }
  const fire = () => {
    clearTimers()
    callback()
  }

  return {
    schedule() {
      clearTimeout(waitTimer)
      waitTimer = setTimeout(fire, options.waitMs)
      maxWaitTimer ??= setTimeout(fire, options.maxWaitMs)
    },
    flush() {
      if (waitTimer !== undefined) fire()
    },
    cancel: clearTimers,
    get isPending() {
      return waitTimer !== undefined
    },
  }
}
