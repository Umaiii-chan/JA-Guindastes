# TASK-001 — Registrar a análise do orquestrador e propor o ADR-003

| Campo | Valor |
|-------|-------|
| **Status** | completed |
| **Prioridade** | alta |
| **Criada em** | 2026-09-26 por Anderson Sehnem (pedido feito em sessão com o agente Claude Code) |
| **Iniciada em** | 2026-09-26 |
| **Concluída em** | 2026-09-26 |
| **Branch** | `task/TASK-001-registrar-analise-orquestrador` (a partir de `development` @ `86e2fdc`) |
| **PR** | [#1](https://github.com/Umaiii-chan/JA-Guindastes/pull/1), mergeado em 2026-09-26 por merge commit (`7d0e2a9`) |
| **Requisitos** | — |
| **Regras de negócio** | — (nenhuma regra funcional envolvida) |
| **Estimativa** | G: cerca de 11 mil palavras no diff, acima do limite de revisão de 15–20 min de `tasks/README.md` (ver pendência 7 em `handoffs/current.md`) |

---

## 1. Objetivo

Registrar no repositório a análise de 2026-09-26 sobre como evoluir este protocolo para um
orquestrador de agentes, incluindo o que vale aproveitar do projeto archify. Deixar também um ADR
`Proposto` que substitui o ADR-001, para a pessoa responsável aceitar ou rejeitar.

## 2. Contexto

A pessoa responsável vai construir um orquestrador de agentes em cima deste repositório. O foco é
melhorar os agentes, a organização e a visão do andamento. Ela vai usar os agentes pelas
**assinaturas** (Claude Code, Codex, Gemini) e dificilmente por API paga. O ADR-001 (Aceito) fixa que
cada agente é acionado manualmente pela pessoa (`docs/decisions/ADR-001-workflow-baseado-em-arquivos.md`,
seção "Decisão"). Qualquer orquestrador precisa primeiro de um ADR que o substitua. Pelo AGENTS.md § 4,
agentes só podem criar esse ADR com status `Proposto`.

**Por que a tarefa está em `backlog/`, e não em `in-progress/`:** os quatro documentos de contexto
mínimo ainda têm marcadores `<preencher>`. Com isso, qualquer tarefa em `in-progress/` faz o
`scripts/check-structure.sh` falhar (seção 4 do script, que aplica o AGENTS.md § 1). Esta tarefa não
altera código. Ela registra uma análise e propõe um ADR `Proposto` (AGENTS.md § 4), a pedido
explícito da pessoa responsável em 2026-09-26.

**É um desvio deliberado, não uma exceção prevista.** Ele contraria:
- a definição de `backlog/` em `tasks/README.md` ("ainda não iniciadas");
- o `git mv` para `in-progress/` pedido em `docs/guides/workflow.md` § 3 e em `docs/guides/git-github.md` § 4;
- o aviso do handoff anterior sobre não acionar IA como Implementador sem o contexto mínimo.

Hoje o AGENTS.md não tem exceção para tarefas que só mexem no protocolo (ver o item 3 da § 7 do
registro da análise). Em `backlog/`, a seção 3 do script não valida o nome nem os CAs desta tarefa;
isso foi conferido à mão. Mover a tarefa, mantê-la aqui ou criar a exceção é decisão da pessoa
responsável (pendência 1 em `handoffs/current.md`).

## 3. Critérios de aceite

- [ ] **CA-1** — Dado o repositório nesta branch, quando abro `docs/research/2026-09-26-orquestrador.md`,
  então encontro: o método da análise; a restrição de uso por planos; o que trazer e o que não trazer
  do archify, com o commit de referência; as propostas com ids (AG-n, ORG-n, VIS-n); o roteiro em
  fases; as decisões pendentes; e o que não foi verificado.
- [ ] **CA-2** — Dado o repositório nesta branch, quando abro
  `docs/decisions/ADR-003-orquestracao-local-via-clis-de-assinatura.md`, então ele tem status
  `Proposto`, o campo **Substitui** igual a `ADR-001`, todas as seções de `docs/decisions/ADR-000-template.md`
  e, em "Evidências", o que foi verificado separado do que é hipótese.
- [ ] **CA-3** — `docs/decisions/README.md` lista o ADR-003 com status `Proposto`, e os arquivos do
  ADR-001 e do ADR-002 não foram alterados (`git diff development -- docs/decisions/ADR-001* docs/decisions/ADR-002*` vazio).
- [ ] **CA-4** — `bash scripts/check-structure.sh` termina com exit 0 nesta branch.
- [ ] **CA-5** — Só os arquivos da § 5 foram alterados (`git diff --stat development...HEAD`). O
  `handoffs/current.md` anterior foi arquivado em `handoffs/history/` e o atual aponta o próximo passo.

## 4. Escopo

### Dentro do escopo

- Registro datado da análise em `docs/research/` (pasta nova).
- Rascunho do ADR-003 com status `Proposto` e a entrada correspondente no índice de ADRs.
- Esta tarefa e o handoff.

### Fora do escopo (explicitamente — o agente NÃO faz)

- Implementar qualquer proposta da análise (orquestrador, scripts, schemas, mudanças no CI).
- Alterar `AGENTS.md`, `docs/prompts/`, `docs/templates/`, `.github/workflows/*`, ADR-001, ADR-002,
  `docs/business-rules.md` ou `docs/architecture.md` § 8. A § 8 só muda depois que o ADR for aceito.
- Preencher a Camada 1 de contexto (`project-overview`, `architecture`, `business-rules`, `development-guide`).
- `git push`, abrir PR, mudar o status do ADR-001.

## 5. Arquivos provavelmente afetados

| Arquivo | Tipo de mudança | Verificado? |
|---------|-----------------|-------------|
| `tasks/backlog/TASK-001-registrar-analise-orquestrador.md` | criar | sim |
| `docs/research/2026-09-26-orquestrador.md` | criar | sim |
| `docs/decisions/ADR-003-orquestracao-local-via-clis-de-assinatura.md` | criar | sim |
| `docs/decisions/README.md` | alterar (índice) | sim |
| `handoffs/current.md` | reescrever | sim |
| `handoffs/history/2026-09-26-sem-tarefa-preparacao.md` | criar (cópia do handoff anterior, que não tinha tarefa) | sim |

## 6. Riscos e dependências

- Depende de: nenhuma tarefa. O ADR-003 depende da decisão da pessoa responsável.
- Risco: as linhas citadas do archify mudarem no projeto original → mitigação: todas as referências
  estão presas ao commit `9e35d2b` do archify.
- Risco: um agente tratar o ADR-003 como aprovado → mitigação: o status `Proposto` e o
  `docs/decisions/README.md` ("um agente nunca implementa uma decisão Proposta por conta própria").
- Risco: flags do `claude` mudarem entre versões → mitigação: o ADR cita princípios, não fixa flags;
  as flags aparecem só como evidência, com a versão (2.1.280).

## 7. Teste manual (se houver)

1. `git diff --stat development...task/TASK-001-registrar-analise-orquestrador`
   **Esperado:** só os arquivos da § 5.
2. `bash scripts/check-structure.sh`
   **Esperado:** `OK: 0 erros` (os avisos de `<preencher>` continuam, porque a Camada 1 não foi preenchida).

---

## 8. Plano (preenchido pelo Planejador)

| # | Passo | Arquivos | Como verificar | Feito |
|---|-------|----------|----------------|-------|
| 1 | Criar a branch a partir de `development` atualizada | — | `git rev-parse development origin/development` iguais | [x] |
| 2 | Escrever o registro da análise | `docs/research/2026-09-26-orquestrador.md` | CA-1 | [x] |
| 3 | Escrever o ADR-003 `Proposto` e a entrada no índice | `docs/decisions/ADR-003-...`, `docs/decisions/README.md` | CA-2, CA-3 | [x] |
| 4 | Arquivar e reescrever o handoff | `handoffs/` | CA-5 | [x] |
| 5 | Revisão cética antes do commit (4 revisores somente leitura) e aplicação das correções confirmadas | os da § 5 | handoff § 4 | [x] |
| 6 | Rodar `check-structure.sh` e fazer o commit sem rodapé de co-autoria | — | CA-4; seção 8 do script | [x] |

**Análise de impacto:**
- Arquivos que podem quebrar indiretamente: nenhum. A checagem de links da seção 6 do script
  percorre `docs/` e passa a ler os arquivos novos.
- Regras de negócio aplicáveis: nenhuma.
- Decisões necessárias: aceitar ou rejeitar o ADR-003, e as demais da § 7 do registro da análise.

## 9. Cenários de teste (preenchido pelo Engenheiro de testes)

Não se aplica: tarefa só de documentação. A verificação é pelos CAs e pelo `check-structure.sh`.

## 10. Parecer da revisão (preenchido pelo Revisor)

**Resultado:** sem revisão independente. O PR #1 foi mergeado pela pessoa responsável em 2026-09-26
sem parecer; a única revisão no PR é um aviso automático do bot `sourcery-ai` sobre o plano do
serviço. Antes do commit, 4 subagentes da mesma sessão fizeram uma revisão cética, registrada em
`handoffs/history/2026-09-26-TASK-001-implementacao.md` § 2, mas ela não substitui a revisão
independente do AGENTS.md § 3. Dispensar ou pedir essa revisão é a pendência 1 de `handoffs/current.md`.

## 11. Encerramento (preenchido ao mover para completed/)

> Movida para `completed/` em 2026-09-26 por decisão da pessoa responsável (em chat), após o merge do PR #1. **A revisão independente (AGENTS.md § 3) foi dispensada pela pessoa responsável**; nenhum parecer foi registrado.

- O que foi entregue (2–3 linhas):
- O que ficou de fora e virou tarefa nova: TASK-...
- Aprendizados para o template/docs:
