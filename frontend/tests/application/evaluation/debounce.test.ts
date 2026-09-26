import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createDebouncer } from '../../../src/application/evaluation/debounce'

describe('createDebouncer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('chama uma vez só, waitMs depois da última chamada', () => {
    const callback = vi.fn()
    const debouncer = createDebouncer(callback, { waitMs: 100, maxWaitMs: 1000 })

    debouncer.schedule()
    vi.advanceTimersByTime(60)
    debouncer.schedule()
    vi.advanceTimersByTime(60)
    debouncer.schedule()
    expect(debouncer.isPending).toBe(true)
    vi.advanceTimersByTime(99)
    expect(callback).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)

    expect(callback).toHaveBeenCalledOnce()
    expect(debouncer.isPending).toBe(false)
  })

  it('durante chamadas contínuas, chama no máximo a cada maxWaitMs', () => {
    const callback = vi.fn()
    const debouncer = createDebouncer(callback, { waitMs: 100, maxWaitMs: 250 })

    for (let elapsed = 0; elapsed < 600; elapsed += 50) {
      debouncer.schedule()
      vi.advanceTimersByTime(50)
    }

    expect(callback).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(100)
    expect(callback).toHaveBeenCalledTimes(3)
  })

  it('flush chama já; cancel descarta', () => {
    const callback = vi.fn()
    const debouncer = createDebouncer(callback, { waitMs: 100, maxWaitMs: 100 })

    debouncer.flush()
    expect(callback).not.toHaveBeenCalled()
    debouncer.schedule()
    debouncer.flush()
    expect(callback).toHaveBeenCalledOnce()

    debouncer.schedule()
    debouncer.cancel()
    vi.advanceTimersByTime(500)
    expect(callback).toHaveBeenCalledOnce()
  })

  it('recusa maxWaitMs menor que waitMs', () => {
    expect(() => createDebouncer(() => {}, { waitMs: 200, maxWaitMs: 100 })).toThrow(RangeError)
  })
})
