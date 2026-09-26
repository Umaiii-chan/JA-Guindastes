# TASK-036 — Dividir o pacote do frontend e criar os testes ponta a ponta

| Campo | Valor |
|-------|-------|
| **Status** | in-progress |
| **Prioridade** | média |
| **Criada em** | 2026-09-26 pela pessoa responsável (leva C, via orquestrador) |
| **Iniciada em** | 2026-09-26 |
| **Concluída em** | — |
| **Branch** | `task/TASK-036-e2e-e-bundle` (a partir de `development` @ `d58edf6`) |
| **PR** | — |
| **Requisitos** | doc-fonte § 20.3 (testes de frontend; operação do Canvas) |
| **Regras de negócio** | RN-007 e RN-008 (o resultado que vale é o do backend) — só verificadas, não alteradas |
| **Estimativa** | M |

---

## 1. Objetivo

O build do frontend deixa de gerar um chunk acima de 500 kB (o Three.js sai do chunk da aplicação),
e existe uma suíte ponta a ponta com Playwright que abre a página no navegador, confere a cena 3D,
os sliders e a avaliação respondida pelo backend, rodando no CI contra a stack Docker.

## 2. Contexto

- O build gerava um só chunk de ~800 kB e o aviso "Some chunks are larger than 500 kB"
  (handoffs da TASK-013/016/032).
- A stack Docker (TASK-027) já sobe no CI com teste de fumaça (job "Imagens Docker"); faltava
  exercitar a interface num navegador de verdade.
- Tarefas paralelas da leva C: TASK-033/034 mexem em `frontend/src` e `App.tsx`; TASK-035 no seed,
  Dockerfile e `docker-compose.yml`. Esta tarefa não toca esses arquivos.

## 3. Critérios de aceite

- [ ] **CA-1** — Dado o `npm run build`, quando o Vite empacota, então nenhum chunk passa de 500 kB
  (sem o aviso), o Three.js fica em chunk(s) separado(s) da aplicação, e os tamanhos antes/depois
  ficam registrados no handoff.
- [ ] **CA-2** — Dado o frontend servido (vite preview ou nginx), quando o Playwright abre a página,
  então o título e os painéis aparecem sem erro de página.
- [ ] **CA-3** — Dado o navegador sem GPU, quando a cena monta, então existe um `<canvas>` visível
  com tamanho > 0, os sliders ficam habilitados e a mensagem de falha do WebGL não aparece.
- [ ] **CA-4** — Dado a cena montada, quando os sliders de inclinação da lança e de comprimento do
  cabo vão do mínimo ao máximo pelo teclado, então o raio de trabalho, a altura da ponta e a altura
  do gancho do painel de pré-visualização mudam.
- [ ] **CA-5** — Dado a stack com backend (`E2E_BACKEND=1`), quando se informa uma configuração
  inexistente e uma carga, então o painel mostra "Não avaliável" com `CRANE_GEOMETRY_NOT_FOUND`;
  sem `E2E_BACKEND=1`, o teste é pulado (nunca aprovado em falso).
- [ ] **CA-6** — O teste do fluxo com dados semeados só roda com `E2E_SEED_CONFIGURATION_ID`
  (seed da TASK-035) e falha se o backend alegar configuração/tabela ausentes; sem a variável, é
  pulado.
- [ ] **CA-7** — Existe um job novo "E2E" no CI que sobe a stack (`.env` de CI,
  `docker compose up --wait`, `alembic upgrade head`), roda o Playwright (Chromium) contra o nginx e
  publica o relatório como artefato em caso de falha; os jobs existentes não mudam.
- [ ] **CA-8** — Gates do frontend (`npm ci`, `lint`, `format:check`, `typecheck`, `test`, `build`)
  e `bash scripts/check-structure.sh` passam; nenhum teste existente quebra.

## 4. Escopo

### Dentro do escopo

- `frontend/vite.config.ts` (divisão do pacote).
- Pasta nova `frontend/e2e/` (config, tsconfig e testes do Playwright).
- `frontend/package.json` / `package-lock.json` (`@playwright/test`, scripts `e2e` e `typecheck`).
- Job novo `e2e` em `.github/workflows/ci.yml`.

### Fora do escopo (explicitamente — o agente NÃO faz)

- Alterar `frontend/src/` (inclusive import dinâmico da cena), `App.tsx`, Dockerfile,
  `docker-compose.yml` ou o seed.
- Editar `handoffs/current.md`, `README.md` ou `docs/*.md` (as mudanças necessárias vão listadas
  no handoff).

## 5. Arquivos provavelmente afetados

| Arquivo | Tipo de mudança | Verificado? |
|---------|-----------------|-------------|
| `frontend/vite.config.ts` | alterar | sim |
| `frontend/e2e/**` | criar | sim |
| `frontend/package.json`, `frontend/package-lock.json` | alterar | sim |
| `.github/workflows/ci.yml` | alterar (job novo) | sim |

## 6. Riscos e dependências

- Depende da TASK-035 para o fluxo com dados semeados (teste pulado até lá).
- Risco: WebGL sem GPU no CI → mitigação: Chromium com SwiftShader (`--enable-unsafe-swiftshader`).

## 7. Teste manual (se houver)

Não há: tudo é automatizado (`npm run e2e`).

---

## 8. Plano (preenchido pelo Planejador)

| # | Passo | Arquivos | Como verificar | Feito |
|---|-------|----------|----------------|-------|
| 1 | Dividir o pacote com `codeSplitting` | `frontend/vite.config.ts` | `npm run build` sem aviso | [x] |
| 2 | Playwright + testes da cena e da avaliação | `frontend/e2e/**`, `package.json` | `npm run e2e` | [x] |
| 3 | Job "E2E" no CI | `.github/workflows/ci.yml` | actionlint; CI do PR | [x] |

## 9. Cenários de teste (preenchido pelo Engenheiro de testes)

| Cenário | Critério | Tipo | Arquivo de teste | Status |
|---------|----------|------|------------------|--------|
| página carrega com título e painéis | CA-2 | E2E | `frontend/e2e/tests/scene.spec.ts` | verde (local) |
| canvas visível e sliders habilitados | CA-3 | E2E | `frontend/e2e/tests/scene.spec.ts` | verde (local) |
| sliders mudam a pré-visualização | CA-4 | E2E | `frontend/e2e/tests/scene.spec.ts` | verde (local) |
| sem configuração, painel pede a configuração | CA-2 | E2E | `frontend/e2e/tests/scene.spec.ts` | verde (local) |
| configuração inexistente → "Não avaliável" | CA-5 | E2E | `frontend/e2e/tests/evaluation.spec.ts` | verde (local, backend sem banco) |
| fluxo com dados semeados | CA-6 | E2E | `frontend/e2e/tests/evaluation.spec.ts` | pulado (aguarda TASK-035) |

## 10. Parecer da revisão (preenchido pelo Revisor)

—

## 11. Encerramento (preenchido ao mover para completed/)

—
