import { type ReactNode, useEffect, useMemo, useState } from 'react'

import type { AiGateway, AiStatus } from '../../application/ai/ports'
import { createAiRestClient } from '../../infrastructure/api/aiRestClient'
import { AI_DISABLED, AiContext, type AiContextValue } from './aiContext'

/**
 * Descobre uma vez, ao entrar, se o assistente de IA está ativo. Qualquer falha na consulta
 * (backend antigo, rede) deixa o assistente escondido: o resto do simulador não depende dele.
 */
export function AiProvider({
  children,
  gateway,
}: {
  readonly children: ReactNode
  /** Cliente REST injetável (testes). Padrão: `createAiRestClient()`. */
  readonly gateway?: AiGateway
}) {
  const client = useMemo(() => gateway ?? createAiRestClient(), [gateway])
  const [status, setStatus] = useState<AiStatus | null>(null)

  useEffect(() => {
    let current = true
    client
      .status()
      .then((result) => {
        if (current) setStatus(result)
      })
      .catch(() => {
        if (current) setStatus(null)
      })
    return () => {
      current = false
    }
  }, [client])

  const value = useMemo<AiContextValue>(
    () => (status?.enabled ? { enabled: true, status, gateway: client } : AI_DISABLED),
    [status, client],
  )
  return <AiContext.Provider value={value}>{children}</AiContext.Provider>
}
