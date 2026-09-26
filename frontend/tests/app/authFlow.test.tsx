// @vitest-environment jsdom
// Login, sessão, guardas de rota por perfil e menu do usuário (TASK-040 CA-1, CA-2 e CA-3), contra o
// backend falso de /auth e /users com contas FICTÍCIAS.

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AppProviders } from '../../src/app/AppProviders'
import { AppRoutes } from '../../src/app/AppRoutes'
import { usePermissions } from '../../src/app/auth/usePermissions'
import { catalogFicticio } from '../fixtures/catalogFicticio'
import {
  createFakeAuthBackend,
  fakeAccount,
  type FakeAuthBackend,
} from '../helpers/fakeAuthBackend'
import { createFakeCatalogFetch, jsonResponse } from '../helpers/fakeCatalogFetch'

const ADMIN = () => fakeAccount({ username: 'admin.ficticio', role: 'ADMIN' })
const OPERADOR = () => fakeAccount({ username: 'operador.ficticio', role: 'OPERATOR' })

let backend: FakeAuthBackend

function useBackend(options: Parameters<typeof createFakeAuthBackend>[0]) {
  backend = createFakeAuthBackend({
    fallback: createFakeCatalogFetch(catalogFicticio()),
    ...options,
  })
  vi.stubGlobal('fetch', backend.fetch)
}

function LocationProbe() {
  const location = useLocation()
  const permissions = usePermissions()
  return (
    <output data-testid="probe">
      {location.pathname}
      {location.search}|{permissions.canEdit ? 'edita' : 'só vê'}
    </output>
  )
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppProviders>
        <AppRoutes />
        <LocationProbe />
      </AppProviders>
    </MemoryRouter>,
  )
}

const probe = () => screen.getByTestId('probe').textContent ?? ''

async function login(username: string, password: string) {
  fireEvent.change(await screen.findByLabelText(/Usuário/), { target: { value: username } })
  fireEvent.change(screen.getByLabelText(/^Senha/), { target: { value: password } })
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
}

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('guarda de sessão e login', () => {
  it('sem sessão, uma rota guardada leva ao login; depois do login, volta ao destino', async () => {
    useBackend({ accounts: [ADMIN()] })
    renderAt('/tabelas?x=1')

    expect(await screen.findByRole('heading', { level: 1, name: 'Entrar' })).toBeTruthy()
    expect(probe()).toContain('/login')
    expect(screen.queryByRole('navigation', { name: 'Navegação principal' })).toBeNull()

    await login('admin.ficticio', 'senha-ficticia-123')
    expect(await screen.findByRole('heading', { level: 1, name: 'Tabelas' })).toBeTruthy()
    expect(probe()).toBe('/tabelas?x=1|edita')
    expect(screen.getByTestId('user-menu').textContent).toContain('Pessoa FICTÍCIA admin.ficticio')
  })

  it('senha errada: 401 explicado, senha limpa e foco nela; 429 explicado', async () => {
    useBackend({ accounts: [ADMIN()] })
    renderAt('/login')
    await login('admin.ficticio', 'errada-errada')

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Usuário ou senha incorretos')
    const password = screen.getByLabelText(/^Senha/) as HTMLInputElement
    expect(password.value).toBe('')
    expect(document.activeElement).toBe(password)

    backend.forced.set(
      'POST /api/v1/auth/login',
      jsonResponse({ detail: 'x', code: 'TOO_MANY_ATTEMPTS' }, 429),
    )
    await login('admin.ficticio', 'outra-senha-1')
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('Aguarde 15 minutos'),
    )
  })

  it('campos vazios não enviam; carregando durante o envio', async () => {
    useBackend({ accounts: [ADMIN()] })
    renderAt('/login')
    fireEvent.click(await screen.findByRole('button', { name: 'Entrar' }))
    expect(screen.getByText('Informe o usuário.')).toBeTruthy()
    expect(backend.fetch.mock.calls.some(([url]) => String(url).includes('/login'))).toBe(false)

    let release!: () => void
    backend.forced.set('POST /api/v1/auth/login', jsonResponse({}, 500))
    backend.fetch.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          release = () => resolve(jsonResponse({ detail: 'x', code: 'INVALID_CREDENTIALS' }, 401))
        }),
    )
    await login('admin.ficticio', 'qualquer-senha')
    const button = screen.getByRole('button', { name: 'Entrando…' })
    expect(button.getAttribute('aria-busy')).toBe('true')
    await act(async () => release())
    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeTruthy()
  })

  it('mostrar/ocultar senha', async () => {
    useBackend({ accounts: [ADMIN()] })
    renderAt('/login')
    const password = (await screen.findByLabelText(/^Senha/)) as HTMLInputElement
    expect(password.type).toBe('password')
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }))
    expect(password.type).toBe('text')
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar senha' }))
    expect(password.type).toBe('password')
  })

  it('logado, /login vai ao Início', async () => {
    useBackend({ accounts: [ADMIN()], loggedInId: 'USR-admin.ficticio' })
    renderAt('/login')
    expect(await screen.findByRole('heading', { level: 1, name: 'Início' })).toBeTruthy()
  })

  it('modo sem banco: /login vai ao Início com o aviso e o menu mostra o modo', async () => {
    useBackend({ accounts: [], authEnabled: false })
    renderAt('/login')
    expect(await screen.findByRole('heading', { level: 1, name: 'Início' })).toBeTruthy()
    expect(screen.getByText('Modo sem autenticação (sem banco)')).toBeTruthy()
    expect(screen.getByTestId('user-menu').textContent).toContain('Modo sem autenticação')
    expect(probe()).toBe('/|edita')
  })

  it('sem backend (sessão falha), cai no modo sem autenticação', async () => {
    vi.stubGlobal(
      'fetch',
      createFakeCatalogFetch(catalogFicticio(), (_method, path) =>
        path === '/api/v1/auth/session' ? jsonResponse({ detail: 'Bad Gateway' }, 502) : undefined,
      ),
    )
    renderAt('/catalogo')
    expect(await screen.findByRole('heading', { level: 1, name: 'Catálogo' })).toBeTruthy()
    expect(probe()).toBe('/catalogo|edita')
  })
})

