// Login, sair e perfis contra o backend real (TASK-040 CA-5; ADR-016/017). Precisam da stack com
// banco e do admin de E2E: rodam só com E2E_BACKEND=1 e as credenciais E2E_ADMIN_*, e são PULADOS,
// nunca aprovados em falso, sem eles. O modo sem autenticação (sem banco) é conferido à parte, com a
// sessão respondida no navegador, e roda sempre.

import { test } from '@playwright/test'

import {
  adminCredentials,
  CSRF_HEADERS,
  expect,
  hasAdminCredentials,
  hasBackend,
  loginViaApi,
  loginViaForm,
} from './auth.js'
import { mockCatalog } from './catalogMock.js'

test.describe('login e perfis com o backend', () => {
  test.skip(
    !hasBackend || !hasAdminCredentials,
    'precisa da stack com backend e banco (E2E_BACKEND=1) e do admin de E2E (E2E_ADMIN_USERNAME, E2E_ADMIN_PASSWORD)',
  )

  test('sem sessão, a rota guardada leva ao login; entrar volta ao destino', async ({ page }) => {
    await page.goto('/tabelas')
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Entrar' })).toBeVisible()
    await expect(page.getByText('FICTÍCIO', { exact: true })).toBeVisible()

    await loginViaForm(page, adminCredentials)
    await expect(page).toHaveURL(/\/tabelas$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Tabelas' })).toBeVisible()
    await expect(
      page.getByRole('button', { name: /Menu do usuário: .*Administrador/ }),
    ).toBeVisible()
  })

  test('senha errada: mensagem de erro e continua no login', async ({ page }) => {
    await page.goto('/login')
    // Usuário que não existe: não gasta as tentativas do admin de E2E (limite por usuário).
    await loginViaForm(page, {
      username: `e2e-inexistente-${Date.now()}`,
      password: 'senha-errada-de-e2e',
    })
    await expect(page.getByRole('alert')).toContainText('Usuário ou senha incorretos')
    await expect(page).toHaveURL(/\/login$/)
  })

  test('sair encerra a sessão: o menu leva ao login e as rotas voltam a pedir login', async ({
    page,
  }) => {
    await loginViaApi(page.request)
    await page.goto('/')
    await page.getByRole('button', { name: /Menu do usuário/ }).click()
    await page.getByRole('menuitem', { name: 'Sair' }).click()
    await expect(page.getByText('Você saiu da sessão.')).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)

    await page.goto('/catalogo')
    await expect(page).toHaveURL(/\/login$/)
    const session = await page.request.get('/api/v1/auth/session')
    expect(await session.json()).toMatchObject({ authEnabled: true, user: null })
  })

  test('o admin cria um Operador pela página Usuários; o Operador não vê nem abre /usuarios', async ({
    page,
    browser,
  }) => {
    const operator = {
      username: `e2e-operador-${Date.now()}`,
      password: `e2e-senha-${Math.random().toString(36).slice(2, 12)}`,
    }

    await loginViaApi(page.request)
    await page.goto('/usuarios')
    await expect(page.getByRole('table', { name: 'Contas de usuário' })).toBeVisible()
    await page.getByRole('button', { name: 'Novo usuário' }).click()
    const drawer = page.getByRole('dialog', { name: 'Novo usuário' })
    await drawer.getByLabel('Nome de usuário').fill(operator.username)
    await drawer.getByLabel('Nome de exibição').fill('Operador FICTÍCIO E2E')
    await drawer.getByLabel('Perfil').selectOption('OPERATOR')
    await drawer.getByLabel(/^Senha/).fill(operator.password)
    await drawer.getByRole('button', { name: 'Criar usuário' }).click()
    await expect(page.getByText(`Conta @${operator.username} criada`)).toBeVisible()
    await page.getByLabel('Buscar').fill(operator.username)
    await expect(
      page.getByRole('table', { name: 'Contas de usuário' }).getByText(`@${operator.username}`),
    ).toBeVisible()

    // O Operador, num contexto próprio (outro cookie).
    const context = await browser.newContext()
    const operatorPage = await context.newPage()
    await operatorPage.goto('/login')
    await loginViaForm(operatorPage, operator)
    await expect(operatorPage.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible()
    const nav = operatorPage.getByRole('navigation', { name: 'Navegação principal' })
    await expect(nav.getByRole('link', { name: 'Catálogo' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Usuários' })).toHaveCount(0)

    await operatorPage.goto('/usuarios')
    await expect(operatorPage.getByText('Sem permissão')).toBeVisible()
    const forbidden = await operatorPage.request.get('/api/v1/users')
    expect(forbidden.status()).toBe(403)
    const createAsOperator = await operatorPage.request.post('/api/v1/users', {
      data: {
        username: 'nao-deve-criar',
        displayName: 'x',
        password: 'x'.repeat(12),
        role: 'ADMIN',
      },
      headers: CSRF_HEADERS,
    })
    expect(createAsOperator.status()).toBe(403)
    await context.close()
  })
})

test('modo sem autenticação (sem banco): /login leva ao Início com o aviso', async ({ page }) => {
  await page.route('**/api/v1/auth/session', (route) =>
    route.fulfill({ json: { authEnabled: false, user: null } }),
  )
  await mockCatalog(page)
  await page.goto('/login')
  await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible()
  await expect(page.getByText('Modo sem autenticação (sem banco)')).toBeVisible()
  await expect(page.getByTestId('user-menu')).toContainText('Modo sem autenticação')
})
