import { type RefObject, useEffect, useRef } from 'react'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function focusableIn(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (element) => !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true',
  )
}

/**
 * Comportamento comum de `Dialog` e `Drawer` abertos: Esc fecha, o foco vai para dentro e fica preso
 * nele (Tab e Shift+Tab circulam), a página atrás não rola e, ao fechar, o foco volta para quem abriu.
 */
export function useModal(
  open: boolean,
  containerRef: RefObject<HTMLElement | null>,
  onClose: () => void,
  /** Onde a janela está montada: se mudar, o React a remonta e o foco precisa ser refeito. */
  mountTarget?: HTMLElement,
): void {
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return
    const container = containerRef.current
    if (!container) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const initial =
      container.querySelector<HTMLElement>('[data-autofocus]') ?? focusableIn(container)[0]
    ;(initial ?? container).focus()

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = focusableIn(container)
      if (focusable.length === 0) {
        event.preventDefault()
        container.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      if (event.shiftKey && (active === first || active === container)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      previouslyFocused?.focus?.()
    }
  }, [open, containerRef, mountTarget])
}
