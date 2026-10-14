import { useCallback, useState } from 'react'

import { type CollisionState, NO_COLLISION } from '../../domain/collision/collisions'

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
  const onCollisionChange = useCallback((state: CollisionState) => setCollision(state), [])
  return { collision, onCollisionChange }
}
