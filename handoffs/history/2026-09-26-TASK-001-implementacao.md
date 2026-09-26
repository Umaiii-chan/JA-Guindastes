# Handoff — TASK-001 — planejamento + implementação (registro da análise e ADR-003 proposto)

> Ponto de continuidade entre agentes. O handoff anterior (estado inicial do template, sem tarefa)
> foi arquivado em `handoffs/history/2026-09-26-sem-tarefa-preparacao.md`.

| Campo | Valor |
|-------|-------|
| **Data/hora** | 2026-09-26 12:51 (UTC-3, Brasília) |
| **Tarefa** | `tasks/backlog/TASK-001-registrar-analise-orquestrador.md` (em `backlog/` de propósito; ver § 5 e § 8) |
| **Etapa concluída** | planejamento + implementação (tarefa só de documentação: registro de pesquisa e ADR `Proposto`) |
| **Papel exercido** | Planejador + Implementador de documentação (um único agente, declarado conforme AGENTS.md § 3) |
| **Ferramenta/agente** | Claude Code 2.1.280 (modelo Opus 5.5), app desktop, com subagentes somente leitura para análise e revisão |
| **Branch** | `task/TASK-001-registrar-analise-orquestrador`, criada a partir de `development` @ `86e2fdc` (o hash do commit desta etapa não existia quando este texto foi escrito) |
| **Duração aproximada** | ~13 h 30 min de sessão (de 2026-09-25 23:21 a 2026-09-26 12:51, UTC-3), com a máquina suspensa durante parte do tempo |

---

## 1. Objetivo desta etapa

Registrar a análise de 2026-09-26 sobre como evoluir o protocolo para um orquestrador de agentes
usado pelas assinaturas, e propor o ADR-003 para a pessoa responsável decidir.

## 2. O que foi feito

- Verifiquei que `development` local e `origin/development` estavam no mesmo commit (`86e2fdc`) e
  criei a branch `task/TASK-001-registrar-analise-orquestrador` a partir dela.
- Criei `tasks/backlog/TASK-001-registrar-analise-orquestrador.md`, com critérios de aceite CA-1 a CA-5.
- Criei `docs/research/2026-09-26-orquestrador.md`, com a análise completa: método, restrição de uso
  por planos, o que trazer e o que não trazer do archify (commit `9e35d2b`), 29 propostas
  (AG-1..9, ORG-1..10, VIS-1..10) já nas versões ajustadas pela revisão cética da análise, roteiro em
  fases, 15 decisões pendentes e o que não foi verificado.
- Criei `docs/decisions/ADR-003-orquestracao-local-via-clis-de-assinatura.md` com status `Proposto`.
  Ele substitui o ADR-001 por inteiro se for aceito, e reescreve dentro de si o que continua valendo.
- Acrescentei o ADR-003 (`Proposto`) ao índice em `docs/decisions/README.md`.
- Copiei o `handoffs/current.md` anterior para `handoffs/history/2026-09-26-sem-tarefa-preparacao.md`
  e reescrevi este arquivo.
- Antes do commit, rodei uma revisão cética com 4 revisores somente leitura: ADR-003; registro §§ 1–3;
  registro §§ 4–8; protocolo. Eles apontaram 40 pontos (11, 6, 14 e 9, respectivamente), nenhum
  contrário à proposta em si, e todos foram aplicados. Os principais:
  - no ADR, "API paga fora do caminho principal" estava rotulado como herdado do ADR-001, mas
    afrouxava a regra. Voltou para "nenhuma API paga por token é usada";
  - o ADR não reescrevia três restrições do ADR-001 (GitHub gratuito, sem custo obrigatório,
    independência de stack) que o ADR-002 herda. Foram incluídas;
  - "nenhum custo novo" virou hipótese no ADR;
  - o registro usava "TASK-001" também para a tarefa piloto sugerida. Ela passou a ser "TASK-002";
  - o registro dizia que o ADR-003 decidiria se os agentes fazem commit, mas o ADR deixa isso de fora.
    O texto foi alinhado;
  - caminhos do archify estavam sem o prefixo `archify:` ou com o diretório errado;
  - neste handoff, um comando registrado com saída que ele não produz (ver § 4).

## 3. Arquivos modificados

Saída de `git status --short` antes do commit:

```text
 M docs/decisions/README.md
 M handoffs/current.md
?? docs/decisions/ADR-003-orquestracao-local-via-clis-de-assinatura.md
?? docs/research/
?? handoffs/history/2026-09-26-sem-tarefa-preparacao.md
?? tasks/backlog/TASK-001-registrar-analise-orquestrador.md
```

Fora do escopo: nenhum arquivo. `docs/research/` é uma pasta nova, prevista na § 5 da tarefa.

## 4. Comandos executados e resultados

