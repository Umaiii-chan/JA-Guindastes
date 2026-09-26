import { useCallback, useEffect, useMemo, useState } from 'react'

import { selectedConfiguration as findSelectedConfiguration } from '../application/catalog/CatalogBrowser'
import type { OperationalGeometry } from '../domain/geometry/operationalGeometry'
import { CraneViewport } from '../presentation/components/CraneViewport'
import { SceneErrorBoundary } from '../presentation/components/SceneErrorBoundary'
import { BackendEvaluationPanel } from '../presentation/panels/BackendEvaluationPanel'
import { CatalogRegistrationPanel } from '../presentation/panels/CatalogRegistrationPanel'
import { CatalogSelectionPanel } from '../presentation/panels/CatalogSelectionPanel'
import { type CraneControlKey, CraneControlPanel } from '../presentation/panels/CraneControlPanel'
import { EvaluationInputPanel } from '../presentation/panels/EvaluationInputPanel'
import { OperationalGeometryPanel } from '../presentation/panels/OperationalGeometryPanel'
import type { CraneCommands, CraneState } from '../three/crane/types'
import { chooseCraneSetup } from './craneSetup'
import { buildEvaluationInput } from './evaluationInput'
import { useCatalogBrowser } from './useCatalogBrowser'
import { useEvaluationSession } from './useEvaluationSession'
import './App.css'

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

export default function App() {
  const [crane, setCrane] = useState<CraneBinding | null>(null)
  const [loadWeightText, setLoadWeightText] = useState('')
  const { session, state: evaluation } = useEvaluationSession()
  const { catalog, state: catalogState } = useCatalogBrowser()

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

  return (
    <div className="app">
      <header className="app__header">
        <h1>Simulador de Tabelas de Carga de Guindastes</h1>
        <p>
          Prova de conceito da cena 3D. O resultado que vale é o do backend; a geometria do painel
          de pré-visualização é calculada no navegador (ADR-013). Arraste para girar a câmera; role
          para aproximar.
        </p>
      </header>
      <main className="app__main">
        <SceneErrorBoundary
          fallback={
            <div className="crane-viewport">
              <p className="crane-viewport__error" role="alert">
                Não foi possível iniciar a cena 3D. Verifique se o navegador oferece WebGL.
              </p>
            </div>
          }
        >
          <CraneViewport setup={craneSetup.setup} onCraneChange={handleCraneChange} />
        </SceneErrorBoundary>
        <aside className="app__sidebar">
          <CatalogSelectionPanel
            manufacturers={catalogState.manufacturers}
            cranes={catalogState.cranes}
            configurations={catalogState.configurations}
            selectedManufacturerId={catalogState.selectedManufacturerId}
            selectedCraneId={catalogState.selectedCraneId}
            selectedConfigurationId={catalogState.selectedConfigurationId}
            onSelectManufacturer={(id) => void catalog.selectManufacturer(id)}
            onSelectCrane={(id) => void catalog.selectCrane(id)}
            onSelectConfiguration={(id) => catalog.selectConfiguration(id)}
          />
          <CraneControlPanel
            limits={crane?.commands.limits ?? null}
            state={crane?.state ?? null}
            notice={craneSetup.notice}
            notes={craneSetup.notes}
            onChange={handleControlChange}
          />
          <EvaluationInputPanel
            loadWeightText={loadWeightText}
            onLoadWeightTextChange={setLoadWeightText}
          />
          <BackendEvaluationPanel
            connectionStatus={evaluation.connectionStatus}
            result={evaluation.result}
            error={evaluation.error}
            pending={evaluation.pending}
            transport={evaluation.transport}
            inputProblem={evaluationInput.problem}
          />
          <OperationalGeometryPanel
            geometry={crane?.geometry ?? null}
            parameters={crane?.commands.geometryParameters ?? null}
            parametersFromSheet={craneSetup.fromSheet}
          />
          {/*
            PONTO DE ENCAIXE DA TASK-034 (importação/ativação de tabela de carga): os painéis novos
            entram aqui, recebendo `selectedConfiguration` (a configuração escolhida, com `id` e
            `geometry`, ou `null`). Não é preciso mexer no resto deste arquivo.
          */}
          <CatalogRegistrationPanel
            selectedManufacturer={selectedManufacturer}
            selectedCrane={selectedCrane}
            onCreateManufacturer={(name) => catalog.createManufacturer(name)}
            onCreateCrane={(manufacturerId, modelName) =>
              catalog.createCrane(manufacturerId, modelName)
            }
            onCreateConfiguration={(craneId, name, geometry) =>
              catalog.createConfiguration(craneId, name, geometry)
            }
          />
        </aside>
      </main>
    </div>
  )
}
