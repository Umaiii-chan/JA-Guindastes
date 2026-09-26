// Clientes REST de `/auth` e `/users` (TASK-040 CA-1), contra o contrato real da TASK-038.

import { describe, expect, it, vi } from 'vitest'

import { AuthRequestError } from '../../../src/domain/auth/user'
import { createAuthRestClient } from '../../../src/infrastructure/api/authRestClient'
import { createUsersRestClient } from '../../../src/infrastructure/api/usersRestClient'
import { createFakeAuthBackend, fakeAccount } from '../../helpers/fakeAuthBackend'
import { jsonResponse } from '../../helpers/fakeCatalogFetch'

async function rejection(promise: Promise<unknown>): Promise<AuthRequestError> {
  const error = await promise.then(
    () => {
      throw new Error('esperava rejeição')
    },
    (reason: unknown) => reason,
  )
  expect(error).toBeInstanceOf(AuthRequestError)
  return error as AuthRequestError
}

function answering(response: Response | Error) {
  return vi.fn<typeof fetch>(async () => {
    if (response instanceof Error) throw response
    return response
  })
}

const ADMIN = fakeAccount({ username: 'admin.ficticio', role: 'ADMIN' })
const OPERADOR = fakeAccount({ username: 'operador.ficticio', role: 'OPERATOR' })

describe('cliente de /auth', () => {
  it('sessão, login e logout: cookie da mesma origem e CSRF nos POST', async () => {
    const backend = createFakeAuthBackend({ accounts: [ADMIN] })
    const client = createAuthRestClient({ fetchFn: backend.fetch })

    expect(await client.getSession()).toEqual({ authEnabled: true, user: null })
    const user = await client.login('Admin.Ficticio', ADMIN.password)
    expect(user).toEqual({
      id: ADMIN.id,
      username: 'admin.ficticio',
      displayName: ADMIN.displayName,
      role: 'ADMIN',
      active: true,
      createdAt: ADMIN.createdAt,
    })
    expect((await client.getSession()).user?.id).toBe(ADMIN.id)
    await client.logout()
    expect((await client.getSession()).user).toBeNull()

    const calls = backend.fetch.mock.calls.map(([url, init]) => ({
      url: String(url),
      method: init?.method,
      credentials: init?.credentials,
      csrf: new Headers(init?.headers).get('X-Requested-With'),
    }))
    expect(calls).toEqual([
      { url: '/api/v1/auth/session', method: 'GET', credentials: 'same-origin', csrf: null },
      {
        url: '/api/v1/auth/login',
        method: 'POST',
        credentials: 'same-origin',
        csrf: 'crane-simulator',
      },
      { url: '/api/v1/auth/session', method: 'GET', credentials: 'same-origin', csrf: null },
      {
        url: '/api/v1/auth/logout',
        method: 'POST',
        credentials: 'same-origin',
        csrf: 'crane-simulator',
      },
      { url: '/api/v1/auth/session', method: 'GET', credentials: 'same-origin', csrf: null },
    ])
    expect(JSON.parse(String(backend.fetch.mock.calls[1][1]?.body))).toEqual({
      username: 'Admin.Ficticio',
      password: ADMIN.password,
    })
  })

  it('modo sem banco: authEnabled false', async () => {
    const client = createAuthRestClient({
      fetchFn: answering(jsonResponse({ authEnabled: false, user: null })),
    })
    expect(await client.getSession()).toEqual({ authEnabled: false, user: null })
  })

  it('login: 401 INVALID_CREDENTIALS e 429 TOO_MANY_ATTEMPTS com código e mensagem', async () => {
    const invalid = await rejection(
      createAuthRestClient({
        fetchFn: answering(
          jsonResponse({ detail: 'Usuário ou senha inválidos.', code: 'INVALID_CREDENTIALS' }, 401),
        ),
      }).login('x', 'y'),
    )
    expect(invalid).toMatchObject({
      code: 'INVALID_CREDENTIALS',
      httpStatus: 401,
      message: 'Usuário ou senha inválidos.',
    })

    const tooMany = await rejection(
      createAuthRestClient({
        fetchFn: answering(jsonResponse({ code: 'TOO_MANY_ATTEMPTS' }, 429)),
      }).login('x', 'y'),
    )
    expect(tooMany.code).toBe('TOO_MANY_ATTEMPTS')
    expect(tooMany.message).toContain('Muitas tentativas')
  })

  it('rede, HTTP sem código e resposta fora do contrato', async () => {
    expect(
      (await rejection(createAuthRestClient({ fetchFn: answering(new TypeError()) }).getSession()))
        .code,
    ).toBe('NETWORK_ERROR')
    const http = await rejection(
      createAuthRestClient({ fetchFn: answering(jsonResponse({ detail: 'x' }, 502)) }).getSession(),
    )
    expect(http).toMatchObject({ code: 'HTTP_ERROR', httpStatus: 502 })
    const invalid = await rejection(
      createAuthRestClient({
        fetchFn: answering(jsonResponse({ authEnabled: 'sim', user: null })),
      }).getSession(),
    )
    expect(invalid.code).toBe('INVALID_RESPONSE')
    expect(invalid.message).toContain('response.authEnabled')
  })
})

