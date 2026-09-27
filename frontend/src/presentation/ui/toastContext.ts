import { createContext, type ReactNode, useContext } from 'react'

import type { Tone } from './tone'

export interface ToastOptions {
  readonly title: ReactNode
  readonly description?: ReactNode
  readonly tone?: Tone
  /** Milissegundos até sumir sozinho; `0` = só some ao fechar. Padrão: 5000. */
  readonly durationMs?: number
}

export interface ToastApi {
  /** Mostra a notificação e devolve o id dela. */
  show(options: ToastOptions): number
  dismiss(id: number): void
}

export const ToastContext = createContext<ToastApi | null>(null)

/** Notificações passageiras. Precisa de um `ToastProvider` acima na árvore. */
export function useToast(): ToastApi {
  const api = useContext(ToastContext)
  if (!api) throw new Error('useToast precisa de um <ToastProvider> acima na árvore.')
  return api
}

/** Tempo padrão de uma notificação na tela. */
export const DEFAULT_TOAST_DURATION_MS = 5000
