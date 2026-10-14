// Área de operação do simulador (TASK-055; ADR-025): pede ao backend a grade verde, amarela e
// vermelha quando o recurso está ligado e recalcula, com debounce, quando a lança, a carga ou a
// configuração mudam. O giro e o raio NÃO entram: a grade já cobre todos os ψ e R. Resposta
// atrasada é descartada (vale a do último pedido).

import { useEffect, useMemo, useState } from 'react'

import type { OperatingArea } from '../domain/evaluation/operatingArea'
import { EvaluationClientError } from '../infrastructure/api/evaluationRestClient'
import {
  createOperatingAreaRestClient,
  type OperatingAreaRestClient,
} from '../infrastructure/api/operatingAreaRestClient'

/** PROVISÓRIO — valor técnico: espera sem mudança antes de recalcular a área. */
export const OPERATING_AREA_DEBOUNCE_MS = 350

export interface UseOperatingAreaParams {
  readonly enabled: boolean
  readonly configurationId: string | null
  readonly boomLengthM: number | null
  /** Peso da carga em kg, ou `null` sem carga válida. */
  readonly loadWeightKg: number | null
  /** Cliente injetável (testes); padrão: REST na mesma origem. */
  readonly client?: OperatingAreaRestClient
  readonly debounceMs?: number
}

export interface UseOperatingAreaResult {
  readonly area: OperatingArea | null
  readonly loading: boolean
  readonly error: string | null
}

interface Settled {
  /** Pedido a que o resultado responde. */
  readonly key: string
  readonly area: OperatingArea | null
  readonly error: string | null
}

export function useOperatingArea({
  enabled,
  configurationId,
  boomLengthM,
  loadWeightKg,
  client,
  debounceMs = OPERATING_AREA_DEBOUNCE_MS,
}: UseOperatingAreaParams): UseOperatingAreaResult {
  const defaultClient = useMemo(() => createOperatingAreaRestClient(), [])
  const restClient = client ?? defaultClient
  const [settled, setSettled] = useState<Settled | null>(null)

  // Identifica o pedido atual; `null` = nada a pedir (desligado ou sem dados).
  const key =
    enabled && configurationId && boomLengthM !== null && loadWeightKg !== null
      ? JSON.stringify([configurationId, boomLengthM, loadWeightKg])
      : null

  useEffect(() => {
    if (key === null) return
    const [id, boom, weight] = JSON.parse(key) as [string, number, number]
    const controller = new AbortController()
    const timer = setTimeout(() => {
      restClient
        .compute(
          { configurationId: id, boomLengthM: boom, loadWeightKg: weight },
          controller.signal,
        )
        .then((area) => {
          if (!controller.signal.aborted) setSettled({ key, area, error: null })
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return
          const message =
            error instanceof EvaluationClientError
              ? error.message
              : 'Não foi possível calcular a área de operação.'
          setSettled({ key, area: null, error: message })
        })
    }, debounceMs)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [key, restClient, debounceMs])

  if (key === null) return { area: null, loading: false, error: null }
  // Enquanto o pedido novo não volta, a grade anterior continua na cena (sem piscar).
  const current = settled?.key === key
  return {
    area: settled?.area ?? null,
    loading: !current,
    error: current ? settled.error : null,
  }
}
