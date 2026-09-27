// `fetch` de todas as chamadas REST da aplicação (TASK-040; ADR-016 § 3). Centraliza o que o backend
// com login exige de qualquer cliente:
//
// - `credentials: 'same-origin'`: o cookie de sessão `crane_session` (HttpOnly, o JS não lê) vai junto;
// - `X-Requested-With: crane-simulator` em POST, PUT, PATCH e DELETE (sem ele: 403
//   `CSRF_HEADER_MISSING`);
// - avisa os ouvintes quando uma resposta diz que a sessão acabou (401 `NOT_AUTHENTICATED`) ou que o
//   perfil não basta (403 `FORBIDDEN`). O `AuthProvider` leva ao login preservando o destino; a casca
//   mostra "sem permissão". A resposta volta intacta para o cliente que chamou.
//
// Corpo de erro do backend: `{"detail": "<mensagem>", "code": "<CÓDIGO>"}`.

import { isRecord } from '../shared/readJson'

export const CSRF_HEADER = 'X-Requested-With'
export const CSRF_HEADER_VALUE = 'crane-simulator'

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export type ApiAuthEvent =
  | { readonly kind: 'unauthenticated'; readonly message: string | null }
  | { readonly kind: 'forbidden'; readonly message: string | null }

type Listener = (event: ApiAuthEvent) => void

const listeners = new Set<Listener>()

/** Ouve os 401 `NOT_AUTHENTICATED` e 403 `FORBIDDEN` de qualquer chamada. Devolve o cancelamento. */
export function onApiAuthEvent(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function emit(event: ApiAuthEvent): void {
  for (const listener of [...listeners]) listener(event)
}

/** `init` com o cookie da mesma origem e, nos métodos inseguros, o cabeçalho contra CSRF. */
export function withApiDefaults(init: RequestInit = {}): RequestInit {
  const method = (init.method ?? 'GET').toUpperCase()
  const headers = new Headers(init.headers)
  if (UNSAFE_METHODS.has(method)) headers.set(CSRF_HEADER, CSRF_HEADER_VALUE)
  return { ...init, credentials: 'same-origin', headers }
}

/** Corpo de erro do backend: `{detail, code}`. Campos ausentes viram `null`. */
export async function readApiErrorBody(
  response: Response,
): Promise<{ readonly code: string | null; readonly detail: string | null }> {
  try {
    const body: unknown = await response.clone().json()
    if (!isRecord(body)) return { code: null, detail: null }
    return {
      code: typeof body.code === 'string' ? body.code : null,
      detail: typeof body.detail === 'string' && body.detail.trim() !== '' ? body.detail : null,
    }
  } catch {
    return { code: null, detail: null }
  }
}

/**
 * Embrulha um `fetch` (padrão: o global, lido na hora da chamada) com os padrões acima. Um 401 só
 * avisa "sessão acabou" quando o código não é `INVALID_CREDENTIALS` (senha errada no login).
 */
export function createApiFetch(fetchFn?: typeof fetch): typeof fetch {
  return async (input, init) => {
    const response = await (fetchFn ?? fetch)(input, withApiDefaults(init))
    if (response.status === 401 || response.status === 403) {
      const { code, detail } = await readApiErrorBody(response)
      if (response.status === 401 && code !== 'INVALID_CREDENTIALS') {
        emit({ kind: 'unauthenticated', message: detail })
      } else if (response.status === 403 && code === 'FORBIDDEN') {
        emit({ kind: 'forbidden', message: detail })
      }
    }
    return response
  }
}
