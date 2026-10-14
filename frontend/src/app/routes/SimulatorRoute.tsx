// Composição do simulador guiado (TASK-039; antes em App.tsx, TASK-032/033/034): cena, passos,
// sessão de avaliação (WebSocket com fallback REST) e HUD do resultado.

import { Link2, TriangleAlert } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'

import { resolveAccessories } from '../../application/accessory/accessorySelection'
import type { AiLiftReportRequest, AiScenarioDraft } from '../../application/ai/ports'
import { loadFormFromDraft } from '../../application/ai/scenarioDraft'
import { selectedConfiguration as findSelectedConfiguration } from '../../application/catalog/CatalogBrowser'
import { cargoGuidance } from '../../application/cargo/cargoGuidance'
import { fitTurretRotation } from '../../application/planning/trajectoryPlayback'
import { evaluationStatus } from '../../application/evaluation/evaluationStatus'
import { type CargoStatus, INACTIVE_CARGO } from '../../domain/cargo/cargoOperation'
import type { RecordingFrame, RecordingSnapshot } from '../../application/recording/recording'
import type { ScenarioSummary } from '../../application/environment/ports'
import {
  loadDimensionsOf,
  loadWeightTextForEvaluation,
  validateLoadForm,
} from '../../application/load/loadForm'
import { guidedStepStatuses, resolveActiveStep } from '../../application/simulator/guidedSteps'
import { RETRACTED_OUTRIGGERS, type OutriggerState } from '../../domain/crane/outriggers'
import type { OperationalGeometry } from '../../domain/geometry/operationalGeometry'
import {
  CraneViewport,
  type CraneViewportHandle,
} from '../../presentation/components/CraneViewport'
import { AssistantButton, LiftReportButton } from '../../presentation/ai'
import { SceneErrorBoundary } from '../../presentation/components/SceneErrorBoundary'
import { ROUTES } from '../../presentation/layout/navigation'
import { SimulatorPage } from '../../presentation/pages/SimulatorPage'
import { accessoryModelUrl } from '../../domain/accessory/accessory'
import { AccessoryPanel } from '../../presentation/panels/AccessoryPanel'
import { BackendEvaluationPanel } from '../../presentation/panels/BackendEvaluationPanel'
import { CatalogSelectionPanel } from '../../presentation/panels/CatalogSelectionPanel'
import { EnvironmentPanel } from '../../presentation/panels/EnvironmentPanel'
import {
  soilKindsUnderShoes,
  windSpeedForEvaluation,
} from '../../application/environment/editorOps'
import {
  obstacleConflictIds,
  obstacleConflictLabels,
} from '../../application/environment/obstacleConflicts'
import {
  addExtraCrane,
  canAddExtraCrane,
  defaultCargoBetween,
} from '../../application/tandem/tandemScenario'
import type { CargoPlacement } from '../../domain/environment/environment'
import { cargoCgWorld, type TandemLoad } from '../../domain/tandem/tandem'
import type { TandemInput } from '../../domain/tandem/tandemEvaluation'
import { environmentSummary } from '../../application/environment/scenarioEditing'
import {
  type CraneControlKey,
  CraneControlPanel,
} from '../../presentation/panels/CraneControlPanel'
import { LoadPanel } from '../../presentation/panels/LoadPanel'
import { OperationalGeometryPanel } from '../../presentation/panels/OperationalGeometryPanel'
import { OutriggerPanel } from '../../presentation/panels/OutriggerPanel'
import {
  CameraPresetButtons,
  type CameraPresetId,
} from '../../presentation/simulator/CameraPresetButtons'
import { CargoOperationPanel } from '../../presentation/simulator/CargoOperationPanel'
import { AddCraneDialog } from '../../presentation/simulator/AddCraneDialog'
import { CollapsibleSection } from '../../presentation/simulator/CollapsibleSection'
import { CollisionAlerts } from '../../presentation/simulator/CollisionAlerts'
import { CraneSelector } from '../../presentation/simulator/CraneSelector'
import { TandemHud } from '../../presentation/simulator/TandemHud'
import { TandemSection, type TandemMessage } from '../../presentation/simulator/TandemSection'
import { ConnectionStatusBar } from '../../presentation/simulator/ConnectionStatusBar'
import { OperatingAreaToggle } from '../../presentation/simulator/OperatingAreaToggle'
import { RecordingPanel } from '../../presentation/simulator/RecordingPanel'
import {
  EditEnvironmentToggle,
  EnvironmentEditorToolbar,
} from '../../presentation/simulator/EnvironmentEditorToolbar'
import { EnvironmentSection } from '../../presentation/simulator/EnvironmentSection'
import { GuidedStepsPanel } from '../../presentation/simulator/GuidedStepsPanel'
import { buttonClassName, EmptyState } from '../../presentation/ui'
import { FICTITIOUS_MAX_LEVELING_DEG } from '../../three/crane/OutriggerController'
import type { CraneCommands, CraneState } from '../../three/crane/types'
import type {
  ExtraCraneInput,
  TandemSceneConfig,
  TandemSceneFrame,
} from '../../three/scene/MultiCrane'
import { PRIMARY_CRANE_ID } from '../../three/scene/MultiCrane'
import type { SceneAccessory } from '../../three/accessories/AccessoryChain'
import { useAuth } from '../auth/authContext'
import { useCatalog } from '../catalog/catalogContext'
import { chooseCraneSetup } from '../craneSetup'
import { buildEvaluationInput } from '../evaluationInput'
import { useScenario } from '../scenario/scenarioContext'
import { sceneRotationZoneCode } from '../sceneRotationZone'
import { useSimulationRecording } from '../simulator/useSimulationRecording'
import { useSimulatorDraft } from '../simulator/simulatorDraft'
import { useCollisionState } from '../simulator/useCollisionState'
import { useConfigurationsById } from '../simulator/useConfigurationsById'
import { useEnvironmentEditor } from '../simulator/useEnvironmentEditor'
import { useTandemEvaluation } from '../simulator/useTandemEvaluation'
import { PlanningSection } from '../planning/PlanningSection'
import { RECORDING_UI_REFRESH_MS, UI_REFRESH_MS } from '../planning/usePlanPlayback'
import { useAccessoryCatalog } from '../useAccessoryCatalog'
import { useEvaluationSession } from '../useEvaluationSession'
import { useOperatingArea } from '../useOperatingArea'

