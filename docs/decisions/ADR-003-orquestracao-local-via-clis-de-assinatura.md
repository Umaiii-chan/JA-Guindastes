# ADR-003 — Orquestração local de agentes via CLIs de assinatura, sem API paga

| Campo | Valor |
|-------|-------|
| **Status** | Proposto |
| **Data** | 2026-09-26 |
| **Autor** | agente Claude Code 2.1.280 (modelo Opus 5.5), sessão de 2026-09-26 |
| **Decisores** | Anderson Sehnem |
| **Tarefa relacionada** | TASK-001 |
| **Substitui** | ADR-001 |

## Contexto

O [ADR-001](ADR-001-workflow-baseado-em-arquivos.md) (Aceito em 2026-09-05) criou o workflow de
múltiplas IAs baseado em arquivos versionados. Quase tudo nele continua certo: o repositório como
única fonte de verdade, nenhum custo obrigatório e CI sem IA. Uma frase, porém, bloqueia o próximo
passo do projeto: "cada agente é acionado **manualmente** pela pessoa"
(`docs/decisions/ADR-001-workflow-baseado-em-arquivos.md:36`).

A pessoa responsável decidiu construir um **orquestrador de agentes** em cima deste repositório. O
objetivo é melhorar os agentes, a organização e a visão do andamento. A restrição de orçamento do
ADR-001 continua: os agentes serão usados pelas **assinaturas** (Claude Code, Codex, Gemini), e não
por API paga por token.

O que pode tornar isso viável sem API são CLIs de agente com modo não interativo. Na máquina da
pessoa verifiquei o Claude Code 2.1.280. O `claude --help` descreve `-p/--print` "for
non-interactive output" e oferece `--output-format` (`text`, `json`, `stream-json`), `--json-schema`,
`--permission-mode`, `--tools` e `--session-id`. Codex e Gemini CLI não estavam instalados; que
tenham um modo equivalente é hipótese. A viabilidade também depende dos termos de uso de cada
assinatura e de o modo não interativo usar a cota da assinatura, e não crédito de API (ver
"Evidências").

Problemas do fluxo atual que a automação ataca (detalhes em
[`docs/research/2026-09-26-orquestrador.md`](../research/2026-09-26-orquestrador.md)):

- cada transição entre papéis é manual, com "5 a 10 minutos por transição" segundo `docs/guides/using-ai-tools.md:113`;
- a evidência de testes é colada pelo próprio agente (AGENTS.md § 5, regra 4), sem registro do exit code;
- a independência do revisor é declarada, não verificada;
- não existe visão consolidada do andamento.

**Se nada for decidido:** o ADR-001 é imutável enquanto Aceito (AGENTS.md § 4) e proíbe o
acionamento automático. Qualquer orquestrador seria construído contra uma decisão vigente.

## Decisão

**Os agentes passam a poder ser acionados de duas formas válidas: manualmente pela pessoa ou por um
orquestrador local que chama, como subprocesso, as CLIs de agente autenticadas pela assinatura. O
repositório continua sendo a única fonte de verdade, nenhuma API paga por token é usada e o CI
continua sem IA.**

Este ADR substitui o ADR-001 **por inteiro**. O que continua valendo do ADR-001 está reescrito aqui,
para que o ADR-001 possa ser marcado como "Substituído por ADR-003" sem perder nada.

### Continua valendo (vem do ADR-001)

1. O repositório é a única fonte de verdade. As IAs compartilham contexto só por documentos
   versionados (`AGENTS.md`, `docs/`, `tasks/`, `handoffs/`).
2. Nenhuma API paga por token é usada. Qualquer uso futuro exige um novo ADR.
3. O GitHub Actions não chama IA. Ele executa verificações determinísticas (lint, testes, build,
   estrutura) e o deploy por ambiente definido no ADR-002.
4. O protótipo em `reference/langgraph-prototype/` fica só como referência.
5. Qualquer ferramenta que leia Markdown pode participar pelo modo manual.
6. Nenhum custo obrigatório: o protocolo funciona no GitHub gratuito e, pelo modo manual, só com as
   interfaces que a pessoa já tem. O orquestrador é opcional.
