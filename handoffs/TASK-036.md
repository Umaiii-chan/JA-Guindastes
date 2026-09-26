# Handoff — TASK-036 — implementação

| Campo | Valor |
|-------|-------|
| **Data/hora** | 2026-09-26 (UTC-3, Brasília) |
| **Tarefa** | `tasks/in-progress/TASK-036-e2e-e-bundle.md` |
| **Etapa concluída** | implementação |
| **Papel exercido** | Planejador, Engenheiro de testes e Implementador (mesma sessão; a revisão deve ser outra) |
| **Ferramenta/agente** | Claude Code (Opus 5.5), agente em segundo plano num git worktree isolado |
| **Branch** | `task/TASK-036-e2e-e-bundle` @ commit deste handoff (código em `0889013`), a partir de `d58edf6` |
| **Duração aproximada** | 1 h |

---

## 1. Objetivo desta etapa

Eliminar o aviso de chunk > 500 kB do build do frontend e criar a suíte ponta a ponta com Playwright,
local (vite preview) e no CI (job novo "E2E" contra a stack Docker).

## 2. O que foi feito

- **Divisão do pacote** (`frontend/vite.config.ts`): `build.rolldownOptions.output.codeSplitting`
  (Vite 8.3.1 usa Rolldown; `manualChunks` está obsoleto nele) com grupos `three-addons`
  (`three/examples/`), `three-core` (`three/build/three.core.js`), `three` (resto do pacote, na
  prática `build/three.module.js`) e `react` (`react`, `react-dom`, `scheduler`), com
  `includeDependenciesRecursively: false` (senão o grupo dos addons puxava o núcleo do Three.js e
  ficava com 558,68 kB). O Three.js é distribuído em dois módulos já empacotados, por isso precisa de
  dois grupos: num só, ficava com 538,90 kB, ainda acima do aviso.
- **Tamanhos** (saída real do `vite build`, minificado):

  | | Antes (`d58edf6`) | Depois |
  |---|---|---|
  | `index-*.js` (aplicação) | **806,91 kB** (gzip 215,77 kB) | 29,05 kB (gzip 9,88 kB) |
  | `react-*.js` | — | 218,84 kB (gzip 68,24 kB) |
  | `three-core-*.js` | — | 187,95 kB (gzip 50,52 kB) |
  | `three-*.js` | — | 352,32 kB (gzip 84,71 kB) |
  | `three-addons-*.js` | — | 19,85 kB (gzip 4,41 kB) |
  | Soma dos JS | 806,91 kB | 808,01 kB |
  | Aviso "chunks larger than 500 kB" | sim | **não** |

  Todos os chunks continuam carregados na abertura da página (import estático + `modulepreload`):
  mudou só a divisão em arquivos (cache melhor entre versões da aplicação), não o comportamento nem
  o volume inicial. Carregar a cena sob demanda (`import()`/`React.lazy`) exige mexer em
  `frontend/src` (TASK-033/034) → Pendência 1.
- **Playwright** (`frontend/e2e/`):
  - `playwright.config.ts`: sem `E2E_BASE_URL`, faz `npm run build` e sobe `vite preview` em
    127.0.0.1:4173 (e o derruba no fim); com `E2E_BASE_URL`, usa o servidor dado (nginx no CI).
    Só Chromium, com `--enable-unsafe-swiftshader` (WebGL sem GPU). `workers: 1` (ver § 5),
    `retries: 0`, trace/screenshot só em falha. Saídas em `frontend/node_modules/.tmp/e2e/`.
  - `tests/scene.spec.ts` (sem backend): página e painéis; canvas visível com tamanho > 0, sliders
    habilitados e sem a mensagem de falha do WebGL; inclinação da lança do mínimo ao máximo (teclado
    `Home`/`End`, eventos reais) muda raio de trabalho e altura da ponta; comprimento do cabo muda a
    altura do gancho; sem configuração, o painel de avaliação pede a configuração. Todos conferem que
    não houve `pageerror`.
  - `tests/evaluation.spec.ts` (com backend, só com `E2E_BACKEND=1`): configuração inexistente
    (`e2e-configuracao-inexistente-FICTICIO`) + 1000 kg → "Não avaliável" com
    `CRANE_GEOMETRY_NOT_FOUND`, "Recebida por WebSocket|REST" e nenhum alerta de erro. Fluxo com
    dados semeados: só com `E2E_SEED_CONFIGURATION_ID`; exige um veredito do backend e falha se
    aparecer `CRANE_GEOMETRY_NOT_FOUND` ou `ACTIVE_LOAD_CHART_NOT_FOUND`.
  - `tsconfig.json` próprio; o script `typecheck` passou a ser `tsc -b && tsc -p e2e`, para o gate de
    tipos cobrir os testes E2E. Script novo `e2e`.
