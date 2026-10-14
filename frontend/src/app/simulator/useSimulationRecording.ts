// Gravação, lista e reprodução de simulações para o simulador (TASK-057; ADR-027; RN-005).
//
// É o único ponto de ligação com a tela: o `SimulatorRoute` passa o retrato atual do simulador
// (`snapshot`) e recebe o estado do painel e, durante a reprodução, o quadro gravado
// (`playbackFrame`). Gravar e reproduzir não acontecem juntos: abrir uma gravação exige não estar
// gravando, e gravar exige a reprodução fechada. Durante a reprodução nada é reavaliado (RN-008).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  advancePosition,
  frameIndexAt,
  interpolateCraneState,
  loadChartRefsOf,
  timelineMarkers,
} from '../../application/recording/playback'
import {
  RecordingRequestError,
  type SimulationRecordingGateway,
} from '../../application/recording/ports'
import {
  PLAYBACK_SPEEDS,
  type PlaybackSpeed,
  type RecordedSimulation,
  type RecordingFrame,
  type RecordingSnapshot,
  type SimulationRecording,
  type SimulationRecordingSummary,
  type TimelineMarker,
} from '../../application/recording/recording'
import { SimulationRecorder } from '../../application/recording/SimulationRecorder'
import type { ScenarioSpec } from '../../domain/environment/environment'
import type { CraneState } from '../../three/crane/types'
import { createSimulationRecordingRestClient } from '../../infrastructure/api/simulationRecordingRestClient'

const TICK_MS = 100
/**
 * Intervalo mínimo (ms) entre duas atualizações do estado React durante a reprodução (~5 Hz): a
 * cena 3D segue a cada quadro de animação, mas a tela (posição, números, `setCrane`) não precisa.
 */
export const PLAYBACK_UI_REFRESH_MS = 200

export interface UseSimulationRecordingOptions {
  /** Retrato atual do simulador; `null` enquanto a cena ou a configuração não estão prontas. */
  readonly snapshot: RecordingSnapshot | null
  /** Cópia do cenário (TASK-052); opcional enquanto ela não integra. */
  readonly scenario?: ScenarioSpec
  /** Persistência injetável (testes). Padrão: o cliente REST. */
  readonly gateway?: SimulationRecordingGateway
  /** Relógio injetável (testes). */
  readonly now?: () => number
  /**
   * Chamado a cada quadro de animação da reprodução (e ao abrir, buscar ou pausar). `frame` é o
   * quadro gravado vigente (carga, resultado) e `crane` a pose interpolada entre ele e o seguinte.
   * A tela o usa para pôr o guindaste na pose gravada. `uiRefresh` é `true` no máximo a ~5 Hz (e
   * sempre que não está tocando): só então o estado React deve ser atualizado. Não é chamado fora
   * da reprodução.
   */
  readonly onFrame?: (frame: RecordingFrame, crane: CraneState, uiRefresh: boolean) => void
}

export interface RecorderView {
  readonly status: 'idle' | 'recording' | 'stopped'
  readonly elapsedMs: number
  readonly frameCount: number
  /** Gravação parada, esperando nome para ser salva. */
  readonly draft: RecordedSimulation | null
  readonly saving: boolean
  readonly error: string | null
  readonly canStart: boolean
  start(): void
  stop(): void
  save(name: string): Promise<boolean>
  discard(): void
}

export interface ListView {
  readonly items: readonly SimulationRecordingSummary[]
  readonly status: 'idle' | 'loading' | 'ready' | 'error'
  readonly error: string | null
  refresh(): Promise<void>
  open(id: string): Promise<void>
  remove(id: string): Promise<void>
}

export interface PlayerView {
  readonly recording: SimulationRecording | null
  readonly positionMs: number
  readonly playing: boolean
  readonly speed: PlaybackSpeed
  readonly markers: readonly TimelineMarker[]
  play(): void
  pause(): void
  seek(positionMs: number): void
  setSpeed(speed: PlaybackSpeed): void
  close(): void
}

export interface SimulationRecordingController {
  readonly recorder: RecorderView
  readonly list: ListView
  readonly player: PlayerView
  /** Quadro mostrado na reprodução; `null` fora dela. Com um quadro, o simulador fica travado. */
  readonly playbackFrame: RecordingFrame | null
}

function messageOf(error: unknown): string {
  if (error instanceof RecordingRequestError) return error.message
  return 'Não foi possível concluir a operação com as gravações.'
}

