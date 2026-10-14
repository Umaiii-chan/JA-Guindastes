import { type Ref, useEffect, useImperativeHandle, useRef } from 'react'

import type { SceneAccessory } from '../../three/accessories/AccessoryChain'
import type { CameraPreset } from '../../three/camera/cameraPresets'
import type { CraneCommands, CraneSetup } from '../../three/crane/types'
import type { LoadDimensions } from '../../three/scene/loadBox'
import {
  type CameraPresetOptions,
  type CraneSceneHandle,
  mountCraneScene,
} from '../../three/scene/mountCraneScene'
import type { EvaluationStatus } from '../../three/scene/palette'
import type { SceneRotationZone } from '../../three/scene/RotationZoneSectors'

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
  /**
   * Zonas de giro da configuração (TASK-046), desenhadas como setores no chão ao redor do eixo de
   * giro. Sem elas (padrão), nada muda na cena. Não remonta a cena.
   */
  rotationZones?: readonly SceneRotationZone[] | null
  /**
   * Zona destacada: a do resultado do backend ou, sem ele, a prévia pelo giro ψ (quem compõe
   * decide). `null` = nenhuma. Não remonta a cena.
   */
  activeZoneCode?: string | null
  /**
   * Cadeia de acessórios de içamento entre o gancho e a carga (TASK-056; RN-014): cada um ocupa
   * `riggingHeightM` abaixo do gancho e a carga desce a soma. Sem ela (padrão), nada muda na cena.
   * Não remonta a cena.
   */
  accessories?: readonly SceneAccessory[] | null
  /** Avisado quando o modelo 3D de um acessório chega (`true`) ou não pôde ser carregado (`false`). */
  onAccessoryModelResult?: (accessoryId: string, loaded: boolean) => void
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
  rotationZones = null,
  activeZoneCode = null,
  accessories = null,
  onAccessoryModelResult,
  ref,
}: CraneViewportProps) {
  const canvasHostRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<CraneSceneHandle | null>(null)
  // Últimos valores recebidos, para reaplicar quando a cena remonta (troca de `setup`).
  const statusRef = useRef(evaluationStatus)
  const loadRef = useRef(load)
  const cameraPresetRef = useRef(cameraPreset)
  const zonesRef = useRef<readonly SceneRotationZone[]>(rotationZones ?? [])
  const activeZoneRef = useRef(activeZoneCode)
  const appliedPresetRef = useRef<CameraPreset | undefined>(undefined)
  const accessoriesRef = useRef<readonly SceneAccessory[]>(accessories ?? [])
  const accessoryResultRef = useRef(onAccessoryModelResult)

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

    const handle = mountCraneScene(host, setup, {
      onAccessoryModelResult: (id, loaded) => accessoryResultRef.current?.(id, loaded),
    })
    sceneRef.current = handle
    handle.setAccessories(accessoriesRef.current)
    handle.setEvaluationStatus(statusRef.current)
    handle.setLoad(loadRef.current)
    handle.setRotationZones(zonesRef.current)
    handle.setActiveRotationZone(activeZoneRef.current)
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
    accessoryResultRef.current = onAccessoryModelResult
  }, [onAccessoryModelResult])

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

  // Dependência no conteúdo das zonas, não no array: a UI pode mandar um array novo a cada render.
  const zonesKey = JSON.stringify(rotationZones ?? [])
  useEffect(() => {
    const zones = JSON.parse(zonesKey) as SceneRotationZone[]
    zonesRef.current = zones
    sceneRef.current?.setRotationZones(zones)
  }, [zonesKey])

  // Dependência no conteúdo da cadeia, não no array: a UI pode mandar um array novo a cada render.
  const accessoriesKey = JSON.stringify(accessories ?? [])
  useEffect(() => {
    const chain = JSON.parse(accessoriesKey) as SceneAccessory[]
    accessoriesRef.current = chain
    sceneRef.current?.setAccessories(chain)
  }, [accessoriesKey])

  useEffect(() => {
    activeZoneRef.current = activeZoneCode
    sceneRef.current?.setActiveRotationZone(activeZoneCode)
  }, [activeZoneCode])

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
