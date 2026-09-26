import type { ReactNode } from 'react'

import styles from './SimulatorPage.module.css'

export interface SimulatorPageProps {
  /** Cena 3D (o `CraneViewport` com o limite de erro), que ocupa a página inteira. */
  readonly viewport: ReactNode
  /** Painel de passos, à esquerda. */
  readonly steps: ReactNode
  /** HUD do resultado e pré-visualização da geometria, à direita. */
  readonly result: ReactNode
  /** Barra de status da conexão e da câmera, embaixo. */
  readonly statusBar: ReactNode
}

/**
 * Página do simulador guiado (ADR-017 § 2): a cena ocupa a área inteira e os painéis de vidro
 * flutuam por cima — passos à esquerda, resultado à direita, status embaixo. Os cliques no espaço
 * livre entre os painéis chegam à cena (girar e aproximar a câmera).
 */
export function SimulatorPage({ viewport, steps, result, statusBar }: SimulatorPageProps) {
  return (
    <div className={styles.stage}>
      <div className={styles.scene}>{viewport}</div>
      <div className={styles.vignette} aria-hidden="true" />
      <div className={styles.overlay}>
        <div className={styles.left}>{steps}</div>
        <aside className={styles.right} aria-label="Resultado da avaliação">
          {result}
        </aside>
        <div className={styles.bottom}>{statusBar}</div>
      </div>
    </div>
  )
}
