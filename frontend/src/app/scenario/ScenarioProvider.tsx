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

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Falha inesperada ao falar com o backend.'
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
    setSpecState(next)
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
        setSpecState(scenario.spec)
        setSaved({ summary: summaryOf(scenario), spec: scenario.spec })
        return `Cenário "${scenario.name}" aberto.`
      }),
    [client, run],
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
    setSpecState(EMPTY_SCENARIO)
    setSaved(null)
    setError(null)
    setInfo(null)
  }, [])

  const groundSlopeDeg = useMemo(() => scenarioGroundSlopeDeg(spec), [spec])
  const dirty = useMemo(
    () => (saved ? JSON.stringify(saved.spec) !== JSON.stringify(spec) : false),
    [saved, spec],
  )

  const value = useMemo<ScenarioContextValue>(
    () => ({
      spec,
      setSpec,
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
