# Fluxo de trabalho entre as IAs

Este guia descreve o ciclo de vida de uma tarefa, do backlog até `completed/`, e como as IAs se
revezam sem se falar. A regra de ouro: **cada etapa termina com o handoff da tarefa atualizado** —
`handoffs/TASK-NNN.md`, porque desde a TASK-006 (ampliada na TASK-021) até 15 tarefas andam em
paralelo e `handoffs/current.md` virou o índice geral, que as branches de tarefa não editam (ver
[`handoffs/README.md`](../../handoffs/README.md) → "Tarefas em paralelo").

O repositório tem três branches longas, uma por ambiente — `development` (default), `homologation` e
`production`. As tarefas nascem e voltam para `development`; a promoção entre ambientes é um
processo separado, descrito na § 13. Ver [ADR-002](../decisions/ADR-002-modelo-de-branches-por-ambiente.md).

---

## 1. Visão geral

```text
 ┌──────────────────────────────────────────────────────────────────────────┐
 │ 0. Contexto do projeto preenchido em docs/ (uma vez por projeto)         │
 └──────────────────────────────────────────────────────────────────────────┘
        │
        ▼
 ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
 │ 1. Tarefa    │───►│ 2. Planejar  │───►│ 3. Testes    │───►│ 4. Implement.│
 │ (pessoa)     │    │ (IA A)       │    │ (IA B)       │    │ (IA C)       │
 └──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
                            │                   │                   │
                            ▼                   ▼                   ▼
                        handoff             handoff             handoff
                                                                    │
        ┌───────────────────────────────────────────────────────────┘
        ▼
 ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
 │ 5. Revisão   │───►│ 6. CI        │───►│ 7. Aprovação │───►│ 8. Encerrar  │
 │ (IA D ≠ C)   │    │ (GitHub)     │    │ (pessoa)     │    │ (pessoa)     │
 └──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
        │                                                           │
        ▼                                                           ▼
    parecer                                              tasks/completed/
                                                         handoffs/history/
                                                         código em development
                                                                    │
                                                                    ▼
                                              ┌─────────────────────────────────┐
                                              │ Promoção (§ 13) — em lote, na   │
                                              │ cadência que você define:       │
                                              │ development → homologation      │
                                              │             → production        │
                                              └─────────────────────────────────┘
```

"IA A, B, C, D" podem ser ferramentas diferentes **ou a mesma ferramenta em conversas diferentes**.
A única exigência forte é: **quem revisa (D) não é a mesma sessão que implementou (C)**.

---

## 2. Etapa 0 — Contexto do projeto (uma vez)

Feito pela pessoa responsável, com ou sem ajuda de IA. Preencher pelo menos:

- `docs/project-overview.md`
- `docs/architecture.md`
- `docs/business-rules.md`
- `docs/development-guide.md`

Depois, `docs/testing-strategy.md`, `docs/security.md` e `.github/workflows/ci.yml`.

Guia: [`adapting-template.md`](adapting-template.md).

**Sem isso, nenhum agente implementa.** É a barreira mais barata contra alucinação: a IA não inventa
o que está escrito.

---

## 3. Etapa 1 — Criar a tarefa (pessoa)

1. Copie `docs/templates/task-template.md` para `tasks/backlog/TASK-NNN-<slug>.md`.
2. Preencha: objetivo, contexto, **critérios de aceite verificáveis**, escopo (dentro/fora),
   arquivos provavelmente afetados, requisitos e regras de negócio relacionados.
3. Quando for começar, mova para `tasks/in-progress/` (`git mv`).
4. Crie o handoff da tarefa em `handoffs/TASK-NNN.md` (template `docs/templates/handoff-template.md`),
   com próximo passo = "Planejador", e registre a tarefa na tabela de `handoffs/current.md` § 2 (o
   índice é atualizado pela pessoa responsável ou pela sessão principal, não pela branch da tarefa).
5. Crie a branch a partir de `development` atualizada:
   `git checkout development && git pull && git checkout -b task/TASK-NNN-<slug>`.
6. Commit: `chore(tasks): iniciar TASK-NNN`.

**Até 15 tarefas em `in-progress/`** ao mesmo tempo (decisão da pessoa responsável em 2026-09-26,
TASK-006 e TASK-021; limite conferido por `scripts/check-structure.sh`), **nunca tocando os mesmos
arquivos**. Cada leva de tarefas paralelas parte do mesmo commit-base de `development`.

Uma tarefa boa cabe em um PR revisável em 15 minutos. Se não cabe, quebre em duas.

---

## 4. Etapa 2 — Planejar (Planejador)

Prompt pronto: `docs/prompts/01-planejador.md`.

O Planejador:

1. lê tudo da ordem obrigatória (`AGENTS.md` § 1);
2. inspeciona o código relacionado (grep, leitura de arquivos — sem adivinhar);
3. produz uma **análise de impacto**: arquivos que vão mudar, arquivos que podem quebrar, riscos,
   dependências, regras de negócio aplicáveis (`RN-*`), dúvidas;
