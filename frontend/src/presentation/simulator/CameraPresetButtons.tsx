import { cx } from '../ui'
import styles from './CameraPresetButtons.module.css'

/**
 * Predefinições de câmera da cena (mesmos nomes do `CameraPreset` da TASK-041,
 * src/three/camera/cameraPresets.ts). Repetidos aqui como texto para a barra não importar a cena.
 */
export type CameraPresetId = 'perspectiva' | 'lateral' | 'topo' | 'operador'

/** Nome acessível completo e o nome curto à vista, como o nome de uma vista na prancha. */
const PRESETS: readonly { id: CameraPresetId; label: string; short: string }[] = [
  { id: 'perspectiva', label: 'Câmera em perspectiva', short: 'Perspectiva' },
  { id: 'lateral', label: 'Câmera lateral', short: 'Lateral' },
  { id: 'topo', label: 'Câmera de topo', short: 'Topo' },
  { id: 'operador', label: 'Câmera do operador', short: 'Operador' },
]

export interface CameraPresetButtonsProps {
  /** Última predefinição escolhida (marcada como pressionada). */
  readonly active: CameraPresetId | null
  readonly onSelect: (preset: CameraPresetId) => void
}

/**
 * Vistas da cena na barra do quadro (ADR-019): botões de texto lado a lado, separados por filetes; a
 * vista escolhida leva o filete laranja embaixo. O nome acessível ("Câmera lateral") contém o texto à
 * vista ("Lateral").
 */
export function CameraPresetButtons({ active, onSelect }: CameraPresetButtonsProps) {
  return (
    <div className={styles.group} role="group" aria-label="Câmera">
      <span className={styles.caption} aria-hidden="true">
        Vista
      </span>
      {PRESETS.map((preset) => (
        <button
          key={preset.id}
          type="button"
          className={cx(styles.view, active === preset.id && styles.selected)}
          aria-label={preset.label}
          aria-pressed={active === preset.id}
          title={preset.label}
          onClick={() => onSelect(preset.id)}
        >
          {preset.short}
        </button>
      ))}
    </div>
  )
}
