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
import type { CargoPlacement, DeliveryPoint } from '../../domain/environment/environment'
import type { PlanCraneState, PlanningRequest } from '../../domain/planning/planning'
import { typingInControl } from '../../presentation/simulator/typingInControl'
import { PlanningPanel } from '../../presentation/simulator/PlanningPanel'
import type { CraneCommands, CraneState } from '../../three/crane/types'
import { useCatalog } from '../catalog/catalogContext'
import { useScenario } from '../scenario/scenarioContext'
import { applyRecommendationToScenario } from '../../application/planning/applyRecommendation'
import { applyPlanState, PLAYBACK_SPEEDS, startsPhase, usePlanPlayback } from './usePlanPlayback'
import { usePlanning } from './usePlanning'

export interface PlanningSectionProps {
  /** Carga do passo 2, ou `null` enquanto o formulário não for válido. */
  readonly load: {
    readonly weightKg: number
    readonly lengthM: number
    readonly widthM: number
    readonly heightM: number
    /** Centro de gravidade ao longo do comprimento (m), da tela de Carga; ausente = no centro. */
    readonly cgOffsetM?: number
  } | null
  readonly accessoryIds: readonly string[]
  /** Estado do guindaste na cena, ou `null` sem cena. */
  readonly craneState: CraneState | null
  /** Comandos da cena agora; mudam quando a cena é montada de novo (outra configuração). */
  readonly commands: CraneCommands | null
  /** Avisa a tela de que o guindaste foi mexido pelo planejamento. */
  onCraneMoved(): void
  onPlaybackChange(playing: boolean): void
  /** Intervalo (ms) entre avisos à tela durante a trajetória (mais curto enquanto grava). */
  readonly refreshMs?: number
  /** Deixa as patolas estendidas e apoiadas, como o planejamento pressupõe. */
  onExtendOutriggers(): void
  /**
   * Comandos do Guindaste 2 (o seguidor do tandem) e se os dois ganchos já estão presos à carga, para
   * a trajetória mover também o Guindaste 2 (TASK-125); `null` sem segundo guindaste.
   */
  getFollower?(): { readonly commands: CraneCommands | null; readonly engaged: boolean } | null
  /** Do gancho ao ponto de amarração das lingas, medido na cena; `null` sem cena. */
  getHookAttachM(): number | null
  /**
   * Devolve a carga ao ponto de coleta para simular de novo (TASK-119): no guindaste só, a carga volta ao
   * chão (ou à carroceria) de origem; no tandem, a posição da carga no cenário volta à da coleta.
   */
  onResetCargo(): void
  /**
   * Engata a carga (TASK-073) ou, no tandem, os dois guindastes (TASK-074), no quadro "Engatar" da
   * trajetória. Devolve `null` se engatou, ou o motivo; com motivo, a execução para.
   */
  onEngage?(tandem: boolean): string | null
  /** Solta a carga no quadro "Soltar"; devolve `null` ou o motivo, como `onEngage`. */
  onRelease?(tandem: boolean): string | null
  /**
   * Avisa que uma recomendação foi aplicada: a tela liga o içamento com dois guindastes quando é um
   * tandem (e desliga quando é um guindaste só), para a trajetória engatar e mover os dois (TASK-120).
   */
  onApplied?(kind: 'single' | 'tandem'): void
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
  refreshMs,
  onExtendOutriggers,
  getHookAttachM,
  getFollower,
  onResetCargo,
  onEngage,
  onRelease,
  onApplied,
  disabled,
}: PlanningSectionProps) {
  const scenario = useScenario()
  const { catalog, state: catalogState } = useCatalog()
  const planning = usePlanning()
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [applying, setApplying] = useState(false)
  // Motivo de a trajetória ter parado ao engatar ou soltar (null = nada a avisar).
  const [operationMessage, setOperationMessage] = useState<string | null>(null)
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
  // Tandem planejado: os quadros do Guindaste 2 (índice 1) tocam junto com os do 1 (TASK-125).
  const followerPoints = useMemo(
    () => (selected?.kind === 'tandem' ? trajectoryOfCrane(selected.trajectory, 1) : []),
    [selected],
  )
  const followerRef = useRef(getFollower)
  useEffect(() => {
    followerRef.current = getFollower
  })
  const playback = usePlanPlayback({
    points,
    ...(followerPoints.length > 0
      ? {
          follower: {
            points: followerPoints,
            getCommands: () => followerRef.current?.()?.commands ?? null,
            isEngaged: () => followerRef.current?.()?.engaged ?? false,
          },
        }
      : {}),
    getCommands: () => commandsRef.current,
    onMoved: onCraneMoved,
    onPlayingChange: onPlaybackChange,
    refreshMs,
    // Coleta e entrega (TASK-073): a trajetória engata no quadro "Engatar" e solta no "Soltar".
    onKeyframe: (point) => {
      // O planejador gera dois quadros "engatar" seguidos (chegar e segurar): só o primeiro de cada
      // fase engata ou solta. Antes, o segundo tentava engatar a carga já no gancho e parava.
      if (!startsPhase(points, point)) return false
      const tandem = selected?.kind === 'tandem'
      const problem =
        point.phase === 'engatar'
          ? (onEngage?.(tandem) ?? null)
          : point.phase === 'soltar'
            ? (onRelease?.(tandem) ?? null)
            : null
      if (problem === null) return false
      setOperationMessage(problem)
      return true
    },
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
  const setDelivery = (changes: Partial<DeliveryPoint>) =>
    scenario.setSpec({ ...scenario.getSpec(), delivery: { ...delivery, ...changes } })

  const plan = () => {
    if (!load) return
    // Os pontos entram no cenário (e na cena) assim que são usados.
    const current = scenario.getSpec()
    const spec = { ...current, cargo: pick, delivery }
    if (current.cargo === undefined || current.delivery === undefined) scenario.setSpec(spec)
    const hookAttachM = getHookAttachM()
    const request: PlanningRequest = {
      // Com o CG da Carga, o tandem divide a carga pela alavanca (RN-016; TASK-089, F-03).
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
      // No tandem, o Guindaste 2 (TASK-074) também vai para a posição recomendada.
      scenario.setSpec(applyRecommendationToScenario(scenario.getSpec(), selected))
      onApplied?.(selected.kind)
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
      const second = selected?.kind === 'tandem' ? selected.placements[1] : undefined
      const place = (name: string, target: { x: number; z: number; headingDeg: number }) =>
        `Posicione o ${name} em X ${meters(target.x)} m, Z ${meters(target.z)} m, rumo ${target.headingDeg.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}°`
      return [
        place(second ? 'Guindaste 1' : 'guindaste', placement),
        ...(second ? [place('Guindaste 2', second)] : []),
      ]
    }
    return guideStep && craneState ? guideActions(guideStep, craneState) : []
  }

  const startGuide = useCallback(() => {
    playback.stop()
    setGuideIndex(0)
    setGuideActive(true)
  }, [playback])

  // Simular de novo (TASK-119): a carga volta à coleta, o guindaste ao estado inicial da trajetória
  // (se a recomendação está aplicada) e o passo a passo ao primeiro passo.
  const restartStart = points[0]?.state
  const restart = () => {
    playback.reset()
    setOperationMessage(null)
    onResetCargo()
    if (applied && restartStart && commandsRef.current) {
      applyPlanState(commandsRef.current, restartStart)
      onCraneMoved()
    }
    setGuideIndex(0)
  }
  const restartRef = useRef(restart)
  useEffect(() => {
    restartRef.current = restart
  })
  const canRestart = selected !== undefined && !disabled && !applying && commands !== null
  useEffect(() => {
    if (!canRestart) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'r') return
      if (event.defaultPrevented || event.repeat) return
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      if (typingInControl(event.target)) return
      if (document.querySelector('[aria-modal="true"]')) return
      event.preventDefault()
      restartRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [canRestart])

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
      operationMessage={operationMessage}
      applying={applying}
      applied={applied}
      canRun={!disabled && commands !== null}
      onRestart={() => restartRef.current()}
      playback={{
        playing: playback.playing,
        progress: playback.progress,
        phase: playback.phase,
        speed: playback.speed,
        speeds: PLAYBACK_SPEEDS,
        onSpeed: playback.setSpeed,
        onStart: () => {
          setOperationMessage(null)
          playback.start()
        },
        onStop: playback.stop,
      }}
      guide={guide}
    />
  )
}