4. propõe um **plano em passos pequenos**, cada um verificável;
5. **não escreve código**;
6. se identificar decisão arquitetural, cria ADR `Proposto`;
7. se identificar dúvida funcional, registra em "Pendências / decisões necessárias" — e a pessoa
   responde antes da próxima etapa;
8. escreve o plano na própria tarefa (seção "Plano") e atualiza o handoff com próximo passo =
   "Engenheiro de testes".

**Saída esperada:** tarefa com seção "Plano" preenchida; handoff atualizado; eventualmente ADR proposto.

---

## 5. Etapa 3 — Definir testes (Engenheiro de testes)

Prompt pronto: `docs/prompts/02-testes.md`.

O Engenheiro de testes:

1. lê a ordem obrigatória + o plano;
2. transforma **cada critério de aceite** em um ou mais cenários de teste (dado/quando/então);
3. escreve os testes no framework do projeto, **falhando** (porque o código ainda não existe) — ou,
   se a stack não permitir teste antes do código, descreve os cenários com precisão suficiente para
   que o Implementador os escreva depois;
4. roda a suíte para provar que os novos testes falham pelo motivo certo (não por erro de sintaxe)
   e cola a saída;
5. identifica o que **não** dá para automatizar e descreve o teste manual;
6. commit: `test(<escopo>): cenários para TASK-NNN`;
7. handoff com próximo passo = "Implementador".

**Saída esperada:** testes commitados (vermelhos) ou cenários escritos; saída do terminal no handoff.

---

## 6. Etapa 4 — Implementar (Implementador)

Prompt pronto: `docs/prompts/03-implementador.md`.

O Implementador:

1. lê a ordem obrigatória + plano + testes;
2. implementa **o mínimo** para os testes passarem, seguindo o plano passo a passo;
3. a cada passo: roda testes, lint e formatação; commit pequeno;
4. **não** adiciona funcionalidade fora dos critérios (se achar algo útil, registra no backlog);
5. atualiza `docs/` se mudou comportamento, comando, arquitetura ou variável de ambiente;
6. roda o "comando único" de `docs/development-guide.md` § 3 e cola a saída;
7. preenche `docs/checklists/implementation-checklist.md` (cópia na tarefa ou no handoff);
8. handoff com próximo passo = "Revisor", incluindo **como revisar** (o que olhar primeiro).

**Saída esperada:** testes verdes; lint/build ok; docs atualizadas; checklist preenchido; handoff.

---

## 7. Etapa 5 — Revisar (Revisor — sessão diferente)

Prompt pronto: `docs/prompts/04-revisor.md`.

O Revisor:

1. lê a ordem obrigatória + tarefa + handoff;
2. lê o **diff completo** (`git diff development...task/TASK-NNN` ou o PR);
3. segue `docs/checklists/code-review-checklist.md` item a item;
4. **executa** os testes e comandos por conta própria — não confia na saída colada pelo Implementador;
5. verifica que cada critério de aceite tem teste e que o teste testa o que diz;
6. procura: mudanças fora do escopo, regras de negócio inventadas, segredos, dependências novas,
   erros engolidos, docs desatualizadas;
7. escreve o parecer com `docs/templates/code-review-template.md`: **Aprovado**, **Mudanças
   necessárias** (lista objetiva) ou **Rejeitado** (motivo);
8. handoff com próximo passo = "Implementador (correções)" ou "Pessoa responsável (aprovação)".

Se houver mudanças necessárias, volta para a etapa 4. Não há limite de ciclos, mas se passar de
três, a tarefa provavelmente está mal definida — pare e reveja a tarefa.

---

## 8. Etapa 6 — CI (GitHub Actions)

Automático ao abrir/atualizar o PR. Roda **exatamente** os comandos de `development-guide.md`, em
quatro jobs: `structure` (`scripts/check-structure.sh`), `backend` (lint, formatação, tipos, camadas,
migrations e testes com PostgreSQL de serviço), `quality` (frontend: lint, formatação, tipos, testes e
build) e `docker` (build das imagens e teste de fumaça da stack). Auditoria de dependências ainda não
está configurada ([`../security.md`](../security.md) § 5). Detalhes em
[`../testing-strategy.md`](../testing-strategy.md) § 5.

O CI **não usa IA** e **não custa nada** dentro do limite gratuito do GitHub. Ele é o único
participante do fluxo que nunca alucina.

Se o CI falha e localmente passa: o ambiente está diferente. Descobrir por quê é parte da tarefa.

---

## 9. Etapa 7 — Aprovação (pessoa)

A pessoa responsável:

1. lê o parecer do Revisor e o handoff;
2. abre o diff e confere pelo menos os pontos que o Revisor marcou como "atenção";
3. confere a Definition of Done (`docs/checklists/definition-of-done.md`);
4. aprova o PR no GitHub e faz o merge em `development` por **squash** (ver [`git-github.md`](git-github.md) § 3).

Se não aprovar, comenta no PR e atualiza o handoff com próximo passo.

---

## 10. Etapa 8 — Encerrar (pessoa, ou agente por instrução)

