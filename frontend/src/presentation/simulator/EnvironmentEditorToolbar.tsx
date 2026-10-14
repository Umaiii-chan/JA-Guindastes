import {
  BRUSH_INTENSITY_RANGE,
  BRUSH_RADIUS_RANGE,
  type Brush,
} from '../../application/environment/editorOps'
import { SOIL_KIND_LABELS } from '../../application/environment/scenarioEditing'
import { SOIL_KINDS, type SoilKind, type WindSpec } from '../../domain/environment/environment'
import { SOIL_COLORS, toCssHex } from '../../three/scene/palette'
import type { EditorTool, EditorTransformMode } from '../../three/scene/SceneEditor'
import { cx } from '../ui'
import styles from './EnvironmentEditorToolbar.module.css'
import { ObjectLibraryPalette } from './ObjectLibraryPalette'
import toggleStyles from './OperatingAreaToggle.module.css'

/** Botão da barra da cena que liga e desliga o modo de edição do ambiente. */
export function EditEnvironmentToggle({
  active,
  onToggle,
}: {
  readonly active: boolean
  onToggle(): void
}) {
  return (
    <div className={toggleStyles.group} role="group" aria-label="Editar ambiente">
      <button
        type="button"
        className={cx(toggleStyles.toggle, active && toggleStyles.selected)}
        aria-pressed={active}
        title="Posicione obstáculos e o guindaste, esculpa o terreno, pinte o solo e ajuste o vento direto na cena"
        onClick={onToggle}
      >
        Editar ambiente
      </button>
    </div>
  )
}

const TOOLS: readonly { readonly id: EditorTool; readonly label: string; readonly hint: string }[] =
  [
    {
      id: 'select',
      label: 'Selecionar',
      hint: 'Clique num obstáculo, na carga, no ponto de entrega ou no guindaste para mover',
    },
    { id: 'add-box', label: 'Caixa', hint: 'Clique no chão para colocar uma caixa' },
    { id: 'add-cylinder', label: 'Cilindro', hint: 'Clique no chão para colocar um cilindro' },
    {
      id: 'place-cargo',
      label: 'Posicionar carga',
      hint: 'Clique no chão para escolher onde a carga começa. Ela usa as medidas do passo Carga',
    },
    {
      id: 'place-delivery',
      label: 'Ponto de entrega',
      hint: 'Clique no chão para marcar onde a carga deve ser entregue',
    },
    {
      id: 'add-model',
      label: 'Biblioteca',
      hint: 'Escolha um objeto e clique no chão para colocá-lo; depois mova, gire ou redimensione',
    },
    {
      id: 'sculpt',
      label: 'Esculpir',
      hint: 'Clique e arraste no chão para subir ou descer o terreno',
    },
    {
      id: 'flatten',
      label: 'Aplainar',
      hint: 'Clique e arraste para nivelar o terreno na altura do primeiro ponto',
    },
    {
      id: 'paint',
      label: 'Pintar solo',
      hint: 'Clique e arraste no chão para pintar o tipo de solo',
    },
  ]

const TRANSFORM_MODES: readonly { readonly id: EditorTransformMode; readonly label: string }[] = [
  { id: 'translate', label: 'Mover' },
  { id: 'rotate', label: 'Girar' },
  { id: 'scale', label: 'Redimensionar' },
]

export interface EnvironmentEditorToolbarProps {
  readonly tool: EditorTool
  onToolChange(tool: EditorTool): void
  readonly transformMode: EditorTransformMode
  onTransformModeChange(mode: EditorTransformMode): void
  readonly brush: Brush
  onBrushChange(brush: Brush): void
  readonly soilKind: SoilKind
  onSoilKindChange(kind: SoilKind): void
  readonly lowerTerrain: boolean
  onLowerTerrainChange(lower: boolean): void
  /** Objeto da biblioteca escolhido na paleta (TASK-072), ou `null`. */
  readonly modelId: string | null
  onModelChange(id: string): void
  readonly wind: WindSpec | undefined
  onWindChange(wind: WindSpec): void
  /** Nome do que está selecionado ("Caixa 1", "Guindaste", "Carga"), ou `null`. */
  readonly selectedLabel: string | null
  readonly canDelete: boolean
  onDelete(): void
  readonly canUndo: boolean
  onUndo(): void
  onDone(): void
}

/**
 * Faixa de ferramentas do editor 3D do ambiente (TASK-066; ADR-032), sob a barra da cena: escolhe
 * a ferramenta, ajusta o pincel e o solo, o vento, desfaz e conclui. O trabalho em si é feito com o
 * mouse na cena.
 */
