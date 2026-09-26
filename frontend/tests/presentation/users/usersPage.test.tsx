// @vitest-environment jsdom
// Página Usuários (TASK-040 CA-4): tabela com busca, criar e editar num Drawer, confirmação antes de
// desativar e os erros 409 explicados. Backend falso em memória, contas FICTÍCIAS.

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createUsersRestClient } from '../../../src/infrastructure/api/usersRestClient'
import { UsersPage } from '../../../src/presentation/pages/UsersPage'
import { ToastProvider } from '../../../src/presentation/ui'
import {
  createFakeAuthBackend,
  fakeAccount,
  type FakeAuthBackend,
} from '../../helpers/fakeAuthBackend'
import { jsonResponse } from '../../helpers/fakeCatalogFetch'

function setup(accounts = defaultAccounts()): FakeAuthBackend {
  const backend = createFakeAuthBackend({ accounts, loggedInId: 'USR-admin.ficticio' })
  render(
    <ToastProvider>
      <UsersPage
        mode="enabled"
        gateway={createUsersRestClient({ fetchFn: backend.fetch })}
        currentUserId="USR-admin.ficticio"
      />
    </ToastProvider>,
  )
  return backend
}

function defaultAccounts() {
  return [
    fakeAccount({ username: 'admin.ficticio', role: 'ADMIN', displayName: 'Ana FICTÍCIA' }),
    fakeAccount({ username: 'bruno.ficticio', role: 'OPERATOR', displayName: 'Bruno FICTÍCIO' }),
    fakeAccount({
      username: 'carla.ficticia',
      role: 'OPERATOR',
      displayName: 'Carla Émile FICTÍCIA',
      active: false,
    }),
  ]
}

/** Uma conta "Único Admin" cujo PATCH o backend recusa com 409 `LAST_ADMIN` (o backend decide). */
function withLastAdminConflict(): FakeAuthBackend {
  const backend = setup([
    ...defaultAccounts(),
    fakeAccount({ username: 'unico.admin', role: 'ADMIN', displayName: 'Único Admin' }),
  ])
  backend.forced.set(
    'PATCH /api/v1/users/USR-unico.admin',
    jsonResponse({ detail: 'Precisa de um admin ativo.', code: 'LAST_ADMIN' }, 409),
  )
  return backend
}

async function rows(): Promise<HTMLElement[]> {
  const table = await screen.findByRole('table', { name: 'Contas de usuário' })
  await waitFor(() => expect(table.getAttribute('aria-busy')).toBeNull())
  return within(table).getAllByRole('row').slice(1)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('lista e busca', () => {
  it('mostra as contas com perfil, situação e "você"; a busca ignora acentos e maiúsculas', async () => {
    setup()
    const list = await rows()
    expect(list).toHaveLength(3)
    expect(list[0].textContent).toContain('Ana FICTÍCIA')
    expect(list[0].textContent).toContain('você')
    expect(list[0].textContent).toContain('Administrador')
    expect(list[2].textContent).toContain('Inativo')
    expect(screen.getByText('3 contas · 1 administrador ativo')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: 'emile' } })
    expect((await rows()).map((row) => row.textContent)).toEqual([
      expect.stringContaining('Carla Émile FICTÍCIA'),
    ])
    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: 'zzz' } })
    expect(screen.getByText('Nenhuma conta encontrada')).toBeTruthy()
  })

  it('erro ao listar: alerta e "Tentar de novo"', async () => {
    const backend = createFakeAuthBackend({
      accounts: defaultAccounts(),
      loggedInId: 'USR-admin.ficticio',
    })
    backend.forced.set('GET /api/v1/users', jsonResponse({ detail: 'x' }, 502))
    render(
      <ToastProvider>
        <UsersPage
          mode="enabled"
          gateway={createUsersRestClient({ fetchFn: backend.fetch })}
          currentUserId="USR-admin.ficticio"
        />
      </ToastProvider>,
    )
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Não foi possível ler as contas')
    fireEvent.click(within(alert).getByRole('button', { name: 'Tentar de novo' }))
    expect(await rows()).toHaveLength(3)
  })

  it('modo sem banco: explica que não há contas', () => {
    render(
      <ToastProvider>
        <UsersPage
          mode="disabled"
          gateway={createUsersRestClient({ fetchFn: vi.fn<typeof fetch>() })}
          currentUserId={null}
        />
      </ToastProvider>,
    )
    expect(screen.getByText('Modo sem autenticação (sem banco)')).toBeTruthy()
  })
})

