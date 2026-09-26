# Como adaptar este template a um projeto real

Roteiro para sair do template e chegar a um repositório pronto para o primeiro ciclo de IA.
Tempo estimado: 1 a 3 horas para um projeto novo; mais para um projeto existente com muito código.

Você pode fazer isso com ajuda de uma IA — o prompt `docs/prompts/06-preencher-contexto.md` foi
escrito para isso. Mas **você** valida cada resposta: é aqui que a fonte de verdade nasce.

---

## Fase 1 — Preparar o repositório (15 min)

- [ ] Copiar/clonar o template e renomear a pasta.
- [ ] Iniciar Git novo (`rm -rf .git && git init`) **ou** usar *Use this template* no GitHub.
- [ ] Apagar `reference/` se não precisar do protótipo antigo.
- [ ] Editar `README.md`: substituir o conteúdo do template pelo do seu projeto (mantenha a seção
      "Estrutura do repositório" e a referência a `AGENTS.md`).
- [ ] Definir licença (`LICENSE`).
- [ ] Criar repositório no GitHub, `git remote add origin ...`, primeiro push.
- [ ] Criar as três branches por ambiente e definir `development` como default
      (ver [`git-github.md`](git-github.md) § 8.1).
- [ ] Se público: configurar proteção das três branches (ver [`git-github.md`](git-github.md) § 8.2).
- [ ] Criar os GitHub Environments `development`, `homologation` e `production` se for usar deploy
      automático (§ 8.3).
- [ ] Ativar Dependabot (*Settings → Code security*).

## Fase 2 — Contexto mínimo (obrigatório antes de qualquer IA implementar) (45–90 min)

Preencha nesta ordem. Substitua **todos** os `<preencher>`. Se um item não se aplica, escreva
"não se aplica" — não deixe o marcador.

### 2.1 `docs/project-overview.md`

- Problema, objetivo, usuários, funcionalidades, escopo (dentro/fora), stack resumida, restrições, glossário.
- Teste: uma pessoa de fora entende o que o sistema faz em 2 minutos?

### 2.2 `docs/architecture.md`

- Projeto **novo**: descreva a arquitetura pretendida. Marque como "alvo" o que ainda não existe.
- Projeto **existente**: descreva a arquitetura **real**, mesmo que feia. Peça a uma IA (nível C) para
  mapear a estrutura de pastas e os imports e gerar um rascunho; você corrige.
- Preencha as regras de dependência entre camadas (§ 3) — é o que mais evita que a IA "faça um
  import esperto".

### 2.3 `docs/business-rules.md`

- Escreva as regras que você **já sabe**. Não precisa ser completo — precisa ser **verdadeiro**.
- Cada regra com ID `RN-NNN`, exemplos e exceções.
- Tudo que você não sabe vai para "Perguntas em aberto".

### 2.4 `docs/development-guide.md`

- Pré-requisitos com versão; instalação; **tabela de comandos** (a parte mais importante); estrutura
  de pastas; convenções; variáveis de ambiente; arquivos protegidos.
- Teste: rode cada comando da tabela em uma máquina limpa (ou peça a uma IA nível C que rode e cole a saída).

### 2.5 `.env.example`

- Uma linha por variável, com comentário. Sem valores reais.

## Fase 3 — Qualidade e segurança (30–60 min)

### 3.1 `docs/testing-strategy.md`

- Framework, comandos, tipos de teste, cobertura mínima, convenções de nome.
- Se o projeto existente não tem testes: escreva a estratégia **desejada** e registre em
  `known-gaps.md` que a cobertura atual é zero. A primeira tarefa pode ser "configurar framework de testes".

### 3.2 `.github/workflows/ci.yml`

- Abra o arquivo. Ele tem blocos comentados por stack (Node, Python, Go, Java, .NET).
- Descomente/adapte o bloco da sua stack. Os comandos devem ser **os mesmos** da tabela em
  `development-guide.md` § 3.
- Mantenha o passo `scripts/check-structure.sh` — ele valida a estrutura do fluxo.
- Faça um push e confira que o CI roda (verde ou vermelho, mas roda).

### 3.3 `docs/security.md`

- Dados tratados e classificação; autenticação/autorização; onde vivem os segredos; superfície de ataque;
  ferramenta de auditoria de dependências.

### 3.4 `docs/known-gaps.md`

- Tudo que você sabe que não funciona, não existe ou não foi decidido. Seja generoso: cada item aqui
  é uma alucinação evitada.

## Fase 4 — Requisitos e decisões (30 min)