| Comando | Resultado | Saída (resumo) |
|---------|-----------|----------------|
| `git fetch origin --quiet` e depois `git rev-parse --short development && git rev-parse --short origin/development` | ✅ | `86e2fdc` e `86e2fdc`. Uma primeira tentativa com as duas refs num só `git rev-parse --short` falhou com `fatal: Needed a single revision` |
| `bash scripts/check-structure.sh` (1ª execução) | ❌ falhou | `FALHOU: 1 erro(s), 4 aviso(s)`: "link quebrado em docs/research/2026-09-26-orquestrador.md → y". Era um exemplo de sintaxe de link escrito dentro de crases, e o trecho foi reescrito |
| `bash scripts/check-structure.sh` (depois das correções da revisão) | ✅ passou | `OK: 0 erros, 4 aviso(s)`. Os 4 avisos são os `<preencher>` de project-overview (21), architecture (14), business-rules (9) e development-guide (20) |
| `claude --version` | ✅ | `2.1.280 (Claude Code)` |
| `claude --help` | ✅ | flags citadas no ADR-003 conferidas (ver "Evidências" do ADR) |
| revisão cética (4 subagentes somente leitura) | ✅ | 40 achados, todos aplicados (ver § 2) |
| `wc -w` nos 4 arquivos principais | ✅ | registro 6.658; ADR 2.290; tarefa 1.151; handoff anterior a esta reescrita 1.207 |
| testes / lint / build | ⚠️ NÃO EXECUTADO | não existem: stack não definida (`docs/development-guide.md` § 3 ainda com `<preencher>`) |

## 5. Decisões tomadas

- **Pendência 1 do handoff anterior** ("Qual é a primeira tarefa?", bloqueante): foi respondida em
  chat pela pessoa responsável em 2026-09-26, com o pedido "pode registrar a análise e rascunhar o
  ADR-003". O arquivo não tinha a resposta (`handoffs/README.md`, regra 6). O registro fica aqui porque
  o arquivo arquivado é imutável (regra 4). A sugestão de usar a TASK-000 como TASK-001 não foi
  seguida: a TASK-001 é esta tarefa.
- **Mantive a TASK-001 em `tasks/backlog/`** em vez de `in-progress/`. Com os `<preencher>` da Camada
  1, qualquer tarefa em `in-progress/` faz o `check-structure.sh` falhar (seção 4 do script, que
  aplica o AGENTS.md § 1). Fiz isso a pedido explícito da pessoa responsável. É um desvio deliberado
  de `tasks/README.md` (backlog = "ainda não iniciadas") e de `docs/guides/workflow.md` § 3, não uma
  exceção prevista no AGENTS.md. A justificativa completa está na § 2 da tarefa, e a decisão final é
  da pessoa (pendência 1).
- **Nome do arquivo arquivado** (`2026-09-26-sem-tarefa-preparacao.md`): a convenção de
  `handoffs/README.md` pede `TASK-NNN`, mas o handoff anterior não tinha tarefa. Usar `TASK-000` ou
  `TASK-001` atribuiria esse conteúdo a uma tarefa errada. A etapa `preparacao` também não está na
  lista de `handoffs/README.md`. Usei-a porque é a etapa registrada no próprio handoff anterior
  ("preparação do repositório").
- **O ADR-003 substitui o ADR-001 por inteiro, e não "parcialmente".** O status "Substituído
  parcialmente" não existe no `docs/decisions/ADR-000-template.md`. O ADR-002 não é substituído: ele
  só cita restrições herdadas, que passam a ter como fonte os itens 6 e 7 do ADR-003.
- **O ADR-003 mantém a proibição de API paga do ADR-001.** Se um dia a API entrar como opção, será
  outra decisão (decisão 5 da § 7 do registro).
- **O ADR-003 fixa princípios, não flags de CLI.** As flags do `claude` aparecem só como evidência,
  com a versão 2.1.280.
- **Referências ao archify presas ao commit `9e35d2b`** e ao link do GitHub, e não ao clone temporário
  usado na análise.

## 6. Regras de negócio aplicadas

- nenhuma

## 7. O que NÃO foi feito e por quê

- Nenhuma proposta da análise foi implementada. Estão fora do escopo, e o ADR-003 é só `Proposto`.
- Não alterei ADR-001, ADR-002, `docs/architecture.md` § 8, `README.md`, `AGENTS.md`, prompts,
  templates nem `.github/workflows/*`. Tudo isso depende do aceite do ADR-003 e, no caso do CI, só a
  pessoa pode alterar.
- Não fiz `git push` nem abri PR: não foi pedido.
- Não executei `claude -p`. O formato de saída e o sinal de limite de uso continuam não verificados.

## Checklist de implementação (`docs/checklists/implementation-checklist.md`)

Tarefa só de documentação. Itens aplicáveis:

- [x] Li `AGENTS.md`, `handoffs/current.md`, a tarefa e os docs da ordem obrigatória
- [x] Confirmei que os arquivos citados existem (a revisão cética conferiu as referências)
- [x] Branch certa (`task/TASK-001-registrar-analise-orquestrador`), criada a partir de `development` atualizada
- [x] Segui o plano da § 8 da tarefa, incluindo o passo extra de revisão (registrado lá)
- [x] Nenhum arquivo fora do escopo (§ 3)
- [x] Nenhuma funcionalidade extra; nenhuma regra de negócio deduzida; nenhuma dependência nova
- [x] `bash scripts/check-structure.sh` passa (§ 4)
- [x] ADR `Proposto` criado e índice atualizado
- [x] Handoff reescrito pelo template, com § 7 e § 11 preenchidas

