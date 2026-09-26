# TASK-006 — Permitir tarefas em paralelo no protocolo

| Campo | Valor |
|-------|-------|
| **Status** | in-progress |
| **Prioridade** | alta |
| **Criada em** | 2026-09-26 por Anderson Sehnem (pedido em sessão com o agente Claude Code) |
| **Iniciada em** | 2026-09-26 |
| **Concluída em** | — |
| **Branch** | `task/TASK-006-tarefas-paralelas` (a partir de `development` @ `c0955b2`) |
| **PR** | — |
| **Requisitos** | — |
| **Regras de negócio** | — |
| **Estimativa** | P |

---

## 1. Objetivo

Várias tarefas podem andar ao mesmo tempo sem que as branches entrem em conflito no handoff e sem
que o CI falhe pelo limite de tarefas em andamento.

## 2. Contexto

Pedido da pessoa em 2026-09-26: "execute mais de 1 atividade por vez, quero terminar logo esse
projeto". Ela escolheu "3 ou mais por vez" e deu autorização permanente para mover tarefas mergeadas
para `completed/`. Antes, o protocolo limitava a 2 tarefas em andamento (`tasks/README.md`,
`scripts/check-structure.sh`), e todas reescreviam o mesmo `handoffs/current.md`.

## 3. Critérios de aceite

- [ ] **CA-1** — Dado até 4 tarefas em `tasks/in-progress/`, quando rodo `bash scripts/check-structure.sh`,
  então não há erro por quantidade (só o aviso de conferir arquivos em comum); com 5, falha.
- [ ] **CA-2** — Dada uma tarefa em andamento com `handoffs/TASK-NNN.md` e sem menção em
  `handoffs/current.md`, quando rodo o script, então não há erro de handoff.
- [ ] **CA-3** — `AGENTS.md`, `tasks/README.md` e `handoffs/README.md` descrevem a regra (até 4 tarefas;
  handoff por tarefa; `current.md` como índice).
- [ ] **CA-4** — `handoffs/current.md` virou índice e registra as autorizações permanentes da pessoa; a
  TASK-005 foi movida para `completed/`.

## 4. Escopo

### Dentro do escopo

- `scripts/check-structure.sh` (seção 3), `AGENTS.md` (§§ 1, 2 e 7), `tasks/README.md`, `handoffs/README.md`,
  `handoffs/current.md`, mover a TASK-005.

### Fora do escopo (explicitamente — o agente NÃO faz)

- Qualquer código do produto; `.github/workflows/*`.

## 5. Arquivos provavelmente afetados

| Arquivo | Tipo de mudança | Verificado? |
|---------|-----------------|-------------|
| `scripts/check-structure.sh` | alterar | sim |
| `AGENTS.md`, `tasks/README.md`, `handoffs/README.md`, `handoffs/current.md` | alterar | sim |
| `tasks/completed/TASK-005-*`, `handoffs/history/2026-09-26-TASK-005-implementacao.md`, `handoffs/TASK-006.md` | mover / criar | sim |

## 6. Riscos e dependências

- Risco: duas tarefas paralelas alterarem o mesmo arquivo → o script avisa a partir de 2 tarefas, e a
  divisão de tarefas é feita para não compartilhar arquivos.

## 7. Teste manual (se houver)

Ver handoff § 4 (simulação com 4 e 5 tarefas, e com handoff por tarefa).

---

## 8. Plano (preenchido pelo Planejador)

| # | Passo | Arquivos | Como verificar | Feito |
|---|-------|----------|----------------|-------|
| 1 | Limite 4 e handoff por tarefa no script | `check-structure.sh` | CA-1, CA-2 | [x] |
| 2 | Documentar a regra | 3 READMEs/AGENTS | CA-3 | [x] |
| 3 | Índice em `current.md`, mover TASK-005 | `handoffs/`, `tasks/` | CA-4 | [x] |

## 9. Cenários de teste (preenchido pelo Engenheiro de testes)

Simulação manual em cópia temporária (handoff § 4).

## 10. Parecer da revisão (preenchido pelo Revisor)

**Resultado:** — (aguardando revisão)

## 11. Encerramento (preenchido ao mover para completed/)

- O que foi entregue (2–3 linhas):
- O que ficou de fora e virou tarefa nova: TASK-...
- Aprendizados para o template/docs:
