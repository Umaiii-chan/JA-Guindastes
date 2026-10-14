import type { ReactNode } from 'react'

import styles from './SimulatorPage.module.css'

export interface SimulatorPageProps {
  /** Cena 3D (o `CraneViewport` com o limite de erro), no quadro de desenho. */
  readonly viewport: ReactNode
  /** Coluna de procedimento (passos), à esquerda. */
  readonly steps: ReactNode
  /** Ficha do resultado do backend, no pé do quadro. */
  readonly result: ReactNode
  /** Pré-visualização da geometria, na última célula da ficha. */
  readonly geometry?: ReactNode
  /** Faixa de título do quadro: conexão e vistas da câmera. */
  readonly statusBar: ReactNode
  /** Acessórios de içamento (TASK-056): sob os passos, trocáveis a qualquer momento. */
  readonly accessories?: ReactNode
  /** Faixa de gravação e reprodução (TASK-057), sob a faixa de título. */
  readonly recording?: ReactNode
  /** Seção "Ambiente" (TASK-052), recolhida, abaixo dos passos. */
  readonly environment?: ReactNode
}

/**
 * Página do simulador guiado (ADR-017 § 2, com o visual do ADR-019): em colunas, nada flutua sobre a
 * cena. À esquerda, a coluna de procedimento; à direita, a prancha: faixa de título (conexão e
 * vistas), o quadro claro da cena com borda de desenho técnico e, no pé, a ficha do resultado com a
 * geometria, como o carimbo de uma prancha.
 */
export function SimulatorPage({
  viewport,
  steps,
  result,
  geometry,
  statusBar,
  accessories,
  recording,
  environment,
}: SimulatorPageProps) {
  return (
    <div className={styles.stage}>
      <div className={styles.procedure}>
        {steps}
        {accessories && <div className={styles.accessories}>{accessories}</div>}
        {environment}
      </div>
      <div className={styles.drawing}>
        <div>
          {statusBar}
          {recording}
        </div>
        <div className={styles.scene}>
          {viewport}
          <span className={styles.corners} aria-hidden="true" />
        </div>
        <aside className={styles.result} aria-label="Resultado da avaliação">
          <div className={styles.evaluation}>{result}</div>
          {geometry && <div className={styles.geometry}>{geometry}</div>}
        </aside>
      </div>
    </div>
  )
}
