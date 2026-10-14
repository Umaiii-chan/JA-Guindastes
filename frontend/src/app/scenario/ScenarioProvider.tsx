import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { scenarioGroundSlopeDeg } from '../../application/environment/scenarioEditing'
import type { ScenarioGateway, ScenarioSummary } from '../../application/environment/ports'
import { EMPTY_SCENARIO, type ScenarioSpec } from '../../domain/environment/environment'
import { createScenarioRestClient } from '../../infrastructure/api/scenarioRestClient'
import {
  ScenarioContext,
  type ScenarioContextValue,
  type ScenarioListStatus,
} from './scenarioContext'

/** Quantos gestos do editor o desfazer guarda. */
const UNDO_LIMIT = 50

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Falha inesperada ao falar com o servidor.'
}

function summaryOf(scenario: ScenarioSummary): ScenarioSummary {
  const { id, name, authorUserId, createdAt, updatedAt } = scenario
  return { id, name, authorUserId, createdAt, updatedAt }
}

/**
 * Guarda o cenário em edição e conversa com `/api/v1/scenarios`. Montado dentro do escopo da sessão
 * (só com usuário logado ou sem autenticação): a lista de cenários só é pedida quando o painel
 * "Ambiente" pede (`refresh`), para não gerar chamadas em páginas que não usam cenário.
 */
export function ScenarioProvider({
  children,
  gateway,
}: {
  readonly children: ReactNode
  /** Cliente REST injetável (testes). Padrão: `createScenarioRestClient()`. */
  readonly gateway?: ScenarioGateway
}) {
  const client = useMemo(() => gateway ?? createScenarioRestClient(), [gateway])
  const [spec, setSpecState] = useState<ScenarioSpec>(EMPTY_SCENARIO)
  // Cenário mais recente, já na hora do `setSpec` (o editor 3D lê entre uma renderização e outra), e
  // a pilha de desfazer dos gestos do editor (TASK-066).
  const specRef = useRef<ScenarioSpec>(EMPTY_SCENARIO)
  const historyRef = useRef<ScenarioSpec[]>([])
  const [undoDepth, setUndoDepth] = useState(0)
  const [saved, setSaved] = useState<{
    readonly summary: ScenarioSummary
    readonly spec: ScenarioSpec
  } | null>(null)
  const [scenarios, setScenarios] = useState<readonly ScenarioSummary[]>([])
  const [listStatus, setListStatus] = useState<ScenarioListStatus>('idle')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const setSpec = useCallback((next: ScenarioSpec) => {
    specRef.current = next
    setSpecState(next)
    setInfo(null)
  }, [])

  const getSpec = useCallback(() => specRef.current, [])

  const clearHistory = useCallback(() => {
    historyRef.current = []
    setUndoDepth(0)
  }, [])

  const checkpoint = useCallback(() => {
    historyRef.current = [...historyRef.current, specRef.current].slice(-UNDO_LIMIT)
    setUndoDepth(historyRef.current.length)
  }, [])

  const undo = useCallback(() => {
    const previous = historyRef.current[historyRef.current.length - 1]
    if (!previous) return
    historyRef.current = historyRef.current.slice(0, -1)
    setUndoDepth(historyRef.current.length)
    specRef.current = previous
    setSpecState(previous)
    setInfo(null)
  }, [])

  const refresh = useCallback(async () => {
    setListStatus('loading')
    try {
      const items = await client.list()
      if (!mounted.current) return
      setScenarios(items)
      setListStatus('ready')
    } catch (failure) {
      if (!mounted.current) return
      setListStatus('error')
      setError(messageOf(failure))
    }
  }, [client])

  // Roda uma ação de gravação: marca ocupado, limpa as mensagens e mostra o erro, se houver.
  const run = useCallback(async (action: () => Promise<string>) => {
    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      const message = await action()
      if (mounted.current) setInfo(message)
    } catch (failure) {
      if (mounted.current) setError(messageOf(failure))
    } finally {
      if (mounted.current) setBusy(false)
    }
  }, [])

  const open = useCallback(
    (id: string) =>
      run(async () => {
        const scenario = await client.get(id)
        specRef.current = scenario.spec
        clearHistory()
        setSpecState(scenario.spec)
        setSaved({ summary: summaryOf(scenario), spec: scenario.spec })
        return `Cenário "${scenario.name}" aberto.`
      }),
    [client, run, clearHistory],
  )

  const save = useCallback(
    (name: string, options: { readonly asNew?: boolean } = {}) =>
      run(async () => {
        const scenario =
          saved && !options.asNew
            ? await client.update(saved.summary.id, { name, spec })
            : await client.create(name, spec)
        setSaved({ summary: summaryOf(scenario), spec: scenario.spec })
        setScenarios(await client.list())
        setListStatus('ready')
        return `Cenário "${scenario.name}" salvo.`
      }),
    [client, run, saved, spec],
  )

  const remove = useCallback(
    (id: string) =>
      run(async () => {
        await client.remove(id)
        setScenarios((current) => current.filter((item) => item.id !== id))
        setSaved((current) => (current?.summary.id === id ? null : current))
        return 'Cenário apagado.'
      }),
    [client, run],
  )

  const reset = useCallback(() => {
    specRef.current = EMPTY_SCENARIO
    clearHistory()
    setSpecState(EMPTY_SCENARIO)
    setSaved(null)
    setError(null)
    setInfo(null)
  }, [clearHistory])

  const groundSlopeDeg = useMemo(() => scenarioGroundSlopeDeg(spec), [spec])
  const dirty = useMemo(
    () => (saved ? JSON.stringify(saved.spec) !== JSON.stringify(spec) : false),
    [saved, spec],
  )

  const value = useMemo<ScenarioContextValue>(
    () => ({
      spec,
      setSpec,
      getSpec,
      checkpoint,
      undo,
      canUndo: undoDepth > 0,
      groundSlopeDeg,
      current: saved?.summary ?? null,
      dirty,
      scenarios,
      listStatus,
      busy,
      error,
      info,
      refresh,
      open,
      save,
      remove,
      reset,
    }),
    [
      spec,
      setSpec,
      getSpec,
      checkpoint,
      undo,
      undoDepth,
      groundSlopeDeg,
      saved,
      dirty,
      scenarios,
      listStatus,
      busy,
      error,
      info,
      refresh,
      open,
      save,
      remove,
      reset,
    ],
  )

  return <ScenarioContext.Provider value={value}>{children}</ScenarioContext.Provider>
}