- **CI**: job novo `e2e` ("E2E (Playwright contra a stack Docker)") em `.github/workflows/ci.yml`,
  com `needs: structure`: `.env` de CI igual ao do job "Imagens Docker", build das duas imagens,
  `docker compose up --detach --no-build --wait --wait-timeout 180`, `alembic upgrade head` no
  container, Node 24 + `npm ci`, `npx playwright install --with-deps chromium`,
  `E2E_BASE_URL=http://127.0.0.1:8080 E2E_BACKEND=1 npm run e2e`; em falha, artefato
  `playwright-report` (relatório HTML + traces, `include-hidden-files: true` porque a pasta é
  `node_modules/.tmp/e2e/`) e logs da stack; `docker compose down --volumes` sempre. Os jobs
  existentes não foram alterados.
- Tags das Actions conferidas com `gh api repos/<owner>/<repo>/git/ref/tags/<tag>`:
  `actions/checkout@v4`, `actions/setup-node@v4`, `actions/upload-artifact@v4` → `refs/tags/v4`.

## 3. Arquivos modificados

```text
$ git diff --stat d58edf6..0889013
 .github/workflows/ci.yml                   |  64 ++++++++++++++++
 frontend/e2e/playwright.config.ts          |  69 +++++++++++++++++
 frontend/e2e/tests/evaluation.spec.ts      |  56 ++++++++++++++
 frontend/e2e/tests/scene.spec.ts           |  99 ++++++++++++++++++++++++
 frontend/e2e/tsconfig.json                 |  18 +++++
 frontend/package-lock.json                 |  54 ++++++++++++-
 frontend/package.json                      |   6 +-
 frontend/vite.config.ts                    |  24 ++++++
 tasks/in-progress/TASK-036-e2e-e-bundle.md | 118 +++++++++++++++++++++++++++++
```

Mais este handoff (`handoffs/TASK-036.md`). Nada fora do escopo. O `package-lock.json` ganhou também
o campo `"version": "0.1.0"` na raiz (normalização do `npm install`).

**Dependência nova (AGENTS.md § 9):** `@playwright/test` `^1.63.0` (instalada 1.63.0; traz
`playwright` e `playwright-core` 1.63.0), licença **Apache-2.0** (lida no `package-lock.json` e em
`npm view @playwright/test license`), fonte: registro npm (Microsoft). Motivo: executor de testes
ponta a ponta num navegador real (Chromium), pedido pela tarefa; só `devDependency`, não entra no
bundle. O navegador é baixado à parte por `npx playwright install chromium` (não pelo `npm ci`).

## 4. Comandos executados e resultados

| Comando (em `frontend/`, salvo indicação) | Resultado | Saída (resumo) |
|---------|-----------|----------------|
| `npm run build` (antes, em `d58edf6`) | ⚠️ aviso | `index-*.js 806.91 kB` + "Some chunks are larger than 500 kB" |
| `npm ci` | ✅ | `found 0 vulnerabilities` |
| `npm run lint` | ✅ | sem saída de erro |
| `npm run format:check` | ✅ | `All matched files use Prettier code style!` |
| `npm run typecheck` | ✅ | `tsc -b && tsc -p e2e` sem erros |
| `npm test` | ✅ | `Test Files 18 passed (18)` · `Tests 217 passed \| 1 skipped (218)` |
| `npm run build` (depois) | ✅ | 5 chunks JS, maior 352,32 kB, sem aviso |
| `npx playwright install chromium` | ✅ | Chromium do Playwright 1.63.0 instalado |
| `npm run e2e` (vite preview, sem backend) ×3 | ✅ | `5 passed · 2 skipped` (≈4 s cada) |
| `E2E_BACKEND=1 npm run e2e` (vite preview + `uv run uvicorn app.main:app` sem `DATABASE_URL`) | ✅ | `6 passed · 1 skipped` |
| `E2E_BACKEND=1 E2E_SEED_CONFIGURATION_ID=nao-semeada npx playwright test ... -g semeados` | ✅ falhou como esperado | `1 failed` em `CRANE_GEOMETRY_NOT_FOUND` (prova de que não aprova em falso) |
| Job `e2e` contra a stack Docker | ⚠️ NÃO EXECUTADO localmente | Docker não sobe nesta máquina (pendência 6 do índice); roda no CI do PR |
| `uvx --from actionlint-py actionlint .github/workflows/ci.yml` (raiz) | ✅ | `exit=0`, sem apontamentos |
| `bash scripts/check-structure.sh` (raiz) | ✅ | `OK: 0 erros, 0 aviso(s)` |

Os servidores subidos à mão para diagnóstico (vite preview na 4173 e uvicorn na 8000) foram
encerrados; conferido com `Get-NetTCPConnection` (nenhuma porta escutando). O `vite preview` do
`webServer` do Playwright é derrubado pelo próprio Playwright.

```text
Running 7 tests using 1 worker
  ok 1 … avaliação pelo backend › sem dados cadastrados para a configuração, a avaliação responde "não avaliável" (2.6s)
  -  2 … avaliação pelo backend › com os dados semeados, a avaliação usa a configuração e a tabela ativa
  ok 3 … a página carrega com o título e os painéis (442ms)
  ok 4 … a cena 3D aparece num canvas e libera os sliders (643ms)
  ok 5 … a inclinação da lança muda o raio de trabalho e a altura da ponta na pré-visualização (611ms)
  ok 6 … o comprimento do cabo muda a altura do gancho na pré-visualização (548ms)
  ok 7 … sem configuração informada, o painel de avaliação pede a configuração (402ms)
  1 skipped
  6 passed (6.5s)
```

A execução com backend acima foi contra o proxy do `vite preview` (que herda o `server.proxy`) e o
backend **sem banco**, não contra nginx + PostgreSQL; a resposta esperada é a mesma
(`NOT_EVALUABLE` com `CRANE_GEOMETRY_NOT_FOUND`, `backend/app/main.py` e `evaluate_operation.py`).

## 5. Decisões tomadas

- **`codeSplitting` no `vite.config.ts` em vez de import dinâmico**: o import dinâmico da cena
  exigiria alterar `frontend/src` (dono: TASK-033/034). O `codeSplitting` elimina o aviso sem mudar
  comportamento; o carregamento sob demanda fica como pendência.
- **`workers: 1` no Playwright**: com o padrão (vários workers) e a gravação de trace, 2 a 5 testes
  travaram por timeout (a página parava de responder; `Fixture "trace recording" timeout`), porque
  cada página renderiza a cena no SwiftShader (CPU). Com 1 worker, 3 execuções seguidas passaram em
  ≈4 s. São poucos testes.
- **`retries: 0`**: teste instável deve aparecer como falha.
- **Sliders pelo teclado (`Home`/`End`)**: gera eventos reais do navegador, que o `onChange` do
  React recebe; não depende do valor inicial dos limites FICTÍCIOS.
- **Saídas em `frontend/node_modules/.tmp/e2e/`**: o Prettier (`prettier --check .`) não respeita
  `.gitignore` aninhado e reprovaria o relatório HTML e o `error-context.md`; editar
  `frontend/.gitignore`/`.prettierignore` estaria fora do escopo. `node_modules/.tmp` já é usado
  pelo `tsbuildinfo` (`tsconfig.*.json`) e fica fora de Git, Prettier e ESLint.
- **Fluxo com dados semeados** depende só de `E2E_SEED_CONFIGURATION_ID` (o id não é fixado no
  teste) e afirma apenas que o backend encontrou configuração e tabela: sem conhecer os valores do
  seed, afirmar "Avaliado" ou uma capacidade seria inventar (Pendência 2).
- Nenhuma decisão arquitetural nova: sem ADR.

## 6. Regras de negócio aplicadas

- RN-007/RN-008: os testes só leem o que o backend devolve ("Não avaliável" + motivo); nada de regra
  no teste. Nenhuma regra nova encontrada.

## 7. O que NÃO foi feito e por quê

