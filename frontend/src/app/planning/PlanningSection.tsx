// Seção "Planejar operação" do simulador (TASK-075; ADR-038): liga o painel ao backend (recomendação),
// ao cenário (coleta, entrega e posição do guindaste), ao catálogo (configuração recomendada) e à
// cena (execução da trajetória e passo a passo). Capacidade e risco vêm só do backend (RN-008).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  buildGuideSteps,
  guideActions,
  guideStepDoneText,
  guideStepTitle,
  placementReached,
  reachedGuideTarget,
} from '../../application/planning/stepGuide'
import { DEFAULT_CARGO, DEFAULT_DELIVERY } from '../../application/planning/planningPoints'
import { trajectoryOfCrane } from '../../application/planning/trajectoryPlayback'
import type { CargoPlacement, DeliveryPlacement } from '../../domain/environment/environment'
import type { PlanCraneState, PlanningRequest } from '../../domain/planning/planning'
import { PlanningPanel } from '../../presentation/simulator/PlanningPanel'
import type { CraneCommands, CraneState } from '../../three/crane/types'
import { useCatalog } from '../catalog/catalogContext'
import { useScenario } from '../scenario/scenarioContext'
import { applyPlanState, PLAYBACK_SPEEDS, usePlanPlayback } from './usePlanPlayback'
import { usePlanning } from './usePlanning'

export interface PlanningSectionProps {
  /** Carga do passo 2, ou `null` enquanto o formulário não for válido. */
  readonly load: {
    readonly weightKg: number
    readonly lengthM: number
    readonly widthM: number
    readonly heightM: number
  } | null
  readonly accessoryIds: readonly string[]
  /** Estado do guindaste na cena, ou `null` sem cena. */
  readonly craneState: CraneState | null
  /** Comandos da cena agora; mudam quando a cena é montada de novo (outra configuração). */
  readonly commands: CraneCommands | null
  /** Avisa a tela de que o guindaste foi mexido pelo planejamento. */
  onCraneMoved(): void
  onPlaybackChange(playing: boolean): void
  /** Deixa as patolas estendidas e apoiadas, como o planejamento pressupõe. */
  onExtendOutriggers(): void
  /** Do gancho ao ponto de amarração das lingas, medido na cena; `null` sem cena. */
  getHookAttachM(): number | null
  /** A reprodução de uma gravação trava o simulador. */
  readonly disabled: boolean
}