describe('criar e editar no Drawer', () => {
  it('cria uma conta: confere os campos antes de enviar e mostra a nova na tabela', async () => {
    const backend = setup()
    await rows()
    fireEvent.click(screen.getByRole('button', { name: 'Novo usuário' }))
    const drawer = screen.getByRole('dialog', { name: 'Novo usuário' })

    fireEvent.click(within(drawer).getByRole('button', { name: 'Criar usuário' }))
    expect(within(drawer).getByText(/Use de 3 a 64 caracteres/)).toBeTruthy()
    expect(within(drawer).getByText('Informe a senha.')).toBeTruthy()
    const posts = () => backend.fetch.mock.calls.filter(([, init]) => init?.method === 'POST')
    expect(posts()).toHaveLength(0)

    fireEvent.change(within(drawer).getByLabelText(/Nome de usuário/), {
      target: { value: 'Davi.Ficticio' },
    })
    fireEvent.change(within(drawer).getByLabelText(/Nome de exibição/), {
      target: { value: 'Davi FICTÍCIO' },
    })
    fireEvent.change(within(drawer).getByLabelText(/Perfil/), { target: { value: 'ADMIN' } })
    fireEvent.change(within(drawer).getByLabelText(/^Senha/), {
      target: { value: 'senha-ficticia-789' },
    })
    fireEvent.click(within(drawer).getByRole('button', { name: 'Criar usuário' }))

    expect(await screen.findByText('Conta @davi.ficticio criada')).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(JSON.parse(String(posts()[0][1]?.body))).toEqual({
      username: 'davi.ficticio',
      displayName: 'Davi FICTÍCIO',
      password: 'senha-ficticia-789',
      role: 'ADMIN',
    })
    expect((await rows()).some((row) => row.textContent?.includes('Davi FICTÍCIO'))).toBe(true)
  })

  it('409 USERNAME_TAKEN: explicado no aviso e no campo', async () => {
    setup()
    await rows()
    fireEvent.click(screen.getByRole('button', { name: 'Novo usuário' }))
    const drawer = screen.getByRole('dialog', { name: 'Novo usuário' })
    fireEvent.change(within(drawer).getByLabelText(/Nome de usuário/), {
      target: { value: 'bruno.ficticio' },
    })
    fireEvent.change(within(drawer).getByLabelText(/Nome de exibição/), {
      target: { value: 'Outro' },
    })
    fireEvent.change(within(drawer).getByLabelText(/^Senha/), {
      target: { value: 'senha-ficticia-789' },
    })
    fireEvent.click(within(drawer).getByRole('button', { name: 'Criar usuário' }))

    const alert = await within(drawer).findByRole('alert')
    expect(alert.textContent).toContain('Nome de usuário em uso')
    const username = within(drawer).getByLabelText(/Nome de usuário/)
    expect(username.getAttribute('aria-invalid')).toBe('true')
  })

  it('edita nome, perfil e senha; o nome de usuário não muda', async () => {
    const backend = setup()
    await rows()
    fireEvent.click(screen.getByRole('button', { name: 'Editar Bruno FICTÍCIO' }))
    const drawer = screen.getByRole('dialog', { name: 'Editar usuário' })
    expect((within(drawer).getByLabelText(/Nome de usuário/) as HTMLInputElement).readOnly).toBe(
      true,
    )
    fireEvent.change(within(drawer).getByLabelText(/Nome de exibição/), {
      target: { value: 'Bruno Silva FICTÍCIO' },
    })
    fireEvent.change(within(drawer).getByLabelText(/Nova senha/), {
      target: { value: 'nova-senha-ficticia' },
    })
    fireEvent.click(within(drawer).getByRole('button', { name: 'Salvar alterações' }))

    expect(await screen.findByText('Alterações salvas')).toBeTruthy()
    const patch = backend.fetch.mock.calls.find(([, init]) => init?.method === 'PATCH')
    expect(String(patch?.[0])).toBe('/api/v1/users/USR-bruno.ficticio')
    expect(JSON.parse(String(patch?.[1]?.body))).toEqual({
      displayName: 'Bruno Silva FICTÍCIO',
      password: 'nova-senha-ficticia',
    })
  })

  it('na própria conta, o perfil fica travado com a explicação', async () => {
    setup()
    await rows()
    fireEvent.click(screen.getByRole('button', { name: 'Editar Ana FICTÍCIA' }))
    const drawer = screen.getByRole('dialog', { name: 'Editar usuário' })
    expect((within(drawer).getByLabelText(/Perfil/) as HTMLSelectElement).disabled).toBe(true)
    expect(
      within(drawer).getByText('Você não pode tirar o próprio perfil de Administrador.'),
    ).toBeTruthy()
  })

  it('409 LAST_ADMIN ao rebaixar o último admin: explicado', async () => {
    withLastAdminConflict()
    await rows()
    fireEvent.click(screen.getByRole('button', { name: 'Editar Único Admin' }))
    const drawer = screen.getByRole('dialog', { name: 'Editar usuário' })
    fireEvent.change(within(drawer).getByLabelText(/Perfil/), { target: { value: 'OPERATOR' } })
    fireEvent.click(within(drawer).getByRole('button', { name: 'Salvar alterações' }))
    const alert = await within(drawer).findByRole('alert')
    expect(alert.textContent).toContain('É o último administrador ativo')
    expect(alert.textContent).toContain('Promova outra conta a Administrador')
  })
})

