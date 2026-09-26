# Handoff — TASK-003 — implementação (ADR-004..011 propostos a partir da doc-fonte)

> Handoff anterior (TASK-002) arquivado em `handoffs/history/2026-09-26-TASK-002-implementacao.md`.
> A TASK-002 foi mergeada (PR #2), mas continua em `tasks/in-progress/` até a pessoa decidir movê-la
> (pendência 4).

| Campo | Valor |
|-------|-------|
| **Data/hora** | 2026-09-26 14:16 (UTC-3, Brasília) |
| **Tarefa** | `tasks/in-progress/TASK-003-adrs-do-simulador.md` |
| **Etapa concluída** | planejamento + implementação (só documentação) |
| **Papel exercido** | Planejador + Implementador de documentação (um único agente, declarado conforme AGENTS.md § 3) |
| **Ferramenta/agente** | Claude Code 2.1.280 (modelo Opus 5.5), app desktop |
| **Branch** | `task/TASK-003-adrs-do-simulador`, a partir de `development` @ `1b4dbaa` |
| **Duração aproximada** | ~15 min |

---

## 1. Objetivo desta etapa

Registrar as 8 decisões da doc-fonte § 7 como ADR-004..011 `Proposto`.

## 2. O que foi feito

- Gerei por script, a partir da doc-fonte § 7 (l.168–205), os arquivos
  `docs/decisions/ADR-004-clean-architecture-no-backend.md` até `ADR-011-monorepo.md`, com a seção
  "Decisão" literal, a origem (número original e linhas) e as relações com RF/RNF/RN e riscos que a
  própria doc-fonte cita. Alternativas e custos que a doc-fonte não registra estão marcados como
  "não registrados".
- Acrescentei os 8 ao índice `docs/decisions/README.md` e à § 8 de `docs/architecture.md` (e ao
  campo "ADRs que afetam este documento").

## 3. Arquivos modificados

```text
 M docs/architecture.md
 M docs/decisions/README.md
?? docs/decisions/ADR-004..ADR-011 (8 arquivos)
?? handoffs/history/2026-09-26-TASK-002-implementacao.md
?? tasks/in-progress/TASK-003-adrs-do-simulador.md
```

(mais este `handoffs/current.md`). Fora do escopo: nenhum.

## 4. Comandos executados e resultados

| Comando | Resultado | Saída (resumo) |
|---------|-----------|----------------|
| script de geração dos ADRs | ✅ | 8 arquivos (ADR-004..011) |
| script de conferência da seção "Decisão" contra a doc-fonte | ✅ | `campos literais ok: 15 divergentes: 0`; todos `Proposto` |
| `bash scripts/check-structure.sh` | ✅ | `OK: 0 erros`; aviso de 2 tarefas em `in-progress/` (TASK-002 e TASK-003) |
| testes / lint / build | ⚠️ NÃO EXECUTADO | não há código |

## 5. Decisões tomadas

- Mapeamento de números: ADR-00N da doc-fonte = ADR-(N+3) deste repositório, citado no "Contexto" de cada ADR.
- Autor dos ADRs: a equipe do projeto (a decisão é da doc-fonte); o agente só redigiu no formato.
- Nenhuma alternativa foi inventada: a doc-fonte não registra alternativas, e cada ADR avisa que elas
  devem entrar antes do aceite, se a equipe quiser.

## 6. Regras de negócio aplicadas

- nenhuma

## 7. O que NÃO foi feito e por quê

- Aceite dos ADRs: é decisão da pessoa.
- ADRs de toolchain (versões, gerenciadores, testes, lint, migrations) e de layout detalhado: tarefa seguinte.
- Nenhuma revisão cética nem independente, para poupar cota.

## 8. Pendências / decisões necessárias (para a pessoa responsável)

| # | Pergunta | Bloqueia? | Resposta | Respondida em |
|---|----------|-----------|----------|---------------|
| 1 | Aceitar, pedir mudanças ou rejeitar os ADR-004..011? (dá para aceitar em bloco) | sim, para os esqueletos do código | | |
| 2 | Dados fictícios rotulados nos testes até a tabela oficial chegar? (P-007) | sim, para testes do motor | | |
| 3 | Versão mais nova da doc-fonte? (P-013) · Onde fica o orquestrador? (P-010) | não | | |
| 4 | Mover TASK-001 e TASK-002 para `completed/` (sem revisão independente) ou pedir revisão antes; apagar as branches delas | não | | |

## 9. ⚠️ Segurança

- nada a relatar

## 10. Próximo passo

**Papel:** Pessoa responsável (depois, Planejador da tarefa de toolchain)

**O que fazer, concretamente:**
1. Revisar o PR da TASK-003 e responder a pendência 1.
2. Depois: tarefa de toolchain (ADR com versões de Node/Python, gerenciadores, testes, lint e
   migrations, e o que muda no `ci.yml`, arquivo protegido), seguida dos esqueletos de backend e frontend.

**Ler primeiro:**
1. `AGENTS.md`
2. este handoff
3. `docs/decisions/README.md` (índice)

**Cuidado com:**
- ADR `Proposto` não autoriza implementação (`docs/decisions/README.md`).
- Merge de PR de tarefa: **squash**.

## 11. Como revisar este trabalho

- Os 8 ADRs seguem o mesmo molde. Confira um por inteiro e, nos outros, só "Contexto" e "Decisão".
