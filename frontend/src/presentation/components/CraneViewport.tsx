import { useEffect, useRef } from 'react'

import type { CraneCommands } from '../../three/crane/types'
import { mountCraneScene } from '../../three/scene/mountCraneScene'

interface CraneViewportProps {
  /** Recebe os comandos do guindaste quando a cena monta, e `null` quando ela desmonta. */
  onCraneChange: (crane: CraneCommands | null) => void
}

/**
 * Área da cena 3D. Toda a lógica Three.js fica em `src/three/` (ADR-005); aqui só monta e desmonta.
 * Se o navegador não oferecer WebGL, o erro sobe para o `SceneErrorBoundary` que envolve o componente.
 */
export function CraneViewport({ onCraneChange }: CraneViewportProps) {
  const canvasHostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = canvasHostRef.current
    if (!host) return

    const handle = mountCraneScene(host)
    onCraneChange(handle.crane)

    return () => {
      onCraneChange(null)
      handle.dispose()
    }
  }, [onCraneChange])

  return (
    <div className="crane-viewport">
      <div className="crane-viewport__canvas" ref={canvasHostRef} />
    </div>
  )
}