describe('ativar e desativar', () => {
  it('desativar pede confirmação; cancelar não envia; confirmar desativa', async () => {
    const backend = setup()
    await rows()
    fireEvent.click(screen.getByRole('button', { name: 'Desativar Bruno FICTÍCIO' }))
    let dialog = screen.getByRole('dialog', { name: 'Desativar conta?' })
    expect(dialog.textContent).toContain('@bruno.ficticio')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
    expect(backend.fetch.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'Desativar Bruno FICTÍCIO' }))
    dialog = screen.getByRole('dialog', { name: 'Desativar conta?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Desativar' }))
    expect(await screen.findByText('Bruno FICTÍCIO desativado')).toBeTruthy()
    const row = (await rows()).find((item) => item.textContent?.includes('Bruno FICTÍCIO'))
    expect(row?.textContent).toContain('Inativo')
    expect(within(row!).getByRole('button', { name: 'Reativar Bruno FICTÍCIO' })).toBeTruthy()
  })

  it('a própria conta não tem "Desativar" habilitado', async () => {
    setup()
    await rows()
    const button = screen.getByRole('button', {
      name: 'Desativar Ana FICTÍCIA',
    }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(button.title).toBe('Você não pode desativar a própria conta.')
  })

  it('reativar não pede confirmação', async () => {
    setup()
    await rows()
    fireEvent.click(screen.getByRole('button', { name: 'Reativar Carla Émile FICTÍCIA' }))
    expect(await screen.findByText('Carla Émile FICTÍCIA reativado')).toBeTruthy()
  })

  it('409 LAST_ADMIN ao desativar o último admin: aviso explicado', async () => {
    withLastAdminConflict()
    await rows()
    fireEvent.click(screen.getByRole('button', { name: 'Desativar Único Admin' }))
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Desativar conta?' })).getByRole('button', {
        name: 'Desativar',
      }),
    )
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('É o último administrador ativo')
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
