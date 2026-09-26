# Handoff — TASK-040 — implementação

> **Tarefas em paralelo (TASK-006):** este handoff fica em `handoffs/TASK-040.md` e não edita
> `handoffs/current.md` (índice geral, atualizado pela sessão principal).

| Campo | Valor |
|-------|-------|
| **Data/hora** | 2026-09-26 (UTC-3, Brasília) |
| **Tarefa** | `tasks/in-progress/TASK-040-login-e-usuarios-frontend.md` |
| **Etapa concluída** | implementação |
| **Papel exercido** | Implementador + Engenheiro de testes (mesma sessão; revisão independente não feita) |
| **Ferramenta/agente** | Claude Code (Opus 5.5), agente em segundo plano num worktree isolado |
| **Branch** | `task/TASK-040-login-e-usuarios-frontend`, a partir de `86e4929` (branch da TASK-039, ainda não mesclada) |
| **Duração aproximada** | 2 h 30 min |

---

## 1. Objetivo desta etapa

Login, sessão real no `AuthProvider`, guardas de rota por perfil, menu do usuário com "Sair" e página
Usuários (admin), contra o contrato real do backend da TASK-038 (branch `task/TASK-038-autenticacao-backend`).

## 2. O que foi feito

- Criei a branch com `git switch -c task/TASK-040-login-e-usuarios-frontend 86e4929` e movi a tarefa
  para `tasks/in-progress/`.
- Li a tarefa, os ADR-016 e 017, e conferi no backend da TASK-038 (`git show`, sem alterar nada):
  `auth_schemas.py` (camelCase), `users.py` (códigos 409 `USERNAME_TAKEN`, `LAST_ADMIN`,
  `OWN_ADMIN_ACCESS`, 404 `USER_NOT_FOUND`, 422 com `loc` em camelCase), `authorization.py`
  (corpo `{detail, code}`, `CsrfHeaderMiddleware`) e o job `e2e` do CI (`E2E_ADMIN_USERNAME=e2e-admin`).
- **CA-1 — cliente central:** criei `src/infrastructure/api/apiFetch.ts` (`createApiFetch`): toda
  chamada leva `credentials: 'same-origin'`; POST/PUT/PATCH/DELETE levam `X-Requested-With:
  crane-simulator`; 401 com código ≠ `INVALID_CREDENTIALS` avisa `unauthenticated` e 403 `FORBIDDEN`
  avisa `forbidden` (`onApiAuthEvent`). Os clientes existentes (catálogo, tabelas, avaliação REST)
  passaram a embrulhar o `fetch` com ele (mudança de uma linha em cada). O WebSocket não mudou.
- Criei os clientes `authRestClient.ts` (`/auth/session|login|logout`) e `usersRestClient.ts`
  (`GET/POST /users`, `PATCH /users/{id}`), com transporte comum em `authHttp.ts` (erros viram
  `AuthRequestError` com `code`, `httpStatus` e `fieldErrors`), e os tipos em `src/domain/auth/user.ts`
  e as portas em `src/application/auth/ports.ts`.
- **Sessão:** `AuthProvider` real (`GET /auth/session` na abertura; `signIn`, `signOut`); falha da
  conferência (sem backend) → modo sem autenticação (`status: 'disabled'`). Um 401 `NOT_AUTHENTICATED`
  em qualquer chamada leva a `unauthenticated` com `signedOutReason: 'expired'`.
- **Guardas (CA-3):** `src/app/auth/RouteGuards.tsx`: `RequireAuth` (tela "Conferindo a sessão…";
  sem sessão → `/login` com `state.from`, menos depois de "Sair") e `RequireRole` (usuário sem o
  perfil → página "Sem permissão"). Dentro da guarda, um 403 `FORBIDDEN` vira a notificação "Sem
  permissão". O trilho esconde a seção Administração de quem não é ADMIN (no modo sem banco ela fica).
- `AppProviders`: o catálogo e o rascunho do simulador só montam com sessão válida ou no modo sem
  banco, e remontam quando o usuário muda (sem chamadas 401 antes do login).
- **CA-2 — `/login`:** `LoginRoute` + `LoginPage` restilizada (grade técnica e traço de guindaste ao
  fundo, cartão de vidro, título, aviso FICTÍCIO discreto, mostrar/ocultar senha, carregando, mensagens
  para 401 e 429, "A sessão acabou" e "Você saiu"). Logado → vai ao destino; modo sem banco → Início com
  a notificação "Modo sem autenticação (sem banco)".
- **Menu do usuário:** nome e perfil; ao abrir, `@usuário`, selo do perfil e "Sair" (fecha com Esc ou
  clique fora). No modo sem banco: "Modo sem autenticação · sem banco · sem login".
- **CA-4 — Usuários:** `UsersPage` + `UserFormDrawer` + `userErrors.ts`: tabela com busca (sem acento e
  sem maiúsculas), criar e editar num Drawer (nome de usuário só na criação; senha opcional na edição;
  perfil travado na própria conta), confirmação antes de desativar, reativar direto, e 409
  `USERNAME_TAKEN` (aviso + campo), `LAST_ADMIN` e `OWN_ADMIN_ACCESS` explicados. "Desativar" fica
  desabilitado na própria conta, com a explicação.
- **Hook de permissões para a TASK-042:** `src/app/auth/usePermissions.ts` (ver § 5).
- **CA-5 — E2E:** `e2e/tests/auth.ts` exporta um `test` cujo fixture `page` entra como o admin de E2E
  pela API (`page.request`, que divide os cookies com o navegador) quando `E2E_BACKEND=1`; sem as
  credenciais, pula. `scene.spec.ts` e `evaluation.spec.ts` passaram a usá-lo. `auth.spec.ts`: login
  com volta ao destino, senha errada (com um usuário inexistente, para não gastar o limite de tentativas
  do admin), sair, e perfil (o admin cria um Operador pela página Usuários; o Operador não vê nem abre
  `/usuarios`, e a API responde 403). Um spec do modo sem autenticação (sessão respondida no navegador)
  roda sempre.
- `playwright.config.ts` ganhou `E2E_PREVIEW_PORT` (padrão `4173`), para rodar o preview em 5210 aqui.
- Testes Vitest novos: `apiFetch.test.ts`, `authRestClient.test.ts`, `application/auth/auth.test.ts`,
  `app/authFlow.test.tsx`, `presentation/users/usersPage.test.tsx`, com o backend falso
  `tests/helpers/fakeAuthBackend.ts` (contas FICTÍCIAS). Ajustei `app/appRoutes.test.tsx` à conferência
  assíncrona da sessão e ao modo sem autenticação.
- Conferi o visual em capturas locais (1440×900, com a API respondida no navegador): login, erro de
  login, Usuários, Drawer e menu. Corrigi o menu, que ficava translúcido sobre a página (a barra
  superior já tem `backdrop-filter`). As capturas não foram versionadas (a tarefa não pede).
- Atualizei `docs/development-guide.md` (variáveis `E2E_PREVIEW_PORT`, `E2E_ADMIN_*`, comando do E2E
  com backend) e `docs/testing-strategy.md` (linha do E2E de login e perfis).

## 3. Arquivos modificados

`git diff --stat 86e4929..HEAD` (antes do commit deste handoff):

