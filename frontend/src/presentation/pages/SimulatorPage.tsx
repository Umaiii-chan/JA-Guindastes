import { Maximize2, Minimize2, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { type ReactNode, useEffect, useRef, useState } from 'react'

import { CollapsibleSection } from '../simulator/CollapsibleSection'
import { cx } from '../ui'

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
  /** Içamento com dois guindastes (TASK-074): seção recolhível sob os passos. */
  readonly tandem?: ReactNode
  /** Acessórios de içamento (TASK-056): sob os passos, trocáveis a qualquer momento. */
  readonly accessories?: ReactNode
  /** Faixa de gravação e reprodução (TASK-057), sob a faixa de título. */
  readonly recording?: ReactNode
  /** Seção "Ambiente" (TASK-052), recolhida, abaixo dos passos. */
  readonly environment?: ReactNode
  /** Faixa de ferramentas do editor 3D do ambiente (TASK-066), sob a faixa de título. */
  readonly editorToolbar?: ReactNode
  /** Faixa de coleta e entrega da carga (TASK-073), sob as ferramentas do editor. */
  readonly operationBar?: ReactNode
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
  tandem,
  accessories,
  recording,
  environment,
  editorToolbar,
  operationBar,
}: SimulatorPageProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  // Tela cheia (Fullscreen API) e painel recolhido: deixam a cena ocupar o espaço (TASK-062).
  const [fullscreen, setFullscreen] = useState(false)
  const [panelHidden, setPanelHidden] = useState(false)

  // Sai do modo com Esc; sincroniza quando o navegador sai da tela cheia por conta própria.
  useEffect(() => {
    if (!fullscreen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFullscreen(false)
    }
    const onChange = () => {
      if (!document.fullscreenElement) setFullscreen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('fullscreenchange', onChange)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('fullscreenchange', onChange)
    }
  }, [fullscreen])

  // Tenta a tela cheia do navegador; se ela for bloqueada, a classe `.full` cobre a janela.
  const toggleFullscreen = () => {
    if (fullscreen) {
      setFullscreen(false)
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined)
      return
    }
    setFullscreen(true)
    void stageRef.current?.requestFullscreen?.().catch(() => undefined)
  }

  return (
    <div
      ref={stageRef}
      className={cx(styles.stage, panelHidden && styles.panelHidden, fullscreen && styles.full)}
    >
      <div className={styles.procedure} hidden={panelHidden}>
        {steps}
        {tandem}
        {accessories && (
          <CollapsibleSection id="accessories" title="Acessórios de içamento">
            {accessories}
          </CollapsibleSection>
        )}
        {environment}
      </div>
      <div className={styles.drawing}>
        <div className={styles.header}>
          <div className={styles.headerBar}>
            {statusBar}
            <div className={styles.viewActions}>
              <button
                type="button"
                className={styles.viewAction}
                onClick={() => setPanelHidden((hidden) => !hidden)}
                aria-pressed={panelHidden}
                title={
                  panelHidden ? 'Mostrar o painel de controles' : 'Ocultar o painel de controles'
                }
              >
                {panelHidden ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
                <span>{panelHidden ? 'Mostrar painel' : 'Ocultar painel'}</span>
              </button>
              <button
                type="button"
                className={styles.viewAction}
                onClick={toggleFullscreen}
                aria-pressed={fullscreen}
                title={fullscreen ? 'Sair da tela cheia (Esc)' : 'Simulação em tela cheia'}
              >
                {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                <span>{fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}</span>
              </button>
            </div>
          </div>
          {recording}
          {editorToolbar}
          {operationBar}
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
