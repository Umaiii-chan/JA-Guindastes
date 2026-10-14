import { type Ref, useEffect, useImperativeHandle, useRef } from 'react'

import type { CargoState, CargoStatus } from '../../domain/cargo/cargoOperation'
import type { CollisionState } from '../../domain/collision/collisions'
import type { ScenarioSpec } from '../../domain/environment/environment'
import type { OutriggerState } from '../../domain/crane/outriggers'
import type { OperatingArea } from '../../domain/evaluation/operatingArea'
import type { SceneAccessory } from '../../three/accessories/AccessoryChain'
import type { CameraPreset } from '../../three/camera/cameraPresets'
import type { CraneCommands, CraneSetup } from '../../three/crane/types'
import type { LoadDimensions } from '../../three/scene/loadBox'
import {
  type CameraPresetOptions,
  type CraneSceneHandle,
  mountCraneScene,
} from '../../three/scene/mountCraneScene'
import type {
  ExtraCraneInput,
  ReleaseResult,
  TandemSceneConfig,
  TandemSceneFrame,
} from '../../three/scene/MultiCrane'
import type { EngageResult } from '../../domain/tandem/tandem'
import type { EvaluationStatus } from '../../three/scene/palette'
import type { SceneRotationZone } from '../../three/scene/RotationZoneSectors'
import type { SceneEditorCallbacks, SceneEditorConfig } from '../../three/scene/SceneEditor'

/** Editor 3D do ambiente ligado à cena (TASK-066); `null` ou ausente = desligado. */
export interface CraneViewportEditor {
  readonly config: SceneEditorConfig
  readonly callbacks: SceneEditorCallbacks
}

/** API imperativa do viewport (via `ref`), para ações pontuais como os botões de câmera. */
export interface CraneViewportHandle {
  /** Leva a câmera à predefinição, mesmo que seja a mesma de antes (reenquadra o estado atual). */
  setCameraPreset(preset: CameraPreset, options?: CameraPresetOptions): void
  /** Engata a carga que está no chão, se o gancho estiver perto dela (TASK-073). */
  engageCargo(): boolean
  /** Solta a carga engatada, se ela estiver perto do chão (TASK-073). */
  releaseCargo(): boolean
  /** Situação atual da coleta e entrega na cena (`null` sem cena; TASK-073). */
  getCargoStatus(): CargoStatus | null
  /** Mostra o estado da carga de uma gravação em reprodução; `null` volta ao estado ao vivo. */
  setCargoPlayback(state: CargoState | null): void
  /** Engata os dois ganchos nos pontos de içamento (TASK-074); `null` sem tandem ou sem cena. */
  engageTandem(): EngageResult | null
  /** Solta a carga do tandem, se ela estiver apoiada no chão (TASK-074). */
  releaseTandem(): ReleaseResult
  /** Do gancho ao ponto de amarração das lingas, medido na cena; `null` sem cena (TASK-075). */
  hookAttachOffsetM(): number | null
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
   * Cenário (terreno, obstáculos e posição do guindaste) usado nas colisões da carga (TASK-053; só os
   * dados: o desenho é da TASK-052). Sem ele, chão plano e guindaste na origem. Não remonta a cena.
   */
  scenario?: ScenarioSpec | null
  /** Recebe o estado de colisão da carga quando ele muda (TASK-053; RN-012). Não remonta a cena. */
  onCollisionChange?: (state: CollisionState) => void
  /** Recebe a situação da coleta e entrega da carga quando ela muda (TASK-073). Não remonta a cena. */
  onCargoChange?: (status: CargoStatus) => void
  /**
   * Patolas (TASK-054): extensão, macacos e nivelamento, animados na cena. Só move os nós de patola
   * que o modelo 3D tiver. Sem a prop, nada muda. Não remonta a cena.
   */
  outriggers?: OutriggerState
  /**
   * Área de operação (TASK-055; ADR-025), desenhada no chão; `null` (padrão) não desenha nada. Não
   * remonta a cena.
   */
  operatingArea?: OperatingArea | null
  /**
   * Cadeia de acessórios de içamento entre o gancho e a carga (TASK-056; RN-014): cada um ocupa
   * `riggingHeightM` abaixo do gancho e a carga desce a soma. Sem ela (padrão), nada muda na cena.
   * Não remonta a cena.
   */
  accessories?: readonly SceneAccessory[] | null
  /** Avisado quando o modelo 3D de um acessório chega (`true`) ou não pôde ser carregado (`false`). */
  onAccessoryModelResult?: (accessoryId: string, loaded: boolean) => void
  /** Editor 3D do ambiente (TASK-066). Não remonta a cena. */
  editor?: CraneViewportEditor | null
  /**
   * Guindastes adicionais do cenário (TASK-074), cada um com o rig completo e os próprios comandos.
   * Não remonta a cena.
   */
  extraCranes?: readonly ExtraCraneInput[]
  /** Recebe os comandos dos guindastes adicionais quando a lista muda (TASK-074). */
  onExtraCranesChange?: (commands: ReadonlyMap<string, CraneCommands>) => void
  /**
   * Carga do tandem no chão, com os pontos de içamento marcados (TASK-074); `null` = sem tandem.
   * Não remonta a cena.
   */
  tandem?: TandemSceneConfig | null
  /** Quadro do tandem engatado a cada comando, e `null` quando ele se desfaz (TASK-074). */
  onTandemFrame?: (frame: TandemSceneFrame | null) => void
  /** Situação (cor) do gancho de cada guindaste adicional e da carga do tandem (TASK-074). */
  extraStatuses?: Readonly<Record<string, EvaluationStatus>>
  tandemStatus?: EvaluationStatus
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
  scenario,
  onCollisionChange,
  onCargoChange,
  outriggers,
  operatingArea = null,
  accessories = null,
  onAccessoryModelResult,
  editor = null,
  extraCranes,
  onExtraCranesChange,
  tandem = null,
  onTandemFrame,
  extraStatuses,
  tandemStatus = 'unknown',
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
  const scenarioRef = useRef(scenario)
  const collisionCallbackRef = useRef(onCollisionChange)
  const cargoCallbackRef = useRef(onCargoChange)
  const operatingAreaRef = useRef(operatingArea)
  const appliedPresetRef = useRef<CameraPreset | undefined>(undefined)
  const outriggersRef = useRef(outriggers)
  const accessoriesRef = useRef<readonly SceneAccessory[]>(accessories ?? [])
  const accessoryResultRef = useRef(onAccessoryModelResult)
  const editorRef = useRef(editor)
  const extraCranesRef = useRef(extraCranes)
  const extraChangeRef = useRef(onExtraCranesChange)
  const tandemRef = useRef(tandem)
  const tandemFrameRef = useRef(onTandemFrame)
  const extraStatusesRef = useRef(extraStatuses)
  const tandemStatusRef = useRef(tandemStatus)

