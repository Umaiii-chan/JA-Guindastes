// Porta dos cenários salvos (TASK-052; ADR-023). Implementada por
// `src/infrastructure/api/scenarioRestClient.ts`; falha com `AuthRequestError` (mesmo transporte
// dos clientes de `/auth` e `/users`: `code`, `httpStatus` e `fieldErrors` do 422).

import type { ScenarioSpec } from '../../domain/environment/environment'

/** Cenário na listagem (sem o `spec`). */
export interface ScenarioSummary {
  readonly id: string
  readonly name: string
  /** Id do usuário autor: só ele ou um admin edita e apaga. */
  readonly authorUserId: string
  readonly createdAt: string
  readonly updatedAt: string
}

/** Cenário aberto, com terreno, obstáculos e posição do guindaste. */
export interface SavedScenario extends ScenarioSummary {
  readonly spec: ScenarioSpec
}

export interface ScenarioGateway {
  /** `GET /api/v1/scenarios`. */
  list(): Promise<readonly ScenarioSummary[]>
  /** `GET /api/v1/scenarios/{id}`. */
  get(id: string): Promise<SavedScenario>
  /** `POST /api/v1/scenarios`; o autor é o usuário da sessão. */
  create(name: string, spec: ScenarioSpec): Promise<SavedScenario>
  /** `PUT /api/v1/scenarios/{id}`; só o autor ou um admin. */
  update(
    id: string,
    changes: { readonly name?: string; readonly spec?: ScenarioSpec },
  ): Promise<SavedScenario>
  /** `DELETE /api/v1/scenarios/{id}`; só o autor ou um admin. */
  remove(id: string): Promise<void>
}