```text
 docs/development-guide.md                                            |   8 +-
 docs/testing-strategy.md                                             |   1 +
 frontend/e2e/playwright.config.ts                                    |  11 +-
 frontend/e2e/tests/auth.spec.ts                                      | 128 ++++
 frontend/e2e/tests/auth.ts                                           |  64 ++
 frontend/e2e/tests/evaluation.spec.ts                                |   7 +-
 frontend/e2e/tests/scene.spec.ts                                     |   7 +-
 frontend/src/app/AppProviders.tsx                                    |  36 +-
 frontend/src/app/AppRoutes.tsx                                       |  49 +-
 frontend/src/app/auth/AuthProvider.tsx                               | 114 ++-
 frontend/src/app/auth/RouteGuards.tsx                                |  74 ++
 frontend/src/app/auth/authContext.ts                                 |  47 +-
 frontend/src/app/auth/usePermissions.ts                              |  20 +
 frontend/src/app/routes/LoginRoute.tsx                               |  60 ++
 frontend/src/app/routes/UsersRoute.tsx                               |  18 +
 frontend/src/application/auth/permissions.ts                         |  41 +
 frontend/src/application/auth/ports.ts                               |  34 +
 frontend/src/application/auth/userForm.ts                            |  90 ++
 frontend/src/domain/auth/user.ts                                     |  63 ++
 frontend/src/infrastructure/api/apiFetch.ts                          |  81 ++
 frontend/src/infrastructure/api/authHttp.ts                          | 143 +++
 frontend/src/infrastructure/api/authRestClient.ts                    |  44 +
 frontend/src/infrastructure/api/catalogRestClient.ts                 |   5 +-
 frontend/src/infrastructure/api/evaluationRestClient.ts              |   5 +-
 frontend/src/infrastructure/api/loadChartRestClient.ts               |   5 +-
 frontend/src/infrastructure/api/usersRestClient.ts                   |  37 +
 frontend/src/presentation/layout/AppShell.tsx                        |  26 +-
 frontend/src/presentation/layout/SessionCheckScreen.module.css       |  16 +
 frontend/src/presentation/layout/SessionCheckScreen.tsx              |  16 +
 frontend/src/presentation/layout/UserMenu.module.css                 | 113 ++-
 frontend/src/presentation/layout/UserMenu.tsx                        | 115 ++-
 frontend/src/presentation/pages/ForbiddenPage.tsx                    |  32 +
 frontend/src/presentation/pages/LoginPage.module.css                 | 129 ++-
 frontend/src/presentation/pages/LoginPage.tsx                        | 207 ++++-
 frontend/src/presentation/pages/UsersPage.module.css                 |  62 ++
 frontend/src/presentation/pages/UsersPage.tsx                        | 407 +++++-
 frontend/src/presentation/users/UserFormDrawer.module.css            |  39 +
 frontend/src/presentation/users/UserFormDrawer.tsx                   | 211 +++
 frontend/src/presentation/users/userErrors.ts                        |  58 +
 frontend/tests/app/appRoutes.test.tsx                                |  47 +-
 frontend/tests/app/authFlow.test.tsx                                 | 247 ++++
 frontend/tests/application/auth/auth.test.ts                         | 110 ++
 frontend/tests/helpers/fakeAuthBackend.ts                            | 175 +++
 frontend/tests/infrastructure/api/apiFetch.test.ts                   | 126 ++
 frontend/tests/infrastructure/api/authRestClient.test.ts             | 227 ++++
 frontend/tests/presentation/users/usersPage.test.tsx                 | 278 +++++
 handoffs/TASK-040.md                                                 |  27 +
 tasks/{backlog => in-progress}/TASK-040-login-e-usuarios-frontend.md |   4 +-
 48 files changed, 3705 insertions(+), 159 deletions(-)
```

**Arquivos da casca (TASK-039) alterados — atenção na integração:**
- `src/app/auth/AuthProvider.tsx` e `src/app/auth/authContext.ts` — reescritos (eram o ponto de
  encaixe falso). `AuthState` mudou: `status` agora é `'loading' | 'disabled' | 'unauthenticated' |
  'authenticated'` (saiu `'anonymous'`), `AuthUser` ganhou `username`, entraram `signIn` e
  `signedOutReason`; `ANONYMOUS_AUTH` virou `NO_AUTH_STATE` (sem provider = modo sem banco).
- `src/app/AppRoutes.tsx` — guardas, `LoginRoute`, `UsersRoute`, menu com `onSignOut`, filtro do trilho.
- `src/app/AppProviders.tsx` — `SessionScope` em volta de `CatalogProvider`/`SimulatorDraftProvider`;
  prop opcional `authGateway`.
- `src/presentation/layout/AppShell.tsx` — prop opcional `isNavItemVisible` e seção Administração só
  com itens (mudança cirúrgica).
- `src/presentation/layout/UserMenu.tsx` e `.module.css` — menu real (props `user`, `onSignOut`).
- `src/presentation/pages/LoginPage.tsx`/`.module.css` e `UsersPage.tsx` — eram espaços reservados.
- `tests/app/appRoutes.test.tsx` — `renderAt` agora é assíncrono (espera a sessão); dois testes
  trocados pelo comportamento do modo sem autenticação.
- `e2e/tests/scene.spec.ts` e `evaluation.spec.ts` — só o import de `test`/`expect` (de `./auth.js`).

Fora do escopo: nenhum. `docs/development-guide.md` e `docs/testing-strategy.md` mudaram porque os
comandos e as variáveis do E2E mudaram (AGENTS.md § 5, regra 9).