  useImperativeHandle(
    ref,
    () => ({
      setCameraPreset(preset, options) {
        cameraPresetRef.current = preset
        appliedPresetRef.current = preset
        sceneRef.current?.setCameraPreset(preset, options)
      },
      engageCargo: () => sceneRef.current?.engageCargo() ?? false,
      releaseCargo: () => sceneRef.current?.releaseCargo() ?? false,
      getCargoStatus: () => sceneRef.current?.getCargoStatus() ?? null,
      setCargoPlayback: (state) => sceneRef.current?.setCargoPlayback(state),
      engageTandem() {
        return sceneRef.current?.engageTandem() ?? null
      },
      releaseTandem() {
        return sceneRef.current?.releaseTandem() ?? { released: false, reason: 'not-engaged' }
      },
      hookAttachOffsetM() {
        return sceneRef.current?.hookAttachOffsetM() ?? null
      },
    }),
    [],
  )

  useEffect(() => {
    const host = canvasHostRef.current
    if (!host) return

    const handle = mountCraneScene(host, setup, {
      onCollisionChange: (state) => collisionCallbackRef.current?.(state),
      onCargoChange: (status) => cargoCallbackRef.current?.(status),
      onAccessoryModelResult: (id, loaded) => accessoryResultRef.current?.(id, loaded),
      onExtraCranesChange: (commands) => extraChangeRef.current?.(commands),
      onTandemFrame: (frame) => tandemFrameRef.current?.(frame),
    })
    sceneRef.current = handle
    handle.setAccessories(accessoriesRef.current)
    handle.setEvaluationStatus(statusRef.current)
    if (scenarioRef.current) handle.setEnvironment(scenarioRef.current)
    handle.setLoad(loadRef.current)
    handle.setRotationZones(zonesRef.current)
    handle.setActiveRotationZone(activeZoneRef.current)
    if (outriggersRef.current) handle.setOutriggers(outriggersRef.current)
    handle.setOperatingArea(operatingAreaRef.current)
    handle.setScenario(scenarioRef.current ?? null)
    handle.setExtraCranes(extraCranesRef.current ?? [])
    handle.setTandemCargo(tandemRef.current)
    handle.setTandemEvaluationStatus(tandemStatusRef.current)
    for (const [id, status] of Object.entries(extraStatusesRef.current ?? {})) {
      handle.setExtraEvaluationStatus(id, status)
    }
    const preset = cameraPresetRef.current
    if (preset) handle.setCameraPreset(preset, { animate: false })
    appliedPresetRef.current = preset
    if (editorRef.current) handle.setEditor(editorRef.current)
    onCraneChange(handle.crane)

    return () => {
      onCraneChange(null)
      sceneRef.current = null
      handle.dispose()
    }
  }, [setup, onCraneChange])

