// Composição do simulador guiado (TASK-039; antes em App.tsx, TASK-032/033/034): cena, passos,
// sessão de avaliação (WebSocket com fallback REST) e HUD do resultado.

import { Link2, TriangleAlert } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'

import { selectedConfiguration as findSelectedConfiguration } from '../../application/catalog/CatalogBrowser'
import { evaluationStatus } from '../../application/evaluation/evaluationStatus'
import { validateLoadForm, loadWeightTextForEvaluation } from '../../application/load/loadForm'
import { guidedStepStatuses, resolveActiveStep } from '../../application/simulator/guidedSteps'
import type { OperationalGeometry } from '../../domain/geometry/operationalGeometry'
import {
  CraneViewport,
  type CraneViewportHandle,
} from '../../presentation/components/CraneViewport'
import { SceneErrorBoundary } from '../../presentation/components/SceneErrorBoundary'
import { ROUTES } from '../../presentation/layout/navigation'
import { SimulatorPage } from '../../presentation/pages/SimulatorPage'
import { BackendEvaluationPanel } from '../../presentation/panels/BackendEvaluationPanel'
import { CatalogSelectionPanel } from '../../presentation/panels/CatalogSelectionPanel'
import {
  type CraneControlKey,
  CraneControlPanel,
} from '../../presentation/panels/CraneControlPanel'
import { LoadPanel } from '../../presentation/panels/LoadPanel'
import { OperationalGeometryPanel } from '../../presentation/panels/OperationalGeometryPanel'
import {
  CameraPresetButtons,
  type CameraPresetId,
} from '../../presentation/simulator/CameraPresetButtons'
import { ConnectionStatusBar } from '../../presentation/simulator/ConnectionStatusBar'
import { OperatingAreaToggle } from '../../presentation/simulator/OperatingAreaToggle'
import { GuidedStepsPanel } from '../../presentation/simulator/GuidedStepsPanel'
import { buttonClassName, EmptyState } from '../../presentation/ui'
import type { CraneCommands, CraneState } from '../../three/crane/types'
import { useCatalog } from '../catalog/catalogContext'
import { chooseCraneSetup } from '../craneSetup'
import { buildEvaluationInput } from '../evaluationInput'
import { sceneRotationZoneCode } from '../sceneRotationZone'
import { useSimulatorDraft } from '../simulator/simulatorDraft'
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
  const { load, setLoad, requestedStep, setRequestedStep } = useSimulatorDraft()
  const { session, state: evaluation } = useEvaluationSession()
  const { catalog, state: catalogState } = useCatalog()

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

  const loadWeightText = loadWeightTextForEvaluation(load)
  const validLoad = validateLoadForm(load).load
  const evaluationInput = buildEvaluationInput(
    crane?.state ?? null,
    selectedConfiguration?.id ?? '',
    loadWeightText,
  )
  const { input } = evaluationInput

  // A cada mudança dos sliders ou dos campos, o estado vai ao backend (com debounce na sessão).
  // As dependências são os campos do estado, não o objeto `input`, que é recriado a cada render.
  useEffect(() => {
    if (input) session.update(input)
    else session.clear()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    session,
    input?.configurationId,
    input?.boomLengthM,
    input?.boomAngleDeg,
    input?.turretRotationDeg,
    input?.cableLengthM,
    input?.loadWeightKg,
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
    evaluationInput.problem === null && evaluation.error === null ? evaluation.result : null,
  )
  // Zonas de giro no chão (TASK-046). A zona destacada é a do backend quando o resultado vale para o
  // estado atual (sem nada a caminho); senão, a prévia pelo giro ψ, só para desenho (RN-008).
  const rotationZones = selectedConfiguration?.rotationZones ?? []
  const activeZoneCode = sceneRotationZoneCode({
    zones: rotationZones,
    turretRotationDeg: crane?.state.turretRotationDeg ?? null,
    result: evaluation.result,
    resultIsCurrent:
      evaluationInput.problem === null && evaluation.error === null && !evaluation.pending,
  })
  // Área de operação (TASK-055): só lança e carga mudam a grade; ψ e R não entram.
  const operatingArea = useOperatingArea({
    enabled: operatingAreaEnabled,
    configurationId: input?.configurationId ?? null,
    boomLengthM: input?.boomLengthM ?? null,
    loadWeightKg: input?.loadWeightKg ?? null,
  })
  const sceneLoad = validLoad
    ? { lengthM: validLoad.lengthM, widthM: validLoad.widthM, heightM: validLoad.heightM }
    : null
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
        operatingArea={operatingAreaEnabled ? operatingArea.area : null}
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
            ),
            load: <LoadPanel values={load} onChange={setLoad} />,
            position: (
              <CraneControlPanel
                limits={crane?.commands.limits ?? null}
                state={crane?.state ?? null}
                notice={craneSetup.notice}
                notes={craneSetup.notes}
                onChange={handleControlChange}
              />
            ),
          }}
        />
      }
      result={
        <BackendEvaluationPanel
          result={evaluation.result}
          error={evaluation.error}
          pending={evaluation.pending}
          transport={evaluation.transport}
          inputProblem={evaluationInput.problem}
          loadWeightKg={input?.loadWeightKg ?? null}
          slow={evaluation.slow}
        />
      }
      geometry={
        <OperationalGeometryPanel
          geometry={crane?.geometry ?? null}
          parameters={crane?.commands.geometryParameters ?? null}
          parametersFromSheet={craneSetup.fromSheet}
        />
      }
      statusBar={
        <ConnectionStatusBar
          connectionStatus={evaluation.connectionStatus}
          transport={evaluation.result !== null ? evaluation.transport : null}
          pending={evaluation.pending}
          slow={evaluation.slow}
          cameraActions={
            <>
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
