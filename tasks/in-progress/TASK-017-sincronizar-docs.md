# TASK-017 — Sincronizar documentos e textos desatualizados

| Campo | Valor |
|-------|-------|
| **Status** | in-progress |
| **Prioridade** | média |
| **Criada em** | 2026-09-26 por Anderson Sehnem (pedido em sessão com o agente Claude Code) |
| **Iniciada em** | 2026-09-26 |
| **Concluída em** | — |
| **Branch** | `task/TASK-017-sincronizar-docs` (a partir de `d5eedab`) |
| **PR** | — |
| **Requisitos** | RNF-011 |
| **Regras de negócio** | — |
| **Estimativa** | P |

---

## 1. Objetivo

Documentos e textos que diziam "não existe código" ou "convenção de ângulos pendente" passam a refletir
o estado real depois das TASK-007..014 e do aceite do ADR-013.

## 2. Contexto

Pendências das TASK-013 e TASK-014 (handoffs em `handoffs/history/`): textos desatualizados que elas não
podiam editar por causa das tarefas paralelas. Esta branch também leva o commit-base da leva
TASK-015..017 (`d5eedab`).

## 3. Critérios de aceite

- [ ] **CA-1** — `docs/architecture.md` (status, § 2 e § 9), `docs/known-gaps.md` (L-001, §§ 5 e 6) e
  `docs/project-overview.md` § 6 descrevem o que existe hoje, sem dizer que não há código.
- [ ] **CA-2** — As docstrings de `angle.py` e `capacity_query.py` e o nome do teste de ângulo negativo
  citam o ADR-013 em vez de "convenção pendente".
- [ ] **CA-3** — Gates do backend (ruff, format, pytest) e `check-structure.sh` passam.

## 4. Escopo

### Dentro do escopo

- Os arquivos do CA-1 e CA-2; esta tarefa; `handoffs/TASK-017.md`.

### Fora do escopo (explicitamente — o agente NÃO faz)

- `docs/development-guide.md` § 4 e `docs/architecture.md` § 7 (em edição pela TASK-011).

## 5. Arquivos provavelmente afetados

| Arquivo | Tipo de mudança | Verificado? |
|---------|-----------------|-------------|
| `docs/architecture.md`, `docs/known-gaps.md`, `docs/project-overview.md` | alterar | sim |
| `backend/app/domain/value_objects/angle.py`, `capacity_query.py`, `backend/tests/domain/test_quantities.py` | alterar (texto) | sim |

## 6. Riscos e dependências

- Conflito com a TASK-011 em `docs/architecture.md`: seções diferentes (esta não toca a § 7).

## 7. Teste manual (se houver)

Não se aplica.

---

## 8. Plano (preenchido pelo Planejador)

| # | Passo | Arquivos | Como verificar | Feito |
|---|-------|----------|----------------|-------|
| 1 | Atualizar docs | 3 docs | CA-1 | [x] |
| 2 | Atualizar docstrings e nome do teste | 3 arquivos do backend | CA-2, CA-3 | [x] |

## 9. Cenários de teste (preenchido pelo Engenheiro de testes)

Não se aplica (só texto e renomeação de teste).

## 10. Parecer da revisão (preenchido pelo Revisor)

**Resultado:** — (aguardando revisão)

## 11. Encerramento (preenchido ao mover para completed/)

- O que foi entregue (2–3 linhas):
- O que ficou de fora e virou tarefa nova: TASK-...
- Aprendizados para o template/docs:
