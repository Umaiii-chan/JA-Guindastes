import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { cx } from './cx'
import styles from './Toast.module.css'
import {
  DEFAULT_TOAST_DURATION_MS,
  type ToastApi,
  ToastContext,
  type ToastOptions,
} from './toastContext'
import type { Tone } from './tone'

interface ToastEntry extends Required<Pick<ToastOptions, 'tone' | 'durationMs'>> {
  readonly id: number
  readonly title: ReactNode
  readonly description?: ReactNode
}

const ICON: Record<Tone, ReactNode> = {
  ok: <CircleCheck size={18} />,
  info: <Info size={18} />,
  neutral: <Info size={18} />,
  warning: <TriangleAlert size={18} />,
  danger: <CircleAlert size={18} />,
}

/**
 * Fornece `useToast()` e mostra as notificações no canto inferior direito. Erros (`danger`) usam
 * `role="alert"`; as demais, `role="status"` (anunciadas sem interromper).
 */
export function ToastProvider({ children }: { readonly children: ReactNode }) {
  const [toasts, setToasts] = useState<readonly ToastEntry[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const show = useCallback((options: ToastOptions) => {
    const id = nextId.current++
    setToasts((current) => [
      ...current.slice(-3),
      {
        id,
        title: options.title,
        description: options.description,
        tone: options.tone ?? 'info',
        durationMs: options.durationMs ?? DEFAULT_TOAST_DURATION_MS,
      },
    ])
    return id
  }, [])

  const api = useMemo<ToastApi>(() => ({ show, dismiss }), [show, dismiss])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <section className={styles.viewport} aria-label="Notificações">
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </section>
    </ToastContext.Provider>
  )
}

function ToastCard({
  toast,
  onDismiss,
}: {
  readonly toast: ToastEntry
  onDismiss(id: number): void
}) {
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (toast.durationMs <= 0 || paused) return
    const timer = setTimeout(() => onDismiss(toast.id), toast.durationMs)
    return () => clearTimeout(timer)
  }, [toast.id, toast.durationMs, paused, onDismiss])

  return (
    <div
      className={cx(styles.toast, styles[toast.tone])}
      role={toast.tone === 'danger' ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <span className={styles.icon} aria-hidden="true">
        {ICON[toast.tone]}
      </span>
      <div className={styles.content}>
        <p className={styles.title}>{toast.title}</p>
        {toast.description && <p className={styles.description}>{toast.description}</p>}
      </div>
      <button
        type="button"
        className={styles.close}
        aria-label="Fechar notificação"
        onClick={() => onDismiss(toast.id)}
      >
        <X size={14} aria-hidden="true" />
      </button>
      {toast.durationMs > 0 && (
        <span
          className={cx(styles.timer, paused && styles.timerPaused)}
          style={{ animationDuration: `${toast.durationMs}ms` }}
          aria-hidden="true"
        />
      )}
    </div>
  )
}