export function useSimulationRecording(
  options: UseSimulationRecordingOptions,
): SimulationRecordingController {
  const { snapshot, scenario } = options
  // Relógio e persistência são fixados na montagem (injeção só nos testes).
  const [clock] = useState(() => options.now ?? (() => performance.now()))
  const [gateway] = useState(() => options.gateway ?? createSimulationRecordingRestClient())
  const clockRef = useRef(clock)
  const onFrameRef = useRef(options.onFrame)
  useEffect(() => {
    onFrameRef.current = options.onFrame
  }, [options.onFrame])
  const gatewayRef = useRef(gateway)

  // --- Gravador --------------------------------------------------------------------------------
  const recorderRef = useRef<SimulationRecorder | null>(null)
  const [recStatus, setRecStatus] = useState<RecorderView['status']>('idle')
  const [elapsedMs, setElapsedMs] = useState(0)
  const [frameCount, setFrameCount] = useState(0)
  const [draft, setDraft] = useState<RecordedSimulation | null>(null)
  const [saving, setSaving] = useState(false)
  const [recError, setRecError] = useState<string | null>(null)

  // --- Lista e player --------------------------------------------------------------------------
  const [items, setItems] = useState<readonly SimulationRecordingSummary[]>([])
  const [listStatus, setListStatus] = useState<ListView['status']>('idle')
  const [listError, setListError] = useState<string | null>(null)
  const [opened, setOpened] = useState<SimulationRecording | null>(null)
  const [positionMs, setPositionMs] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeedState] = useState<PlaybackSpeed>(1)
  // Posição de verdade da reprodução (a cada quadro de animação); `positionMs` é a cópia para a
  // tela, atualizada a ~5 Hz. Quem muda uma muda a outra.
  const positionRef = useRef(0)

  const emitFrame = useCallback((recording: SimulationRecording, ms: number, uiRefresh = true) => {
    const frame = recording.frames[frameIndexAt(recording.frames, ms)]
    const crane = interpolateCraneState(recording.frames, ms)
    if (frame && crane) onFrameRef.current?.(frame, crane, uiRefresh)
  }, [])

  const finishRecording = useCallback((by?: RecordedSimulation['stoppedBy']) => {
    const recorder = recorderRef.current
    if (!recorder || !recorder.isRecording) return
    const result = recorder.stop(clockRef.current(), by)
    recorderRef.current = null
    setDraft(result)
    setFrameCount(result.frames.length)
    setElapsedMs(result.durationMs)
    setRecStatus('stopped')
  }, [])

  // Cada mudança do retrato vira, no máximo, um quadro (10 Hz); o intervalo grava o pendente e
  // percebe os limites de duração e de tamanho.
  useEffect(() => {
    const recorder = recorderRef.current
    if (recStatus !== 'recording' || !recorder || snapshot === null) return
    recorder.record(snapshot, clockRef.current())
    setFrameCount(recorder.frameCount)
  }, [snapshot, recStatus])

  useEffect(() => {
    if (recStatus !== 'recording') return
    const timer = window.setInterval(() => {
      const recorder = recorderRef.current
      if (!recorder) return
      const now = clockRef.current()
      recorder.flush(now)
      setFrameCount(recorder.frameCount)
      setElapsedMs(recorder.elapsedMs(now))
      if (recorder.limitReached !== null) finishRecording()
    }, TICK_MS)
    return () => window.clearInterval(timer)
  }, [recStatus, finishRecording])

  const start = useCallback(() => {
    if (snapshot === null || opened !== null) return
    const recorder = new SimulationRecorder({ scenario })
    recorder.start(snapshot, clockRef.current())
    recorderRef.current = recorder
    setDraft(null)
    setRecError(null)
    setElapsedMs(0)
    setFrameCount(recorder.frameCount)
    setRecStatus('recording')
  }, [snapshot, scenario, opened])

  const stop = useCallback(() => finishRecording('user'), [finishRecording])

  const save = useCallback(
    async (name: string): Promise<boolean> => {
      if (draft === null || snapshot === null) return false
      const trimmed = name.trim()
      if (trimmed === '') {
        setRecError('Informe um nome para a gravação.')
        return false
      }
      setSaving(true)
      setRecError(null)
      try {
        const first = draft.frames[0]
        const created = await gatewayRef.current.create({
          name: trimmed,
          configurationId: first.configurationId,
          durationMs: draft.durationMs,
          loadChartRefs: loadChartRefsOf(draft.frames),
          scenario: draft.scenario,
          frames: draft.frames,
        })
        setItems((current) => [created, ...current.filter((item) => item.id !== created.id)])
        setDraft(null)
        setRecStatus('idle')
        setElapsedMs(0)
        setFrameCount(0)
        return true
      } catch (error) {
        setRecError(messageOf(error))
        return false
      } finally {
        setSaving(false)
      }
    },
    [draft, snapshot],
  )

  const discard = useCallback(() => {
    setDraft(null)
    setRecError(null)
    setRecStatus('idle')
    setElapsedMs(0)
    setFrameCount(0)
  }, [])

  const refresh = useCallback(async () => {
    setListStatus('loading')
    setListError(null)
    try {
      setItems(await gatewayRef.current.list())
      setListStatus('ready')
    } catch (error) {
      setListError(messageOf(error))
      setListStatus('error')
    }
  }, [])

  const open = useCallback(
    async (id: string) => {
      if (recorderRef.current?.isRecording) return
      setListError(null)
      try {
        const recording = await gatewayRef.current.open(id)
        if (recording.frames.length === 0) {
          setListError('A gravação não tem quadros.')
          return
        }
        setOpened(recording)
        positionRef.current = 0
        setPositionMs(0)
        emitFrame(recording, 0)
        setPlaying(false)
      } catch (error) {
        setListError(messageOf(error))
      }
    },
    [emitFrame],
  )

  const remove = useCallback(async (id: string) => {
    setListError(null)
    try {
      await gatewayRef.current.remove(id)
      setItems((current) => current.filter((item) => item.id !== id))
      setOpened((current) => (current?.id === id ? null : current))
    } catch (error) {
      setListError(messageOf(error))
    }
  }, [])

  // --- Reprodução: só escolhe o quadro; o relógio de parede move a posição ---------------------
  useEffect(() => {
    if (!playing || opened === null) return
    let handle = 0
    let last = clockRef.current()
    let lastUiRefresh = Number.NEGATIVE_INFINITY
    const step = () => {
      const now = clockRef.current()
      const next = advancePosition(positionRef.current, now - last, speed, opened.durationMs)
      last = now
      positionRef.current = next.positionMs
      // A cena anda a cada quadro; o estado React só a ~5 Hz (e no fim).
      const uiRefresh = next.ended || now - lastUiRefresh >= PLAYBACK_UI_REFRESH_MS
      if (uiRefresh) {
        lastUiRefresh = now
        setPositionMs(next.positionMs)
      }
      emitFrame(opened, next.positionMs, uiRefresh)
      if (next.ended) setPlaying(false)
      else handle = window.requestAnimationFrame(step)
    }
    handle = window.requestAnimationFrame(step)
    return () => window.cancelAnimationFrame(handle)
  }, [playing, speed, opened, emitFrame])

  const play = useCallback(() => {
    if (opened === null) return
    // No fim, tocar de novo recomeça.
    if (positionRef.current >= opened.durationMs) {
      positionRef.current = 0
      setPositionMs(0)
      emitFrame(opened, 0)
    }
    setPlaying(true)
  }, [opened, emitFrame])
  const pause = useCallback(() => {
    setPlaying(false)
    // Sincroniza a tela com a posição exata em que parou.
    if (opened) {
      setPositionMs(positionRef.current)
      emitFrame(opened, positionRef.current)
    }
  }, [opened, emitFrame])
  const seek = useCallback(
    (value: number) => {
      const bounded = Math.min(Math.max(0, value), opened?.durationMs ?? 0)
      positionRef.current = bounded
      setPositionMs(bounded)
      if (opened) emitFrame(opened, bounded)
    },
    [opened, emitFrame],
  )
  const setSpeed = useCallback((value: PlaybackSpeed) => {
    if (PLAYBACK_SPEEDS.includes(value)) setSpeedState(value)
  }, [])
  const close = useCallback(() => {
    setPlaying(false)
    setOpened(null)
    positionRef.current = 0
    setPositionMs(0)
  }, [])

  const markers = useMemo(() => (opened ? timelineMarkers(opened.frames) : []), [opened])
  const playbackFrame = useMemo(() => {
    if (opened === null) return null
    return opened.frames[frameIndexAt(opened.frames, positionMs)] ?? null
  }, [opened, positionMs])

  return {
    recorder: {
      status: recStatus,
      elapsedMs,
      frameCount,
      draft,
      saving,
      error: recError,
      canStart: snapshot !== null && opened === null && recStatus === 'idle',
      start,
      stop,
      save,
      discard,
    },
    list: { items, status: listStatus, error: listError, refresh, open, remove },
    player: {
      recording: opened,
      positionMs,
      playing,
      speed,
      markers,
      play,
      pause,
      seek,
      setSpeed,
      close,
    },
    playbackFrame,
  }
}