export function EnvironmentEditorToolbar(props: EnvironmentEditorToolbarProps) {
  const { tool, brush, wind } = props
  const brushTool = tool === 'sculpt' || tool === 'flatten' || tool === 'paint'
  const hint = TOOLS.find((item) => item.id === tool)?.hint
  return (
    <section className={styles.bar} aria-label="Ferramentas do ambiente">
      <div className={styles.row}>
        <div className={styles.group} role="group" aria-label="Ferramenta">
          {TOOLS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cx(styles.tool, tool === item.id && styles.on)}
              aria-pressed={tool === item.id}
              onClick={() => props.onToolChange(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className={styles.spacer} />
        <button
          type="button"
          className={styles.action}
          disabled={!props.canUndo}
          onClick={props.onUndo}
        >
          Desfazer
        </button>
        <button type="button" className={cx(styles.action, styles.done)} onClick={props.onDone}>
          Concluir
        </button>
      </div>

      <div className={styles.row}>
        {tool === 'select' && (
          <>
            <div className={styles.group} role="group" aria-label="Ação sobre o selecionado">
              {TRANSFORM_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  className={cx(styles.tool, props.transformMode === mode.id && styles.on)}
                  aria-pressed={props.transformMode === mode.id}
                  onClick={() => props.onTransformModeChange(mode.id)}
                >
                  {mode.label}
                </button>
              ))}
            </div>
            <span className={styles.note}>{props.selectedLabel ?? 'Nada selecionado'}</span>
            <button
              type="button"
              className={styles.action}
              disabled={!props.canDelete}
              onClick={props.onDelete}
            >
              Excluir
            </button>
          </>
        )}

        {tool === 'add-model' && (
          <ObjectLibraryPalette selectedId={props.modelId} onSelect={props.onModelChange} />
        )}

        {tool === 'sculpt' && (
          <div className={styles.group} role="group" aria-label="Sentido do pincel">
            <button
              type="button"
              className={cx(styles.tool, !props.lowerTerrain && styles.on)}
              aria-pressed={!props.lowerTerrain}
              onClick={() => props.onLowerTerrainChange(false)}
            >
              Elevar
            </button>
            <button
              type="button"
              className={cx(styles.tool, props.lowerTerrain && styles.on)}
              aria-pressed={props.lowerTerrain}
              onClick={() => props.onLowerTerrainChange(true)}
            >
              Rebaixar
            </button>
          </div>
        )}

        {tool === 'paint' && (
          <div className={styles.group} role="group" aria-label="Tipo de solo">
            {SOIL_KINDS.map((kind) => (
              <button
                key={kind}
                type="button"
                className={cx(styles.tool, props.soilKind === kind && styles.on)}
                aria-pressed={props.soilKind === kind}
                onClick={() => props.onSoilKindChange(kind)}
              >
                <i
                  className={styles.swatch}
                  style={{ background: toCssHex(SOIL_COLORS[kind]) }}
                  aria-hidden="true"
                />
                {SOIL_KIND_LABELS[kind]}
              </button>
            ))}
          </div>
        )}

        {brushTool && (
          <>
            <label className={styles.range}>
              <span>Raio do pincel</span>
              <input
                type="range"
                min={BRUSH_RADIUS_RANGE.min}
                max={BRUSH_RADIUS_RANGE.max}
                step={0.5}
                value={brush.radiusM}
                onChange={(event) =>
                  props.onBrushChange({ ...brush, radiusM: Number(event.target.value) })
                }
              />
              <output>{brush.radiusM.toLocaleString('pt-BR')} m</output>
            </label>
            {tool === 'sculpt' && (
              <label className={styles.range}>
                <span>Intensidade</span>
                <input
                  type="range"
                  min={BRUSH_INTENSITY_RANGE.min}
                  max={BRUSH_INTENSITY_RANGE.max}
                  step={0.1}
                  value={brush.intensityM}
                  onChange={(event) =>
                    props.onBrushChange({ ...brush, intensityM: Number(event.target.value) })
                  }
                />
                <output>{brush.intensityM.toLocaleString('pt-BR')} m</output>
              </label>
            )}
          </>
        )}

        {hint && tool !== 'select' && <span className={styles.note}>{hint}</span>}
        <span className={styles.note}>Botão direito ou Alt + arrastar gira a câmera.</span>
      </div>

      <div className={styles.row} role="group" aria-label="Vento">
        <label className={styles.range}>
          <span>Vento</span>
          <input
            type="range"
            min={0}
            max={30}
            step={0.5}
            value={wind?.speedMs ?? 0}
            onChange={(event) =>
              props.onWindChange({
                speedMs: Number(event.target.value),
                directionDeg: wind?.directionDeg ?? 0,
              })
            }
          />
          <output>{(wind?.speedMs ?? 0).toLocaleString('pt-BR')} m/s</output>
        </label>
        <label className={styles.range}>
          <span>Direção</span>
          <input
            type="range"
            min={0}
            max={359}
            step={1}
            value={wind?.directionDeg ?? 0}
            onChange={(event) =>
              props.onWindChange({
                speedMs: wind?.speedMs ?? 0,
                directionDeg: Number(event.target.value),
              })
            }
          />
          <output>{wind?.directionDeg ?? 0}°</output>
        </label>
        <span className={styles.note}>A seta na cena mostra para onde o vento sopra.</span>
      </div>
    </section>
  )
}
