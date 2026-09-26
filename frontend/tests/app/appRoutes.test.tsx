// @vitest-environment jsdom
// Casca, rotas do ADR-017 § 1 e página Início (TASK-039), com o backend do catálogo falso (FICTÍCIO).
// A rota do simulador fica de fora: ela monta a cena WebGL (coberta pelo E2E).

import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AppProviders } from '../../src/app/AppProviders'
import { AppRoutes } from '../../src/app/AppRoutes'
import { catalogFicticio } from '../fixtures/catalogFicticio'
import { createFakeCatalogFetch, jsonResponse } from '../helpers/fakeCatalogFetch'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppProviders>
        <AppRoutes />
      </AppProviders>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  window.localStorage.clear()
  vi.stubGlobal('fetch', createFakeCatalogFetch(catalogFicticio()))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('casca', () => {
  it('trilho com as rotas, a atual marcada, título da página e menu do usuário reservado', () => {
    renderAt('/usuarios')
    const nav = screen.getByRole('navigation', { name: 'Navegação principal' })
    const links = within(nav).getAllByRole('link')
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/',
      '/simulador',
      '/catalogo',
      '/tabelas',
      '/usuarios',
    ])
    expect(within(nav).getByRole('link', { name: 'Usuários' }).getAttribute('aria-current')).toBe(
      'page',
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Usuários' })).toBeTruthy()
    expect(screen.getByTestId('user-menu').textContent).toContain('Sem autenticação')
    expect(screen.getByText('A gestão de usuários chega com o login')).toBeTruthy()
  })

  it('o trilho recolhe e expande, e lembra a escolha', () => {
    renderAt('/usuarios')
    const toggle = screen.getByRole('button', { name: /Recolher menu|Expandir menu/ })
    const startedExpanded = toggle.getAttribute('aria-expanded') === 'true'
    fireEvent.click(toggle)
    const toggled = screen.getByRole('button', {
      name: startedExpanded ? 'Expandir menu' : 'Recolher menu',
    })
    expect(toggled.getAttribute('aria-expanded')).toBe(String(!startedExpanded))
    expect(window.localStorage.getItem('ja-guindastes.rail-collapsed')).toBe(
      startedExpanded ? '1' : '0',
    )
  })

  it('rota desconhecida mostra a página não encontrada, com volta ao início', () => {
    renderAt('/nao-existe')
    expect(screen.getByRole('heading', { level: 1, name: 'Página não encontrada' })).toBeTruthy()
    expect(screen.getByText('/nao-existe')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Ir para o início' }).getAttribute('href')).toBe('/')
  })

  it('/login fica fora da casca (espaço reservado da TASK-040)', () => {
    renderAt('/login')
    expect(screen.queryByRole('navigation', { name: 'Navegação principal' })).toBeNull()
    expect(screen.getByRole('heading', { level: 1, name: 'Entrar' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Continuar sem login/ }).getAttribute('href')).toBe('/')
  })

  it('a ajuda abre uma janela modal e fecha com Esc', () => {
    renderAt('/usuarios')
    fireEvent.click(screen.getByRole('button', { name: 'Ajuda' }))
    expect(screen.getByRole('dialog', { name: 'Como ler o simulador' })).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('página Início', () => {
  it('atalhos, avisos permanentes e o resumo do catálogo (carregando → contagens)', async () => {
    renderAt('/')
    expect(screen.getByRole('heading', { level: 1, name: 'Início' })).toBeTruthy()
    const shortcuts = screen.getByRole('navigation', { name: 'Atalhos' })
    expect(
      within(shortcuts)
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual(['/simulador', '/catalogo', '/tabelas'])
    expect(screen.getByText('Dados FICTÍCIOS')).toBeTruthy()
    expect(screen.getByText('Estratégia PROVISÓRIA')).toBeTruthy()
    expect(screen.getByText('Carregando o resumo do catálogo…')).toBeTruthy()

    const counts = await screen.findByRole('list', { name: 'Contagens do catálogo' })
    expect(
      within(counts)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['2Fabricantes', '3Guindastes', '3Configurações'])
    expect(
      screen
        .getByRole('meter', { name: 'Configurações com ficha técnica' })
        .getAttribute('aria-valuenow'),
    ).toBe('2')
  })

  it('catálogo vazio: orienta a cadastrar', async () => {
    vi.stubGlobal(
      'fetch',
      createFakeCatalogFetch({ manufacturers: [], cranes: [], configurations: [] }),
    )
    renderAt('/')
    expect(await screen.findByText('O catálogo está vazio')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Cadastrar no catálogo' }).getAttribute('href')).toBe(
      '/catalogo',
    )
  })

  it('erro do backend: mensagem em alerta e "Tentar de novo" recarrega', async () => {
    let failing = true
    vi.stubGlobal(
      'fetch',
      createFakeCatalogFetch(catalogFicticio(), () =>
        failing ? jsonResponse({ detail: 'Bad Gateway' }, 502) : undefined,
      ),
    )
    renderAt('/')
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Não foi possível ler o catálogo')
    failing = false
    fireEvent.click(within(alert).getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByRole('list', { name: 'Contagens do catálogo' })).toBeTruthy()
  })
})