7. O protocolo (`AGENTS.md`, `tasks/`, `handoffs/`, `docs/`) continua independente de stack. O
   orquestrador terá a própria stack, decidida à parte.

### Muda

8. **Acionamento.** Além do modo manual, um orquestrador **local** pode acionar os papéis do
   AGENTS.md § 3 chamando CLIs de agente em modo não interativo. "Local" quer dizer que ele roda na
   máquina da pessoa e é iniciado por ela.
9. **Modo manual de primeira classe.** Todo papel que o orquestrador aciona também pode ser acionado
   manualmente. Por exemplo: gerar o prompt de um papel e depois ingerir a resposta colada de uma
   interface web. No modo manual, a evidência de verificação e a independência do revisor ficam
   registradas como *declaradas*, não como *verificadas*.
10. **Continuidade.** O orquestrador lê e escreve os mesmos artefatos versionados (`tasks/`,
    `handoffs/`) e não mantém uma fonte de verdade paralela. Logs e transcrições de execução podem
    ficar fora do Git, desde que o necessário para continuar o trabalho esteja nos artefatos
    versionados. O resultado das verificações (comando e exit code) e o nível de independência do
    revisor fazem parte desse necessário: ficam em artefato versionado, no mínimo no handoff, como
    exigem o AGENTS.md (introdução e § 5, regra 4).
11. **Protótipo.** O ADR-001 reservava o protótipo "para uma futura segunda versão". Ele deixa de ser
    a base prevista, porque depende de chaves de API. Dele se aproveitam só ideias (papéis, manifesto
    de execução, recorte do repositório).

### Princípios obrigatórios para o orquestrador

- **(a) Autenticação pela assinatura.** O subprocesso roda sem variáveis de chave de API (por exemplo
  `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`). Modos da CLI que exigem chave não são
  usados. Exemplo verificado: segundo o `claude --help`, o `--bare` usa "strictly ANTHROPIC_API_KEY
  or apiKeyHelper".
- **(b) Evidência executada vale mais que evidência declarada.** Quando o orquestrador roda os
  comandos de verificação, o resultado registrado vem do exit code, não do relato do agente. Um
  comando não executado nunca é registrado como aprovado.
- **(c) Revisor independente, registrado de forma verificável.** A regra do AGENTS.md § 3 continua.
  Independência significa outra ferramenta ou fornecedor ou, no mínimo, uma sessão nova que não
  retoma o contexto da implementação. O nível de independência fica registrado (ver item 10).
- **(d) Limite de uso é cota, não falha.** Uma execução interrompida por limite do plano é pausada e
  retomada depois. Ela não conta como falha do agente.
- **(e) Termos de uso primeiro.** Cada adaptador de CLI só é habilitado depois que a pessoa confirma,
  e registra, que os termos da assinatura permitem o uso automatizado local.
- **(f) As travas humanas não mudam.** Aprovação de PR, promoção entre ambientes (ADR-002), regras de
  negócio, aceite de ADR e mover a tarefa para `completed/` continuam com a pessoa responsável.
- **(g) Sem IA no CI por política, não por impossibilidade.** A CLI oferece um token de longa duração
  para assinatura (`claude setup-token`). Mesmo assim, ele seria um segredo de alto valor, o PR é
  entrada externa (risco de prompt injection) e o consumo de cota ficaria sem controle.

### Fora desta decisão (ficam para decisões ou ADRs seguintes)

- Onde o orquestrador fica: neste repositório, em `tools/orquestrador/` ou em outro repositório.
- Runtime e linguagem do orquestrador (ADR-004 sugerido).
- Se os agentes continuam fazendo commits e escrevendo tarefa, parecer e handoff, ou se o
  orquestrador grava esses arquivos a partir da saída do agente e faz o commit em nome da pessoa.
  Isso afeta o AGENTS.md §§ 2 e 6 e os prompts de `docs/prompts/`.
- O formato legível por máquina de handoffs e registros de execução, e os limites de rodadas de
  correção e revisão.
- Se, num ADR futuro, a API paga pode entrar como opção (por exemplo, opt-in por execução): decisão 5
  da § 7 de `docs/research/2026-09-26-orquestrador.md`.

