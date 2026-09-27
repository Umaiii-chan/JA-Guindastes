// Login nos testes ponta a ponta (TASK-040; ADR-016). Com backend (E2E_BACKEND=1), toda rota exige
// sessão: o fixture `page` daqui entra como o admin de E2E antes de cada teste. As credenciais vêm do
// ambiente (E2E_ADMIN_USERNAME e E2E_ADMIN_PASSWORD; o job "E2E" do CI cria esse admin com uma senha
// que só existe no CI). Sem backend (vite preview), `/auth/session` falha, a aplicação cai no modo
// sem autenticação e o fixture não faz nada.

import { test as base, expect, type APIRequestContext, type Page } from '@playwright/test'

export const hasBackend = process.env.E2E_BACKEND === '1'

export const adminCredentials = {
  username: process.env.E2E_ADMIN_USERNAME?.trim() ?? '',
  password: process.env.E2E_ADMIN_PASSWORD ?? '',
}

export const hasAdminCredentials =
  adminCredentials.username !== '' && adminCredentials.password !== ''

/** Cabeçalho contra CSRF exigido pelo backend em todo POST/PUT/PATCH/DELETE (ADR-016 § 3). */
export const CSRF_HEADERS = { 'X-Requested-With': 'crane-simulator' } as const

/**
 * Entra pela API, no mesmo contexto do navegador: o cookie HttpOnly da resposta fica com a página
 * (`page.request` divide os cookies com o contexto).
 */
export async function loginViaApi(
  request: APIRequestContext,
  credentials: { username: string; password: string } = adminCredentials,
): Promise<void> {
  const response = await request.post('/api/v1/auth/login', {
    data: credentials,
    headers: CSRF_HEADERS,
  })
  expect(response.status(), `login de ${credentials.username} pela API`).toBe(200)
}

/** Preenche e envia o formulário de login (já em /login). */
export async function loginViaForm(
  page: Page,
  credentials: { username: string; password: string },
): Promise<void> {
  await page.getByLabel(/^Usuário/).fill(credentials.username)
  await page.getByLabel(/^Senha/).fill(credentials.password)
  await page.getByRole('button', { name: 'Entrar' }).click()
}

/**
 * `test` com login automático: com backend, entra como o admin de E2E antes do teste (e pula, sem
 * aprovar em falso, se as credenciais não estiverem no ambiente); sem backend, não faz nada.
 */
export const test = base.extend({
  page: async ({ page }, provide) => {
    if (hasBackend) {
      base.skip(
        !hasAdminCredentials,
        'com backend, toda rota exige login: defina E2E_ADMIN_USERNAME e E2E_ADMIN_PASSWORD',
      )
      await loginViaApi(page.request)
    }
    await provide(page)
  },
})

export { expect }
