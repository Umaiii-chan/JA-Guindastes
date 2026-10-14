// Configurações do catálogo dos guindastes adicionais do cenário (TASK-074): o cenário guarda só o
// id da configuração, e a cena precisa da ficha técnica dela (limites e parâmetros a e h).

import { useEffect, useState } from 'react'

import type { CraneConfiguration } from '../../domain/catalog/catalog'
import { createCatalogRestClient } from '../../infrastructure/api/catalogRestClient'

/**
 * Busca no catálogo as configurações de `ids` (uma vez cada) e devolve o que já chegou. Um id sem
 * resposta (removida do catálogo, falha de rede) fica `null`: o guindaste correspondente não entra
 * na cena, e a tela avisa.
 */
export function useConfigurationsById(ids: readonly string[]): {
  readonly configurations: ReadonlyMap<string, CraneConfiguration | null>
  /** Guarda uma configuração já conhecida (a que a pessoa acabou de escolher no catálogo). */
  remember(configuration: CraneConfiguration): void
} {
  const [client] = useState(() => createCatalogRestClient())
  const [loaded, setLoaded] = useState<ReadonlyMap<string, CraneConfiguration | null>>(
    () => new Map(),
  )
  const key = [...new Set(ids)].sort().join('|')

  useEffect(() => {
    const missing = key === '' ? [] : key.split('|').filter((id) => !loaded.has(id))
    if (missing.length === 0) return
    let cancelled = false
    for (const id of missing) {
      client
        .getConfiguration(id)
        .then(
          (configuration) => configuration,
          () => null,
        )
        .then((configuration) => {
          if (cancelled) return
          setLoaded((current) => new Map(current).set(id, configuration))
        })
    }
    return () => {
      cancelled = true
    }
    // `loaded` não entra: o efeito só reage à lista de ids.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, key])

  const remember = (configuration: CraneConfiguration): void => {
    setLoaded((current) => new Map(current).set(configuration.id, configuration))
  }
  return { configurations: loaded, remember }
}
