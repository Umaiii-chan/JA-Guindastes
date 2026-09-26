# ADR-002 — Modelo de branches por ambiente (development, homologation, production)

| Campo | Valor |
|-------|-------|
| **Status** | Aceito |
| **Data** | 2026-09-05 |
| **Autor** | Anderson Sehnem |
| **Decisores** | Anderson Sehnem |
| **Tarefa relacionada** | — (evolução do protocolo) |
| **Substitui** | — (complementa [ADR-001](ADR-001-workflow-baseado-em-arquivos.md)) |

## Contexto

A primeira versão do template usava um modelo mínimo: `main` estável e uma branch `task/<TASK-ID>-<slug>`
por tarefa, com a observação "Sem `develop`, sem `release/*` nesta versão. Se o projeto precisar, é um ADR."

Os projetos reais em que o template será usado têm **três ambientes** — desenvolvimento, homologação e
produção. Com uma branch só:

- não há onde uma mudança "esperar" entre estar pronta e estar em produção;
- não dá para validar em homologação sem já ter mesclado no que vai para produção;
- o deploy de cada ambiente não tem um gatilho natural;
- não existe registro rastreável de **quando** uma mudança subiu de ambiente.

Restrições que continuam valendo (ADR-001): GitHub no plano gratuito, sem custo obrigatório, agentes de
IA acionados manualmente, protocolo independente de stack.

## Decisão

**Três branches longas e permanentes, uma por ambiente:**

| Branch | Ambiente | Papel |
|--------|----------|-------|
| `development` | desenvolvimento | integração contínua; **branch default** do repositório; é para cá que as tarefas voltam |
| `homologation` | homologação | validação com QA / cliente antes de produção |
| `production` | produção | o que está no ar |

A branch `main` é **renomeada para `production`** e deixa de existir. Não há branch `main`.

**Fluxo:**

- Tarefas nascem de `development` (`task/<TASK-ID>-<slug>`) e voltam para `development` por Pull Request.
- A promoção entre ambientes é feita por **PR de merge em cascata**: `development` → `homologation` →
  `production`. Nunca por commit direto, nunca por cherry-pick.
- PRs de promoção e de sincronização usam **merge commit**. PRs de tarefa usam **squash**.
- Correções urgentes usam `hotfix/<slug>`, saindo de `production` e voltando para `production` por PR;
  em seguida `production` é mesclada de volta em `homologation` e em `development`.
- O GitHub Actions executa as mesmas verificações determinísticas nas três branches e, em `push`,
  faz o **deploy do ambiente correspondente** usando GitHub Environments (`development`,
  `homologation`, `production`).

## Alternativas consideradas

| Alternativa | Vantagens | Desvantagens | Por que não |
|-------------|-----------|--------------|-------------|
| **Três branches com promoção em cascata (escolhida)** | mapeamento 1:1 entre branch e ambiente; gatilho natural de deploy; histórico de promoção auditável; poucos conceitos para os agentes entenderem | três branches para manter em sincronia; risco de divergência se alguém commitar direto ou usar squash na promoção | — |
| Manter `main` + `task/*` (ADR-001) | mais simples; menos minutos de CI | não representa os ambientes; sem ponto de validação antes de produção | não atende à necessidade |
| GitFlow completo (`release/*`, `develop`, `main`) | permite congelar um conjunto de funcionalidades e continuar desenvolvendo em paralelo | mais um tipo de branch efêmera; mais cerimônia; mais difícil de explicar a um agente de IA em um `AGENTS.md` curto | complexidade desproporcional ao tamanho dos projetos |
| Cherry-pick seletivo para cada ambiente | permite promover só parte do que está pronto | branches divergem; `git diff` entre ambientes deixa de significar "o que falta subir"; rastreabilidade piora | contraria o princípio de auditoria do template (ADR-001) |
| Trunk-based com feature flags | uma branch só; deploy contínuo | exige infraestrutura de flags e maturidade de testes que o projeto ainda não tem; ver [`known-gaps.md`](../known-gaps.md) | prematuro |
| Manter `main` como produção e criar só `development` e `homologation` | menos configuração no GitHub | `main` não deixa óbvio que é produção; mistura convenção do Git com nome de ambiente | clareza vale a renomeação |

## Consequências

**Positivas:**

- cada ambiente tem uma branch, e `git log production` responde "o que está no ar" sem ambiguidade;
- `git diff production...homologation` responde "o que está esperando para subir";
- o deploy tem gatilho determinístico (push na branch do ambiente), sem passo manual esquecível;
- a promoção vira um PR — ou seja, ganha revisão, CI e registro de quem aprovou e quando;
- agentes de IA continuam com uma regra simples: *"você trabalha em `task/*`, nasce de `development`,
  volta para `development`, e nunca toca nas três branches longas."*

**Negativas / custos:**

- três branches para manter em sincronia; um hotfix exige merge de volta em duas branches;
- mais consumo de minutos do GitHub Actions (verificações em três `push` além dos PRs);
- deploy automático exige credenciais por ambiente configuradas no GitHub;
- no plano gratuito, repositórios **privados** não têm proteção de branch nem regras de proteção de
  Environments — a disciplina substitui a ferramenta (ver [`../guides/git-github.md`](../guides/git-github.md) § 8).

**Riscos e como mitigar:**

- *Squash em PR de promoção* reescreve os commits e faz as branches divergirem para sempre; a próxima
  promoção mostra diferenças fantasma. → Regra explícita em `git-github.md` § 4, item no
  `code-review-checklist.md` e aviso no template de PR.
- *Commit direto em uma das três branches* → proibido em `AGENTS.md` § 6 para agentes; verificado por
  `scripts/check-structure.sh` § 7; proteção de branch quando o repositório for público.
- *`development` e `production` divergirem após hotfix* → o próprio fluxo de hotfix exige o merge de
  volta, e o checklist de encerramento cobra.
- *Custo de CI* → `concurrency` cancela execuções antigas, e o job de deploy só roda em `push`.
- *Deploy automático em produção sem revisão humana* → configurar *required reviewers* no Environment
  `production` (disponível em repositórios públicos no plano gratuito; em privados exige plano pago).

## Impacto na documentação

- [x] `docs/architecture.md` § 7 (ambientes) e § 8 (índice de ADRs) atualizados
- [x] `docs/guides/git-github.md` reescrito (modelo, promoção, hotfix, proteção, Environments)
- [x] `docs/guides/workflow.md` — nova seção de promoção entre ambientes
- [x] `docs/development-guide.md` § 7 (fluxo de branches) atualizado
- [x] `AGENTS.md` § 6 (Git) atualizado
- [x] `.github/workflows/ci.yml` — gatilhos nas três branches e job de deploy por ambiente
- [x] `.github/pull_request_template.md` — tipo de PR e método de merge
- [x] `scripts/check-structure.sh` — validação de nome de branch
- [x] índice em `docs/decisions/README.md` atualizado

## Evidências

- Modelo derivado de práticas usuais de *environment branching*; nenhum benchmark foi executado.
- **Hipótese a confirmar no momento do uso:** disponibilidade de proteção de branch e de regras de
  proteção de Environments em repositórios privados no plano gratuito do GitHub — os limites mudam
  com o tempo. Ver a tabela em `docs/guides/git-github.md` § 8, que carrega a mesma ressalva.