## 4. Comandos executados e resultados

Em `frontend/` (saídas reais, resumidas):

| Comando | Resultado | Saída (resumo) |
|---------|-----------|----------------|
| `npm run lint` | ✅ passou | `eslint .` sem erros |
| `npm run format:check` | ✅ passou | `All matched files use Prettier code style!` |
| `npm run typecheck` | ✅ passou | `tsc -b && tsc -p e2e` sem erros |
| `npm test` | ✅ passou | `Test Files 38 passed (38)`, `Tests 406 passed \| 1 skipped (407)` |
| `npm run build` | ✅ passou | `✓ built in 7.45s` |
| `E2E_PREVIEW_PORT=5210 npm run e2e` | ✅ passou | `8 passed`, `6 skipped` (os 4 de login/perfil e os 2 de avaliação, que precisam do backend) |
| `bash scripts/check-structure.sh` (raiz) | ✅ passou | `OK: 0 erros, 1 aviso(s)` (aviso: 4 tarefas em `in-progress/`) |
| E2E com backend e banco (`E2E_BACKEND=1`, `E2E_ADMIN_*`) | ⚠️ NÃO EXECUTADO | sem Docker nesta máquina (`failed to connect to the docker API`) e sem PostgreSQL; roda no job `e2e` do CI depois da integração com a TASK-038 |

Servidores: o `vite preview` do E2E (porta 5210) é derrubado pelo próprio Playwright; o preview das
capturas (porta 5211) foi encerrado com `Stop-Process`. Nenhum na 5173.

## 5. Decisões tomadas

- **API do hook de permissões (para a TASK-042):**

  ```ts
  import { useCan, usePermissions } from '../auth/usePermissions' // src/app/auth/usePermissions.ts
  const { canEdit, canManageUsers, canView, readOnlyReason } = useCan() // useCan === usePermissions
  ```

  - `canEdit`: ADMIN logado **ou** modo sem autenticação (sem banco) → pode cadastrar, importar, ativar.
  - `canManageUsers`: só ADMIN logado.
  - `canView`: sessão válida ou modo sem banco.
  - `readOnlyReason`: `null` quando `canEdit`; senão `"Só o perfil Administrador pode fazer esta
    alteração."` (para o `title`/dica de um botão desabilitado).
  - A lógica pura está em `src/application/auth/permissions.ts` (`permissionsFor(status, role)`).
  - Padrão sugerido: o componente de rota (`src/app/routes/CatalogRoute.tsx`, `TablesRoute.tsx`) lê
    `useCan()` e passa `canEdit`/`readOnlyReason` como props à página em `src/presentation/pages/`
    (as páginas não importam de `src/app`). Sem `AuthProvider` acima (testes de página), o contexto
    padrão é o modo sem banco: `canEdit: true`.
- Falha em `GET /auth/session` (rede ou HTTP ≠ 2xx) → modo sem autenticação, como pedido para o E2E sem
  backend. É só apresentação: o backend continua recusando com 401/403.
- O redirecionamento depois do login é declarativo (`<Navigate>` em `LoginRoute`), porque a mudança de
  sessão remonta as rotas (`SessionScope`).
- Depois de "Sair", o login não guarda destino (entrar de novo vai ao Início); depois de sessão
  expirada, guarda.
- `CatalogProvider` e `SimulatorDraftProvider` pertencem à sessão: não montam antes de a sessão ser
  conhecida e recomeçam quando o usuário muda (outro usuário não herda o rascunho).
- Login no E2E pela API (`page.request`) em vez do formulário, exceto nos specs do próprio login.
- `E2E_PREVIEW_PORT` no `playwright.config.ts`: a pessoa responsável pediu servidores só nas portas
  5210–5219; o padrão continua `4173` (CI não muda).
- Nenhuma dependência nova.

## 6. Regras de negócio aplicadas

- ADR-016 § 1 (perfis): Operador não abre `/usuarios` nem vê a seção Administração; `canEdit` só para
  ADMIN ou sem banco. Testes: `tests/app/authFlow.test.tsx` (guardas), `tests/application/auth/auth.test.ts`.
- ADR-016 § 2 (nome 3–64 `[a-z0-9._-]` em minúsculas, senha 10–128, proteções da própria conta e do
  último admin): conferência no cliente em `userForm.ts`; as recusas do backend (409/422) explicadas em
  `userErrors.ts`. Testes: `auth.test.ts`, `usersPage.test.tsx`.
