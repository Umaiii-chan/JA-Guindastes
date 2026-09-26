# AI Dev Workflow Template

Template universal e **gratuito** para desenvolver projetos grandes usando múltiplas IAs
(ChatGPT/Codex, Claude, Gemini e outras) **sem APIs pagas**, mantendo a continuidade do trabalho
por meio de arquivos versionados no Git.

Uma IA começa, outra continua, uma terceira revisa — e nenhuma delas precisa "lembrar" de nada,
porque tudo que importa está no repositório.

---

## O problema que este template resolve

Quando você usa várias ferramentas de IA em um projeto grande:

- cada uma tem sua própria memória (ou nenhuma);
- o contexto se perde entre sessões;
- elas inventam arquivos, funções e regras que não existem;
- ninguém sabe o que a IA anterior fez nem por quê;
- integrar via API custa dinheiro e exige chaves.

Este template resolve isso com **um protocolo de trabalho baseado em arquivos**, não em ferramentas:

| Problema | Solução no template |
|----------|---------------------|
| Perda de contexto | `handoffs/current.md` registra exatamente onde parou e o que vem depois |
| Alucinação | `AGENTS.md` + `docs/policies/anti-hallucination.md` com regras verificáveis |
| Falta de fonte de verdade | `docs/` versionado: arquitetura, regras de negócio, decisões (ADRs) |
| Não saber o que cada IA fez | `handoffs/history/` + commits pequenos + PR template |
| Custo | zero — só GitHub gratuito + as interfaces de IA que você já usa |
| Dependência de uma ferramenta | qualquer IA que leia Markdown funciona; a distribuição de papéis é flexível |

---

## Como funciona em 60 segundos

```text
Você                       Repositório (fonte de verdade)              IAs (manuais)
─────                      ──────────────────────────────              ─────────────
1. Preenche docs/    ───►  project-overview, architecture,
   (contexto mínimo)       business-rules, development-guide
2. Cria uma tarefa   ───►  tasks/in-progress/TASK-001.md
                           com critérios de aceite
3. Abre a IA #1      ───►  "Leia AGENTS.md e handoffs/current.md"  ◄── planeja, escreve testes
                           handoffs/current.md atualizado
4. Abre a IA #2      ───►  "Leia AGENTS.md e handoffs/current.md"  ◄── implementa, roda testes
                           handoffs/current.md atualizado
5. Abre a IA #3      ───►  "Leia AGENTS.md e handoffs/current.md"  ◄── revisa o diff
                           parecer registrado
6. Abre o PR         ───►  GitHub Actions roda lint/test/build (determinístico, sem IA)
7. Você aprova       ───►  merge em development; tarefa vai para completed/, handoff arquivado
8. Quando quiser     ───►  promove development → homologation → production (PR de merge)
```

As IAs não se falam. Elas se leem através dos arquivos.

O repositório tem três branches longas, uma por ambiente — `development` (default), `homologation` e
`production`. As tarefas nascem e voltam para `development`; a promoção entre ambientes é feita em
lote, por PR, quando você decidir. Detalhes em [`docs/guides/git-github.md`](docs/guides/git-github.md).

---

## Estrutura do repositório

```text
.
├── AGENTS.md                  ← regras para qualquer agente de IA (comece aqui)
├── CLAUDE.md / GEMINI.md      ← apontam para AGENTS.md (algumas ferramentas exigem o nome)
├── README.md                  ← este arquivo
│
├── docs/
│   ├── README.md              ← índice da documentação
│   ├── project-overview.md    ← [PREENCHER] o que é o sistema, para quem, escopo
│   ├── architecture.md        ← [PREENCHER] componentes, camadas, fluxo de dados
│   ├── business-rules.md      ← [PREENCHER] regras que a IA não pode inventar
│   ├── development-guide.md   ← [PREENCHER] instalar, rodar, comandos, convenções
│   ├── testing-strategy.md    ← [PREENCHER] tipos de teste, comandos, cobertura mínima
│   ├── security.md            ← [PREENCHER] contexto de segurança do projeto
│   ├── known-gaps.md          ← [PREENCHER] limitações e dívidas conhecidas
│   ├── requirements/          ← requisitos funcionais e não funcionais
│   ├── decisions/             ← ADRs (Architecture Decision Records)
│   ├── templates/             ← tarefa, handoff, code review (o de ADR fica em decisions/)
│   ├── checklists/            ← implementação, code review, definição de pronto
│   ├── guides/                ← fluxo de trabalho, Git/GitHub, uso das IAs, adaptação, Obsidian
│   ├── policies/              ← anti-alucinação, segurança
│   └── prompts/               ← prompts prontos para colar em cada IA, por papel
│
├── tasks/
│   ├── backlog/               ← tarefas ainda não iniciadas
│   ├── in-progress/           ← tarefa(s) em execução (idealmente uma por vez)
│   └── completed/             ← concluídas e validadas
│
├── handoffs/
│   ├── current.md             ← ONDE O TRABALHO PAROU (o arquivo mais importante do fluxo)
│   └── history/               ← handoffs arquivados, um por etapa concluída
│
├── scripts/
│   └── check-structure.sh     ← valida a estrutura do repositório (usado pelo CI)
│
├── src/                       ← código do projeto (estrutura depende da stack)
├── tests/                     ← testes automatizados
│
├── .github/
│   ├── workflows/ci.yml       ← CI determinístico + deploy por ambiente — sem IA
│   ├── pull_request_template.md
│   └── ISSUE_TEMPLATE/task.md
│
└── reference/
    └── langgraph-prototype/   ← protótipo anterior com APIs (só referência; ver STATUS.md)
```