Itens não marcados, com justificativa:

- *Código, Testes e Qualidade* (lint, formatação, tipos, build, comando único): N/A. Tarefa só de
  documentação, com a stack ainda não definida (`docs/development-guide.md` § 3 com `<preencher>`).
- *Commit sem co-autoria de IA*: pendente (plano, passo 6); é conferido pela seção 8 do
  `check-structure.sh`.
- *Grep de segurança sobre `git diff development...HEAD`*: rodar depois do commit. O
  `check-structure.sh` (seção 5) não encontrou padrão de segredo.
- *`docs/known-gaps.md`*: só depois do aceite do ADR-003 (ver "Impacto na documentação" do ADR).

## 8. Pendências / decisões necessárias (para a pessoa responsável)

| # | Pergunta | Bloqueia? | Resposta | Respondida em |
|---|----------|-----------|----------|---------------|
| 1 | Manter a TASK-001 em `backlog/` (desvio deliberado; ver § 5), mover para `in-progress/` (faz o CI falhar enquanto houver `<preencher>`) ou criar no AGENTS.md uma exceção para tarefas que só mexem no protocolo? | não | | |
| 2 | Aceitar, pedir mudanças ou rejeitar o ADR-003? Se aceitar: mudar o status do ADR-001 para "Substituído por ADR-003" e atualizar os arquivos da seção "Impacto na documentação" do ADR. | sim, para qualquer trabalho no orquestrador | | |
| 3 | Onde o orquestrador fica: (A) este repositório, (B) `tools/orquestrador/` ou (C) outro repositório? | sim, para a Fase 3 | | |
| 4 | Revisor padrão enquanto só o Claude Code está instalado: instalar Codex ou Gemini CLI, revisar pela interface web de outro fornecedor, ou aceitar uma sessão nova do Claude Code sinalizada como independência mínima? | não | | |
| 5 | Preencher a Camada 1 (`project-overview`, `architecture`, `business-rules`, `development-guide`) descrevendo o orquestrador, ou o sistema da JA Guindastes? | sim, para implementar qualquer coisa | | |
| 6 | Demais decisões: § 7 de `docs/research/2026-09-26-orquestrador.md` (runtime, formato dos recibos, limites de rodadas, commits por agentes etc.). | não | | |
| 7 | O diff tem cerca de 11 mil palavras (registro 6.658, ADR 2.290), acima do limite de 15–20 min de `tasks/README.md`. Aceitar a exceção (ADR revisado por inteiro, registro revisado por amostragem) ou quebrar em duas tarefas (registro primeiro, ADR depois, porque o ADR tem link para o registro)? | sim, para abrir o PR | | |

## 9. ⚠️ Segurança

- nada a relatar

## 10. Próximo passo

**Papel:** Revisor (outra ferramenta ou sessão nova, conforme AGENTS.md § 3), depois Pessoa responsável

**O que fazer, concretamente:**
1. Revisor: revisar o diff `git diff development...task/TASK-001-registrar-analise-orquestrador`
   com `docs/templates/code-review-template.md`, conferindo os CAs da TASK-001. O foco é o ADR-003:
   ele respeita o template, as referências existem, e o verificado está separado do que é hipótese?
2. Pessoa responsável: responder as pendências 1, 2 e 7. Se aprovar, abrir o PR para `development`.

**Ler primeiro (nesta ordem):**
1. `AGENTS.md`
2. este handoff
3. `tasks/backlog/TASK-001-registrar-analise-orquestrador.md` § 3 (critérios de aceite)
4. `docs/decisions/ADR-003-orquestracao-local-via-clis-de-assinatura.md`
5. `docs/research/2026-09-26-orquestrador.md` §§ 1, 2 e 7 (resumo, archify e decisões)

**Cuidado com:**
- O registro de pesquisa cita linhas de arquivos do archify no commit `9e35d2b`. Confira no GitHub,
  nesse commit, e não na versão atual.
- As linhas citadas deste repositório referem-se ao commit `86e2fdc`.
- `ADR-003` é `Proposto`: nenhum agente implementa nada dele até o aceite (`docs/decisions/README.md`).
- A revisão feita antes do commit foi por subagentes da **mesma** sessão que escreveu os textos. Ela
  não substitui a revisão independente do AGENTS.md § 3.

## 11. Como revisar este trabalho

- Comece pelo ADR-003: seções "Decisão" (itens 1 a 11), "Fora desta decisão" e "Evidências".
- É onde tenho menos certeza: se "substitui por inteiro" é a forma certa, ou se a pessoa prefere
  criar o status "Substituído parcialmente" no template.
- O registro de pesquisa é longo (464 linhas). As afirmações com número de linha foram conferidas por
  amostragem (mais de 50 itens entre os dois revisores do registro), não uma a uma.