- ADR-016 § 5 (sem banco): aviso "modo sem autenticação (sem banco)" no menu, na notificação do
  `/login` e na página Usuários.

## 7. O que NÃO foi feito e por quê

- **CA-3 nas páginas de Catálogo e Tabelas:** esconder/desabilitar as ações de escrita do Operador
  fica com a TASK-042 (que reescreve essas páginas), consumindo `useCan()`. Hoje, o Operador ainda vê os
  botões de cadastro/importação; se clicar, o backend responde 403 `FORBIDDEN` e a casca mostra a
  notificação "Sem permissão".
- E2E com backend e banco NÃO EXECUTADO localmente (sem Docker/PostgreSQL). Os specs de login e perfil
  foram escritos contra o contrato real da TASK-038 (conferido no código dela) e o backend falso dos
  testes Vitest imita esse contrato, mas só o job `e2e` do CI vai confirmar.
- Não alterei `.github/workflows/ci.yml`: a TASK-038 já cria `e2e-admin` e exporta `E2E_ADMIN_*`.
- Não atualizei `docs/architecture.md`, `docs/security.md`, `docs/known-gaps.md` (L-003) nem o
  README: a TASK-038 também os altera; melhor consolidar na integração (sessão principal).
- Sem capturas versionadas (a tarefa não pede).

## 8. Pendências / decisões necessárias (para a pessoa responsável)

| # | Pergunta | Bloqueia? | Resposta | Respondida em |
|---|----------|-----------|----------|---------------|
| 1 | Na integração, atualizar `docs/architecture.md` (frontend: sessão, guardas, `apiFetch`) e `docs/known-gaps.md` L-003 junto com a doc da TASK-038? | não | | |

## 9. ⚠️ Segurança

Nada exposto. Nenhuma senha real: as contas dos testes são FICTÍCIAS (em memória) e a senha do
Operador criado no E2E é gerada na hora. O frontend não lê nem guarda o token (cookie HttpOnly).

## 10. Próximo passo

**Papel:** Revisor (outra sessão/ferramenta), depois a sessão principal integra com TASK-038, 039 e 042.

**O que fazer, concretamente:**
1. Revisar o diff `86e4929..task/TASK-040-login-e-usuarios-frontend` com o checklist de revisão.
2. Na integração: mesclar sobre a TASK-039 e a TASK-038; rodar os gates e o job `e2e` do CI (com
   backend e banco), que exercita `auth.spec.ts` e o login dos demais specs.
3. TASK-042: consumir `useCan()` nas rotas de catálogo e tabelas (§ 5).

**Ler primeiro (nesta ordem):**
1. `AGENTS.md`
2. este handoff
3. `tasks/in-progress/TASK-040-login-e-usuarios-frontend.md` § 3
4. `frontend/src/infrastructure/api/apiFetch.ts` e `frontend/src/app/auth/AuthProvider.tsx`
5. `frontend/src/app/auth/RouteGuards.tsx` e `frontend/src/app/AppProviders.tsx`

**Cuidado com:**
- Se a TASK-039 mudar `AppRoutes.tsx`, `AppProviders.tsx`, `AppShell.tsx` ou `UserMenu.tsx` depois de
  `86e4929`, o conflito é nesses arquivos (lista na § 3).
- O limite de 5 falhas de login por usuário em 15 min (ADR-016 § 3): o spec de senha errada usa um
  usuário inexistente para não travar o `e2e-admin`.
- No Playwright, `getByLabel('Usuário', { exact: true })` não encontra o campo (o rótulo tem o `*`);
  use `getByLabel(/^Usuário/)`.

## 11. Como revisar este trabalho

- Comece por `apiFetch.ts` (cookie, CSRF, eventos de 401/403) e `AuthProvider.tsx` (estados da sessão).
- Risco maior: `SessionScope` em `AppProviders.tsx` remonta as rotas quando a sessão muda; conferir que
  nada perde estado que deveria manter.
- Tenho menos certeza sobre o E2E com backend (não rodou aqui) e sobre `page.request` levar o cookie
  `SameSite=Strict` de volta para as navegações da página (a documentação do Playwright diz que o
  `APIRequestContext` da página divide os cookies com o contexto).