1. `git mv tasks/in-progress/TASK-NNN-*.md tasks/completed/`
2. Preencher na tarefa: data de conclusão, PR, resumo do que foi entregue.
3. Mover `handoffs/TASK-NNN.md` para `handoffs/history/AAAA-MM-DD-TASK-NNN-<etapa>.md`.
4. Atualizar o índice `handoffs/current.md` (estado do projeto, tabela de tarefas em andamento,
   pendências gerais). Com a autorização permanente de `handoffs/current.md` § 3, um agente pode
   mover para `completed/` a tarefa que a pessoa mergeou, registrando que a revisão independente foi
   dispensada por ela.
5. Atualizar `docs/known-gaps.md` se algo foi resolvido ou descoberto.
6. Commit `chore(tasks): concluir TASK-NNN` — via PR pequeno ou, **somente a pessoa responsável** e
   somente quando a proteção de branch não estiver disponível, direto na `development`. Agentes nunca
   commitam nas branches longas.
7. A tarefa agora está em `development`. Ela chega a homologação e produção na próxima **promoção**
   (§ 13) — não automaticamente.

---

## 11. Distribuição sugerida de papéis (não obrigatória)

| Papel | Sugestão | Por quê |
|-------|----------|---------|
| Planejador | Gemini ou Claude | janelas de contexto grandes para ler muita documentação |
| Engenheiro de testes | ChatGPT/Codex ou Claude | bom em derivar cenários de critérios |
| Implementador | Claude Code, Codex ou Cursor | ferramentas com acesso ao repositório e terminal |
| Revisor | **qualquer um diferente do Implementador** | independência importa mais que a ferramenta |
| CI | GitHub Actions | determinístico |

Se só houver **uma** IA disponível: use conversas separadas para cada papel e diga explicitamente
no prompt qual papel ela exerce. Registre no handoff. Funciona pior do que ferramentas distintas, mas
funciona.

---

## 12. Sinais de que o fluxo está sendo seguido mal

| Sintoma | Causa provável | Correção |
|---------|----------------|----------|
| Handoff diz "testes passam" sem saída colada | regra 4 da anti-alucinação ignorada | devolver; exigir saída |
| Diff tem arquivos que a tarefa não menciona | escopo não respeitado | devolver; mover extras para backlog |
| Revisor aprovou em 2 linhas | não executou nada | devolver com o checklist |
| Mesma dúvida aparece em 3 handoffs seguidos | pessoa não respondeu "Pendências" | responder antes de acionar próximo agente |
| Tarefa em `in-progress/` há mais de uma semana | tarefa grande demais | quebrar em duas |
| Agente "lembra" de algo que não está escrito | confiou na memória | reforçar: "leia `handoffs/current.md` de novo" |
| CI verde, mas comportamento errado | critério de aceite mal escrito | reescrever o critério; adicionar teste |


---

## 13. Promoção entre ambientes

Concluir uma tarefa coloca o código em `development` — **não** em homologação nem em produção.
Promover é uma atividade separada, feita **em lote**, na cadência que você escolher (ao fim do dia,
duas vezes por semana, quando um conjunto de tarefas fecha uma funcionalidade). O procedimento
completo, com comandos, está em [`git-github.md`](git-github.md) § 5.

```text
tarefas concluídas ──► development ──PR (merge commit)──► homologation ──PR (merge commit)──► production
                                                              │
                                                         validação de
                                                        QA / cliente
```

### Quem faz

**A pessoa responsável.** Agentes de IA não iniciam nem executam promoção — a decisão de que "isto
está pronto para o cliente ver" e "isto pode ir para produção" não é derivável do repositório. Se
você quiser que um agente prepare o PR de promoção (levantar as tarefas incluídas, montar o corpo),
peça explicitamente e revise antes de mesclar.

### Antes de promover para homologação

- [ ] CI verde na `development`
- [ ] todas as tarefas incluídas estão em `tasks/completed/`
- [ ] nenhuma tarefa em `tasks/in-progress/` depende de algo que ficou pela metade
- [ ] migrations, se houver, são compatíveis com os dados de homologação
- [ ] `handoffs/current.md` não tem pendência bloqueante sem resposta

### Antes de promover para produção

- [ ] o que está em homologação foi validado — registre **quem** validou e **quando** no corpo do PR
- [ ] `docs/known-gaps.md` não lista problema bloqueante aberto para o que vai subir
- [ ] plano de rollback conhecido (qual commit voltar, como reverter migration)
- [ ] janela de deploy combinada, se o projeto tiver uma

### Depois

- Marque o ponto com uma tag (`git tag -a vAAAA.MM.DD`), opcional mas recomendado.
- Se algo der errado em produção e a correção não puder esperar: **hotfix**
  ([`git-github.md`](git-github.md) § 6) — e não se esqueça de mesclar `production` de volta em
  `homologation` e `development`, senão a próxima promoção reverte a correção.

### Os dois erros que quebram este modelo

1. **Squash em PR de promoção.** Faz as branches divergirem para sempre e cria diferenças fantasma
   na promoção seguinte. Sempre *merge commit* entre branches longas.
2. **Hotfix sem merge de volta.** A correção some na próxima promoção.

Ambos estão no checklist de revisão e nas regras de [`git-github.md`](git-github.md) § 10.