- [ ] `docs/requirements/`: registre os requisitos das funcionalidades da primeira entrega, com
      critérios de aceite. Pode começar com 3 a 5.
- [ ] `docs/decisions/`: crie ADRs para decisões já tomadas (stack, banco, hospedagem, arquitetura).
      Um por decisão. Status `Aceito`. Atualize o índice.
- [ ] Revise `ADR-003` (que substituiu o `ADR-001`): ele é do template. Mantenha se você adota este fluxo; ajuste autor/data se quiser.

## Fase 5 — Primeira tarefa e handoff inicial (15 min)

- [ ] Copie `docs/templates/task-template.md` para `tasks/in-progress/TASK-001-<slug>.md`.
- [ ] Escolha algo **pequeno e vertical** (atravessa as camadas, mas com pouca lógica): um endpoint
      de health check, um CRUD mínimo de uma entidade, a configuração do framework de testes.
      A primeira tarefa serve para **testar o fluxo**, não para entregar valor.
- [ ] Critérios de aceite verificáveis. Escopo explícito.
- [ ] Edite `handoffs/current.md`: tarefa = TASK-001; etapa concluída = "criação da tarefa";
      próximo passo = "Planejador: análise de impacto e plano".
- [ ] `git checkout development && git checkout -b task/TASK-001-<slug>`; commit; push.

## Fase 6 — Primeiro ciclo (assistido) (1–2 h)

- [ ] Abra a primeira IA com `docs/prompts/00-kickoff.md` + `01-planejador.md`.
- [ ] Leia o que ela devolveu com atenção: ela citou arquivos que existem? Identificou as `RN-*`?
      Fez perguntas em vez de supor?
- [ ] Siga o fluxo ([`workflow.md`](workflow.md)) até o merge.
- [ ] Ao terminar, faça uma **retrospectiva de 10 minutos**: o que os agentes erraram? O que faltava
      na documentação? Corrija `docs/` e, se for regra universal, corrija também no template.

---

## Adaptações por tipo de projeto

### Projeto existente com muito código

- Não tente documentar tudo. Documente o que a **primeira tarefa** toca, mais a visão geral.
- Peça a uma IA nível C: "mapeie a estrutura de `src/`, liste os módulos e seus imports principais,
  e gere um rascunho de `docs/architecture.md` § 2 e § 3. Marque como hipótese tudo que você deduziu."
- Registre em `known-gaps.md`: "documentação de arquitetura cobre apenas os módulos X, Y; o resto é
  não documentado."

### Monorepo / vários serviços

- Um `AGENTS.md` na raiz com as regras universais; um `AGENTS.md` curto por serviço com o que é
  específico (comandos, arquivos protegidos). O da raiz diz: "leia também o `AGENTS.md` da pasta
  em que a tarefa está".
- `docs/` na raiz para o que é transversal; `docs/` por serviço para o resto.
- `tasks/` e `handoffs/` únicos na raiz (a continuidade é do projeto, não do serviço).

### Projeto sem código ainda (só ideia)

- Preencha `project-overview.md` e `requirements/` primeiro.
- Use uma IA nível A/B como Planejador para propor arquitetura → vira ADRs `Proposto` → você aceita.
- Só depois `development-guide.md` e `ci.yml`.
- TASK-001 = "esqueleto do projeto: estrutura de pastas, dependências, comando de teste rodando com um teste trivial".

### Projeto solo com uma só IA disponível

- Funciona. Use **conversas separadas por papel** e diga o papel no kickoff.
- Seja mais rigoroso com o Revisor: peça explicitamente "assuma que o Implementador errou; procure onde".

---

## Checklist final — pronto para o primeiro ciclo?

- [ ] `grep -r "<preencher>" docs/project-overview.md docs/architecture.md docs/business-rules.md docs/development-guide.md` retorna vazio
- [ ] cada comando de `development-guide.md` § 3 foi executado com sucesso pelo menos uma vez
- [ ] `ci.yml` roda no GitHub (mesmo que ainda vermelho por falta de código)
- [ ] as três branches existem no remoto e `development` é a default
- [ ] `bash scripts/check-structure.sh` passa localmente
- [ ] existe uma tarefa em `tasks/in-progress/` com critérios de aceite
- [ ] `handoffs/current.md` aponta para essa tarefa e para o papel Planejador
- [ ] `.env.example` existe e `.env` está no `.gitignore`
- [ ] `README.md` fala do seu projeto, não do template

Se tudo estiver marcado, abra a primeira IA.
