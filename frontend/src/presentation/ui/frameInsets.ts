// Margens da cena cobertas por painéis (TASK-104; ADR-048). Quem desenha os painéis sobre a cena
// (a página do simulador) mede e publica; o `CraneViewport` repassa à cena, que enquadra a câmera na
// área livre. O `CraneViewport` não muda de lugar na árvore: só lê este contexto.

import { createContext, useContext } from 'react'

import { type FrameInsets, NO_FRAME_INSETS } from '../../three/camera/cameraPresets'

export const FrameInsetsContext = createContext<FrameInsets>(NO_FRAME_INSETS)

/** Margens cobertas por painéis, em px; zeros fora do simulador. */
export function useFrameInsets(): FrameInsets {
  return useContext(FrameInsetsContext)
}
