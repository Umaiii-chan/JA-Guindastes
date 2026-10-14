// Estado aberto/recolhido das seções da coluna do simulador (TASK-066), lembrado entre visitas no
// `localStorage` (só desta pessoa e deste navegador). Se o armazenamento estiver bloqueado, a seção
// funciona do mesmo jeito, só sem lembrar.

import { useCallback, useState } from 'react'

export const SECTIONS_STORAGE_KEY = 'ja.simulator.sections'

function readAll(): Record<string, boolean> {
  try {
    const raw = window.localStorage.getItem(SECTIONS_STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return {}
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        (entry): entry is [string, boolean] => typeof entry[1] === 'boolean',
      ),
    )
  } catch {
    return {}
  }
}

function writeOne(id: string, open: boolean): void {
  try {
    window.localStorage.setItem(SECTIONS_STORAGE_KEY, JSON.stringify({ ...readAll(), [id]: open }))
  } catch {
    // Sem armazenamento: a seção continua funcionando, só não é lembrada.
  }
}

/** `[aberta, mudar]` da seção `id`; `defaultOpen` vale enquanto a pessoa não escolheu. */
export function useSectionOpen(
  id: string,
  defaultOpen: boolean,
): readonly [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(() => readAll()[id] ?? defaultOpen)
  const change = useCallback(
    (next: boolean) => {
      setOpen(next)
      writeOne(id, next)
    },
    [id],
  )
  return [open, change]
}