export function PlanningSection({
  load,
  accessoryIds,
  craneState,
  commands,
  onCraneMoved,
  onPlaybackChange,
  onExtendOutriggers,
  getHookAttachM,
  disabled,
}: PlanningSectionProps) {
  const scenario = useScenario()
  const { catalog, state: catalogState } = useCatalog()
  const planning = usePlanning()
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [applying, setApplying] = useState(false)
  // Estado inicial a aplicar quando a cena nova (outra configuração) entregar os comandos.
  const pendingStart = useRef<PlanCraneState | null>(null)
  const [guideActive, setGuideActive] = useState(false)
  const [guideIndex, setGuideIndex] = useState(0)

  const pick = scenario.spec.cargo ?? DEFAULT_CARGO
  const delivery = scenario.spec.delivery ?? DEFAULT_DELIVERY
  const recommendations = planning.state.result?.recommendations ?? []
  const selected = recommendations[selectedIndex]
  const points = useMemo(
    () => (selected ? trajectoryOfCrane(selected.trajectory, 0) : []),
    [selected],
  )
  const steps = useMemo(() => (selected ? buildGuideSteps(selected.trajectory, 0) : []), [selected])
  const placement = selected?.placements[0]
  const detail = selected?.details[0]

  const commandsRef = useRef(commands)
  useEffect(() => {
    commandsRef.current = commands
  })
  const playback = usePlanPlayback({
    points,
    getCommands: () => commandsRef.current,
    onMoved: onCraneMoved,
    onPlayingChange: onPlaybackChange,
  })

  const applied =
    placement !== undefined &&
    detail !== undefined &&
    catalogState.selectedConfigurationId === detail.configurationId &&
    placementReached(scenario.spec.crane, placement)

  // Depois de trocar a configuração, a cena é montada de novo: o estado inicial entra nos comandos novos.
  useEffect(() => {
    if (pendingStart.current === null || commands === null) return
    applyPlanState(commands, pendingStart.current)
    pendingStart.current = null
    onCraneMoved()
  }, [commands, onCraneMoved])

  const setPick = (changes: Partial<CargoPlacement>) =>
    scenario.setSpec({ ...scenario.getSpec(), cargo: { ...pick, ...changes } })
  const setDelivery = (changes: Partial<DeliveryPlacement>) =>
    scenario.setSpec({ ...scenario.getSpec(), delivery: { ...delivery, ...changes } })

  const plan = () => {
    if (!load) return
    // Os pontos entram no cenário (e na cena) assim que são usados.
    const current = scenario.getSpec()
    const spec = { ...current, cargo: pick, delivery }
    if (current.cargo === undefined || current.delivery === undefined) scenario.setSpec(spec)
    const hookAttachM = getHookAttachM()
    const request: PlanningRequest = {
      load,
      pick: { x: pick.x, z: pick.z, rotationYDeg: pick.rotationYDeg },
      delivery: { x: delivery.x, z: delivery.z, rotationYDeg: delivery.rotationYDeg },
      scenario: spec,
      accessoryIds,
      ...(hookAttachM === null ? {} : { hookAttachM }),
    }
    playback.stop()
    setGuideActive(false)
    setSelectedIndex(0)
    void planning.plan(request)
  }

  const apply = async () => {
    if (!selected || !placement || !detail) return
    playback.stop()
    setApplying(true)
    try {
      if (catalogState.selectedConfigurationId !== detail.configurationId) {
        await catalog.selectManufacturer(detail.manufacturerId)
        await catalog.selectCrane(detail.craneId)
        catalog.selectConfiguration(detail.configurationId)
      }
      scenario.setSpec({
        ...scenario.getSpec(),
        crane: { x: placement.x, z: placement.z, headingDeg: placement.headingDeg },
      })
      onExtendOutriggers()
      const start = points[0]?.state
      if (start) {
        if (
          commandsRef.current &&
          catalogState.selectedConfigurationId === detail.configurationId
        ) {
          applyPlanState(commandsRef.current, start)
          onCraneMoved()
        } else {
          pendingStart.current = start
        }
      }
    } finally {
      setApplying(false)
    }
  }

  // ----- passo a passo -----

  const total = steps.length + 1
  const stepIndex = Math.min(guideIndex, total)
  const finished = guideActive && stepIndex >= total
  const guideStep = stepIndex >= 1 ? steps[stepIndex - 1] : undefined

  const guideReached =
    stepIndex === 0
      ? applied
      : guideStep !== undefined && craneState !== null && reachedGuideTarget(guideStep, craneState)
  // Chegou ao estado do passo (dentro da tolerância): vai para o seguinte. Se o guindaste já está no
  // estado de um passo mais adiante (a trajetória foi executada, ou a pessoa se adiantou), pula para
  // depois dele. O passo de soltar a carga só termina quando a pessoa confirma.
  if (guideActive && !finished) {
    let advanceTo = stepIndex
    if (stepIndex === 0) {
      if (applied) advanceTo = 1
    } else if (craneState) {
      for (let index = steps.length; index >= stepIndex; index -= 1) {
        const candidate = steps[index - 1]
        if (candidate && !candidate.manual && reachedGuideTarget(candidate, craneState)) {
          advanceTo = index + 1
          break
        }
      }
    }
    if (advanceTo !== stepIndex) setGuideIndex(advanceTo)
  }
  const guideActionsList = (): readonly string[] => {
    if (stepIndex === 0 && placement && detail) {
      if (catalogState.selectedConfigurationId !== detail.configurationId) {
        return [`Escolha o guindaste ${detail.label}`]
      }
      const meters = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
      return [
        `Posicione o guindaste em X ${meters(placement.x)} m, Z ${meters(placement.z)} m, rumo ${placement.headingDeg.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}°`,
      ]
    }
    return guideStep && craneState ? guideActions(guideStep, craneState) : []
  }

  const startGuide = useCallback(() => {
    playback.stop()
    setGuideIndex(0)
    setGuideActive(true)
  }, [playback])

  const guide = {
    active: guideActive,
    finished,
    counter: `Passo ${Math.min(stepIndex + 1, total)} de ${total}`,
    title: stepIndex === 0 ? 'Posicionar' : guideStep ? guideStepTitle(guideStep) : '',
    actions: guideActionsList(),
    doneText:
      stepIndex === 0 ? 'Guindaste posicionado.' : guideStep ? guideStepDoneText(guideStep) : '',
    reached: guideReached,
    manual: guideStep?.manual ?? false,
    onStart: startGuide,
    onExit: () => setGuideActive(false),
    onConfirm: () => setGuideIndex(stepIndex + 1),
    onSkip: () => setGuideIndex(stepIndex + 1),
    onPrevious: () => setGuideIndex(Math.max(0, stepIndex - 1)),
  }

  return (
    <PlanningPanel
      pick={pick}
      delivery={delivery}
      onPickChange={setPick}
      onDeliveryChange={setDelivery}
      loadReady={load !== null}
      status={planning.state.status}
      error={planning.state.error}
      result={planning.state.result}
      selectedIndex={selectedIndex}
      onSelect={(index) => {
        playback.stop()
        setGuideActive(false)
        setSelectedIndex(index)
      }}
      onPlan={plan}
      onApply={() => void apply()}
      applying={applying}
      applied={applied}
      canRun={!disabled && commands !== null}
      playback={{
        playing: playback.playing,
        progress: playback.progress,
        phase: playback.phase,
        speed: playback.speed,
        speeds: PLAYBACK_SPEEDS,
        onSpeed: playback.setSpeed,
        onStart: playback.start,
        onStop: playback.stop,
      }}
      guide={guide}
    />
  )
}