  useEffect(() => {
    editorRef.current = editor
    sceneRef.current?.setEditor(editor)
  }, [editor])

  useEffect(() => {
    extraChangeRef.current = onExtraCranesChange
    tandemFrameRef.current = onTandemFrame
  }, [onExtraCranesChange, onTandemFrame])

  // Dependência no conteúdo da lista, não no array: a UI pode mandar um array novo a cada render.
  const extraCranesKey = JSON.stringify(extraCranes ?? [])
  useEffect(() => {
    const list = JSON.parse(extraCranesKey) as ExtraCraneInput[]
    extraCranesRef.current = list
    sceneRef.current?.setExtraCranes(list)
  }, [extraCranesKey])

  const tandemKey = JSON.stringify(tandem)
  useEffect(() => {
    const config = JSON.parse(tandemKey) as TandemSceneConfig | null
    tandemRef.current = config
    sceneRef.current?.setTandemCargo(config)
  }, [tandemKey])

  useEffect(() => {
    tandemStatusRef.current = tandemStatus
    sceneRef.current?.setTandemEvaluationStatus(tandemStatus)
  }, [tandemStatus])

  const extraStatusesKey = JSON.stringify(extraStatuses ?? {})
  useEffect(() => {
    const statuses = JSON.parse(extraStatusesKey) as Record<string, EvaluationStatus>
    extraStatusesRef.current = statuses
    for (const [id, status] of Object.entries(statuses)) {
      sceneRef.current?.setExtraEvaluationStatus(id, status)
    }
  }, [extraStatusesKey, extraCranesKey])

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
  const cargoType = load?.cargoType
  useEffect(() => {
    const next =
      lengthM === undefined || widthM === undefined || heightM === undefined
        ? null
        : { lengthM, widthM, heightM, ...(cargoType === undefined ? {} : { cargoType }) }
    loadRef.current = next
    sceneRef.current?.setLoad(next)
  }, [lengthM, widthM, heightM, cargoType])

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
    collisionCallbackRef.current = onCollisionChange
  }, [onCollisionChange])

  useEffect(() => {
    cargoCallbackRef.current = onCargoChange
  }, [onCargoChange])

  useEffect(() => {
    // TASK-052 desenha o cenário; TASK-053 usa os mesmos dados para colidir.
    scenarioRef.current = scenario
    sceneRef.current?.setScenario(scenario ?? null)
    if (scenario) sceneRef.current?.setEnvironment(scenario)
  }, [scenario])

  useEffect(() => {
    activeZoneRef.current = activeZoneCode
    sceneRef.current?.setActiveRotationZone(activeZoneCode)
  }, [activeZoneCode])

  // Dependência nos campos, não no objeto: a UI pode mandar um objeto novo a cada render.
  const outriggerExtension = outriggers?.extensionPercent
  const outriggerJacksSet = outriggers?.jacksSet
  const outriggerLeveling = outriggers?.levelingDeg
  useEffect(() => {
    if (
      outriggerExtension === undefined ||
      outriggerJacksSet === undefined ||
      outriggerLeveling === undefined
    ) {
      return
    }
    const next = {
      extensionPercent: outriggerExtension,
      jacksSet: outriggerJacksSet,
      levelingDeg: outriggerLeveling,
    }
    outriggersRef.current = next
    sceneRef.current?.setOutriggers(next)
  }, [outriggerExtension, outriggerJacksSet, outriggerLeveling])

  useEffect(() => {
    operatingAreaRef.current = operatingArea
    sceneRef.current?.setOperatingArea(operatingArea)
  }, [operatingArea])

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