### Relação com o ADR-002

O [ADR-002](ADR-002-modelo-de-branches-por-ambiente.md) continua Aceito. O contexto dele lista
restrições herdadas do ADR-001 (`docs/decisions/ADR-002-modelo-de-branches-por-ambiente.md:25-26`):
"GitHub no plano gratuito, sem custo obrigatório, agentes de IA acionados manualmente, protocolo
independente de stack". Com este ADR aceito, GitHub gratuito, custo e stack passam a ter como fonte os
itens 6 e 7 acima. "Acionados manualmente" passa a valer como "acionados manualmente ou pelo
orquestrador local do ADR-003". A decisão do ADR-002 (as três branches por ambiente) não muda, por
isso ele não é substituído.

## Alternativas consideradas

| Alternativa | Vantagens | Desvantagens | Por que não |
|-------------|-----------|--------------|-------------|
| **A. Orquestrador local via CLIs de assinatura, mais o modo manual (escolhida)** | sem custo por token (se o modo não interativo usar a cota da assinatura, o que é hipótese); usa planos já pagos; automatiza transições e o registro da verificação; mantém o repositório como fonte de verdade | depende de CLIs e flags que mudam entre versões; limite de uso dos planos; termos de uso a confirmar por fornecedor; hoje só o Claude Code está instalado | — |
| B. Manter o ADR-001 (só modo manual) | nenhum esforço; nenhuma dependência nova | copiar e colar em toda transição; evidência só declarada; nenhuma visão consolidada; o orquestrador desejado continua proibido | não atende ao objetivo |
| C. Orquestrador com SDKs e API paga (o protótipo LangGraph) | automação completa; papéis já esboçados | custo por token; chaves como segredos; contraria a restrição de usar os planos | orçamento e restrição de uso |
| D. Agentes no GitHub Actions com token de assinatura | automação dentro do PR, sem máquina local | token de alto valor como segredo; PR como entrada externa (prompt injection); consumo de cota sem controle; gasta minutos do plano gratuito; contraria o CI sem IA | segurança e controle |
| E. Frameworks multiagente (CrewAI, AutoGen e similares) | ecossistema pronto | o ADR-001 registrou a mesma dependência de API; mais uma camada para aprender | mesma dependência de API (**hipótese** para as versões atuais; não reavaliado aqui) |

## Consequências

**Positivas:**
- as transições entre papéis deixam de depender de copiar e colar;
- o resultado dos testes, do lint e do build passa a ser registrado pelo orquestrador, a partir do exit code;
- a independência do revisor fica registrada e pode ser conferida;
- **hipótese:** nenhum custo novo além dos planos que a pessoa já assina. Depende de o modo não
  interativo consumir a cota da assinatura, e não crédito de API, e de os termos permitirem esse uso
  (ver "Evidências");
- base para uma visão de andamento gerada a partir dos próprios artefatos versionados.

**Negativas / custos:**
- código novo para manter (o orquestrador) e dependência das CLIs de terceiros;
- vários documentos precisam ser atualizados depois do aceite (ver "Impacto na documentação");
- **hipótese:** a automação consome a mesma cota do uso interativo;
- um revisor de outra ferramenta exige instalar Codex ou Gemini CLI, ou revisar manualmente por uma interface web.

**Riscos e como mitigar:**
- *Flags e formatos das CLIs mudam* → o ADR fixa princípios, não flags. Cada execução registra a
  versão da CLI, e uma checagem de pré-requisitos roda antes de despachar um papel.
- *Termos de uso* → princípio (e).
- *Limite de uso no meio de uma execução* → princípio (d), mais timeout de relógio e uma execução
  por ferramenta de cada vez.
- *Agente com permissões demais no subprocesso* → permissões mínimas por papel e diretório de
  trabalho isolado (`git worktree`). Planejador e Revisor não alteram código nem testes. Hoje o
  AGENTS.md § 2 (etapa 8) e os prompts `docs/prompts/01-planejador.md` e `docs/prompts/04-revisor.md`
  mandam o próprio agente escrever tarefa, parecer e handoff e fazer o commit. Se esses arquivos
  passarem a ser gravados pelo orquestrador a partir da saída do agente, isso fica para a decisão
  sobre commits e formato de handoff (ver "Fora desta decisão").