describe('cliente de /users', () => {
  function adminClient() {
    const backend = createFakeAuthBackend({
      accounts: [fakeAccount({ ...ADMIN }), fakeAccount({ ...OPERADOR })],
      loggedInId: ADMIN.id,
    })
    return { backend, client: createUsersRestClient({ fetchFn: backend.fetch }) }
  }

  it('lista, cria e altera, em camelCase, com o cabeçalho CSRF no POST e no PATCH', async () => {
    const { backend, client } = adminClient()
    expect((await client.list()).map((user) => user.username)).toEqual([
      'admin.ficticio',
      'operador.ficticio',
    ])
    const created = await client.create({
      username: 'nova.ficticia',
      displayName: 'Nova FICTÍCIA',
      password: 'senha-ficticia-456',
      role: 'OPERATOR',
    })
    expect(created).toMatchObject({ username: 'nova.ficticia', role: 'OPERATOR', active: true })
    const updated = await client.update(created.id, { displayName: 'Outra', role: 'ADMIN' })
    expect(updated).toMatchObject({ displayName: 'Outra', role: 'ADMIN' })

    const [, post, patch] = backend.fetch.mock.calls
    expect(JSON.parse(String(post[1]?.body))).toEqual({
      username: 'nova.ficticia',
      displayName: 'Nova FICTÍCIA',
      password: 'senha-ficticia-456',
      role: 'OPERATOR',
    })
    expect(String(patch[0])).toBe(`/api/v1/users/${created.id}`)
    expect(patch[1]?.method).toBe('PATCH')
    expect(JSON.parse(String(patch[1]?.body))).toEqual({ displayName: 'Outra', role: 'ADMIN' })
    for (const [, init] of [post, patch]) {
      expect(new Headers(init?.headers).get('X-Requested-With')).toBe('crane-simulator')
    }
  })

  it('409 USERNAME_TAKEN, LAST_ADMIN e OWN_ADMIN_ACCESS; 404 USER_NOT_FOUND', async () => {
    const { client } = adminClient()
    const taken = await rejection(
      client.create({
        username: 'operador.ficticio',
        displayName: 'x',
        password: 'senha-ficticia-456',
        role: 'OPERATOR',
      }),
    )
    expect(taken).toMatchObject({ code: 'USERNAME_TAKEN', httpStatus: 409 })
    expect((await rejection(client.update(ADMIN.id, { active: false }))).code).toBe(
      'OWN_ADMIN_ACCESS',
    )
    expect((await rejection(client.update('USR-NAO-EXISTE', { active: false }))).code).toBe(
      'USER_NOT_FOUND',
    )

    const lastAdmin = await rejection(
      createUsersRestClient({
        fetchFn: answering(jsonResponse({ detail: 'Último admin.', code: 'LAST_ADMIN' }, 409)),
      }).update('USR-X', { role: 'OPERATOR' }),
    )
    expect(lastAdmin).toMatchObject({ code: 'LAST_ADMIN', message: 'Último admin.' })
  })

  it('422 do FastAPI vira erros de campo com o nome em camelCase', async () => {
    const client = createUsersRestClient({
      fetchFn: answering(
        jsonResponse(
          {
            detail: [
              { loc: ['body', 'displayName'], msg: 'Obrigatório.', type: 'value_error' },
              { loc: ['body', 'password'], msg: 'Curta demais.', type: 'value_error' },
            ],
          },
          422,
        ),
      ),
    })
    const error = await rejection(
      client.create({ username: 'x', displayName: '', password: '1', role: 'OPERATOR' }),
    )
    expect(error.code).toBe('VALIDATION')
    expect(error.fieldErrors).toEqual([
      { field: 'displayName', message: 'Obrigatório.' },
      { field: 'password', message: 'Curta demais.' },
    ])
  })

  it('perfil fora do contrato → INVALID_RESPONSE', async () => {
    const client = createUsersRestClient({
      fetchFn: answering(jsonResponse({ items: [{ ...OPERADOR, role: 'ROOT' }] })),
    })
    const error = await rejection(client.list())
    expect(error.code).toBe('INVALID_RESPONSE')
    expect(error.message).toContain('response.items[0].role')
  })
})