describe('sessão durante o uso', () => {
  it('um 401 NOT_AUTHENTICATED em qualquer chamada leva ao login, preservando o destino', async () => {
    useBackend({ accounts: [ADMIN()], loggedInId: 'USR-admin.ficticio' })
    renderAt('/catalogo')
    const selection = await screen.findByRole('region', { name: 'Guindaste e configuração' })
    await within(selection).findByRole('option', { name: 'Fabricante FICTÍCIO A' })

    backend.loggedInId = null // a sessão expirou no servidor
    fireEvent.change(within(selection).getByLabelText('Fabricante'), {
      target: { value: 'FAB-A' },
    })
    expect(await screen.findByRole('heading', { level: 1, name: 'Entrar' })).toBeTruthy()
    expect(screen.getByText('A sessão acabou. Entre de novo para continuar.')).toBeTruthy()

    await login('admin.ficticio', 'senha-ficticia-123')
    expect(await screen.findByRole('heading', { level: 1, name: 'Catálogo' })).toBeTruthy()
    expect(probe()).toBe('/catalogo|edita')
  })

  it('sair: menu do usuário → Sair → login com "Você saiu", sem destino guardado', async () => {
    useBackend({ accounts: [ADMIN()], loggedInId: 'USR-admin.ficticio' })
    renderAt('/tabelas')
    fireEvent.click(await screen.findByRole('button', { name: /Menu do usuário/ }))
    const menu = screen.getByRole('menu', { name: 'Conta' })
    expect(menu.textContent).toContain('@admin.ficticio')
    expect(menu.textContent).toContain('Administrador')
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Sair' }))

    expect(await screen.findByText('Você saiu da sessão.')).toBeTruthy()
    expect(backend.loggedInId).toBeNull()
    await login('admin.ficticio', 'senha-ficticia-123')
    expect(await screen.findByRole('heading', { level: 1, name: 'Início' })).toBeTruthy()
  })

  it('o menu fecha com Esc', async () => {
    useBackend({ accounts: [ADMIN()], loggedInId: 'USR-admin.ficticio' })
    renderAt('/')
    const trigger = await screen.findByRole('button', { name: /Menu do usuário/ })
    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
  })
})

describe('guardas por perfil (ADR-017 § 1)', () => {
  it('Operador: sem a seção de administração no trilho, /usuarios mostra "Sem permissão" e só vê', async () => {
    useBackend({ accounts: [ADMIN(), OPERADOR()], loggedInId: 'USR-operador.ficticio' })
    renderAt('/usuarios')

    expect(await screen.findByText('Sem permissão')).toBeTruthy()
    expect(screen.getByText(/só para o perfil Administrador/)).toBeTruthy()
    const nav = screen.getByRole('navigation', { name: 'Navegação principal' })
    expect(within(nav).queryByRole('link', { name: 'Usuários' })).toBeNull()
    expect(within(nav).queryByText('Administração')).toBeNull()
    expect(probe()).toBe('/usuarios|só vê')
    expect(backend.fetch.mock.calls.some(([url]) => String(url).startsWith('/api/v1/users'))).toBe(
      false,
    )
  })

  it('ADMIN: vê Usuários no trilho e abre a página', async () => {
    useBackend({ accounts: [ADMIN(), OPERADOR()], loggedInId: 'USR-admin.ficticio' })
    renderAt('/usuarios')
    expect(await screen.findByRole('table', { name: 'Contas de usuário' })).toBeTruthy()
    const nav = screen.getByRole('navigation', { name: 'Navegação principal' })
    expect(within(nav).getByRole('link', { name: 'Usuários' })).toBeTruthy()
  })

  it('um 403 FORBIDDEN de qualquer chamada vira a notificação "Sem permissão"', async () => {
    useBackend({ accounts: [ADMIN()], loggedInId: 'USR-admin.ficticio' })
    backend.forced.set(
      'GET /api/v1/manufacturers',
      jsonResponse({ detail: 'Perfil insuficiente.', code: 'FORBIDDEN' }, 403),
    )
    renderAt('/catalogo')
    const toast = await screen.findByText('Sem permissão')
    expect(toast.closest('[role="alert"]')?.textContent).toContain('Perfil insuficiente.')
  })
})
