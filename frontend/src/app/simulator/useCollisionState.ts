import { useCallback, useEffect, useRef, useState } from 'react'

import { type CollisionState, NO_COLLISION } from '../../domain/collision/collisions'

/**
 * Por quanto tempo o aviso "comando bloqueado" continua visível depois do último bloqueio (ms). O
 * controle de deslizar arredonda o valor e reenvia um valor já seguro logo em seguida, o que apagava
 * o aviso antes de a pessoa conseguir ler (TASK-069).
 */
export const BLOCKED_NOTICE_HOLD_MS = 2000

/**
 * Estado de colisão da carga na cena (TASK-053; RN-012), para a UI mostrar os alertas e para a
 * gravação (TASK-057) registrar o instante em que o comando foi bloqueado. Passe `onCollisionChange`
 * ao `CraneViewport` e leia `collision` onde precisar.
 */
export function useCollisionState(): {
  readonly collision: CollisionState
  readonly onCollisionChange: (state: CollisionState) => void
} {
  const [collision, setCollision] = useState<CollisionState>(NO_COLLISION)
  const blockedUntil = useRef(0)
  const lastBlocked = useRef<CollisionState>(NO_COLLISION)
  const latest = useRef<CollisionState>(NO_COLLISION)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const onCollisionChange = useCallback((state: CollisionState) => {
    latest.current = state
    const now = Date.now()
    if (state.blocked) {
      blockedUntil.current = now + BLOCKED_NOTICE_HOLD_MS
      lastBlocked.current = state
    }
    const hold = !state.blocked && now < blockedUntil.current
    // No período mantido, mostra o contato que bloqueou (o estado atual, já seguro, não tem contato).
    setCollision(hold ? { ...lastBlocked.current, alerts: state.alerts, blocked: true } : state)
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = hold
      ? setTimeout(() => setCollision(latest.current), blockedUntil.current - now)
      : null
  }, [])

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current)
    },
    [],
  )

  return { collision, onCollisionChange }
}
