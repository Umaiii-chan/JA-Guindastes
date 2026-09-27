// Backend falso de `/auth` e `/users` (TASK-040), em memória, com contas FICTÍCIAS, imitando o contrato
// real da TASK-038: cookie de sessão implícito (um usuário logado por vez), cabeçalho CSRF obrigatório
// nos métodos inseguros e erros `{detail, code}`. Delega o resto (catálogo) a `fallback`.

import { vi } from 'vitest'

import type { User, UserRole } from '../../src/domain/auth/user'
import { jsonResponse } from './fakeCatalogFetch'

export interface FakeAccount extends User {
  password: string
}

export function fakeAccount(
  partial: Partial<FakeAccount> & Pick<User, 'username' | 'role'>,
): FakeAccount {
  return {
    id: `USR-${partial.username}`,
    displayName: `Pessoa FICTÍCIA ${partial.username}`,
    active: true,
    createdAt: '2026-09-26T12:00:00+00:00',
    password: 'senha-ficticia-123',
    ...partial,
  }
}

export interface FakeAuthBackend {
  readonly fetch: ReturnType<typeof vi.fn<typeof fetch>>
  readonly accounts: FakeAccount[]
  /** Quem está logado (o "cookie"). */
  loggedInId: string | null
  authEnabled: boolean
  /** Próximas falhas forçadas por caminho+método, ex.: `POST /api/v1/auth/login` → 429. */
  readonly forced: Map<string, Response>
}

function publicUser(account: FakeAccount): User {
  const { password: _password, ...user } = account
  void _password
  return user
}

function error(status: number, code: string, detail: string): Response {
  return jsonResponse({ detail, code }, status)
}

export function createFakeAuthBackend(options: {
  accounts: FakeAccount[]
  loggedInId?: string | null
  authEnabled?: boolean
  fallback?: typeof fetch
}): FakeAuthBackend {
  const backend: FakeAuthBackend = {
    accounts: options.accounts,
    loggedInId: options.loggedInId ?? null,
    authEnabled: options.authEnabled ?? true,
    forced: new Map(),
    fetch: vi.fn<typeof fetch>(async (input, init) => {
      const url = new URL(String(input), 'http://localhost')
      const method = (init?.method ?? 'GET').toUpperCase()
      const headers = new Headers(init?.headers)
      const body: unknown = init?.body ? JSON.parse(String(init.body)) : undefined
      const key = `${method} ${url.pathname}`
      const forcedResponse = backend.forced.get(key)
      if (forcedResponse) {
        backend.forced.delete(key)
        return forcedResponse
      }
      if (method !== 'GET' && headers.get('X-Requested-With') !== 'crane-simulator') {
        return error(403, 'CSRF_HEADER_MISSING', 'Cabeçalho ausente.')
      }
      const current = backend.accounts.find((item) => item.id === backend.loggedInId) ?? null

      if (url.pathname === '/api/v1/auth/session') {
        return jsonResponse({
          authEnabled: backend.authEnabled,
          user: backend.authEnabled && current ? publicUser(current) : null,
        })
      }
      if (url.pathname === '/api/v1/auth/login' && method === 'POST') {
        const { username, password } = body as { username: string; password: string }
        const account = backend.accounts.find(
          (item) => item.username === username.toLowerCase() && item.password === password,
        )
        if (!account || !account.active) {
          return error(401, 'INVALID_CREDENTIALS', 'Usuário ou senha inválidos.')
        }
        backend.loggedInId = account.id
        return jsonResponse({ user: publicUser(account) })
      }
      if (url.pathname === '/api/v1/auth/logout' && method === 'POST') {
        backend.loggedInId = null
        return new Response(null, { status: 204 })
      }
      if (url.pathname.startsWith('/api/v1/users')) {
        if (!current) return error(401, 'NOT_AUTHENTICATED', 'Sessão ausente ou expirada.')
        if (current.role !== 'ADMIN') return error(403, 'FORBIDDEN', 'Perfil insuficiente.')
        return users(backend, current, method, url.pathname, body)
      }
      if (backend.authEnabled && !current) {
        return error(401, 'NOT_AUTHENTICATED', 'Sessão ausente ou expirada.')
      }
      return options.fallback
        ? options.fallback(input, init)
        : jsonResponse({ detail: 'Not Found' }, 404)
    }),
  }
  return backend
}

function activeAdmins(backend: FakeAuthBackend): number {
  return backend.accounts.filter((item) => item.active && item.role === 'ADMIN').length
}

function users(
  backend: FakeAuthBackend,
  actor: FakeAccount,
  method: string,
  path: string,
  body: unknown,
): Response {
  if (path === '/api/v1/users' && method === 'GET') {
    const items = [...backend.accounts]
      .sort((a, b) => a.username.localeCompare(b.username))
      .map(publicUser)
    return jsonResponse({ items })
  }
  if (path === '/api/v1/users' && method === 'POST') {
    const request = body as {
      username: string
      displayName: string
      password: string
      role: UserRole
    }
    if (backend.accounts.some((item) => item.username === request.username)) {
      return error(409, 'USERNAME_TAKEN', `O usuário ${request.username} já existe.`)
    }
    if (request.password.length < 10) {
      return jsonResponse(
        {
          detail: [
            {
              loc: ['body', 'password'],
              msg: 'A senha precisa de pelo menos 10 caracteres.',
              type: 'value_error',
            },
          ],
        },
        422,
      )
    }
    const account = fakeAccount({ ...request, id: `USR-NOVO-${backend.accounts.length + 1}` })
    backend.accounts.push(account)
    return jsonResponse(publicUser(account), 201)
  }
  const match = /^\/api\/v1\/users\/([^/]+)$/.exec(path)
  if (match && method === 'PATCH') {
    const account = backend.accounts.find((item) => item.id === decodeURIComponent(match[1]))
    if (!account) return error(404, 'USER_NOT_FOUND', 'Usuário não encontrado.')
    const changes = body as Partial<FakeAccount>
    const losesAdmin =
      account.role === 'ADMIN' &&
      account.active &&
      (changes.active === false || changes.role === 'OPERATOR')
    if (losesAdmin && account.id === actor.id) {
      return error(409, 'OWN_ADMIN_ACCESS', 'O admin não pode se desativar nem se rebaixar.')
    }
    if (losesAdmin && activeAdmins(backend) <= 1) {
      return error(409, 'LAST_ADMIN', 'O sistema precisa de pelo menos um admin ativo.')
    }
    Object.assign(account, changes)
    return jsonResponse(publicUser(account))
  }
  return jsonResponse({ detail: 'Not Found' }, 404)
}