- Job `e2e` não executado localmente: Docker indisponível nesta máquina. Validação só por
  actionlint; a primeira execução real será no CI do PR.
- Carregamento sob demanda da cena (`import()`): fora do escopo (`frontend/src`).
- Teste do fluxo com dados semeados: pulado até a TASK-035 definir o seed e a variável ser ligada.
- Não editei `docs/*.md`, `README.md` nem `handoffs/current.md` (regra da leva C). Mudanças
  necessárias, para a TASK-037 ou para a pessoa:
  - `docs/development-guide.md` § 3: comando `npm run e2e` (e `npx playwright install chromium`
    uma vez por máquina), variáveis `E2E_BASE_URL`, `E2E_BACKEND`, `E2E_SEED_CONFIGURATION_ID`; o
    `typecheck` agora inclui `tsc -p e2e`; job novo "E2E" no CI.
  - `docs/testing-strategy.md`: camada de testes ponta a ponta (Playwright, Chromium, SwiftShader),
    o que cobre e onde roda.
  - `docs/architecture.md` (se descrever o build): divisão do pacote em chunks.
  - `docs/known-gaps.md`: remover/atualizar a lacuna do bundle > 500 kB, se estiver listada; e
    registrar que o fluxo E2E com dados semeados depende da TASK-035.
  - `handoffs/current.md`: marcar a TASK-036 quando for mergeada.

## 8. Pendências / decisões necessárias (para a pessoa responsável)

| # | Pergunta | Bloqueia? | Resposta | Respondida em |
|---|----------|-----------|----------|---------------|
| 1 | Carregar a cena 3D sob demanda (`React.lazy`/`import()` no `CraneViewport`) numa tarefa futura, depois da TASK-033/034? Reduziria o JS inicial (~560 kB do Three.js); hoje só a divisão em arquivos mudou. | não | | |
| 2 | Quando a TASK-035 entrar: qual configuração semeada usar, e o job `e2e` deve rodar o seed e definir `E2E_SEED_CONFIGURATION_ID`? Com os valores do seed, o teste pode afirmar "Avaliado" e a capacidade esperada. | não | | |
| 3 | Tornar o job "E2E" obrigatório (branch protection) ou mantê-lo informativo até estabilizar no CI? | não | | |

## 9. ⚠️ Segurança (se houver algo)

- nada a relatar (as credenciais do `.env` do job valem só para containers efêmeros, como no job
  "Imagens Docker").

## 10. Próximo passo

**Papel:** Revisor (outra sessão/ferramenta), depois a pessoa responsável

**O que fazer, concretamente:**
1. Revisar `git diff development...task/TASK-036-e2e-e-bundle`.
2. Conferir no CI do PR o job "E2E (Playwright contra a stack Docker)" verde e, se falhar, baixar o
   artefato `playwright-report`.
3. Responder as pendências do § 8.

**Ler primeiro (nesta ordem):**
1. `AGENTS.md`
2. este handoff
3. `tasks/in-progress/TASK-036-e2e-e-bundle.md` § 3
4. `frontend/e2e/playwright.config.ts` (modos local/CI e variáveis)
5. `frontend/vite.config.ts` (grupos do `codeSplitting`)

**Cuidado com:**
- Mudanças de texto dos rótulos/títulos em `frontend/src` (TASK-033/034) quebram os seletores dos
  testes (`getByLabel('Inclinação da lança')`, região `/Geometria/`, região `/Avaliação/`,
  `dt:text-is("Raio de trabalho") + dd`). Se a TASK-033/034 mudar esses textos, ajustar os specs.
- Rodar o Playwright com vários workers faz a cena travar (SwiftShader); mantenha `workers: 1`.

## 11. Como revisar este trabalho

- Comece por `frontend/e2e/tests/evaluation.spec.ts`: é onde está a garantia de "nunca falso
  positivo" (skip condicional por variável e asserções negativas).
- Tenho menos certeza sobre o tempo do job `e2e` no CI (build das duas imagens + instalação do
  Chromium com `--with-deps`); o `timeout-minutes: 25` é estimativa.
- O job `e2e` repete o build das imagens do job "Imagens Docker" (jobs independentes não
  compartilham imagens sem registry/artefato); aceitei a duplicação para não alterar o job existente.
