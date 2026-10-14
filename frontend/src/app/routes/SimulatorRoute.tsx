// Composição do simulador guiado (TASK-039; antes em App.tsx, TASK-032/033/034): cena, passos,
// sessão de avaliação (WebSocket com fallback REST) e HUD do resultado.

import { Link2, TriangleAlert } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'

import { resolveAccessories } from '../../application/accessory/accessorySelection'
import { selectedConfiguration as findSelectedConfiguration } from '../../application/catalog/CatalogBrowser'
import { cargoGuidance } from '../../application/cargo/cargoGuidance'
import { evaluationStatus } from '../../application/evaluation/evaluationStatus'
import { type CargoStatus, INACTIVE_CARGO } from '../../domain/cargo/cargoOperation'
import type { RecordingFrame, RecordingSnapshot } from '../../application/recording/recording'
import type { ScenarioSummary } from '../../application/environment/ports'
import { validateLoadForm, loadWeightTextForEvaluation } from '../../application/load/loadForm'
import { guidedStepStatuses, resolveActiveStep } from '../../application/simulator/guidedSteps'
import { RETRACTED_OUTRIGGERS, type OutriggerState } from '../../domain/crane/outriggers'
import type { OperationalGeometry } from '../../domain/geometry/operationalGeometry'
import {
  CraneViewport,
  type CraneViewportHandle,
} from '../../presentation/components/CraneViewport'
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
import { obstacleConflictIds } from '../../application/environment/obstacleConflicts'
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
import { CollisionAlerts } from '../../presentation/simulator/CollisionAlerts'
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
import { useEnvironmentEditor } from '../simulator/useEnvironmentEditor'
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
  const viewportRef = useRef<CraneViewportHandle>(null)
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

  // Solo sob as sapatas, vento e obstáculos em conflito vão ao backend só quando existem (TASK-066).
  const conflicts = obstacleConflictIds(
    scenario.spec,
    crane?.geometry.workingRadiusM ?? null,
    collision,
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
          load: validLoad
            ? { lengthM: validLoad.lengthM, widthM: validLoad.widthM, heightM: validLoad.heightM }
            : null,
          outriggers,
          accessoryIds,
          ...(cargoStatus.active ? { cargo: cargoStatus.state } : {}),
        }
      : null
  // Reprodução: cada quadro vira a pose aplicada na cena, sem avaliar (RN-008).
  const craneCommands = crane?.commands
  const applyFrame = useCallback(
    (frame: RecordingFrame) => {
      if (!craneCommands) return
      // Primeiro a carga (no chão ou no gancho), para as colisões já valerem para o quadro todo.
      viewportRef.current?.setCargoPlayback(frame.cargo ?? null)
      craneCommands.setTurretRotation(frame.crane.turretRotationDeg)
      craneCommands.setBoomAngle(frame.crane.boomAngleDeg)
      craneCommands.setBoomLength(frame.crane.boomLengthM)
      craneCommands.setCableLength(frame.crane.cableLengthM)
      setCrane(bindCrane(craneCommands))
    },
    [craneCommands],
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
    if (!locked) viewportRef.current?.setCargoPlayback(null)
  }, [locked])
  const shownResult = playbackFrame ? playbackFrame.evaluation : evaluation.result

  // A cada mudança dos sliders ou dos campos, o estado vai ao backend (com debounce na sessão).
  // As dependências são os campos do estado, não o objeto `input`, que é recriado a cada render.
  useEffect(() => {
    if (locked) return
    if (input) session.update(input)
    else session.clear()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    session,
    locked,
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
  }, [])

  const handleControlChange = (key: CraneControlKey, value: number) => {
    if (!crane) return
    APPLY_COMMAND[key](crane.commands, value)
    setCrane(bindCrane(crane.commands))
  }

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
  const sceneStatus = evaluationStatus(
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
    : validLoad
      ? { lengthM: validLoad.lengthM, widthM: validLoad.widthM, heightM: validLoad.heightM }
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
  const cargoGuide = cargoGuidance({
    status: cargoStatus,
    cargoPlaced: scenario.spec.cargo !== undefined,
    deliveryPlaced: scenario.spec.delivery !== undefined,
  })
  const handleCameraPreset = (preset: CameraPresetId) => {
    setCameraPreset(preset)
    viewportRef.current?.setCameraPreset(preset)
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
              <fieldset disabled={locked} className="recording-lock">
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
              <fieldset disabled={locked} className="recording-lock">
                <LoadPanel values={load} onChange={setLoad} />
              </fieldset>
            ),
            position: (
              <fieldset disabled={locked} className="recording-lock">
                <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
                  <CraneControlPanel
                    limits={crane?.commands.limits ?? null}
                    state={crane?.state ?? null}
                    notice={craneSetup.notice}
                    notes={craneSetup.notes}
                    onChange={handleControlChange}
                  />
                  <OutriggerPanel
                    state={outriggers}
                    maxLevelingDeg={FICTITIOUS_MAX_LEVELING_DEG}
                    onChange={setOutriggers}
                  />
                </div>
              </fieldset>
            ),
          }}
        />
      }
      result={
        <>
          <CollisionAlerts collision={collision} />
          <BackendEvaluationPanel
            result={shownResult}
            error={locked ? null : evaluation.error}
            pending={locked ? false : evaluation.pending}
            transport={evaluation.transport}
            inputProblem={locked ? null : evaluationInput.problem}
            loadWeightKg={
              playbackFrame ? playbackFrame.loadWeightKg : (input?.loadWeightKg ?? null)
            }
            slow={evaluation.slow}
          />
        </>
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
        locked ? undefined : (
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
  )
}
