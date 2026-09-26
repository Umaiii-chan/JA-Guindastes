// Testes ponta a ponta do frontend (TASK-036; doc-fonte § 20.3: operação do Canvas), com Playwright.
//
// Dois modos, escolhidos por variável de ambiente:
//
// - sem E2E_BASE_URL (padrão, local): o Playwright faz `npm run build` e sobe `vite preview` em
//   127.0.0.1:4173, roda os testes e derruba o servidor no fim. Sem backend: os testes que precisam
//   dele são pulados (ver E2E_BACKEND abaixo).
// - com E2E_BASE_URL (CI, job "E2E"): usa o frontend já servido (ex.: nginx da stack Docker em
//   http://127.0.0.1:8080) e não sobe servidor nenhum.
//
// E2E_BACKEND=1 liga os testes que precisam do backend atrás de /api (a stack Docker).
// E2E_SEED_CONFIGURATION_ID liga o teste do fluxo com dados semeados (seed da TASK-035).
//
// Rodar, em frontend/:
//   npx playwright install chromium        # uma vez por máquina
//   npm run e2e                            # contra o vite preview
//   E2E_BASE_URL=http://127.0.0.1:8080 E2E_BACKEND=1 npm run e2e   # contra a stack Docker
//
// Saídas (relatório HTML e traces) ficam em node_modules/.tmp/e2e/, como o tsbuildinfo do tsc: fora
// do Git, do Prettier e do ESLint. Abrir o relatório: npx playwright show-report node_modules/.tmp/e2e/report

import { fileURLToPath } from 'node:url'

import { defineConfig, devices } from '@playwright/test'

const FRONTEND_DIR = fileURLToPath(new URL('..', import.meta.url))
const OUTPUT_DIR = fileURLToPath(new URL('../node_modules/.tmp/e2e/', import.meta.url))
const PREVIEW_URL = 'http://127.0.0.1:4173'

const externalBaseUrl = process.env.E2E_BASE_URL
const isCi = Boolean(process.env.CI)

export default defineConfig({
  testDir: './tests',
  outputDir: `${OUTPUT_DIR}results`,
  // Um worker só: sem GPU, cada página renderiza a cena no SwiftShader (CPU). Com vários workers e a
  // gravação de trace, as páginas travaram por falta de CPU (medido na TASK-036); são poucos testes.
  workers: 1,
  forbidOnly: isCi,
  // Sem retentativa: um teste instável deve aparecer como falha, não passar na segunda vez.
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: `${OUTPUT_DIR}report`, open: 'never' }]],
  use: {
    baseURL: externalBaseUrl ?? PREVIEW_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'pt-BR',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Sem GPU (CI e headless), o WebGL do Three.js roda no SwiftShader; o Chromium atual só o
        // usa com esta opção explícita.
        launchOptions: { args: ['--enable-unsafe-swiftshader'] },
      },
    },
  ],
  webServer: externalBaseUrl
    ? undefined
    : {
        command: 'npm run build && npx vite preview --host 127.0.0.1 --port 4173 --strictPort',
        cwd: FRONTEND_DIR,
        url: PREVIEW_URL,
        reuseExistingServer: !isCi,
        timeout: 180_000,
      },
})
