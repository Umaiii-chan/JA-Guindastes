// @vitest-environment jsdom
// Hook da área de operação (TASK-055): debounce, recálculo e descarte de resposta atrasada.

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useOperatingArea } from '../../src/app/useOperatingArea'
import type { OperatingArea, OperatingAreaRequest } from '../../src/domain/evaluation/operatingArea'
import { EvaluationClientError } from '../../src/infrastructure/api/evaluationRestClient'
import type { OperatingAreaRestClient } from '../../src/infrastructure/api/operatingAreaRestClient'

function area(loadWeightKg: number): OperatingArea {
  return {
    configurationId: 'CFG-FICTICIA',
    boomLengthM: 20,
    loadWeightKg,
    comparedWeightKg: loadWeightKg,
    psiStepDeg: 10,
    radiusStepM: 1,
    maxRadiusM: 21,
    cells: [{ psiDeg: 0, radiusM: 5, level: 'GREEN' }],
  }
}

function fakeClient() {
  const calls: OperatingAreaRequest[] = []
  const compute = vi.fn<OperatingAreaRestClient['compute']>(async (request) => {
    calls.push(request)
    return area(request.loadWeightKg)
  })
  return { client: { compute } satisfies OperatingAreaRestClient, calls, compute }
}

const BASE = {
  configurationId: 'CFG-FICTICIA',
  boomLengthM: 20,
  loadWeightKg: 1500,
  debounceMs: 100,
}

describe('useOperatingArea', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('desligado, não pede nada', async () => {
    const { client, compute } = fakeClient()
    const { result } = renderHook(() => useOperatingArea({ ...BASE, enabled: false, client }))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })

    expect(compute).not.toHaveBeenCalled()
    expect(result.current).toEqual({ area: null, loading: false, error: null })
  })

  it('ligado, pede depois do debounce e entrega a grade', async () => {
    const { client, compute } = fakeClient()
    const { result } = renderHook(() => useOperatingArea({ ...BASE, enabled: true, client }))
    expect(result.current.loading).toBe(true)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(99)
    })
    expect(compute).not.toHaveBeenCalled()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2)
    })

    expect(compute).toHaveBeenCalledTimes(1)
    expect(result.current.loading).toBe(false)
    expect(result.current.area?.loadWeightKg).toBe(1500)
  })

  it('mudanças seguidas viram um pedido só, com o último valor', async () => {
    const { client, calls } = fakeClient()
    const { rerender } = renderHook(
      (props: { loadWeightKg: number }) =>
        useOperatingArea({ ...BASE, ...props, enabled: true, client }),
      { initialProps: { loadWeightKg: 1000 } },
    )
    rerender({ loadWeightKg: 1200 })
    rerender({ loadWeightKg: 1400 })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(150)
    })

    expect(calls).toHaveLength(1)
    expect(calls[0].loadWeightKg).toBe(1400)
  })

  it('manda os acessórios e pede de novo quando a cadeia muda (RN-014)', async () => {
    const { client, calls } = fakeClient()
    const { rerender } = renderHook(
      (props: { accessoryIds: readonly string[] }) =>
        useOperatingArea({ ...BASE, ...props, enabled: true, client }),
      { initialProps: { accessoryIds: [] as readonly string[] } },
    )
    await act(async () => {
      await vi.advanceTimersByTimeAsync(150)
    })
    // Mesmo conteúdo num array novo (a tela recria a lista): não pede de novo.
    rerender({ accessoryIds: [] })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(150)
    })
    rerender({ accessoryIds: ['ACC-FICTICIO-GANCHO', 'ACC-FICTICIO-MANILHA'] })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(150)
    })

    expect(calls).toHaveLength(2)
    expect(calls[0].accessoryIds).toEqual([])
    expect(calls[1].accessoryIds).toEqual(['ACC-FICTICIO-GANCHO', 'ACC-FICTICIO-MANILHA'])
  })

  it('erro do servidor vira mensagem e apaga a grade', async () => {
    const client: OperatingAreaRestClient = {
      compute: async () => {
        throw new EvaluationClientError('HTTP_ERROR', 'O servidor respondeu HTTP 500.')
      },
    }
    const { result } = renderHook(() => useOperatingArea({ ...BASE, enabled: true, client }))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(150)
    })

    expect(result.current).toEqual({
      area: null,
      loading: false,
      error: 'O servidor respondeu HTTP 500.',
    })
  })

  it('sem carga válida, não pede', async () => {
    const { client, compute } = fakeClient()
    renderHook(() => useOperatingArea({ ...BASE, loadWeightKg: null, enabled: true, client }))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })

    expect(compute).not.toHaveBeenCalled()
  })
})
