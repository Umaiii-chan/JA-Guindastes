import { useCallback, useState } from 'react'

import { CraneViewport } from '../presentation/components/CraneViewport'
import { SceneErrorBoundary } from '../presentation/components/SceneErrorBoundary'
import { type CraneControlKey, CraneControlPanel } from '../presentation/panels/CraneControlPanel'
import type { CraneCommands, CraneState } from '../three/crane/types'
import './App.css'

interface CraneBinding {
  readonly commands: CraneCommands
  /** Cópia do estado aplicado na cena, para a UI mostrar o valor já limitado pelo controller. */
  readonly state: CraneState
}

const APPLY_COMMAND: Record<CraneControlKey, (commands: CraneCommands, value: number) => void> = {
  turretRotationDeg: (commands, value) => commands.setTurretRotation(value),
  boomAngleDeg: (commands, value) => commands.setBoomAngle(value),
  boomLengthM: (commands, value) => commands.setBoomLength(value),
  cableLengthM: (commands, value) => commands.setCableLength(value),
}

export default function App() {
  const [crane, setCrane] = useState<CraneBinding | null>(null)

  const handleCraneChange = useCallback((commands: CraneCommands | null) => {
    setCrane(commands ? { commands, state: commands.getState() } : null)
  }, [])

  const handleControlChange = (key: CraneControlKey, value: number) => {
    if (!crane) return
    APPLY_COMMAND[key](crane.commands, value)
    setCrane({ commands: crane.commands, state: crane.commands.getState() })
  }

  return (
    <div className="app">
      <header className="app__header">
        <h1>Simulador de Tabelas de Carga de Guindastes</h1>
        <p>
          Prova de conceito da cena 3D (TASK-013). Arraste para girar a câmera; role para aproximar.
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
          <CraneViewport onCraneChange={handleCraneChange} />
        </SceneErrorBoundary>
        <CraneControlPanel
          limits={crane?.commands.limits ?? null}
          state={crane?.state ?? null}
          onChange={handleControlChange}
        />
      </main>
    </div>
  )
}
