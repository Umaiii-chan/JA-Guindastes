# TASK-005 — Corrigir a versão da action setup-uv no job de backend do CI

| Campo | Valor |
|-------|-------|
| **Status** | in-progress |
| **Prioridade** | alta (CI de `development` quebrado) |
| **Criada em** | 2026-09-26 por Anderson Sehnem (pedido em sessão com o agente Claude Code) |
| **Iniciada em** | 2026-09-26 |
| **Concluída em** | — |
| **Branch** | `task/TASK-005-corrigir-setup-uv-ci` (a partir de `development` @ `f0d0bfc`) |
| **PR** | — |
| **Requisitos** | — |
| **Regras de negócio** | — |
| **Estimativa** | P |

---

## 1. Objetivo

O job "Backend" do CI volta a rodar. No PR #4 (TASK-004) ele falhou antes de executar qualquer passo,
e o PR foi mergeado assim.

## 2. Contexto

Log do job no run `36259482656`: `Unable to resolve action astral-sh/setup-uv@v10, unable to find
version v10`. A action não publica a tag de versão maior `v10`; só existem as tags completas.
Verifiquei com `gh api repos/astral-sh/setup-uv/git/ref/tags/...`: `v10` → Not Found; `v10.2.0` →
`c18668ad…`. O erro foi do agente na TASK-004, que supôs uma tag `v10` sem conferir.

Alterar `.github/workflows/ci.yml` (arquivo protegido) está dentro da autorização dada pela pessoa na
TASK-004, para os gates de backend e frontend.

## 3. Critérios de aceite

- [ ] **CA-1** — Dado o `ci.yml`, quando procuro `setup-uv`, então o job `backend` usa uma tag que
  existe (`astral-sh/setup-uv@v10.2.0`).
- [ ] **CA-2** — Dado o PR desta tarefa, quando o CI roda, então o job "Backend (lint, tipos, camadas,
  testes)" termina com sucesso.

## 4. Escopo

### Dentro do escopo

- Uma linha do `.github/workflows/ci.yml`; esta tarefa; handoff.
- Uma linha em `docs/development-guide.md` § 9 sobre o push recusado por falta do escopo `workflow` (problema encontrado ao subir a TASK-004).

### Fora do escopo (explicitamente — o agente NÃO faz)

- Qualquer outra mudança no CI (concorrência, job do frontend).

## 5. Arquivos provavelmente afetados

| Arquivo | Tipo de mudança | Verificado? |
|---------|-----------------|-------------|
| `.github/workflows/ci.yml` | alterar (1 linha) | sim |
| `tasks/in-progress/TASK-005-corrigir-setup-uv-ci.md`, `handoffs/` | criar / reescrever | sim |

## 6. Riscos e dependências

- Nenhum: a tag existe e aponta para o commit `c18668ad…`.

## 7. Teste manual (se houver)

Não se aplica: a verificação é o próprio CI do PR (CA-2).

---

## 8. Plano (preenchido pelo Planejador)

| # | Passo | Arquivos | Como verificar | Feito |
|---|-------|----------|----------------|-------|
| 1 | Trocar `@v10` por `@v10.2.0` | `ci.yml` | CA-1 | [x] |
| 2 | Handoff, commit, PR | — | CA-2 | [ ] |

## 9. Cenários de teste (preenchido pelo Engenheiro de testes)

Não se aplica.

## 10. Parecer da revisão (preenchido pelo Revisor)

**Resultado:** — (aguardando revisão)

## 11. Encerramento (preenchido ao mover para completed/)

- O que foi entregue (2–3 linhas):
- O que ficou de fora e virou tarefa nova: TASK-...
- Aprendizados para o template/docs: conferir se a tag de uma action existe antes de usá-la.
