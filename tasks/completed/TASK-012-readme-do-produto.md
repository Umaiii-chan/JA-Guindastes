# TASK-012 — Reescrever o README para o produto

| Campo | Valor |
|-------|-------|
| **Status** | completed |
| **Prioridade** | média |
| **Criada em** | 2026-09-26 por Anderson Sehnem (pedido em sessão com o agente Claude Code) |
| **Iniciada em** | 2026-09-26 |
| **Concluída em** | 2026-09-26 |
| **Branch** | `task/TASK-012-readme-do-produto` (a partir de `ae2ec66`) |
| **PR** | [#10](https://github.com/Umaiii-chan/JA-Guindastes/pull/10), mergeado em 2026-09-26 |
| **Requisitos** | RNF-011 |
| **Regras de negócio** | — |
| **Estimativa** | P |

---

## 1. Objetivo

O `README.md` passa a apresentar o produto (o simulador), e não mais o template de workflow.

## 2. Contexto

Decisão da pessoa em 2026-09-26 (TASK-002, decisão 1): o repositório deixa de ser template. O README
ainda descrevia o template e citava `src/` e `tests/`, que não existem mais. Esta branch também contém
o commit-base da leva TASK-010..013 (TASK-006..009 movidas para `completed/`, índice atualizado).

## 3. Critérios de aceite

- [ ] **CA-1** — Dado o `README.md`, quando leio, então ele descreve o simulador, a premissa de segurança,
  o estado atual, a stack, a estrutura real de pastas, como rodar backend e frontend e como o trabalho é
  organizado, sem citar `src/`/`tests/` do template.
- [ ] **CA-2** — `bash scripts/check-structure.sh` passa (sem link quebrado no README).

## 4. Escopo

### Dentro do escopo

- `README.md`; esta tarefa; `handoffs/TASK-012.md`.

### Fora do escopo (explicitamente — o agente NÃO faz)

- Guias do template em `docs/guides/` (tarefa futura).

## 5. Arquivos provavelmente afetados

| Arquivo | Tipo de mudança | Verificado? |
|---------|-----------------|-------------|
| `README.md` | reescrever | sim |

## 6. Riscos e dependências

- Nenhum.

## 7. Teste manual (se houver)

Não se aplica.

---

## 8. Plano (preenchido pelo Planejador)

| # | Passo | Arquivos | Como verificar | Feito |
|---|-------|----------|----------------|-------|
| 1 | Reescrever o README | `README.md` | CA-1, CA-2 | [x] |

## 9. Cenários de teste (preenchido pelo Engenheiro de testes)

Não se aplica.

## 10. Parecer da revisão (preenchido pelo Revisor)

**Resultado:** — (aguardando revisão)

## 11. Encerramento (preenchido ao mover para completed/)

> Movida para `completed/` em 2026-09-26 pela autorização permanente da pessoa responsável (revisão independente dispensada).

- O que foi entregue (2–3 linhas):
- O que ficou de fora e virou tarefa nova: TASK-...
- Aprendizados para o template/docs:
