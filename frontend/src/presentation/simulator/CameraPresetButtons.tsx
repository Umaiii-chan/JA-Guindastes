import { Box, Eye, Grid3x3, MoveHorizontal } from 'lucide-react'
import type { ReactNode } from 'react'

import { IconButton } from '../ui'
import styles from './CameraPresetButtons.module.css'

/**
 * Predefinições de câmera da cena (mesmos nomes do `CameraPreset` da TASK-041,
 * src/three/camera/cameraPresets.ts). Repetidos aqui como texto para a barra não importar a cena.
 */
export type CameraPresetId = 'perspectiva' | 'lateral' | 'topo' | 'operador'

const PRESETS: readonly { id: CameraPresetId; label: string; icon: ReactNode }[] = [
  { id: 'perspectiva', label: 'Câmera em perspectiva', icon: <Box size={16} /> },
  { id: 'lateral', label: 'Câmera lateral', icon: <MoveHorizontal size={16} /> },
  { id: 'topo', label: 'Câmera de topo', icon: <Grid3x3 size={16} /> },
  { id: 'operador', label: 'Câmera do operador', icon: <Eye size={16} /> },
]

export interface CameraPresetButtonsProps {
  /** Última predefinição escolhida (marcada como pressionada). */
  readonly active: CameraPresetId | null
  readonly onSelect: (preset: CameraPresetId) => void
}

/** Botões de câmera da barra de status do simulador (IconButton com dica). */
export function CameraPresetButtons({ active, onSelect }: CameraPresetButtonsProps) {
  return (
    <div className={styles.group} role="group" aria-label="Câmera">
      {PRESETS.map((preset) => (
        <IconButton
          key={preset.id}
          size="sm"
          label={preset.label}
          icon={preset.icon}
          tooltip="top"
          pressed={active === preset.id}
          onClick={() => onSelect(preset.id)}
        />
      ))}
    </div>
  )
}