- *Viés correlacionado quando o revisor é o mesmo modelo em sessão nova* → registrar o nível de
  independência e preferir outra ferramenta.
- *A CLI adiciona rodapé de co-autoria de IA no commit* (conflito com AGENTS.md § 6) → a seção 8 do
  `scripts/check-structure.sh` já barra isso no CI. Quem faz o commit é decisão posterior.
- *Uma chave de API no ambiente faz a CLI cobrar por token* (**hipótese** sobre a precedência entre
  chave e login) → princípio (a): o ambiente do subprocesso é montado sem essas variáveis.

## Impacto na documentação

Nada abaixo foi alterado enquanto este ADR está `Proposto`. Tudo depende do aceite:

- [ ] `docs/architecture.md` § 8: incluir o ADR-003 e marcar o ADR-001 como substituído
- [ ] `docs/decisions/ADR-001-workflow-baseado-em-arquivos.md`: só o campo Status muda, para "Substituído por ADR-003" (feito pela pessoa responsável)
- [x] índice em `docs/decisions/README.md`: ADR-003 listado como `Proposto` (atualizar os dois status no aceite)
- [ ] `README.md`, seção "O que este template **não** é": hoje diz "Não é um orquestrador automático"
- [ ] `docs/policies/security.md` § 6, item 5: citar este ADR em vez do ADR-001
- [ ] comentário de `.github/workflows/ci.yml` (linhas 276–281): citar este ADR e trocar o motivo "exigiria chaves de API (custo)" pelo do princípio (g) (arquivo protegido; só a pessoa altera)
- [ ] `docs/guides/adapting-template.md` (linha 93): "Revise `ADR-001`" passa a apontar para o ADR-003
- [ ] `docs/guides/using-ai-tools.md`: descrever o modo orquestrado ao lado do manual
- [ ] `reference/langgraph-prototype/STATUS.md`: a linha 22 passa a citar o ADR-003, e a seção "Quando voltar a usar" deixa de ser o caminho previsto
- [ ] `docs/development-guide.md`: comandos do orquestrador, quando ele existir
- [ ] `docs/known-gaps.md`: só o Claude Code instalado; termos de uso ainda não confirmados

## Evidências

**Verificado** (em 2026-09-26, na máquina da pessoa responsável):
- `claude --version` → `2.1.280 (Claude Code)`. `codex` e `gemini` não encontrados no PATH.
- No `claude --help`, existem: `-p/--print` ("non-interactive output"), `--output-format` com
  `text|json|stream-json` ("only works with --print"), `--json-schema`, `--permission-mode`,
  `--permission-prompts`, `--tools`, `--allowedTools`, `--disallowedTools`, `--session-id` e
  `--no-session-persistence`. Também existem o `--bare` (texto sobre `ANTHROPIC_API_KEY` citado acima),
  o `--max-budget-usd` ("Maximum dollar amount to spend on API calls") e o subcomando `setup-token`
  ("requires Claude subscription").
- O texto do ADR-001 (linha 36), do ADR-002 (linhas 25–26), do `README.md` (linha 156), do
  `docs/policies/security.md` § 6 item 5, do `docs/guides/adapting-template.md` (linha 93), do
  `reference/langgraph-prototype/STATUS.md` (linha 22) e do comentário em `.github/workflows/ci.yml`
  (linhas 276–281), todos na forma citada acima.
- A análise completa, com método e revisão cética de 29 propostas:
  [`docs/research/2026-09-26-orquestrador.md`](../research/2026-09-26-orquestrador.md).

**Hipótese / não verificado:**
- `claude -p` não foi executado. O formato real do JSON de saída, os campos de uso e o sinal de
  "limite atingido" são desconhecidos.
- Se os termos de uso de cada assinatura permitem a automação local via CLI: não verificado para
  nenhum fornecedor (por isso o princípio (e)).
- Se o uso headless consome a cota da assinatura e se compartilha a mesma cota do uso interativo.
- A precedência entre chave de API no ambiente e login da assinatura.
- As flags de modo não interativo do Codex e do Gemini CLI (não instalados).
