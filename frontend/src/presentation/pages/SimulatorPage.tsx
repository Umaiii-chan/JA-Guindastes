import {
  Film,
  Layers,
  Link2,
  ListChecks,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  Route,
  Trees,
} from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useId, useMemo, useState } from 'react'

import { ContextChip, type SimulatorSetupSummary } from '../simulator/layout/ContextChip'
import { ResultCard } from '../simulator/layout/ResultCard'
import {
  type SimulatorLayout,
  SimulatorLayoutContext,
  type SimulatorSheetId,
} from '../simulator/layout/simulatorLayout'
import { SimulatorSheet } from '../simulator/layout/SimulatorSheet'
import { SimulatorToolbar, type SimulatorToolbarItem } from '../simulator/layout/SimulatorToolbar'
import { cx, PortalTargetContext } from '../ui'

import styles from './SimulatorPage.module.css'

export interface SimulatorPageProps {
  /** Cena 3D (o `CraneViewport` com o limite de erro): ocupa o palco inteiro, atrás de tudo. */
  readonly viewport: ReactNode
  /** Simulação guiada (passos 01–03), na folha "Configurar". */
  readonly steps: ReactNode
  /** Resumo dos passos para o chip de contexto; com passos pendentes, "Configurar" abre sozinha. */
  readonly setup?: SimulatorSetupSummary
  /** Ficha do resultado do backend (ou a do tandem), no cartão do canto direito. */
  readonly result: ReactNode
  /** Geometria de pré-visualização e o relatório, nos "Detalhes" do cartão. */
  readonly geometry?: ReactNode
  /** Barra de vistas: conexão, câmeras, área de operação, editor e assistente. */
  readonly statusBar: ReactNode
  /** Barra de comando embaixo: controles do guindaste, patolas e gravação. Sempre à vista. */
  readonly commandBar?: ReactNode
  /** Içamento com dois guindastes (TASK-074), numa folha. */
  readonly tandem?: ReactNode
  /** Acessórios de içamento (TASK-056), numa folha. */
  readonly accessories?: ReactNode
  /** Gravações salvas (TASK-057), numa folha. */
  readonly recordings?: ReactNode
  /** Player da gravação aberta, numa faixa acima da barra de comando. */
  readonly playback?: ReactNode
  /** Ambiente (TASK-052), numa folha. */
  readonly environment?: ReactNode
  /** Ferramentas do editor 3D do ambiente (TASK-066), numa faixa no topo da cena. */
  readonly editorToolbar?: ReactNode
  /** Coleta e entrega da carga (TASK-073), numa linha logo acima da barra de comando. */
  readonly operationBar?: ReactNode
  /** Planejar operação (TASK-075), numa folha. */
  readonly planning?: ReactNode
  /** A trajetória planejada está rodando: o botão "Planejar" ganha a marca de execução. */
  readonly planningActive?: boolean
  /** Avisos de colisão: faixa no topo da cena, só quando houver. */
  readonly sceneOverlay?: ReactNode
  /** Janelas abertas pela tela (ex.: adicionar guindaste), montadas dentro do palco. */
  readonly dialogs?: ReactNode
}

/** Folhas da barra de ferramentas: texto à vista, nome acessível e título da folha. */
const SHEETS: readonly {
  readonly id: SimulatorSheetId
  readonly caption: string
  readonly label: string
  readonly title: string
  readonly icon: ReactNode
}[] = [
  {
    id: 'setup',
    caption: 'Configurar',
    label: 'Configurar',
    title: 'Configurar',
    icon: <ListChecks size={18} />,
  },
  {
    id: 'accessories',
    caption: 'Acessórios',
    label: 'Acessórios de içamento',
    title: 'Acessórios de içamento',
    icon: <Link2 size={18} />,
  },
  {
    id: 'environment',
    caption: 'Ambiente',
    label: 'Ambiente',
    title: 'Ambiente',
    icon: <Trees size={18} />,
  },
  {
    id: 'tandem',
    caption: 'Tandem',
    label: 'Tandem — içamento com dois guindastes',
    title: 'Içamento com dois guindastes',
    icon: <Layers size={18} />,
  },
  {
    id: 'planning',
    caption: 'Planejar',
    label: 'Planejar',
    title: 'Planejar operação',
    icon: <Route size={18} />,
  },
  {
    id: 'recordings',
    caption: 'Gravações',
    label: 'Gravações salvas',
    title: 'Gravações salvas',
    icon: <Film size={18} />,
  },
]