---

## Começando a usar (11 passos)

1. **Copie ou clone** este repositório e renomeie a pasta para o nome do seu projeto.
2. **Inicie um novo Git** (`rm -rf .git && git init`) ou use este repositório como template no GitHub
   (*Use this template*).
3. **Apague `reference/`** se não precisar do protótipo antigo.
4. **Preencha o contexto mínimo** em `docs/` — pelo menos `project-overview.md`,
   `architecture.md`, `business-rules.md` e `development-guide.md`.
   Siga `docs/guides/adapting-template.md`.
5. **Crie as três branches** (`development`, `homologation`, `production`) e defina `development`
   como default — ver `docs/guides/git-github.md` § 8.1.
6. **Ajuste `.github/workflows/ci.yml`** com os comandos reais de lint, teste e build da sua stack
   (o arquivo tem exemplos comentados para Node, Python, Go, Java e .NET) e, se for usar deploy
   automático, configure os GitHub Environments (§ 8.3 do mesmo guia).
7. **Crie a primeira tarefa** copiando `docs/templates/task-template.md` para
   `tasks/in-progress/TASK-001-<slug>.md`, com critérios de aceite claros.
8. **Atualize `handoffs/current.md`** dizendo qual é a tarefa e qual o primeiro papel (Planejador).
9. **Abra o repositório em qualquer IA** e cole o prompt de `docs/prompts/00-kickoff.md`.
   A instrução essencial é: *"Leia `AGENTS.md` e `handoffs/current.md` antes de qualquer coisa."*
10. **Siga o ciclo**: planejar → testar → implementar → revisar, trocando de IA quando fizer sentido.
   Cada etapa termina com o handoff atualizado.
11. **Abra o PR** para `development`, deixe o CI validar, aprove, mova a tarefa para `completed/` e
    arquive o handoff.

Guia detalhado de uso das ferramentas em `docs/guides/using-ai-tools.md`.

---

## Princípios

- **O repositório é a fonte de verdade.** Não a memória da IA, não o chat, não o Obsidian.
- **Handoff é obrigatório.** Trabalho sem handoff é trabalho perdido.
- **Evidência > afirmação.** Saída de terminal vale; "acredito que passou" não vale.
- **Mudanças pequenas.** Uma tarefa, uma branch, um PR revisável.
- **Revisão independente.** Quem revisa não é quem implementou.
- **CI determinístico.** GitHub Actions valida código, não opina sobre ele.
- **Universal.** Nenhuma stack pressuposta; nenhuma IA obrigatória; nenhum custo obrigatório.

---

## O que este template **não** é

- Não é um orquestrador automático. As IAs são acionadas manualmente por você.
- Não chama nenhuma API de IA. Se um dia você quiser isso, veja `reference/langgraph-prototype/`.
- Não substitui julgamento humano. A aprovação final é sempre de uma pessoa.

---

## Documentação

Comece por [`docs/README.md`](docs/README.md). Os guias mais úteis para o primeiro dia:

- [`docs/guides/workflow.md`](docs/guides/workflow.md) — o fluxo completo, passo a passo
- [`docs/guides/using-ai-tools.md`](docs/guides/using-ai-tools.md) — como usar ChatGPT/Codex, Claude e Gemini manualmente
- [`docs/guides/adapting-template.md`](docs/guides/adapting-template.md) — como adaptar a um projeto real
- [`docs/guides/git-github.md`](docs/guides/git-github.md) — as três branches por ambiente, commits, PRs, promoção, hotfix e proteção no plano gratuito

---

## Licença

Defina a licença do seu projeto. Este template pode ser usado e adaptado livremente.
