import { type Ref, useEffect, useImperativeHandle, useRef } from 'react'

import type { CameraPreset } from '../../three/camera/cameraPresets'
import type { CraneCommands, CraneSetup } from '../../three/crane/types'
import type { LoadDimensions } from '../../three/scene/loadBox'
import {
  type CameraPresetOptions,
  type CraneSceneHandle,
  mountCraneScene,
} from '../../three/scene/mountCraneScene'
import type { EvaluationStatus } from '../../three/scene/palette'

/** API imperativa do viewport (via `ref`), para ações pontuais como os botões de câmera. */
export interface CraneViewportHandle {
  /** Leva a câmera à predefinição, mesmo que seja a mesma de antes (reenquadra o estado atual). */
  setCameraPreset(preset: CameraPreset, options?: CameraPresetOptions): void
}

interface CraneViewportProps {
  /**
   * Limites e parâmetros a e h do guindaste (TASK-033). Trocar o objeto remonta a cena, então quem
   * compõe deve mantê-lo estável (`useMemo`). Sem ele, a cena usa os valores FICTÍCIOS da PoC.
   */
  setup?: CraneSetup
  /** Recebe os comandos do guindaste quando a cena monta, e `null` quando ela desmonta. */
  onCraneChange: (crane: CraneCommands | null) => void
  /**
   * Situação que colore o anel de raio e o halo da carga (TASK-041). Vem do resultado do backend,
   * traduzido pela UI; sem ela, `'unknown'` (cinza). Não remonta a cena.
   */
  evaluationStatus?: EvaluationStatus
  /** Medidas da carga (m), desenhada pendurada no gancho; sem ela, só o gancho. Não remonta a cena. */
  load?: LoadDimensions | null
  /**
   * Predefinição de câmera. Ao mudar, a câmera vai até ela com transição suave (imediata com
   * `prefers-reduced-motion`); na montagem, já começa nela. Não remonta a cena.
   */
  cameraPreset?: CameraPreset
  /** API imperativa (`CraneViewportHandle`). */
  ref?: Ref<CraneViewportHandle>
}

/**
 * Área da cena 3D. Toda a lógica Three.js fica em `src/three/` (ADR-005); aqui só monta, desmonta e
 * repassa os ajustes visuais. Se o navegador não oferecer WebGL, o erro sobe para o
 * `SceneErrorBoundary` que envolve o componente.
 */
export function CraneViewport({
  setup,
  onCraneChange,
  evaluationStatus = 'unknown',
  load = null,
  cameraPreset,
  ref,
}: CraneViewportProps) {
  const canvasHostRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<CraneSceneHandle | null>(null)
  // Últimos valores recebidos, para reaplicar quando a cena remonta (troca de `setup`).
  const statusRef = useRef(evaluationStatus)
  const loadRef = useRef(load)
  const cameraPresetRef = useRef(cameraPreset)
  const appliedPresetRef = useRef<CameraPreset | undefined>(undefined)

  useImperativeHandle(
    ref,
    () => ({
      setCameraPreset(preset, options) {
        cameraPresetRef.current = preset
        appliedPresetRef.current = preset
        sceneRef.current?.setCameraPreset(preset, options)
      },
    }),
    [],
  )

  useEffect(() => {
    const host = canvasHostRef.current
    if (!host) return

    const handle = mountCraneScene(host, setup)
    sceneRef.current = handle
    handle.setEvaluationStatus(statusRef.current)
    handle.setLoad(loadRef.current)
    const preset = cameraPresetRef.current
    if (preset) handle.setCameraPreset(preset, { animate: false })
    appliedPresetRef.current = preset
    onCraneChange(handle.crane)

    return () => {
      onCraneChange(null)
      sceneRef.current = null
      handle.dispose()
    }
  }, [setup, onCraneChange])

  useEffect(() => {
    statusRef.current = evaluationStatus
    sceneRef.current?.setEvaluationStatus(evaluationStatus)
  }, [evaluationStatus])

  // Dependências nos números, não no objeto: a UI pode mandar um objeto novo a cada render.
  const lengthM = load?.lengthM
  const widthM = load?.widthM
  const heightM = load?.heightM
  useEffect(() => {
    const next =
      lengthM === undefined || widthM === undefined || heightM === undefined
        ? null
        : { lengthM, widthM, heightM }
    loadRef.current = next
    sceneRef.current?.setLoad(next)
  }, [lengthM, widthM, heightM])

  useEffect(() => {
    cameraPresetRef.current = cameraPreset
    if (!cameraPreset || cameraPreset === appliedPresetRef.current) return
    appliedPresetRef.current = cameraPreset
    sceneRef.current?.setCameraPreset(cameraPreset)
  }, [cameraPreset])

  return (
    <div className="crane-viewport">
      <div className="crane-viewport__canvas" ref={canvasHostRef} />
    </div>
  )
}
