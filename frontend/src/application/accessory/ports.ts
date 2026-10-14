// Porta do catálogo de acessórios (TASK-056): o que a tela precisa do backend, sem saber que é
// `fetch` (implementação em `src/infrastructure/api/accessoryRestClient.ts`).

import type { Accessory, AccessoryChanges, NewAccessory } from '../../domain/accessory/accessory'

/** Todas as operações rejeitam com um `AccessoryRequestError`. */
export interface AccessoryGateway {
  /** Leitura para qualquer perfil logado. */
  list(): Promise<readonly Accessory[]>
  get(id: string): Promise<Accessory>
  /** Escrita só do perfil ADMIN. */
  create(accessory: NewAccessory): Promise<Accessory>
  update(id: string, changes: AccessoryChanges): Promise<Accessory>
  remove(id: string): Promise<void>
}

export type AccessoryErrorCode =
  'NOT_FOUND' | 'CONFLICT' | 'VALIDATION' | 'HTTP_ERROR' | 'NETWORK_ERROR' | 'INVALID_RESPONSE'

export class AccessoryRequestError extends Error {
  readonly code: AccessoryErrorCode

  constructor(code: AccessoryErrorCode, message: string) {
    super(message)
    this.name = 'AccessoryRequestError'
    this.code = code
  }
}
