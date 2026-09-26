# TASK-003 — Registrar as decisões arquiteturais da doc-fonte como ADRs Propostos

| Campo | Valor |
|-------|-------|
| **Status** | in-progress |
| **Prioridade** | alta |
| **Criada em** | 2026-09-26 por Anderson Sehnem (pedido em sessão com o agente Claude Code) |
| **Iniciada em** | 2026-09-26 |
| **Concluída em** | — |
| **Branch** | `task/TASK-003-adrs-do-simulador` (a partir de `development` @ `1b4dbaa`) |
| **PR** | — |
| **Requisitos** | — (os ADRs citam os RF/RNF relacionados) |
| **Regras de negócio** | — |
| **Estimativa** | P |

---

## 1. Objetivo

As 8 decisões arquiteturais da doc-fonte v0.1 (§ 7) passam a existir no formato de ADR do
repositório, com status `Proposto`, para a pessoa responsável aceitar ou rejeitar.

## 2. Contexto

A doc-fonte numera suas decisões como ADR-001..008, mas esses números já existem aqui. A pessoa
decidiu em 2026-09-26 (TASK-002, decisão 3) que elas seriam rascunhadas como ADR-004..011 `Proposto`.
Mapeamento: ADR-00N da doc-fonte = ADR-(N+3) deste repositório.

## 3. Critérios de aceite

- [ ] **CA-1** — Dado `docs/decisions/`, quando listo os arquivos, então existem ADR-004..ADR-011, todos
  com status `Proposto` e todas as seções de `ADR-000-template.md`.
- [ ] **CA-2** — Dado cada ADR, quando comparo a seção "Decisão" com a doc-fonte § 7 (l.168–205), então
  o texto é literal, e o "Contexto" cita as linhas de origem e o número original.
- [ ] **CA-3** — Dado cada ADR, quando reviso "Alternativas" e "Consequências", então nada foi
  inventado: onde a doc-fonte é omissa, o texto diz "não registrad(o/a)s na doc-fonte".
- [ ] **CA-4** — Dado `docs/decisions/README.md` e `docs/architecture.md` § 8, quando reviso, então os
  8 ADRs estão listados como `Proposto`, com links válidos (`check-structure.sh` sem link quebrado).

## 4. Escopo

### Dentro do escopo

- `docs/decisions/ADR-004..011-*.md`, índice e `docs/architecture.md` § 8.

### Fora do escopo (explicitamente — o agente NÃO faz)

- Aceitar os ADRs (decisão da pessoa).
- Reavaliar tecnicamente as decisões ou acrescentar alternativas que a doc-fonte não registra.
- ADRs de toolchain/layout (tarefa seguinte).

## 5. Arquivos provavelmente afetados

| Arquivo | Tipo de mudança | Verificado? |
|---------|-----------------|-------------|
| `docs/decisions/ADR-004-clean-architecture-no-backend.md` … `ADR-011-monorepo.md` | criar (8) | sim |
| `docs/decisions/README.md`, `docs/architecture.md` | alterar | sim |
| `tasks/in-progress/TASK-003-adrs-do-simulador.md`, `handoffs/` | criar / reescrever | sim |

## 6. Riscos e dependências

- Risco: aceitar ADRs sem alternativas registradas → cada ADR avisa que alternativas, se desejadas,
  entram antes do aceite.

## 7. Teste manual (se houver)

1. `bash scripts/check-structure.sh` → **Esperado:** `OK: 0 erros`.

---

## 8. Plano (preenchido pelo Planejador)

| # | Passo | Arquivos | Como verificar | Feito |
|---|-------|----------|----------------|-------|
| 1 | Gerar os 8 ADRs por script a partir da doc-fonte § 7 (texto literal) | `docs/decisions/` | CA-1, CA-2, CA-3 | [x] |
| 2 | Atualizar índice e architecture § 8 | 2 arquivos | CA-4 | [x] |
| 3 | Handoff, check, commit | — | CA-4 | [x] |

## 9. Cenários de teste (preenchido pelo Engenheiro de testes)

Não se aplica: tarefa só de documentação.

## 10. Parecer da revisão (preenchido pelo Revisor)

**Resultado:** — (aguardando revisão)

## 11. Encerramento (preenchido ao mover para completed/)

- O que foi entregue (2–3 linhas):
- O que ficou de fora e virou tarefa nova: TASK-...
- Aprendizados para o template/docs:
