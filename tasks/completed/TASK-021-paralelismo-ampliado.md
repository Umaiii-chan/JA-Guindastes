# TASK-021 — Ampliar o paralelismo para 15 tarefas e abrir a leva A

| Campo | Valor |
|-------|-------|
| **Status** | completed |
| **Prioridade** | alta |
| **Criada em** | 2026-09-26 por Anderson Sehnem (pedido em sessão com o agente Claude Code) |
| **Iniciada em** | 2026-09-26 |
| **Concluída em** | 2026-09-26 |
| **Branch** | `task/TASK-021-paralelismo-ampliado` (a partir da TASK-020 + `development`) |
| **PR** | [#21](https://github.com/Umaiii-chan/JA-Guindastes/pull/21), mergeado em 2026-09-26 |
| **Requisitos** | — |
| **Regras de negócio** | — |
| **Estimativa** | P |

---

## 1. Objetivo

Permitir até 15 tarefas em paralelo e servir de base comum para as tarefas da leva A (TASK-022..028).

## 2. Contexto

Pedido da pessoa em 2026-09-26: "execute as 15 em paralelo se possível, quero terminar o quanto antes".
O limite era 4 (TASK-006). Esta branch parte da TASK-020 (PR #20, ainda aberto) mesclada com
`development` (que já tem as TASK-016 e 019), para que a leva A tenha a consulta conservadora e o
endpoint de validação.

## 3. Critérios de aceite

- [ ] **CA-1** — `scripts/check-structure.sh` aceita até 15 tarefas em `tasks/in-progress/` (falha com 16).
- [ ] **CA-2** — `tasks/README.md`, `AGENTS.md` e `handoffs/README.md` dizem 15.
- [ ] **CA-3** — TASK-016 e TASK-019 em `completed/`; índice `handoffs/current.md` atualizado.

## 4. Escopo

### Dentro do escopo

- Os arquivos dos CAs; esta tarefa; `handoffs/TASK-021.md`.

### Fora do escopo (explicitamente — o agente NÃO faz)

- Código do produto.

## 5. Arquivos provavelmente afetados

| Arquivo | Tipo de mudança | Verificado? |
|---------|-----------------|-------------|
| `scripts/check-structure.sh`, `tasks/README.md`, `AGENTS.md`, `handoffs/README.md`, `handoffs/current.md` | alterar | sim |

## 6. Riscos e dependências

- **Mergear depois do PR #20 e antes dos PRs da leva A**, que partem desta branch.

## 7. Teste manual (se houver)

Não se aplica.

---

## 8. Plano (preenchido pelo Planejador)

| # | Passo | Arquivos | Como verificar | Feito |
|---|-------|----------|----------------|-------|
| 1 | Limite 15 e docs | 4 arquivos | CA-1, CA-2 | [x] |
| 2 | Mover 016/019; índice | `tasks/`, `handoffs/` | CA-3 | [x] |

## 9. Cenários de teste (preenchido pelo Engenheiro de testes)

Não se aplica.

## 10. Parecer da revisão (preenchido pelo Revisor)

**Resultado:** — (aguardando revisão)

## 11. Encerramento (preenchido ao mover para completed/)

> Movida para `completed/` em 2026-09-26 pela autorização permanente da pessoa responsável (revisão independente dispensada).

- O que foi entregue (2–3 linhas):
- O que ficou de fora e virou tarefa nova: TASK-...
- Aprendizados para o template/docs:
