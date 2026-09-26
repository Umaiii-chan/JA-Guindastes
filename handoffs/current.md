# Handoff — índice geral do projeto

> Desde a TASK-006 (2026-09-26), até 4 tarefas podem andar em paralelo, e **cada uma tem o próprio
> handoff em `handoffs/TASK-NNN.md`**. Este arquivo é o índice: estado do projeto, autorizações
> permanentes da pessoa responsável e pendências gerais. Branches de tarefa não o editam
> (ver `handoffs/README.md` → "Tarefas em paralelo").

| Campo | Valor |
|-------|-------|
| **Data/hora** | 2026-09-26 15:15 (UTC-3, Brasília) |
| **Atualizado por** | agente Claude Code 2.1.280 (Opus 5.5), no commit-base da leva TASK-010..013 |
| **Branch de referência** | `development` @ `f7570d7` |

---

## 1. Estado do projeto

- Produto: Simulador Web 3D para Análise de Tabelas de Carga de Guindastes (`docs/project-overview.md`).
- Contexto mínimo preenchido (TASK-002); ADR-003..012 aceitos; toolchain no ADR-012.
- Backend: esqueleto em Clean Architecture com gates no CI (TASK-004/005) e núcleo de domínio da tabela de carga, sem interpolação (TASK-008). Frontend: esqueleto com gates (TASK-007).
- ADR-013 (convenções geométricas provisórias) está **Proposto**: aguarda aceite da pessoa.
- Concluídas: TASK-001..009 (`tasks/completed/`).

## 2. Tarefas em andamento e seus handoffs

| Tarefa | Handoff | O que é |
|--------|---------|---------|
| TASK-010 | `handoffs/TASK-010.md` (na branch da tarefa) | importação de tabela CSV com relatório de inconsistências |
| TASK-011 | `handoffs/TASK-011.md` (na branch da tarefa) | persistência: Docker Compose + PostgreSQL + SQLAlchemy + Alembic |
| TASK-012 | `handoffs/TASK-012.md` (na branch da tarefa) | README do produto |
| TASK-013 | `handoffs/TASK-013.md` (na branch da tarefa) | PoC Three.js com guindaste provisório e controles (só visual) |

## 3. Autorizações permanentes da pessoa responsável

Dadas em chat em 2026-09-26. Valem até a pessoa revogar.

1. **Mover para `tasks/completed/` toda tarefa que ela mergear**, registrando na tarefa que a revisão
   independente (AGENTS.md § 3) foi dispensada por ela.
2. **Até 4 tarefas em paralelo**, inclusive com agentes em segundo plano em worktrees separadas,
   desde que não toquem os mesmos arquivos (TASK-006).
3. **Alterar `.github/workflows/ci.yml`** para os gates de backend e frontend (TASK-004).
4. **Dados fictícios rotulados FICTÍCIO** nos testes, até a tabela oficial chegar (ADR-012).
5. **Fazer push e abrir PR** de cada tarefa assim que ela ficar pronta, sem perguntar a cada vez. O
   merge continua sendo da pessoa.

## 4. O que foi feito

Histórico por tarefa em `handoffs/history/`. Últimos: `handoffs/history/2026-09-26-TASK-006..009-implementacao.md`.

## 5. Arquivos modificados

Ver o handoff de cada tarefa (seção 2).

## 6. Comandos executados e resultados

Ver o handoff de cada tarefa (seção 2).

## 7. Pendências gerais (para a pessoa responsável)

| # | Pergunta | Bloqueia? | Resposta | Respondida em |
|---|----------|-----------|----------|---------------|
| 1 | Apagar as branches das tarefas mergeadas (`task/TASK-001..009`, remotas e locais) | não | | |
| 2 | Versão mais nova da doc-fonte (P-013) · onde fica o orquestrador (P-010) · dados oficiais podem ir ao repositório e a agentes de IA (P-007) | não | | |
| 4 | Aceitar, pedir mudanças ou rejeitar o ADR-013 (destrava `GeometryService` e cálculo de raio/altura); perguntas G-1..G-8 para a empresa no próprio ADR | sim, para a geometria | | |
| 5 | 11 perguntas de domínio da TASK-008 em `handoffs/history/2026-09-26-TASK-008-implementacao.md` § 8 | não | | |
| 3 | Antes de mergear, conferir se todos os checks estão verdes (sem branch protection, o GitHub não impede) e usar **squash** | — | | |

## 8. ⚠️ Segurança

- nada a relatar

## 9. Próximo passo

**Papel:** Pessoa responsável

1. Revisar e mergear os PRs das tarefas em andamento (seção 2), começando pela TASK-006, que muda o
   protocolo de que as outras dependem.
2. Responder as pendências da seção 7.

**Ler primeiro:** `AGENTS.md`, este índice e o handoff da tarefa que for trabalhar.
