import { useEffect, useRef, useState } from 'react'

function canAnimate(durationMs: number): boolean {
  if (durationMs <= 0 || typeof window === 'undefined') return false
  if (typeof window.requestAnimationFrame !== 'function') return false
  const reduced =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  return !reduced
}

/**
 * Valor que caminha suavemente até `target` (easing de saída) em `durationMs`. Sem animação (devolve o
 * próprio `target`) quando o usuário pede movimento reduzido ou o ambiente não tem
 * `requestAnimationFrame`.
 */
export function useAnimatedNumber(target: number, durationMs = 700): number {
  const animate = canAnimate(durationMs)
  const [display, setDisplay] = useState(target)
  const displayRef = useRef(target)

  useEffect(() => {
    const from = displayRef.current
    if (!animate) {
      displayRef.current = target
      return
    }
    if (from === target) return
    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - progress, 3)
      const next = from + (target - from) * eased
      displayRef.current = next
      setDisplay(next)
      if (progress < 1) frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [target, durationMs, animate])

  return animate ? display : target
}
