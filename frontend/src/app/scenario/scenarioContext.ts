// Cenário do simulador (TASK-052; ADR-023): terreno, obstáculos e posição do guindaste que a cena
// desenha, mais o cenário salvo que ele veio de (se houver) e as ações de salvar, abrir e apagar.
// Fica fora da página para sobreviver a uma ida ao Catálogo e à volta, como a carga (TASK-039).

import { createContext, useContext } from 'react'

import type { ScenarioSummary } from '../../application/environment/ports'
import type { ScenarioSpec } from '../../domain/environment/environment'

export type ScenarioListStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface ScenarioContextValue {
  /** Cenário em edição: é o que a cena desenha. Começa vazio (terreno plano, sem obstáculos). */
  readonly spec: ScenarioSpec
  setSpec(next: ScenarioSpec): void
  /** Cenário mais recente, mesmo antes da próxima renderização (usado pelo editor 3D). */
  getSpec(): ScenarioSpec
  /** Guarda o cenário atual na pilha do desfazer; o editor chama antes de cada gesto (TASK-066). */
  checkpoint(): void
  /** Volta ao cenário do último ponto guardado. */
  undo(): void
  readonly canUndo: boolean
  /**
   * Inclinação do terreno sob as sapatas FICTÍCIAS do guindaste, em graus, enviada como
   * `ground_slope_deg`; `undefined` com terreno plano (a requisição fica como era).
   */
  readonly groundSlopeDeg: number | undefined
  /** Cenário salvo de onde o `spec` veio; `null` se ainda não foi salvo. */
  readonly current: ScenarioSummary | null
  /** O `spec` mudou desde que foi aberto ou salvo. */
  readonly dirty: boolean
  readonly scenarios: readonly ScenarioSummary[]
  readonly listStatus: ScenarioListStatus
  /** Salvando, abrindo ou apagando. */
  readonly busy: boolean
  /** Mensagem do último erro (rede, 403, 404, 422), ou `null`. */
  readonly error: string | null
  /** Mensagem do último sucesso ("Cenário salvo"), ou `null`. */
  readonly info: string | null
  /** Recarrega a lista de cenários salvos. */
  refresh(): Promise<void>
  /** Abre um cenário salvo: o `spec` dele passa a ser o do cenário em edição. */
  open(id: string): Promise<void>
  /** Salva: atualiza o cenário aberto (`asNew: false`) ou cria um novo. */
  save(name: string, options?: { readonly asNew?: boolean }): Promise<void>
  /** Apaga um cenário salvo. Se for o aberto, o `spec` continua em edição como não salvo. */
  remove(id: string): Promise<void>
  /** Volta ao cenário vazio (terreno plano). */
  reset(): void
}

export const ScenarioContext = createContext<ScenarioContextValue | null>(null)

export function useScenario(): ScenarioContextValue {
  const value = useContext(ScenarioContext)
  if (!value) throw new Error('useScenario precisa de um <ScenarioProvider> acima na árvore.')
  return value
}