interface CraneBinding {
  readonly commands: CraneCommands
  /** Cópia do estado aplicado na cena, para a UI mostrar o valor já limitado pelo controller. */
  readonly state: CraneState
  /** Geometria do estado aplicado, só para pré-visualização (ADR-013 C-7; RN-008). */
  readonly geometry: OperationalGeometry
}

const APPLY_COMMAND: Record<CraneControlKey, (commands: CraneCommands, value: number) => void> = {
  turretRotationDeg: (commands, value) => commands.setTurretRotation(value),
  boomAngleDeg: (commands, value) => commands.setBoomAngle(value),
  boomLengthM: (commands, value) => commands.setBoomLength(value),
  cableLengthM: (commands, value) => commands.setCableLength(value),
}

function bindCrane(commands: CraneCommands): CraneBinding {
  return { commands, state: commands.getState(), geometry: commands.getOperationalGeometry() }
}

export function SimulatorRoute() {
  const [crane, setCrane] = useState<CraneBinding | null>(null)
  const [cameraPreset, setCameraPreset] = useState<CameraPresetId | null>(null)
  const [operatingAreaEnabled, setOperatingAreaEnabled] = useState(false)
  // A trajetória planejada está rodando na cena (TASK-075): os controles ficam travados.
  const [planPlaying, setPlanPlaying] = useState(false)
  const viewportRef = useRef<CraneViewportHandle>(null)
  // Guindastes adicionais e tandem (TASK-074).
  const [selectedCraneId, setSelectedCraneId] = useState<string>(PRIMARY_CRANE_ID)
  const [extraCommands, setExtraCommands] = useState<ReadonlyMap<string, CraneCommands>>(
    () => new Map(),
  )
  const [, setExtraVersion] = useState(0)
  const [addingCrane, setAddingCrane] = useState(false)
  const [tandemActive, setTandemActive] = useState(false)
  const [tandemFrame, setTandemFrame] = useState<TandemSceneFrame | null>(null)
  const [tandemMessage, setTandemMessage] = useState<TandemMessage | null>(null)
  const [outriggers, setOutriggers] = useState<OutriggerState>(RETRACTED_OUTRIGGERS)
  const { load, setLoad, requestedStep, setRequestedStep, accessoryIds, setAccessoryIds } =
    useSimulatorDraft()
  const { state: accessoryCatalog, reload: reloadAccessories } = useAccessoryCatalog()
  // Acessórios cujo arquivo de modelo 3D não pôde ser carregado na cena (TASK-056).
  const [failedModelIds, setFailedModelIds] = useState<ReadonlySet<string>>(() => new Set())
  const { session, state: evaluation } = useEvaluationSession()
  const { catalog, state: catalogState } = useCatalog()
  const { collision, onCollisionChange } = useCollisionState()
  // Coleta e entrega da carga (TASK-073): situação vinda da cena e botões Engatar e Soltar.
  const [cargoStatus, setCargoStatus] = useState<CargoStatus>(INACTIVE_CARGO)
  const scenario = useScenario()
  const editor = useEnvironmentEditor()
  const auth = useAuth()
  // Só o autor ou um admin atualiza e apaga um cenário (ADR-016; ADR-023); o backend confere de novo.
  const canEditScenario = (item: ScenarioSummary) =>
    auth.hasRole('ADMIN') || auth.user?.id === item.authorUserId

  // Configuração escolhida na seleção (fabricante → guindaste → configuração), ou `null`.
  const selectedConfiguration = findSelectedConfiguration(catalogState)
  const selectedManufacturer =
    catalogState.manufacturers.items.find(
      (item) => item.id === catalogState.selectedManufacturerId,
    ) ?? null
  const selectedCrane =
    catalogState.cranes.items.find((item) => item.id === catalogState.selectedCraneId) ?? null

  // Limites dos sliders e a/h da pré-visualização: da ficha técnica, se houver; senão, FICTÍCIOS.
  // Trocar o `setup` remonta a cena, então ele só muda quando a configuração ou a ficha mudam (a
  // lista é recarregada depois de um cadastro, com objetos novos e iguais).
  const setupKey = JSON.stringify(selectedConfiguration)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const craneSetup = useMemo(() => chooseCraneSetup(selectedConfiguration), [setupKey])

  // Guindastes adicionais do cenário (TASK-074): o cenário guarda só o id da configuração; a ficha
  // técnica (limites e a/h) vem do catálogo.
  const extraCranes = scenario.spec.cranes ?? []
  const { configurations: extraConfigurations, remember: rememberConfiguration } =
    useConfigurationsById(extraCranes.map((item) => item.configurationId))
  const extraSetups = extraCranes.flatMap((item, index) => {
    const configuration = extraConfigurations.get(item.configurationId)
    if (!configuration) return []
    return [{ item, index, configuration, choice: chooseCraneSetup(configuration) }]
  })
  const extraInputs: ExtraCraneInput[] = extraSetups.map(({ item, index, choice }) => ({
    id: item.id,
    label: `Guindaste ${index + 2}`,
    setup: choice.setup,
    placement: item.placement,
  }))
  const craneOptions = [
    { id: PRIMARY_CRANE_ID, label: 'Guindaste 1' },
    ...extraInputs.map((item) => ({ id: item.id, label: item.label })),
  ]
  const activeCraneId = craneOptions.some((option) => option.id === selectedCraneId)
    ? selectedCraneId
    : PRIMARY_CRANE_ID
  const activeExtra = extraSetups.find(({ item }) => item.id === activeCraneId) ?? null
  const activeExtraCommands = activeExtra ? (extraCommands.get(activeExtra.item.id) ?? null) : null
  // O segundo guindaste do tandem é o primeiro adicional.
  const follower = extraSetups[0] ?? null

  // Solo sob as sapatas, vento e obstáculos em conflito vão ao backend só quando existem (TASK-066).
  // O backend recebe os rótulos (o alerta mostra "Árvore (carvalho)", não o id interno).
  const conflicts = obstacleConflictLabels(
    scenario.spec,
    obstacleConflictIds(scenario.spec, crane?.geometry.workingRadiusM ?? null, collision),
  )
  const scenarioExtras = {
    soilKinds: soilKindsUnderShoes(scenario.spec),
    windSpeedMs: windSpeedForEvaluation(scenario.spec),
    obstacleConflicts: conflicts,
  }
  const scenarioExtrasKey = JSON.stringify(scenarioExtras)

  const validLoad = validateLoadForm(load).load
  // Com a carga posicionada no chão, o peso só entra na avaliação depois de engatar (TASK-073): antes
  // disso, vale só o gancho e os acessórios, com carga 0.
  const cargoMode = scenario.spec.cargo !== undefined && validLoad !== null
  const cargoHooked = cargoStatus.state?.phase === 'hooked'
  const loadWeightText = cargoMode && !cargoHooked ? '0' : loadWeightTextForEvaluation(load)
  const evaluationInput = buildEvaluationInput(
    crane?.state ?? null,
    selectedConfiguration?.id ?? '',
    loadWeightText,
    { extensionPercent: outriggers.extensionPercent, jacksSet: outriggers.jacksSet },
    accessoryIds,
    scenario.groundSlopeDeg,
    scenarioExtras,
  )
  const accessoryKey = accessoryIds.join('|')
  const { input } = evaluationInput

  // Gravação e reprodução (TASK-057). Com um quadro gravado na tela (`playbackFrame`), o simulador
  // fica travado e nada é reavaliado: a cena e o resultado mostram o quadro (RN-008).
  const { user: authUser } = useAuth()
  const evaluationIsCurrent = evaluation.error === null && !evaluation.pending
  // O retrato só entra no gravador quando muda de verdade (comparado por conteúdo).
  const snapshot: RecordingSnapshot | null =
    crane && input
      ? {
          crane: crane.state,
          configurationId: input.configurationId,
          loadWeightKg: input.loadWeightKg,
          evaluation: evaluationIsCurrent ? evaluation.result : null,
          // A gravação guarda a cena inteira, não só o guindaste (TASK-068).
          load: validLoad ? loadDimensionsOf(validLoad) : null,
          outriggers,
          accessoryIds,
          ...(cargoStatus.active ? { cargo: cargoStatus.state } : {}),
        }
      : null
  // Reprodução: cada quadro vira a pose aplicada na cena, sem avaliar (RN-008).
  const craneCommands = crane?.commands
  // A cena anda a cada quadro de animação; o estado React (setCrane) só quando `uiRefresh` (~10 Hz).
  const lastCargoFrame = useRef<RecordingFrame | null>(null)
  const applyFrame = useCallback(
    (frame: RecordingFrame, pose: CraneState, uiRefresh: boolean) => {
      if (!craneCommands) return
      // Primeiro a carga (no chão ou no gancho), para as colisões já valerem para o quadro todo.
      if (lastCargoFrame.current !== frame) {
        lastCargoFrame.current = frame
        viewportRef.current?.setCargoPlayback(frame.cargo ?? null)
      }
      // Pose interpolada aplicada de uma vez, sem a guarda de colisão: o estado gravado já foi
      // validado. A cena só reavalia uma vez, para manter os destaques de colisão.
      craneCommands.setState(
        {
          ...pose,
          turretRotationDeg: fitTurretRotation(
            pose.turretRotationDeg,
            craneCommands.limits.turretRotationDeg,
          ),
        },
        { guarded: false },
      )
      if (uiRefresh) setCrane(bindCrane(craneCommands))
    },
    [craneCommands],
  )
  // Planejamento (TASK-075): atualiza a tela depois que a trajetória mexe no guindaste da cena.
  const handlePlanMoved = useCallback(() => {
    if (craneCommands) setCrane(bindCrane(craneCommands))
  }, [craneCommands])
  const handleExtendOutriggers = useCallback(
    () =>
      setOutriggers({
        extensionPercent: 100,
        jacksSet: true,
        levelingDeg: FICTITIOUS_MAX_LEVELING_DEG,
      }),
    [],
  )
  const recording = useSimulationRecording({
    snapshot,
    scenario: scenario.spec,
    onFrame: applyFrame,
  })
  const { playbackFrame } = recording
  const locked = playbackFrame !== null
  // Ao sair da reprodução, a carga volta ao estado ao vivo.
  useEffect(() => {
    if (!locked) {
      lastCargoFrame.current = null
      viewportRef.current?.setCargoPlayback(null)
    }
  }, [locked])
  const controlsLocked = locked || planPlaying
  const shownResult = playbackFrame ? playbackFrame.evaluation : evaluation.result

  // A cada mudança dos sliders ou dos campos, o estado vai ao backend (com debounce na sessão).
  // As dependências são os campos do estado, não o objeto `input`, que é recriado a cada render.
  useEffect(() => {
    if (locked || tandemActive) {
      // No tandem, a carga é dividida entre os dois e avaliada junta (POST /evaluations/tandem).
      if (tandemActive) session.clear()
      return
    }
    if (input) session.update(input)
    else session.clear()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    session,
    locked,
    tandemActive,
    input?.configurationId,
    input?.boomLengthM,
    input?.boomAngleDeg,
    input?.turretRotationDeg,
    input?.cableLengthM,
    input?.loadWeightKg,
    // A cadeia de acessórios entra na avaliação do backend (RN-014); a chave troca com ela.
    accessoryKey,
    input?.outriggers?.extensionPercent,
    input?.outriggers?.jacksSet,
    input?.groundSlopeDeg,
    scenarioExtrasKey,
  ])

  const handleCraneChange = useCallback((commands: CraneCommands | null) => {
    setCrane(commands ? bindCrane(commands) : null)
    // A cena foi refeita (ou desmontada): o engate do tandem não sobrevive a isso.
    if (commands === null) setTandemFrame(null)
  }, [])

  const handleControlChange = (key: CraneControlKey, value: number) => {
    if (activeExtraCommands) {
      APPLY_COMMAND[key](activeExtraCommands, value)
      setExtraVersion((version) => version + 1)
      return
    }
    if (!crane) return
    APPLY_COMMAND[key](crane.commands, value)
    setCrane(bindCrane(crane.commands))
    // No tandem engatado, o segundo guindaste seguiu o primeiro: a tela relê os dois.
    setExtraVersion((version) => version + 1)
  }

  const handleExtraCranesChange = useCallback((commands: ReadonlyMap<string, CraneCommands>) => {
    setExtraCommands(commands)
  }, [])

  const handleTandemFrame = useCallback((frame: TandemSceneFrame | null) => {
    setTandemFrame(frame)
    setExtraVersion((version) => version + 1)
  }, [])

  // Passos: 1 configuração escolhida → 2 carga válida → 3 resultado do backend para o estado.
  const statuses = guidedStepStatuses({
    configurationChosen: selectedConfiguration !== null,
    loadValid: validLoad !== null,
    evaluated: input !== null && evaluation.result !== null && evaluation.error === null,
  })
  const activeStep = resolveActiveStep(statuses, requestedStep)

  const craneSummary = [
    selectedManufacturer?.name,
    selectedCrane?.modelName,
    selectedConfiguration?.name,
  ]
    .filter(Boolean)
    .join(' · ')
  const loadSummary = validLoad
    ? `${validLoad.description} · ${validLoad.weightKg.toLocaleString('pt-BR')} kg`
    : undefined
  const positionSummary =
    crane && crane.geometry.workingRadiusM !== null
      ? `R ${crane.geometry.workingRadiusM.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m · θ ${crane.state.boomAngleDeg.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}°`
      : undefined

  // Situação na cena (TASK-041): só com resultado do backend válido para o estado atual.
  const singleSceneStatus = evaluationStatus(
    playbackFrame
      ? playbackFrame.evaluation
      : evaluationInput.problem === null && evaluation.error === null
        ? evaluation.result
        : null,
  )
  // Zonas de giro no chão (TASK-046). A zona destacada é a do backend quando o resultado vale para o
  // estado atual (sem nada a caminho); senão, a prévia pelo giro ψ, só para desenho (RN-008).
  const rotationZones = selectedConfiguration?.rotationZones ?? []
  const activeZoneCode = sceneRotationZoneCode({
    zones: rotationZones,
    turretRotationDeg: crane?.state.turretRotationDeg ?? null,
    result: shownResult,
    resultIsCurrent:
      locked ||
      (evaluationInput.problem === null && evaluation.error === null && !evaluation.pending),
  })
  // Área de operação (TASK-055): só lança e carga mudam a grade; ψ e R não entram.
  const operatingArea = useOperatingArea({
    enabled: operatingAreaEnabled,
    configurationId: input?.configurationId ?? null,
    boomLengthM: input?.boomLengthM ?? null,
    loadWeightKg: input?.loadWeightKg ?? null,
  })
  // Na reprodução, a cena mostra o que foi gravado: carga, acessórios, patolas e ambiente.
  const sceneLoad = playbackFrame
    ? (playbackFrame.load ?? null)
    : tandemActive
      ? null // no tandem, a carga é a do chão (ou içada pelos dois), não a pendurada num gancho
      : validLoad
        ? loadDimensionsOf(validLoad)
        : null
  // Cadeia de acessórios na cena (TASK-056): cada um ocupa `riggingHeightM` abaixo do gancho, e a
  // carga desce a soma. Sem arquivo (ou com o arquivo ausente), só peso e distância.
  const sceneAccessories: readonly SceneAccessory[] = resolveAccessories(
    playbackFrame ? (playbackFrame.accessoryIds ?? []) : accessoryIds,
    accessoryCatalog.items,
  ).accessories.map((item) => ({
    id: item.id,
    riggingHeightM: item.riggingHeightM,
    modelUrl: accessoryModelUrl(item),
    replacesHook: item.type === 'HOOK_BLOCK',
  }))
  const handleAccessoryModelResult = useCallback((accessoryId: string, loaded: boolean) => {
    setFailedModelIds((previous) => {
      if (previous.has(accessoryId) === !loaded) return previous
      const next = new Set(previous)
      if (loaded) next.delete(accessoryId)
      else next.add(accessoryId)
      return next
    })
  }, [])
  // Planejamento (TASK-075) com coleta e entrega (TASK-073) e tandem (TASK-074): a trajetória
  // engata e solta pela cena. Devolve `null` se deu certo, ou o motivo, para a tela parar e mostrar.
  const engageFromPlan = (tandem: boolean): string | null => {
    const handle = viewportRef.current
    if (!handle) return 'A cena ainda não está pronta.'
    if (tandem) {
      const result = handle.engageTandem()
      if (result === null) {
        return 'Para engatar com dois guindastes, ative o içamento com dois guindastes antes de executar.'
      }
      if (!result.reachable) {
        const names = result.unreachable.map((index) => `Guindaste ${index}`).join(' e ')
        return `${names} não alcança o ponto de içamento.`
      }
      return null
    }
    if (handle.engageCargo()) return null
    const status = handle.getCargoStatus()
    const reason = status
      ? cargoGuidance({
          status,
          cargoPlaced: scenario.spec.cargo !== undefined,
          deliveryPlaced: scenario.spec.delivery !== undefined,
        }).message
      : ''
    return `Não deu para engatar a carga. ${reason}`.trim()
  }
  const releaseFromPlan = (tandem: boolean): string | null => {
    const handle = viewportRef.current
    if (!handle) return 'A cena ainda não está pronta.'
    if (tandem) {
      const result = handle.releaseTandem()
      if (result.released) changeCargo(result.cargo)
      return result.released ? null : 'Não deu para soltar a carga dos dois guindastes.'
    }
    return handle.releaseCargo() ? null : 'Não deu para soltar a carga: baixe-a até perto do chão.'
  }
  const cargoGuide = cargoGuidance({
    status: cargoStatus,
    cargoPlaced: scenario.spec.cargo !== undefined,
    deliveryPlaced: scenario.spec.delivery !== undefined,
  })
  // Tandem (TASK-074): carga no chão entre os dois guindastes, com a divisão pelos pontos de içamento.
  const tandemLoad: TandemLoad | null = validLoad
    ? {
        lengthM: validLoad.lengthM,
        widthM: validLoad.widthM,
        heightM: validLoad.heightM,
        ...(validLoad.centerOfGravity
          ? {
              cgAlongLengthM: validLoad.centerOfGravity.alongLengthM,
              cgAlongWidthM: validLoad.centerOfGravity.alongWidthM,
            }
          : {}),
      }
    : null
  const tandemCargo = scenario.spec.cargo ?? null
  // O viewport compara o conteúdo (não a referência), então um objeto novo a cada render não remonta nada.
  const tandemConfig: TandemSceneConfig | null =
    tandemActive && follower && tandemLoad && tandemCargo
      ? { followerId: follower.item.id, load: tandemLoad, cargo: tandemCargo }
      : null
  const tandemEngaged = tandemFrame !== null
  const tandemInput: TandemInput | null =
    tandemEngaged &&
    tandemFrame &&
    follower &&
    tandemLoad &&
    validLoad &&
    selectedConfiguration !== null
      ? {
          loadWeightKg: validLoad.weightKg,
          loadCg: cargoCgWorld(tandemFrame.cargo, tandemLoad),
          cranes: [
            {
              configurationId: selectedConfiguration.id,
              placement: scenario.spec.crane,
              state: tandemFrame.leaderState,
              hookPoint: { x: tandemFrame.hooks[0].x, z: tandemFrame.hooks[0].z },
            },
            {
              configurationId: follower.configuration.id,
              placement: follower.item.placement,
              state: tandemFrame.followerState,
              hookPoint: { x: tandemFrame.hooks[1].x, z: tandemFrame.hooks[1].z },
            },
          ],
        }
      : null
  const tandemEvaluation = useTandemEvaluation(tandemInput)
  const tandemStatuses = tandemEvaluation.result
    ? tandemEvaluation.result.evaluations.map((result) => evaluationStatus(result))
    : []
  const tandemStatus = !tandemEvaluation.result
    ? 'unknown'
    : tandemStatuses.includes('over')
      ? 'over'
      : tandemStatuses.includes('warning')
        ? 'warning'
        : tandemStatuses.every((status) => status === 'ok')
          ? 'ok'
          : 'unknown'

  // No tandem engatado, a cena mostra a situação do Guindaste 1 (a do outro vai no gancho dele).
  const sceneStatus = tandemEngaged ? (tandemStatuses[0] ?? 'unknown') : singleSceneStatus

  const activateTandem = () => {
    if (!scenario.spec.cargo)
      scenario.setSpec({ ...scenario.getSpec(), cargo: defaultCargoBetween(scenario.getSpec()) })
    setSelectedCraneId(PRIMARY_CRANE_ID)
    setTandemMessage(null)
    setTandemActive(true)
  }
  const deactivateTandem = () => {
    setTandemActive(false)
    setTandemMessage(null)
  }
  const changeCargo = (next: CargoPlacement) => {
    scenario.setSpec({ ...scenario.getSpec(), cargo: next })
  }
  const engageTandem = () => {
    const result = viewportRef.current?.engageTandem() ?? null
    if (result === null) {
      setTandemMessage({ tone: 'warning', text: 'A cena ainda está carregando. Tente de novo.' })
      return
    }
    if (!result.reachable) {
      const names = result.unreachable.map((index) => `Guindaste ${index}`).join(' e ')
      setTandemMessage({
        tone: 'warning',
        text: `${names} não alcança o ponto de içamento. Aproxime os guindastes da carga ou gire a carga.`,
      })
      return
    }
    setTandemMessage(null)
    if (crane) setCrane(bindCrane(crane.commands))
    setExtraVersion((version) => version + 1)
  }
  const releaseTandem = () => {
    const result = viewportRef.current?.releaseTandem()
    if (!result) return
    if (!result.released) {
      setTandemMessage({
        tone: 'warning',
        text:
          result.reason === 'in-air'
            ? 'Baixe a carga até o chão antes de soltar.'
            : 'Os guindastes não estão engatados.',
      })
      return
    }
    setTandemMessage({ tone: 'ok', text: 'Carga apoiada no chão e solta.' })
    changeCargo(result.cargo)
  }
  const handleAddCrane = (configuration: Parameters<typeof rememberConfiguration>[0]) => {
    const current = scenario.getSpec()
    const added = addExtraCrane(current, configuration.id)
    if (added.id === null) return
    scenario.checkpoint()
    rememberConfiguration(configuration)
    scenario.setSpec(added.spec)
    editor.selectExtraCrane(added.id)
    setAddingCrane(false)
  }

  const handleCameraPreset = (preset: CameraPresetId) => {
    setCameraPreset(preset)
    viewportRef.current?.setCameraPreset(preset)
  }

  // Assistente de IA (TASK-076): "Aplicar" troca o cenário e a carga pela proposta revisada. O
  // desfazer do editor guarda o cenário anterior. Nada é calculado aqui: o resultado continua vindo
  // do backend para o novo estado (RN-008).
  const applyAiDraft = (draft: AiScenarioDraft) => {
    scenario.checkpoint()
    scenario.setSpec(draft.scenario)
    setLoad(loadFormFromDraft(draft.load))
  }
  // Pedido do relatório de içamento: só com guindaste, carga e estado válidos. O backend avalia de
  // novo o estado enviado, então os números do relatório são os do cálculo dele.
  const buildLiftReportRequest = (): AiLiftReportRequest | null =>
    locked || input === null || validLoad === null
      ? null
      : {
          // Com a carga no chão ainda não engatada (TASK-073), a avaliação ao vivo usa peso 0; o
          // relatório é do içamento planejado, então vai com o peso do passo Carga.
          evaluation: { ...input, loadWeightKg: validLoad.weightKg },
          load: {
            description: validLoad.description,
            lengthM: validLoad.lengthM,
            widthM: validLoad.widthM,
            heightM: validLoad.heightM,
          },
          craneLabel: craneSummary === '' ? undefined : craneSummary,
          scenario: scenario.spec,
        }

  const viewport = (
    <SceneErrorBoundary
      fallback={
        <div className="crane-viewport">
          <div className="crane-viewport__error">
            <EmptyState
              tone="danger"
              role="alert"
              icon={<TriangleAlert size={16} />}
              title="Não foi possível iniciar a cena 3D"
              description="Verifique se o navegador oferece WebGL (aceleração gráfica ligada). Os passos e o resultado continuam funcionando."
            />
          </div>
        </div>
      }
    >
      <CraneViewport
        ref={viewportRef}
        setup={craneSetup.setup}
        onCraneChange={handleCraneChange}
        evaluationStatus={sceneStatus}
        load={sceneLoad}
        rotationZones={rotationZones}
        activeZoneCode={activeZoneCode}
        accessories={sceneAccessories}
        onAccessoryModelResult={handleAccessoryModelResult}
        onCollisionChange={onCollisionChange}
        onCargoChange={setCargoStatus}
        extraCranes={extraInputs}
        onExtraCranesChange={handleExtraCranesChange}
        tandem={tandemConfig}
        onTandemFrame={handleTandemFrame}
        tandemStatus={tandemStatus}
        extraStatuses={
          follower && tandemEngaged ? { [follower.item.id]: tandemStatuses[1] ?? 'unknown' } : {}
        }
        outriggers={playbackFrame?.outriggers ?? outriggers}
        operatingArea={operatingAreaEnabled ? operatingArea.area : null}
        scenario={
          playbackFrame ? (recording.player.recording?.scenario ?? scenario.spec) : scenario.spec
        }
        editor={editor.viewportEditor}
      />
    </SceneErrorBoundary>
  )

  return (
    <>
      <SimulatorPage
        viewport={viewport}
        steps={
          <GuidedStepsPanel
            statuses={statuses}
            activeStep={activeStep}
            onSelectStep={setRequestedStep}
            summaries={{ crane: craneSummary, load: loadSummary, position: positionSummary }}
            content={{
              crane: (
                <fieldset disabled={controlsLocked} className="recording-lock">
                  <CatalogSelectionPanel
                    embedded
                    manufacturers={catalogState.manufacturers}
                    cranes={catalogState.cranes}
                    configurations={catalogState.configurations}
                    selectedManufacturerId={catalogState.selectedManufacturerId}
                    selectedCraneId={catalogState.selectedCraneId}
                    selectedConfigurationId={catalogState.selectedConfigurationId}
                    onSelectManufacturer={(id) => void catalog.selectManufacturer(id)}
                    onSelectCrane={(id) => void catalog.selectCrane(id)}
                    onSelectConfiguration={(id) => catalog.selectConfiguration(id)}
                    onRetry={() => void catalog.loadManufacturers()}
                    emptyAction={
                      <Link to={ROUTES.catalog} className={buttonClassName('secondary', 'sm')}>
                        <Link2 size={13} aria-hidden="true" />
                        Cadastrar no Catálogo
                      </Link>
                    }
                  />
                </fieldset>
              ),
              load: (
                <fieldset disabled={controlsLocked} className="recording-lock">
                  <LoadPanel values={load} onChange={setLoad} />
                </fieldset>
              ),
              position: (
                <fieldset disabled={controlsLocked} className="recording-lock">
                  <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
                    {craneOptions.length > 1 && (
                      <CraneSelector
                        cranes={craneOptions}
                        selectedId={activeCraneId}
                        onSelect={setSelectedCraneId}
                      />
                    )}
                    {activeExtra && tandemEngaged && (
                      <p className="recording-lock-note">
                        No tandem, o Guindaste {activeExtra.index + 2} acompanha o Guindaste 1: use
                        os controles do Guindaste 1.
                      </p>
                    )}
                    <fieldset
                      disabled={activeExtra !== null && tandemEngaged}
                      className="recording-lock"
                    >
                      <CraneControlPanel
                        limits={
                          activeExtra
                            ? (activeExtraCommands?.limits ?? null)
                            : (crane?.commands.limits ?? null)
                        }
                        state={
                          activeExtra
                            ? (activeExtraCommands?.getState() ?? null)
                            : (crane?.state ?? null)
                        }
                        notice={activeExtra ? activeExtra.choice.notice : craneSetup.notice}
                        notes={activeExtra ? activeExtra.choice.notes : craneSetup.notes}
                        onChange={handleControlChange}
                      />
                    </fieldset>
                    {activeExtra === null && (
                      <OutriggerPanel
                        state={outriggers}
                        maxLevelingDeg={FICTITIOUS_MAX_LEVELING_DEG}
                        onChange={setOutriggers}
                      />
                    )}
                  </div>
                </fieldset>
              ),
            }}
          />
        }
        planning={
          <PlanningSection
            load={
              validLoad
                ? {
                    weightKg: validLoad.weightKg,
                    lengthM: validLoad.lengthM,
                    widthM: validLoad.widthM,
                    heightM: validLoad.heightM,
                  }
                : null
            }
            accessoryIds={accessoryIds}
            craneState={crane?.state ?? null}
            commands={crane?.commands ?? null}
            onCraneMoved={handlePlanMoved}
            onPlaybackChange={setPlanPlaying}
            refreshMs={
              recording.recorder.status === 'recording' ? RECORDING_UI_REFRESH_MS : UI_REFRESH_MS
            }
            onExtendOutriggers={handleExtendOutriggers}
            getHookAttachM={() => viewportRef.current?.hookAttachOffsetM() ?? null}
            onEngage={engageFromPlan}
            onRelease={releaseFromPlan}
            disabled={locked}
          />
        }
        result={
          <>
            <CollisionAlerts collision={collision} />
            {tandemActive && tandemEngaged ? (
              <TandemHud
                result={tandemEvaluation.result}
                error={tandemEvaluation.error}
                pending={tandemEvaluation.pending}
                labels={['Guindaste 1', 'Guindaste 2']}
              />
            ) : (
              <BackendEvaluationPanel
                result={shownResult}
                error={locked ? null : evaluation.error}
                pending={locked ? false : evaluation.pending}
                transport={evaluation.transport}
                inputProblem={
                  tandemActive
                    ? 'Engate os dois guindastes na carga para avaliar o içamento em tandem.'
                    : locked
                      ? null
                      : evaluationInput.problem
                }
                loadWeightKg={
                  playbackFrame ? playbackFrame.loadWeightKg : (input?.loadWeightKg ?? null)
                }
                slow={evaluation.slow}
              />
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
              <LiftReportButton buildRequest={buildLiftReportRequest} />
            </div>
          </>
        }
        tandem={
          <CollapsibleSection
            id="tandem"
            title="Içamento com dois guindastes"
            summary={tandemEngaged ? 'engatado' : tandemActive ? 'ativo' : undefined}
          >
            <TandemSection
              hasSecondCrane={follower !== null}
              loadReady={validLoad !== null}
              active={tandemActive}
              engaged={tandemEngaged}
              cargo={tandemCargo}
              onActivate={activateTandem}
              onDeactivate={deactivateTandem}
              onCargoChange={changeCargo}
              onEngage={engageTandem}
              onRelease={releaseTandem}
              message={tandemMessage}
            />
          </CollapsibleSection>
        }
        accessories={
          <AccessoryPanel
            catalog={accessoryCatalog.items}
            status={accessoryCatalog.status}
            errorMessage={accessoryCatalog.error}
            selectedIds={accessoryIds}
            onChange={setAccessoryIds}
            failedModelIds={failedModelIds}
            onRetry={reloadAccessories}
          />
        }
        geometry={
          <OperationalGeometryPanel
            geometry={crane?.geometry ?? null}
            parameters={crane?.commands.geometryParameters ?? null}
            parametersFromSheet={craneSetup.fromSheet}
          />
        }
        recording={
          <RecordingPanel
            controller={recording}
            canDelete={(authorUserId) =>
              authUser !== null && (authUser.id === authorUserId || authUser.role === 'ADMIN')
            }
          />
        }
        environment={
          <EnvironmentSection
            summary={environmentSummary(scenario.spec)}
            onOpen={() => void scenario.refresh()}
          >
            <EnvironmentPanel
              spec={scenario.spec}
              onChange={scenario.setSpec}
              groundSlopeDeg={scenario.groundSlopeDeg}
              scenarios={scenario.scenarios}
              current={scenario.current}
              canEditCurrent={scenario.current !== null && canEditScenario(scenario.current)}
              canEdit={canEditScenario}
              dirty={scenario.dirty}
              busy={scenario.busy}
              error={scenario.error}
              info={scenario.info}
              onOpen={(id) => void scenario.open(id)}
              onSave={(name, options) => void scenario.save(name, options)}
              onRemove={(id) => void scenario.remove(id)}
              onReset={scenario.reset}
            />
          </EnvironmentSection>
        }
        operationBar={
          locked || tandemActive ? undefined : (
            <CargoOperationPanel
              status={cargoStatus}
              guidance={cargoGuide}
              locked={locked}
              onEngage={() => viewportRef.current?.engageCargo()}
              onRelease={() => viewportRef.current?.releaseCargo()}
            />
          )
        }
        editorToolbar={
          editor.active ? (
            <EnvironmentEditorToolbar
              tool={editor.tool}
              onToolChange={editor.changeTool}
              transformMode={editor.transformMode}
              onTransformModeChange={editor.setTransformMode}
              brush={editor.brush}
              onBrushChange={editor.setBrush}
              soilKind={editor.soilKind}
              onSoilKindChange={editor.setSoilKind}
              lowerTerrain={editor.lowerTerrain}
              onLowerTerrainChange={editor.setLowerTerrain}
              modelId={editor.modelId}
              onModelChange={editor.setModelId}
              wind={scenario.spec.wind}
              onWindChange={editor.changeWind}
              selectedLabel={editor.selectedLabel}
              canDelete={editor.canDelete}
              onDelete={editor.deleteSelected}
              canUndo={editor.canUndo}
              onUndo={editor.undo}
              onDone={editor.done}
              onAddCrane={() => setAddingCrane(true)}
              canAddCrane={canAddExtraCrane(scenario.spec)}
            />
          ) : undefined
        }
        statusBar={
          <ConnectionStatusBar
            connectionStatus={evaluation.connectionStatus}
            transport={evaluation.result !== null ? evaluation.transport : null}
            pending={evaluation.pending}
            slow={evaluation.slow}
            cameraActions={
              <>
                <EditEnvironmentToggle active={editor.active} onToggle={editor.toggle} />
                <AssistantButton onApply={applyAiDraft} disabled={locked} />
                <OperatingAreaToggle
                  enabled={operatingAreaEnabled}
                  onToggle={setOperatingAreaEnabled}
                  loading={operatingArea.loading}
                  error={operatingArea.error}
                />
                <CameraPresetButtons active={cameraPreset} onSelect={handleCameraPreset} />
              </>
            }
          />
        }
      />
      {addingCrane && (
        <AddCraneDialog onConfirm={handleAddCrane} onClose={() => setAddingCrane(false)} />
      )}
    </>
  )
}
