import { useEffect, useRef } from 'react'

import { cx } from '../ui'
import styles from './CameraPresetButtons.module.css'

/**
 * Predefinições de câmera da cena (mesmos nomes do `CameraPreset` da TASK-041,
 * src/three/camera/cameraPresets.ts). Repetidos aqui como texto para a barra não importar a cena.
 */
export type CameraPresetId = 'perspectiva' | 'lateral' | 'topo' | 'operador'

/** Nome acessível completo e o nome curto à vista, como o nome de uma vista na prancha. */
const PRESETS: readonly { id: CameraPresetId; label: string; short: string; key: string }[] = [
  { id: 'perspectiva', label: 'Câmera em perspectiva', short: 'Perspectiva', key: '1' },
  { id: 'lateral', label: 'Câmera lateral', short: 'Lateral', key: '2' },
  { id: 'topo', label: 'Câmera de topo', short: 'Topo', key: '3' },
  { id: 'operador', label: 'Câmera do operador', short: 'Operador', key: '4' },
]

export interface CameraPresetButtonsProps {
  /** Última predefinição escolhida (marcada como pressionada). */
  readonly active: CameraPresetId | null
  readonly onSelect: (preset: CameraPresetId) => void
  /**
   * Teclas 1 a 4 escolhem a vista (TASK-095), fora de campos de texto, listas e controles
   * deslizantes, e nunca com uma janela modal aberta.
   */
  readonly shortcuts?: boolean
}

/** O foco está num controle que usa o teclado por conta própria (campo, lista, slider…)? */
function typingInControl(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return target.closest('input, select, textarea, [role="slider"], [role="spinbutton"]') !== null
}

/**
 * Vistas da cena na barra do quadro (ADR-019): botões de texto lado a lado, separados por filetes; a
 * vista escolhida leva o filete laranja embaixo. O nome acessível ("Câmera lateral") contém o texto à
 * vista ("Lateral").
 */
export function CameraPresetButtons({
  active,
  onSelect,
  shortcuts = false,
}: CameraPresetButtonsProps) {
  const onSelectRef = useRef(onSelect)
  useEffect(() => {
    onSelectRef.current = onSelect
  })

  useEffect(() => {
    if (!shortcuts) return
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat) return
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      if (typingInControl(event.target)) return
      if (document.querySelector('[aria-modal="true"]')) return
      const preset = PRESETS.find((item) => item.key === event.key)
      if (!preset) return
      event.preventDefault()
      onSelectRef.current(preset.id)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [shortcuts])

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
          aria-keyshortcuts={shortcuts ? preset.key : undefined}
          title={shortcuts ? `${preset.label} (tecla ${preset.key})` : preset.label}
          onClick={() => onSelect(preset.id)}
        >
          {preset.short}
        </button>
      ))}
    </div>
  )
}