/**
 * Página do simulador (ADR-017 § 2 e ADR-019, com o layout do ADR-042; TASK-095): a cena ocupa o
 * palco inteiro e os painéis flutuam sobre ela, na camada `overlay-panel`. À esquerda, a barra de
 * ferramentas abre UMA folha lateral por vez (não modal; fecha com Esc ou no próprio botão; fechada,
 * só esconde). No topo, o chip da operação e a barra de vistas; no meio do topo, o editor e as
 * colisões; no canto direito, o cartão do resultado; embaixo, a coleta e entrega e a barra de comando.
 *
 * O `viewport` nunca muda de lugar na árvore (desmontar recarrega o modelo 3D e perde câmera e
 * engate): tela cheia e "ocultar painéis" são só classes e atributos.
 */
export function SimulatorPage({
  viewport,
  steps,
  setup,
  result,
  geometry,
  statusBar,
  commandBar,
  tandem,
  accessories,
  recordings,
  playback,
  environment,
  editorToolbar,
  operationBar,
  planning,
  planningActive = false,
  sceneOverlay,
  dialogs,
}: SimulatorPageProps) {
  const [stage, setStage] = useState<HTMLDivElement | null>(null)
  // Tela cheia (Fullscreen API) e painéis ocultos: deixam a cena livre (TASK-062).
  const [fullscreen, setFullscreen] = useState(false)
  const [panelsHidden, setPanelsHidden] = useState(false)
  // Com passos pendentes no primeiro acesso, a simulação guiada já abre (TASK-095).
  const [activeSheet, setActiveSheet] = useState<SimulatorSheetId | null>(() =>
    setup?.incomplete ? 'setup' : null,
  )
  const [bottomDock, setBottomDock] = useState<HTMLDivElement | null>(null)
  const baseId = useId()
  const sheetDomId = useCallback((id: SimulatorSheetId) => `${baseId}-sheet-${id}`, [baseId])

  const content: Record<SimulatorSheetId, ReactNode> = {
    setup: steps,
    accessories,
    environment,
    tandem,
    planning,
    recordings,
  }
  const sheets = SHEETS.filter((sheet) => content[sheet.id] !== undefined)

  // Fecha a folha; se o foco estava dentro dela, devolve-o ao botão que a abre.
  const closeSheet = useCallback(() => {
    if (activeSheet === null) return
    const sheet = document.getElementById(sheetDomId(activeSheet))
    if (sheet?.contains(document.activeElement)) {
      stage?.querySelector<HTMLElement>(`[data-sheet-toggle="${activeSheet}"]`)?.focus()
    }
    setActiveSheet(null)
  }, [activeSheet, stage, sheetDomId])

  const layout = useMemo<SimulatorLayout>(
    () => ({
      activeSheet,
      openSheet: (id) => {
        setPanelsHidden(false)
        setActiveSheet(id)
      },
      closeSheet,
    }),
    [activeSheet, closeSheet],
  )

  const toggleSheet = (id: SimulatorSheetId) => {
    if (activeSheet === id) closeSheet()
    else setActiveSheet(id)
  }

  // Esc fecha a folha aberta; sem folha, sai da tela cheia. Com uma janela modal aberta, quem trata o
  // Esc é ela.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      if (document.querySelector('[aria-modal="true"]')) return
      if (activeSheet !== null) {
        closeSheet()
        return
      }
      if (fullscreen) {
        setFullscreen(false)
        if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [activeSheet, closeSheet, fullscreen])

  // Altura da faixa de baixo (player e barra de comando) para o que a cena desenha no rodapé (a escala
  // gráfica) ficar acima dela.
  useEffect(() => {
    if (!stage || !bottomDock || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      stage.style.setProperty('--hud-bottom', `${bottomDock.offsetHeight}px`)
    })
    observer.observe(bottomDock)
    return () => observer.disconnect()
  }, [stage, bottomDock])

  // Sincroniza quando o navegador sai da tela cheia por conta própria.
  useEffect(() => {
    if (!fullscreen) return
    const onChange = () => {
      if (!document.fullscreenElement) setFullscreen(false)
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [fullscreen])

  // Tenta a tela cheia do navegador; se ela for bloqueada, a classe `.full` cobre a janela.
  const toggleFullscreen = () => {
    if (fullscreen) {
      setFullscreen(false)
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined)
      return
    }
    setFullscreen(true)
    void stage?.requestFullscreen?.().catch(() => undefined)
  }

  const toolbarItems: SimulatorToolbarItem[] = sheets.map((sheet) => ({
    id: sheet.id,
    label: sheet.label,
    caption: sheet.caption,
    icon: sheet.icon,
    controls: sheetDomId(sheet.id),
    busy: sheet.id === 'planning' && planningActive ? 'trajetória em execução' : undefined,
  }))

  return (
    <div
      ref={setStage}
      className={cx(styles.stage, fullscreen && styles.full)}
      data-panels-hidden={panelsHidden || undefined}
      data-sheet-open={activeSheet !== null || undefined}
    >
      {/* Em tela cheia, as janelas são montadas aqui dentro para aparecer por cima (F-21). */}
      <PortalTargetContext.Provider value={fullscreen ? stage : null}>
        <SimulatorLayoutContext.Provider value={layout}>
          <div className={styles.scene}>
            {viewport}
            <span className={styles.corners} aria-hidden="true" />
          </div>

          <div className={styles.hud}>
            <div className={cx(styles.toolbar, styles.hideable)}>
              <SimulatorToolbar items={toolbarItems} active={activeSheet} onToggle={toggleSheet} />
            </div>

            <div className={cx(styles.sheets, styles.hideable)}>
              {sheets.map((sheet) => (
                <SimulatorSheet
                  key={sheet.id}
                  id={sheetDomId(sheet.id)}
                  title={sheet.title}
                  open={activeSheet === sheet.id}
                  onClose={closeSheet}
                >
                  {content[sheet.id]}
                </SimulatorSheet>
              ))}
            </div>

            <div className={styles.center}>
              {editorToolbar && (
                <div className={cx(styles.panelSlot, styles.editor, styles.hideable)}>
                  {editorToolbar}
                </div>
              )}
              {sceneOverlay && <div className={styles.alerts}>{sceneOverlay}</div>}
            </div>

            <div className={cx(styles.cardSlot, styles.hideable)}>
              <ResultCard result={result} extra={geometry} />
            </div>

            <div ref={setBottomDock} className={styles.bottom}>
              {playback && <div className={cx(styles.panelSlot, styles.playback)}>{playback}</div>}
              {/* Coleta e entrega logo acima da barra de comando: a dica ("faltam 2 m") e o
                  Engatar/Soltar ficam junto dos controles que levam o gancho até a carga. */}
              {operationBar && (
                <div className={cx(styles.panelSlot, styles.operation, styles.hideable)}>
                  {operationBar}
                </div>
              )}
              {commandBar && (
                <div
                  className={cx(styles.panelSlot, styles.commandBar, styles.hideable)}
                  role="group"
                  aria-label="Barra de comando"
                >
                  {commandBar}
                </div>
              )}
            </div>
            <div className={styles.top}>
              {setup && (
                <div className={cx(styles.panelSlot, styles.hideable)}>
                  <ContextChip
                    summary={setup}
                    expanded={activeSheet === 'setup'}
                    controls={sheetDomId('setup')}
                    onOpen={() => toggleSheet('setup')}
                  />
                </div>
              )}
              <div className={styles.viewBar}>
                {statusBar}
                <div className={styles.viewActions}>
                  <button
                    type="button"
                    className={styles.viewAction}
                    onClick={() => setPanelsHidden((hidden) => !hidden)}
                    aria-pressed={panelsHidden}
                    title={panelsHidden ? 'Mostrar os painéis' : 'Ocultar os painéis da cena'}
                  >
                    {panelsHidden ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
                    <span className={styles.viewActionText}>
                      {panelsHidden ? 'Mostrar painéis' : 'Ocultar painéis'}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={styles.viewAction}
                    onClick={toggleFullscreen}
                    aria-pressed={fullscreen}
                    title={fullscreen ? 'Sair da tela cheia (Esc)' : 'Simulação em tela cheia'}
                  >
                    {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                    <span className={styles.viewActionText}>
                      {fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
          {dialogs}
        </SimulatorLayoutContext.Provider>
      </PortalTargetContext.Provider>
    </div>
  )
}
