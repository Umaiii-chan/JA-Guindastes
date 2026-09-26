# TASK-007 — Criar o esqueleto do frontend com gates

| Campo | Valor |
|-------|-------|
| **Status** | completed |
| **Prioridade** | alta |
| **Criada em** | 2026-09-26 por Anderson Sehnem (pedido em sessão com o agente Claude Code) |
| **Iniciada em** | 2026-09-26 |
| **Concluída em** | 2026-09-26 |
| **Branch** | `task/TASK-007-esqueleto-frontend` (a partir de `development` @ `c0955b2`) |
| **PR** | [#7](https://github.com/Umaiii-chan/JA-Guindastes/pull/7), mergeado em 2026-09-26 |
| **Requisitos** | RNF-008, RNF-009 |
| **Regras de negócio** | — |
| **Estimativa** | M |

---

## 1. Objetivo

O frontend passa a existir como esqueleto (Vite + React + TypeScript + Three.js puro), com gates iguais
no local e no CI, para receber a PoC Three.js e a integração com o backend.

## 2. Contexto

Toolchain do ADR-012 (Node 24 + npm, Vite, Three.js puro, Vitest, ESLint, Prettier). O template atual
do `create-vite` traz o oxlint no lugar do ESLint; ele foi trocado pelo ESLint para seguir o ADR-012
(aceito). Alteração do `ci.yml` autorizada pela pessoa (TASK-004). Tarefa paralela às TASK-006, 008 e
009 (sem arquivos em comum). Handoff próprio em `handoffs/TASK-007.md` (regra da TASK-006).

## 3. Critérios de aceite

- [ ] **CA-1** — Dado `frontend/`, quando rodo `npm ci`, `npm run lint`, `npm run format:check`,
  `npm run typecheck`, `npm test` e `npm run build`, então todos terminam com exit 0.
- [ ] **CA-2** — Dado um import de `three` fora de `src/three/`, quando rodo `npm run lint`, então o
  ESLint acusa erro citando o ADR-005.
- [ ] **CA-3** — Dado o CI, quando o PR roda, então o job "Frontend (lint, formatação, tipos, testes,
  build)" executa os mesmos comandos de `docs/development-guide.md` § 3 e passa.
- [ ] **CA-4** — `docs/development-guide.md` §§ 1–5 trazem os comandos e convenções reais do frontend.

## 4. Escopo

### Dentro do escopo

- `frontend/` (config de TypeScript strict, ESLint com a regra do ADR-005, Prettier, Vitest; app React
  mínimo; `createScene` em `src/three/scene/` com 1 teste); job `quality` do CI; `development-guide.md`;
  `.gitignore` (worktrees dos agentes).

### Fora do escopo (explicitamente — o agente NÃO faz)

- PoC Three.js com o guindaste, `CraneController`, câmera/controles, integração com a API.

## 5. Arquivos provavelmente afetados

| Arquivo | Tipo de mudança | Verificado? |
|---------|-----------------|-------------|
| `frontend/**` | criar | sim |
| `.github/workflows/ci.yml` (job `quality`) | alterar | sim |
| `docs/development-guide.md`, `.gitignore` | alterar | sim |
| `tasks/in-progress/TASK-007-esqueleto-frontend.md`, `handoffs/TASK-007.md` | criar | sim |

## 6. Riscos e dependências

- Depende da TASK-006 para o `check-structure.sh` aceitar `handoffs/TASK-007.md` (ver handoff).

## 7. Teste manual (se houver)

1. Em `frontend/`: `npm run dev` e abrir a URL do Vite. **Esperado:** título "Simulador de Tabelas de Carga de Guindastes".

---

## 8. Plano (preenchido pelo Planejador)

| # | Passo | Arquivos | Como verificar | Feito |
|---|-------|----------|----------------|-------|
| 1 | Scaffold Vite react-ts; trocar oxlint por ESLint; Three.js, Vitest, Prettier | `frontend/` | CA-1 | [x] |
| 2 | Regra "Three.js só em src/three/" | `eslint.config.js` | CA-2 | [x] |
| 3 | Job do CI | `ci.yml` | CA-3 | [x] |
| 4 | Guia de desenvolvimento | `development-guide.md` | CA-4 | [x] |

## 9. Cenários de teste (preenchido pelo Engenheiro de testes)

| Cenário | Critério | Tipo | Arquivo de teste | Status |
|---------|----------|------|------------------|--------|
| cria cena Three.js vazia | CA-1 | unitário | `frontend/tests/three/createScene.test.ts` | verde |
| import proibido de `three` fora de `src/three/` | CA-2 | manual (ESLint) | — | verificado |

## 10. Parecer da revisão (preenchido pelo Revisor)

**Resultado:** — (aguardando revisão)

## 11. Encerramento (preenchido ao mover para completed/)

> Movida para `completed/` em 2026-09-26 pela autorização permanente da pessoa responsável (tarefas mergeadas; revisão independente dispensada). O CI do PR rodou antes da TASK-006 entrar em `development`; o CI de `development` depois dos merges foi o que validou.

- O que foi entregue (2–3 linhas):
- O que ficou de fora e virou tarefa nova: TASK-...
- Aprendizados para o template/docs:
