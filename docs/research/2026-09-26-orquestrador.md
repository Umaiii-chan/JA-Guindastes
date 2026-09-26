# Pesquisa — Orquestrador de agentes: o que trazer do archify e como organizar o trabalho sem API paga

| Campo | Valor |
|-------|-------|
| **Data** | 2026-09-26 |
| **Autor** | agente Claude Code 2.1.280 (modelo Opus 5.5), sessão de 2026-09-26, a pedido de Anderson Sehnem |
| **Tarefa** | TASK-001 (`tasks/backlog/TASK-001-registrar-analise-orquestrador.md`) |
| **Natureza** | registro de pesquisa. **Não é decisão.** Decisões vão para ADR; a primeira proposta é o [ADR-003](../decisions/ADR-003-orquestracao-local-via-clis-de-assinatura.md) (`Proposto`) |
| **Base analisada** | este repositório em `development` @ `86e2fdc`; [archify](https://github.com/tt-a1i/archify/tree/9e35d2b0b39b155553ba9fcfe0b4f2a5198dd993) @ `9e35d2b` (licença MIT) |

## Pergunta

A pessoa responsável vai construir um orquestrador de agentes em cima deste repositório. O foco é
(1) melhorar os agentes, (2) a organização e (3) a visão do andamento das atividades. A pergunta
era: o que melhorar, e o que do projeto archify vale trazer?

**Restrição informada durante a análise:** os agentes serão usados pelas **assinaturas** (Claude
Code, Codex, Gemini) e dificilmente por API paga por token. Na máquina da pessoa, em 2026-09-26, só o
`claude` (Claude Code 2.1.280) estava instalado; `codex` e `gemini` não estavam no PATH.

## Método

- **Leitura:** 5 agentes somente leitura. Três leram o archify (instruções e empacotamento de
  agentes; motor de diagramas como ferramenta de visibilidade; governança e processo). Dois leram
  este repositório (o protocolo atual; o protótipo em `reference/langgraph-prototype/`).
- **Propostas:** 3 agentes, um por eixo (agentes, organização, visibilidade). Eles receberam a
  restrição de uso por planos, que foi informada depois da leitura.
- **Verificação:** um revisor cético por eixo tentou derrubar cada proposta, conferindo os arquivos
  dos dois repositórios e as regras do AGENTS.md e dos ADRs. Das 29 propostas, nenhuma foi descartada,
  e todas receberam "ajustar". Este registro usa as versões ajustadas.
- **Síntese:** um agente juntou as propostas duplicadas entre eixos, mantendo os ids.
- **Conferência final:** o agente principal conferiu à parte as flags citadas no `claude --help`, o
  bloco `concurrency` de `.github/workflows/ci.yml`, o `<org>/<repo>` de `.github/ISSUE_TEMPLATE/config.yml`
  e o remoto `origin`.

**Convenções.** Caminhos sem prefixo são relativos à raiz deste repositório. `arquivo:N` indica a
linha N no commit `86e2fdc`. O prefixo `archify:` indica um arquivo do archify no commit `9e35d2b`.
"(novo)" marca um arquivo que ainda não existe. Onde duas propostas diziam a mesma coisa, elas foram
juntadas numa só, com os dois ids.

---

## 1. Resumo em 5 linhas

1. **Diagnóstico.** O protocolo é sólido, mas nunca foi usado. Há 1 commit (`86e2fdc`), e `tasks/completed/` e `handoffs/history/` só têm `.gitkeep`. O estado vive em prosa e a evidência é declarada pelo próprio agente. Duas regras travam o orquestrador hoje: o ADR-001:36 manda acionar agentes "manualmente", e o AGENTS.md:32-34 proíbe implementar enquanto os 4 docs mínimos tiverem `<preencher>` (21, 14, 9 e 20 linhas com o marcador).
2. **Archify.** O que serve dele é a forma de verificar o agente: status tirado do exit code, laço com critério de parada, diagnósticos estruturados e taxonomia de revisão. O motor de diagramas não serve como painel.
3. **Aposta 1: decidir.** Um ADR-003, "orquestração local de agentes via CLIs de assinatura, sem API paga", mais a decisão de onde o orquestrador fica. O executor seria o Claude Code 2.1.280 em modo não interativo (`claude -p`), com o modo manual pelas interfaces web tratado como caminho de primeira classe.
4. **Aposta 2: evidência.** O orquestrador roda os gates e grava recibos. A aprovação fica presa ao SHA, o laço de correção tem limite, e a independência do revisor é provada pelo argv da chamada.
5. **Aposta 3: estado e visão.** Um handoff por tarefa, só de acréscimo, com frontmatter plano e pendências com ID. Um comando `status` lê todas as branches `task/*` e abre com "Aguardando você".

---

## 2. Do archify: o que vale trazer

O archify é uma skill de diagramas. O produto (renderizadores, viewer, presets) não resolve o seu problema. O que vale é a engenharia em volta do agente: como ele é instruído, como a saída dele é verificada e quando ele deve parar. Tudo o que está abaixo é padrão para reimplementar. Nenhum item pede vendorizar código.

| Ideia | O que é no archify (arquivo) | Como fica no seu projeto | Esforço | Valor |
|---|---|---|---|---|
| Status vem do exit code; skipped nunca vira passed | `archify:archify/references/delivery-contract.md:73-77`; `archify:archify/SKILL.md:35` ("A non-zero exit can never be described as success") | Recibo de gates: passed/failed pelo exit code; timeout/not_run/error pela execução (AG-3, ORG-5) | M | alto |
| O harness externo reexecuta; o relato do agente não vale como prova | `archify:benchmarks/ordinary-model-floor/README.md:27`. Em `results/2026-07-26-pi-three-models-quality-first.json`, 1 execução diz "All 4 checks passed" com `validation.ok=false`, e outras 2 dizem "complete and validated" também com falha | O orquestrador roda os gates **depois** que o agente termina. O gate é definido pelo orquestrador, nunca escolhido pelo agente (AG-3) | incluso em AG-3 | alto |
| Laço com parada objetiva e congelamento | `archify:archify/SKILL.md:28` (candidato congelado após passar) e `:35` (2 rodadas sem melhorar o melhor valor = parar); `archify:archify/references/delivery-contract.md:117` (no máximo 2 rodadas) | Laço interno do Implementador e laço Revisor↔Implementador com limite; testes congelados por hash (AG-7) | M | alto |
| Falha operacional é registrada, não perdida | `archify:benchmarks/ordinary-model-floor/benchmark.mjs:27` (timeout/no_candidate/provider_error) e o comando `record-failure` | Limite de uso, CLI ausente ou timeout geram recibo de falha operacional, que não conta como falha do agente (ORG-5, VIS-3) | P | alto |
| Diagnóstico estruturado | `archify:archify/renderers/shared/diagnostics.mjs:15-30` (`code`, `subject`, `evidence`, `supportedFixes`); `archify:CONTRIBUTING.md:53` | Saída legível por máquina do validador e do `check-structure.sh`, que alimenta um prompt de reparo (AG-2, ORG-7) | P–M | alto |
| Taxonomia de revisão e re-revisão | `archify:REVIEWING.md:32-43`: defeito bloqueante, evidência necessária, sugestão e resultado Ready; um bloqueante tardio precisa ser justificado por evidência nova, por requisito de aceite esquecido ou por diff novo (l.37); "do not treat an old pass as proof of new behavior" | Um eixo único de disposição e o resultado INCONCLUSIVO; re-revisão contra o head anterior (AG-2, AG-7, AG-8) | P | alto |
| Verificar referências no repositório | `archify:archify/renderers/shared/repository-evidence.mjs` (239 linhas: `git cat-file -t` = blob, linha dentro do arquivo). Ele para no 1º erro | Validar `arquivo:linha` do parecer e do handoff no SHA revisado, reportando **todos** os erros (AG-8) | M | médio |
| Entrada curta com leitura progressiva | `archify:archify/SKILL.md` (137 linhas; "Fast authoring path" na l.15, "Read only those files" na l.20); limite de 160 linhas em `archify:archify/test/skill-metadata.test.mjs:38-40` | Leitura por papel em vez de ~1.207 linhas obrigatórias (AG-4, ORG-8) | M | médio |
| Testes de contrato das instruções | `archify:archify/test/skill-metadata.test.mjs:27-36`: caminhos citados existem, mas só os com prefixos conhecidos; `archify:CONTRIBUTING.md:38` diz que instruções são "behavioral inputs" | Poucas checagens determinísticas no CI, sem IA (AG-5, ORG-7) | P | médio |
| Concorrência de CI correta | `archify:.github/workflows/ci.yml:8-11` (cancela só em PR) e `:331-336` (deploy com grupo próprio, sem cancelamento) | Corrige o bug de `.github/workflows/ci.yml:35-39` (ORG-10) | P | médio |
| Registros datados e "não planejado" | `archify:docs/cursor-acceptance-2026-07.md:5` ("dated compatibility record"); seção "Not planned" de `archify:ROADMAP.md` | Registro de aceite por adaptador de CLI e lista de ideias recusadas (ORG-9) | P | médio |
| Fim de linha fixo | `archify:.gitattributes` (`* text=auto eol=lf`) | Hashes e hook estáveis no Windows, onde verifiquei `core.autocrlf=true` e working tree em CRLF (ORG-5, ORG-7) | P | médio |
| Validadores gerados sem dependência em runtime | `archify:archify/scripts/generate-validators.mjs` (ajv só em devDependencies) | Só se o runtime escolhido for Node (AG-2) | P | baixo |

**O que NÃO vale trazer:**
- **Renderizadores, viewer, presets, motion, Share Cards, exportação PNG/WebM e brand marks.** Não servem ao objetivo. As marcas têm licenças variadas, inclusive CC-BY-NC-SA.
- **Archify como painel de status.** Cada HTML tem 810 a 820 KB (verificado em `archify:archify/examples/*.html`) e não aparece inline no GitHub. A interface só existe em en/zh-CN. O lifecycle aceita no máximo 4 raias e 5 colunas por raia, e o layout falha fechado por critério estético. Mermaid já é usado em `docs/architecture.md` (linhas 21 e 65) e atende melhor.
- **Commitar HTML gerado.** São ~800 KB por diagrama e 2,2 MB por delta.
- **`archify:archify/scripts/check-update.mjs` (1.667 linhas) e manifesto remoto de versão.** Engenharia de distribuição. O SemVer de `archify:archify/skill-release.json` também é exagero aqui: um inteiro `protocolo_versao` basta.
- **Infraestrutura de release (zip determinístico, DeepSeek Harness, matriz de 3 sistemas operacionais), site, testes de README bilíngue e os 48 docs `archify:docs/research-visual-evolution-round-*` (rounds 2 a 49).**
- **visual-check com Chrome e 4 viewports.** Vale o princípio (separar checagem automática de julgamento humano), não a ferramenta.
- **CodeRabbit como revisor.** Contraria o ADR-001 e o comentário de `ci.yml:276-281` (sem IA no CI). Só o conteúdo da configuração serve de inspiração para o prompt do revisor.
- **Testes de contrato com dezenas de frases travadas por regex.** Engessariam a edição dos prompts.
- **Benchmark com matriz de modelos agora.** Nenhuma tarefa real foi concluída e só uma CLI está instalada (ver AG-9, rebaixado).
- **Uso opcional futuro:** archify com versão fixada, só para o diagrama de arquitetura do orquestrador com evidência Git, gerado como artefato de CI. Exige ADR, porque o Node entraria como dependência nova.

---

## 3. Melhorias nos agentes

Em ordem de prioridade. O ADR-003 (AG-1) está unificado com ORG-1 na seção 4.

**3.1 · AG-3 (+ parte de ORG-5): o orquestrador executa os gates e grava recibos** (esforço M, valor alto)
- **Problema.** "Cole a saída real do terminal" (AGENTS.md:107) é declaração do agente. `docs/templates/handoff-template.md:50-55` não tem exit code nem SHA por comando.
- **Mudança.**
  - Comando `orq gates` (novo), que funciona também no modo manual. Ele lê um bloco `gates` (novo) em `docs/development-guide.md` §3, que só a pessoa preenche e que precisa bater com o `ci.yml`, porque `ci.yml:7-8` exige paridade.
  - Para cada comando, o recibo grava `cmd`, `shell`, `exit_code`, `status ∈ {passed, failed, timeout, not_run, error}`, `duration_ms`, `head_sha`, `dirty_tree`, `stdout_tail` com segredos mascarados pela regex de `scripts/check-structure.sh:163` e `log_sha256`. O log completo fica fora do Git.
  - O recibo fica **vencido** quando `git diff --quiet <head_sha> HEAD -- . ':(exclude)handoffs' ':(exclude)tasks'` acusa diferença. Assim, commits que só mexem no protocolo não vencem o recibo.
  - No Windows, o shell é resolvido explicitamente: o Git Bash a partir do git, nunca `bash` pelo PATH do PowerShell.
  - O `check-structure.sh` continua em bash sem dependências. O orquestrador só encapsula o exit code e o log. O `jq` não está instalado.
- **Contrato.** AGENTS.md:107, `docs/policies/anti-hallucination.md:29` (regra 14) e `handoffs/README.md:20` passam a aceitar "recibo <id>" como evidência. É mudança que só você aprova.
- **Limite atual.** Os comandos do §3 ainda são `<preencher>`, então o único gate real hoje é `bash scripts/check-structure.sh`.

**3.2 · AG-2: contrato de saída estruturada (fase 1: envelope + Revisor)** (esforço M, valor alto)
- **Problema.** O veredito é uma caixa de seleção (`docs/templates/code-review-template.md:19-21`). O protótipo aprova por substring: `"VERDICT: APPROVE" in review` (`reference/langgraph-prototype/src/ai_orchestrator/workflow.py:68`).
- **Mudança.**
  - Schemas `protocolo/schemas/envelope.schema.json` e `protocolo/schemas/revisor.schema.json` (novos; draft 2020-12, `additionalProperties:false`).
  - Envelope: `task`, `stage`, `role`, `status`, `verified_facts[]`, `assumptions[]`, `not_done[]`, `questions[{id Q-n, text, blocking}]`, `next_role`, `read_first[]`.
  - Revisor: `verdict ∈ {aprovado, mudancas_necessarias, rejeitado, inconclusivo}`, `reviewed_head_sha`, `findings[{code, disposition, subject{file,line}, evidence, supported_fix}]` e `reading_evidence[2]`.
  - Um eixo único de disposição: `defeito_bloqueante | evidencia_necessaria | importante_negociavel | sugestao`, que substitui 🔴🟡🟢.
  - Regras de consistência:
    - `aprovado` exige zero `defeito_bloqueante` e zero `evidencia_necessaria`;
    - `mudancas_necessarias` exige pelo menos um achado não-sugestão;
    - não existe campo para o agente declarar "testes passaram".
  - Modo CLI: `claude -p --output-format json --json-schema <schema>` (flags verificadas no `--help` 2.1.280). Ficam a confirmar na doc da CLI se a flag aceita caminho de arquivo e em qual campo do JSON vem a saída estruturada.
  - Modo manual: o agente termina com um bloco ```json, que é validado. Os diagnósticos geram no máximo 1 prompt de reparo. No nível A (chat web), só veredito e perguntas são obrigatórios em JSON.
  - O Markdown é gerado só entre marcadores `<!-- gerado:inicio/fim -->`. As respostas da pessoa nunca são sobrescritas, o que preserva `handoffs/README.md:21-22`, e o que vai para o histórico nunca é re-renderizado.
- **Catálogo de códigos:** `protocolo/review-codes.json` (novo), com poucos códigos iniciais.

**3.3 · AG-6 + VIS-4 (+ ORG-1 ponto 5): executor por assinatura com independência verificável** (esforço G; a primeira fatia é M; valor alto)
- **Problema.** O protótipo chama API: `init_chat_model` em `reference/langgraph-prototype/src/ai_orchestrator/models.py:11-12`, com 3 chaves em `reference/langgraph-prototype/.github/workflows/agent.yml`. A independência é declarada: `code-review-template.md:10` e a coluna "Sessão independente?" de `.github/pull_request_template.md:61`. Só o `claude` está instalado.
- **Mudança.**
  - Máquina de estados pequena, sem LangGraph como motor.
  - Interface `AgentRunner` derivada do Protocol de `models.py:7-15`, com três implementações: `FakeRunner`, para testes sem rede; `ManualRunner`, que gera um `prompt.md` e ingere um `output.json`; e `ClaudeCodeRunner`. O detalhe de invocação está na Fase 3 (seção 6).
- **Independência.**
  - É provada pelo **argv gravado**, não pelo `session_id`. O orquestrador gera UUIDs novos a cada execução, então comparar session_id quase nunca acusa nada. E `--resume <x> --fork-session` cria um ID novo carregando o contexto inteiro da implementação.
  - Níveis:
    1. outra ferramenta ou fornecedor: verificado se foi headless, declarado se foi web;
    2. Claude Code em sessão nova, sem `--resume`, `-c`, `--fork-session` ou `--from-pr`, rotulado "independência de sessão, não de modelo";
    3. inválido.
  - O Revisor roda num worktree limpo no SHA revisado. Se `git status --porcelain` não sair vazio ao fim, o parecer é invalidado, porque com Bash liberado negar Edit/Write não impede edição.
- **Commits.** "Agentes não commitam" contradiz AGENTS.md:129 e os prompts 01 a 05. Isso só entra depois da decisão 9 (fora do ADR-003).

**3.4 · AG-7: laço de correção limitado, testes congelados e aprovação presa ao SHA** (esforço M, valor alto)
- **Problema.** `docs/guides/workflow.md:168-169` diz "Não há limite de ciclos". "NÃO altere os testes" (`docs/prompts/03-implementador.md:22`) é só texto. O `@ <hash>` de `code-review-template.md:11` não invalida nada.
- **Mudança.**
  - (a) Ao fim da etapa Testes, gravar `tests_frozen` com o **id de blob do Git** (`git ls-tree`, não sha256 do working tree, por causa do CRLF) de *todos* os arquivos que casam com o glob de testes. A única saída é o `test_dispute`, que devolve a tarefa ao papel Testes, ou uma aprovação sua registrada.
  - (b) Laço interno: a métrica é o número de gates com exit≠0. Padrão `max_inner_rounds=2` e `stall_rounds=2`, com timeout de relógio, porque o 2.1.280 não tem `--max-turns`.
  - (c) Laço externo: no máximo N ciclos de `mudancas_necessarias` (decisão 8) e depois escala para você. A re-revisão lê o delta desde `reviewed_head_sha`.
  - (d) A aprovação é invalidada pelo mesmo critério de caminhos do 3.1. Os commits de handoff exigidos por `docs/prompts/04-revisor.md:43` não a invalidam.

**3.5 · AG-8: pré-voo determinístico do Revisor e verificação de referências** (esforço M, valor médio)
- **Problema.** `docs/prompts/04-revisor.md:23-36` pede ao LLM checagens mecânicas, o que gasta cota. A "evidência de leitura" (`code-review-template.md:123-129`) não é conferida.
- **Mudança.**
  - Antes do Revisor, gerar um JSON de fatos: diff × lista da §5 da tarefa, testes × `tests_frozen`, marcadores novos de skip, recibos não vencidos e o resultado de `bash scripts/check-structure.sh`. O script já cobre segredos (§5, l.163) e trailers de IA (§8, l.230-258) e deve ser **invocado**, não reimplementado.
  - Depois da revisão, validar:
    - `reading_evidence` precisa existir no diff e não aparecer no handoff; o resultado é rotulado "acesso ao diff comprovado", não "leitura completa";
    - todo `subject{file,line}` existe no SHA revisado;
    - os códigos pertencem ao catálogo;
    - o veredito é consistente com as disposições.

**3.6 · AG-4 + ORG-8b: leitura por papel e pacote de contexto** (esforço M, valor médio)
- **Problema.** A leitura obrigatória soma 1.207 linhas / 51.275 bytes no commit `86e2fdc` (52.482 bytes no working tree em CRLF) (AGENTS.md:13-30, incluindo `docs/decisions/ADR-000-template.md` e `docs/decisions/README.md`). `docs/prompts/00-kickoff.md:15` repete a lista, e `docs/guides/using-ai-tools.md:131-136` oferece, como última das quatro opções ("da melhor para a pior", l.120), concatenar tudo num único arquivo. O ganho maior aqui é foco e automação; em cota, o ganho é moderado.
- **Mudança.**
  - Uma tabela "papel → leituras obrigatórias e condicionais" no próprio AGENTS.md, legível no modo manual.
  - O orquestrador monta o pacote a partir dela e, no nível A, gera um único arquivo concatenado.
  - Use JSON, e não YAML, se um dia houver arquivo de máquina (`protocolo/papeis.json`, novo, validado contra a tabela). Nem Node nem Python trazem parser YAML na biblioteca padrão.
  - O kickoff vira um JSON de entendimento, validado automaticamente no modo CLI. No modo manual, sua confirmação continua como padrão (`docs/prompts/README.md`, regra 2).
  - Adaptadores de skill (`.claude/skills/`, `.agents/skills/`) ficam para depois. Os diretórios de descoberta estão a confirmar na doc de cada CLI.

**3.7 · AG-9: benchmark de papéis — rebaixado** (valor baixo agora)
Com zero tarefas concluídas e uma única CLI, a matriz não teria poder de comparação e gastaria cota. A fase 0 foi incorporada a VIS-7: métricas dos recibos de tarefas reais. Um caso de regressão do Revisor (RN inventada contra diff limpo) só entra quando o contrato dos agentes mudar.

---

## 4. Organização

**4.1 · ORG-1 + AG-1: ADR-003 "Orquestração local de agentes via CLIs de assinatura, sem API paga"** (esforço P, valor alto)
- **Problema.** O ADR-001 está Aceito e é imutável (AGENTS.md:91). As linhas 36 a 39 fixam acionamento manual, CI sem IA e o protótipo como referência. O ADR-002:25-26 repete "agentes de IA acionados manualmente". O `README.md:154-157` diz "Não é um orquestrador automático".
- **Mudança.**
  - Criar `docs/decisions/ADR-003-orquestracao-local-via-clis-de-assinatura.md` (criado na TASK-001 com status Proposto), que substitui o ADR-001 **por inteiro** e reescreve dentro de si o que continua valendo. O status "Substituído parcialmente" não existe em `docs/decisions/ADR-000-template.md:5`; use "Substituído por ADR-003", trocado por você depois do aceite.
  - **Permanece:**
    - o repositório é a fonte de verdade;
    - nenhuma API paga por token (qualquer uso futuro exige outro ADR; ver decisão 5);
    - as restrições citadas por ADR-002:25-26 (GitHub gratuito, sem custo obrigatório, protocolo independente de stack);
    - CI determinístico sem IA;
    - as travas humanas.
  - **Muda:**
    - acionamento por orquestrador **local** que chama CLIs autenticadas pelo plano como subprocesso;
    - o modo manual continua de primeira classe;
    - o LangGraph com APIs vai para "alternativas recusadas".
  - **Princípios, sem fixar flags:**
    - autenticação sempre pela sessão do plano; o subprocesso roda sem `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` e `GOOGLE_API_KEY`, e modos que exigem chave são recusados;
    - limite de uso é cota: pausar e retomar;
    - revisor independente registrado no recibo;
    - termos de uso de automação verificados por fornecedor;
    - a questão "agentes não commitam" ficou **fora** do rascunho do ADR-003 (seção "Fora desta decisão"); é a decisão 9 da seção 7.
  - **Sem IA no CI por política, não por impossibilidade:** `claude setup-token` existe no help ("requires Claude subscription"). O token seria um segredo de alto valor, PRs são entrada externa (prompt injection) e o consumo de cota ficaria sem controle.
  - **Arquivos derivados, depois do aceite:** `docs/decisions/README.md` (índice); `docs/architecture.md` §8 (obrigatório por `docs/decisions/README.md:31`); `README.md:154-158`; `docs/policies/security.md` §6 item 5; o comentário de `.github/workflows/ci.yml:276-281`; `docs/guides/using-ai-tools.md` §3; `reference/langgraph-prototype/STATUS.md`.

**4.2 · ORG-2: onde o orquestrador fica, a Camada 1 e a stack** (esforço M, valor alto; pré-requisito de tudo)
- **Problema.** Nenhum `.md` menciona "guindaste"; `README.md:1` se apresenta como "AI Dev Workflow Template". Não está decidido se "o projeto" é o orquestrador ou um sistema da JA Guindastes. Com `<preencher>` nos 4 docs, nenhum agente implementa nada, nem o orquestrador.
- **Mudança.**
  - Você escolhe: **(A)** este repositório é o orquestrador, e a Camada 1 o descreve; ou **(B)** o repositório é o sistema JA Guindastes, e o orquestrador fica em `tools/orquestrador/` (novo), com job de CI próprio. Um repositório separado só por escolha explícita, já que você disse "em cima desse repositório".
  - Preencher a Camada 1. Um agente pode rascunhar com `docs/prompts/06-preencher-contexto.md`; `docs/business-rules.md` é só seu (AGENTS.md:90).
  - Registrar a stack num `ADR-004` (novo). Disponível nesta máquina: Node v24.19.0, ou Python via uv 0.12.18 com CPython 3.14.7 gerenciado. Verifiquei que o `python` do PATH é o atalho da Microsoft Store e que há dois intérpretes 3.12 quebrados no uv.
  - Versão do protocolo: um inteiro `protocolo_versao: 1`.
  - TASK-002 piloto no protocolo **atual**, cronometrando cada transição manual (a TASK-001 foi usada para registrar esta análise). Candidatas: ORG-10 e ORG-8a.

**4.3 · ORG-10 (parte imediata) + ORG-8a: correções baratas** (esforço P, valor médio)
- **CI.** O comentário de `.github/workflows/ci.yml:35-36` promete que deploy em production não é cancelado, mas as linhas 37-39 têm `cancel-in-progress: true` no nível do workflow e o job `deploy` (l.198-205) não tem grupo próprio. Correção: `cancel-in-progress: ${{ github.event_name == 'pull_request' }}` no topo e `concurrency: {group: deploy-${{ github.ref_name }}, cancel-in-progress: false}` no deploy. `.github/workflows/*` é protegido (`docs/development-guide.md` §8): só você altera.
- **Template de issue.** Trocar o `https://github.com/<org>/<repo>/...` de `.github/ISSUE_TEMPLATE/config.yml:4` por `Umaiii-chan/JA-Guindastes`.
- **Divergências de texto:**
  - tamanho de PR: "15 minutos" em `docs/guides/workflow.md:85`, `docs/prompts/01-planejador.md:24` e `docs/policies/anti-hallucination.md:28`, contra "15–20" em `tasks/README.md:24` e `docs/guides/git-github.md:176`;
  - `tasks/backlog/TASK-000-exemplo.md:30` cita um "orquestrador de deploy" inexistente;
  - clarificar em `docs/decisions/README.md:29-30` que o conteúdo do ADR é imutável e só o Status muda;
  - trocar o item 10 do AGENTS.md §1 por "índice + ADRs citados na tarefa".
- **Adiados:** `scripts/ci-scope.sh` (novo; inspirado em `archify:scripts/ci-scope.mjs`) só com stack no job `quality`; CODEOWNERS provavelmente não teria efeito (hipótese, ver seção 8): o repo é PRIVATE (conferido), e a falta de branch protection no plano Free e o mantenedor único ainda precisam ser confirmados no GitHub.

**4.4 · ORG-7 + AG-5: validador de contratos (lote 1)** (esforço M, valor alto)
- **Problema.**
  - `scripts/check-structure.sh:75` só faz grep de 4 títulos, então o template vazio e o `handoffs/current.md:8` com "AAAA-MM-DD HH:MM" passam (rodei o script: exit 0, 4 avisos).
  - A l.132 conta linhas, não ocorrências.
  - A l.189 só verifica links no formato Markdown (texto entre colchetes seguido do alvo entre parênteses).
  - Não há teste do script nem checagem de só-acréscimo.
- **Mudança:**
  - saída `--format tsv` (código, severidade, arquivo, linha, mensagem), bash puro;
  - só-acréscimo: `git diff --name-status --diff-filter=MDR <base>...HEAD -- handoffs/history tasks/completed`; em push, a base é `github.event.before`;
  - placeholders no handoff viram erro quando há tarefa ativa;
  - caminhos entre crases validados só com prefixos conhecidos (`AGENTS.md`, `docs/`, `scripts/`, `tasks/`, `handoffs/`, `.github/`), excluindo `...`, `NNN`, `<`, `*` e caminhos ignorados pelo Git. Sem esse recorte, uma simulação deu 10 falsos positivos;
  - adaptadores (`CLAUDE.md`, `GEMINI.md`, `.github/copilot-instructions.md`) continuam como ponteiros curtos;
  - variável `CHECK_ROOT`;
  - `tests/contracts/run.sh` com fixtures em repositórios git temporários (novo);
  - `.gitattributes` com `*.sh text eol=lf`.
- **Cuidado.** A checagem "invariantes em cada prompt" falharia hoje: os prompts 01 e 02 não contêm "verifiquei" nem "suponho"; o 04 e o 06 não contêm nenhum dos três ("verifiquei", "suponho", "NÃO EXECUTADO"). Verifique no kickoff ou na fonte canônica, edite antes 01, 02, 04 e 06, ou restrinja a checagem aos prompts de papel 01 a 05.
- **Co-autoria de IA.** O `check-structure.sh` §8 (l.230-258) já barra os trailers no CI. `.githooks/commit-msg` (novo) é opcional e ativado por você (`git config core.hooksPath .githooks`). O `--bare` pula a atribuição, mas quebra o OAuth. A chave de settings que desliga a atribuição no Claude Code está a confirmar na doc.

**4.5 · ORG-4: handoff por tarefa, só de acréscimo** (esforço M, valor alto)
- **Problema.** Há um único `handoffs/current.md`, mas `tasks/README.md:11` permite 2 tarefas paralelas e `check-structure.sh:110-113` exige que o `current.md` cite cada uma. O arquivamento é descrito de três formas contraditórias: `handoffs/README.md:17-18`, `docs/templates/handoff-template.md:5-6` e `docs/prompts/05-handoff.md:23`. O "max+1" de `tasks/README.md:23` colide entre branches.
- **Mudança:**
  - `handoffs/TASK-NNN/NN-<etapa>.md` (novo): cada etapa cria um arquivo e o de maior NN é o atual;
  - `handoffs/current.md` vira ponteiro estático;
  - agentes deixam de criar arquivos `TASK-NNN`, e só você (ou a ferramenta, na `development`) aloca o ID;
  - `handoffs/history/` fica como legado congelado (hoje com `2026-09-26-sem-tarefa-preparacao.md`, arquivado na TASK-001) e não recebe arquivos novos, o que respeita AGENTS.md:92.
- **Contrato.** AGENTS.md §1, §7 e §8, prompts 00 e 05 e `docs/checklists/definition-of-done.md:49`: mudanças que só você aprova.

**4.6 · ORG-3 (+ VIS-10 na derivação): máquina de estados e frontmatter plano** (esforço M, valor alto; depois da TASK-002 piloto)
- **Problema.** O status fica em dois lugares: a pasta e o campo de `docs/templates/task-template.md:5`, e ninguém confere se batem. A etapa só aparece em prosa. As dependências são texto livre (`task-template.md:59`).
- **Mudança.**
  - `protocolo/estados.json` (novo) com estados e transições, cada transição com ator e nome da guarda. A guarda fica em código, sem DSL.
  - Estado **gravado**: só a fase (`backlog…concluida|cancelada`).
  - Sinais **derivados**, nunca gravados: bloqueado (via `bloqueada_por`), interrompido (via ledger) e aguardando aprovação. O CI confere a coerência entre estado, pasta e último handoff.
  - Frontmatter estritamente plano, uma chave por linha, com listas separadas por vírgula, para que grep/sed funcionem.
  - Bootstrap: até a ferramenta existir, você edita o frontmatter e o check valida.

**4.7 · ORG-5 + VIS-1 (+ camada local de VIS-3): onde o recibo fica** (esforço M, valor alto)
- **Versionado.** O frontmatter plano no topo do handoff (exemplo na seção 5) substitui a tabela de cabeçalho. O `base_sha` é o SHA onde os gates rodaram.
- **Local, fora do Git.** `.orq/runs/<run-id>/` (novo, no `.gitignore`) guarda o `receipt.json` completo, o argv, o prompt, a transcrição, stdout/stderr e um `index.jsonl` só de acréscimo. Pode conter segredos e é grande.
- **Regras:**
  - skipped e not_run nunca viram passed;
  - saída colada de interface web = "declarada";
  - falha operacional não muda o estado da tarefa;
  - SHAs das etapas deixam de ser alcançáveis depois do squash e da remoção da branch, então métricas usam datas.
- **Alternativa (decisão 7):** JSON versionado ao lado de cada handoff (`NN-<etapa>.json`).

**4.8 · ORG-6: fonte canônica entre branches e pendências com ID** (esforço M, valor médio)
- **Problema.** O `git mv` e o handoff são commitados na branch `task/*` (`docs/guides/git-github.md` §4), então a `development` fica atrasada. As pendências estão em 5 lugares: handoff §8, `docs/business-rules.md:63`, `docs/known-gaps.md` §4, parecer §6 e ADRs Propostos.
- **Mudança.**
  - Regra: o estado da tarefa é o da ref `task/TASK-NNN-*`, se existir; senão, o da `development`.
  - Pendências `Q-n` locais à tarefa (referenciadas como `TASK-003/Q-1`, sem colidir com os `P-NNN` globais de `docs/known-gaps.md`) em `handoffs/TASK-NNN/pendencias.md` (novo), só de acréscimo: a resposta vai na própria linha.
  - `orq responder` (novo) commita na branch da tarefa via `git worktree`.

**4.9 · ORG-9: registros datados, versão mínima** (esforço P, valor médio)
- `docs/research/AAAA-MM-DD-<slug>.md`: este arquivo é o primeiro registro.
- `docs/acceptance/claude-code.md` (novo), **por adaptador e não por versão**: versão mínima testada, flags usadas com a prova (saída do `--help`), smoke test autorizado por você e a mensagem observada ao bater no limite.
- `orq doctor` (novo) confere, sem gastar cota: CLI no PATH, `claude auth` (saída a confirmar), ausência de `*_API_KEY` e presença das flags no `--help`.
- Uma seção "não planejado" em `docs/decisions/README.md`, com linhas incluídas só depois de você decidir.

---

## 5. Visão do andamento

**5.1 · VIS-2 + ORG-6: comando `status` que lê todas as branches** (esforço M, valor alto)
- **Problema.** Não há visão consolidada. A transição manual custa "5 a 10 minutos" (`docs/guides/using-ai-tools.md:113`). Na base `86e2fdc` não havia nenhuma branch `task/*`; hoje existe só a local `task/TASK-001-registrar-analise-orquestrador`, sem cópia em `origin`.
- **Mudança.**
  - **v0 (bash, agora):** `scripts/status.sh` (novo) percorre `refs/heads/task` e `refs/remotes/origin/task` e, com `git ls-tree` e `git log -1`, mostra em que pasta de `tasks/` cada tarefa está em cada ref e a data do último fetch. Não faz fetch sozinho.
  - **v1 (depois de ORG-3/ORG-4/VIS-1):** `orq status` lê o frontmatter do último `NN-<etapa>.md` via `git show <ref>:<caminho>`. "Mudanças desde" vem de `git log --since` indexado por TASK-ID, sem guardar snapshot.
  - Saída no terminal ou em `--out`. O padrão é `.orq/STATUS.md` (fora do Git; não aparece no GitHub).
  - Ferramenta e testes ficam fora de `src/` e `tests/` do produto.

**5.2 · VIS-5: "Aguardando você" no topo** (esforço P, valor alto)
Somente leitura, nesta ordem: pendências bloqueantes sem resposta; ADRs Propostos; perguntas de `docs/business-rules.md` e `docs/known-gaps.md`; revisões aprovadas sem merge (com VIS-1); execuções paradas por `limite_provavel` ou `cli_not_found` (com VIS-3). Linhas com `<preencher>` são ignoradas. O texto lido é tratado como dado, nunca executado.

**5.3 · VIS-6: alertas de saúde** (esforço P, valor médio)
- Códigos estáveis com saída `--json`. Começar com quatro:
  - (a) evidência vencida ou aprovação invalidada, pelo critério de caminhos do 3.1;
  - (b) gate `not_run` ou `skipped` em implementação ou correções;
  - (f) estado diferente da pasta;
  - (h) revisão não independente, pelo argv.
- (c) placeholders e (f) entram no `check-structure.sh` como aviso, e viram erro com `STRICT=1`.
- Ordem que evita alarme: rebase, depois gates, depois handoff.
- Limites numa tabela de `docs/development-guide.md` ou em JSON, nunca em YAML.

**5.4 · VIS-3 (ledger local) e VIS-8 (progresso ao vivo)** (esforço M, valor alto e médio)
- **VIS-3.** O ledger é a camada local do 4.7. Status possíveis: `ok|failed|timeout|cancelled|cli_not_found|limite_provavel`. O `limite_provavel` sempre acompanha o trecho da mensagem que o motivou, porque o help não documenta nenhum sinal de cota.
- **VIS-8.** `claude -p --output-format stream-json` grava `events.jsonl` com heartbeat e timeout de inatividade. Se exige `--verbose` junto está a confirmar na doc. Quando a execução cai:
  - o orquestrador **não toca** em handoffs versionados;
  - grava `.orq/runs/<run>/handoff-rascunho.md` marcado "gerado automaticamente — NÃO revisado";
  - você decide entre `--resume <session-id>` (que só funciona sem `--no-session-persistence`) e promover o rascunho.
- Antes de construir o runner com streaming, avaliar `claude --bg`, `claude logs <id>` e `claude agents`, que existem no help (adequação a confirmar).

**5.5 · Baixo valor agora (adiar)**
- **VIS-7 + AG-9 fase 0: métricas.** Só depois de ~10 tarefas concluídas: lead time, rodadas, veredito da 1ª revisão e contagem e horário das interrupções, para planejar as janelas dos planos. Valores em dólar, se a CLI informar, aparecem rotulados "estimativa da ferramenta, não cobrança do plano".
- **VIS-9: resumo no `$GITHUB_STEP_SUMMARY`.** Usa `github.event.pull_request.head.sha` e só dados versionados; opcional.
- **VIS-10: ciclo em Mermaid `stateDiagram-v2`.** Gerado a partir da tabela de derivação, em `docs/guides/workflow.md`. Archify fora.

**Esboço dos artefatos** (todos novos; valores ilustrativos)

Frontmatter plano do handoff (`handoffs/TASK-002/03-implementacao.md`):
```yaml
---
schema: 1
tarefa: TASK-002
etapa: implementacao
papel: implementador
ferramenta: claude-code
ferramenta_versao: 2.1.280
modelo:
modo: headless
sessao: 7c1e0b52-4a0e-4f7e-9b1a-2d3c4e5f6a7b
inicio: 2026-09-28T14:02:00-03:00
fim: 2026-09-28T14:31:00-03:00
base_sha: 1a2b3c4
gate_testes: passed
gate_lint: not_run
gate_build: skipped
gate_estrutura: passed
revisao_veredito: na
revisao_rodada: 0
bloqueantes: 1
proximo_papel: pessoa
proxima_etapa: revisao
registrado_por: orquestrador
---
```

Frontmatter da tarefa (`tasks/.../TASK-002-*.md`):
```yaml
---
id: TASK-002
estado: implementacao
depende_de:
bloqueada_por: TASK-002/Q-1
rodadas_revisao: 0
protocolo_versao: 1
---
```

Saída de `orq status` (v1):
```text
Refs: origin/task/* (último fetch 2026-09-28 13:55)

AGUARDANDO VOCÊ
 1  Pendência bloqueante  TASK-002/Q-1  handoffs/TASK-002/pendencias.md  responder
 2  ADR Proposto          ADR-003       docs/decisions/ADR-003-...       aceitar/rejeitar

QUADRO
 Tarefa    Estado         Próximo  Última execução                  Na etapa  Rodadas  Bloqueios  Branch@sha
 TASK-002  implementacao  Pessoa   claude-code 2.1.280 · há 12 min  1 d       0        Q-1        task/TASK-002-ci-concorrencia@1a2b3c4

ALERTAS
 gate/not-run  TASK-002  gate_lint=not_run na etapa implementacao
```

---

## 6. Roteiro em fases

**Fase 0: decisões (antes de qualquer código)**
- Aceitar ou rejeitar o ADR-003 (ORG-1/AG-1).
- Decidir A ou B e se o repositório continua como template; preencher a Camada 1; ADR-004 com a stack (ORG-2).
- Revisor padrão enquanto só o Claude Code existe (AG-6/VIS-4).
- Onde ficam os recibos (ORG-5/VIS-1).
- "Agentes commitam?"; limites de rodadas (AG-7).
- Verificar os termos de uso dos planos para automação.

**Fase 1: quick wins (até ~1 semana).** Atenção: pelo AGENTS.md:32-34, um agente só implementa depois da Camada 1 preenchida. Antes disso, estes itens são feitos por você, ou você aprova uma exceção explícita para tarefas que só mexem no protocolo.
- ORG-10: concorrência do CI e URL do `config.yml`. É a TASK-002 piloto, cronometrada (ORG-2).
- ORG-8a: unificar o tamanho de PR, corrigir `TASK-000-exemplo.md:30`, clarificar o README de decisões e o item 10 do AGENTS.md §1.
- ORG-7/AG-5, lote 1: TSV, só-acréscimo, placeholders, crases com prefixo, adaptadores, `CHECK_ROOT`, fixtures, `.gitattributes`; hook opcional.
- VIS-2/ORG-6 v0: `scripts/status.sh`, pastas por ref.
- ORG-9 mínimo: registro desta análise em `docs/research/` (feito na TASK-001) e aceite do Claude Code com base no `--help`.

**Fase 2: estrutura (protocolo legível por máquina, ainda sem automação)**
- ORG-4: handoff por tarefa e `current.md` como ponteiro.
- ORG-3: estados e frontmatter plano; VIS-10: tabela de derivação.
- VIS-1/ORG-5: recibo no frontmatter e `.orq/` local.
- AG-3: `orq gates`, que também funciona no modo manual.
- AG-2 fase 1: envelope, schema do Revisor, marcadores de geração e `orq ingest`.
- ORG-6: pendências `Q-n`; VIS-5: "Aguardando você"; VIS-2 v1; VIS-6: alertas (a), (b), (f) e (h).
- AG-4/ORG-8b: leitura por papel.
- ORG-7, lote 2: validar frontmatter, recibos e pendências.

**Fase 3: orquestrador automatizado (CLIs de assinatura, sem API)**
- **Fatia 1 (M):** AG-6 com `FakeRunner`, `ManualRunner` e `ClaudeCodeRunner` só para Planejador (leitura) e Revisor; comandos `orq doctor | next | run <papel> | ingest | gates`. Mais VIS-3 (ledger), AG-8 (pré-voo e verificação de referências), AG-7 (laços e congelamento) e VIS-4 (independência pelo argv).
- **Fatia 2:** Implementador automatizado em worktree e VIS-8 (streaming e rascunho).
- **Depois:** VIS-7/AG-9 (métricas), VIS-9, e runners Codex/Gemini quando instalados.

**Como o orquestrador aciona o Claude Code (instalado, 2.1.280).** Todas as flags usadas abaixo aparecem no `claude --help` que rodei; a única citada que não aparece é `--max-turns`, mencionada justamente por não existir.
- Subprocesso por **array de argumentos, sem shell**: `claude -p --output-format json --json-schema <schema> --session-id <uuid novo> --permission-prompts none`, mais `--tools` / `--allowedTools` / `--disallowedTools` e `--permission-mode <plan|acceptEdits|…>` conforme o papel. Por exemplo, Planejador e Revisor sem edição. A sintaxe de restrição por caminho está a confirmar na doc da CLI.
- O prompt vai como argumento ou por stdin. Se `--input-format` serve a esse caso está a confirmar na doc da CLI. O schema vai inline, e o limite de tamanho da linha de comando no Windows é hipótese.
- **Autenticação pelo plano:** o ambiente do subprocesso é montado sem `*_API_KEY`. Nunca usar `--bare`: segundo o help, ele usa "strictly ANTHROPIC_API_KEY or apiKeyHelper via --settings (OAuth and keychain are never read)" e ainda pula o CLAUDE.md, a auto-memory e a atribuição. `--max-budget-usd` é para "API calls" e não controla cota. A precedência entre chave e OAuth quando a variável existe é hipótese.
- **Limites:** não existe `--max-turns` no 2.1.280. O teto é um timeout de relógio que mata a árvore de processos (no Windows, algo como `taskkill /T`, conforme a linguagem). Concorrência 1 por ferramenta.
- **Isolamento:**
  - `cwd` num worktree criado pelo orquestrador (`git worktree add`), em vez de `-w/--worktree`, cujo local e branch estão a confirmar;
  - o Revisor roda num worktree limpo no SHA revisado e precisa terminar com `git status --porcelain` vazio;
  - com `-p` o diálogo de confiança é pulado e settings inválidos são ignorados em silêncio, então as restrições de segurança vão por flags e o `doctor` confere.
- **Independência:** o argv gravado não pode ter `--resume`, `-c`, `--fork-session` ou `--from-pr`. `--session-id` sempre novo. O pacote de contexto não leva a transcrição do implementador.
- **Cota:** um erro que pareça limite de uso vira `limite_provavel` com a mensagem bruta e estado `aguardando_cota`, sem contar como falha do agente. Os campos de uso e de sessão no JSON de saída estão a confirmar na doc (não rodei `claude -p`).
- **Commits:** se a decisão 9 (tomada fora do ADR-003) adotar "agentes não commitam", o orquestrador commita com a sua identidade, sem trailers. O `check-structure.sh` §8 segue como barreira de CI.

**Codex e Gemini (não instalados).** Entram só depois de instalados e com registro de aceite próprio (ORG-9). Comandos e flags de modo não interativo estão a confirmar na doc de cada CLI. Até lá, a revisão de "outra ferramenta" é feita pelo `ManualRunner`: o orquestrador gera `prompt.md` com diff, recibos, tarefa e schema, você cola no ChatGPT ou Gemini web e depois cola de volta o `output.json`, que é validado com no máximo 1 prompt de reparo. A independência fica registrada como "declarada".

---

## 7. Decisões que só você pode tomar

1. **Substituir o ADR-001** pelo ADR-003 (rascunho `Proposto` em `docs/decisions/ADR-003-orquestracao-local-via-clis-de-assinatura.md`), total, com status "Substituído por ADR-003". A alternativa é criar o status "parcialmente" no template e no README de decisões.
2. **Onde o orquestrador fica:** (A) este repositório, (B) `tools/orquestrador/` ou repositório separado. E se o repositório continua servindo de template.
3. **Preencher a Camada 1** (`docs/business-rules.md` é só seu) ou aprovar uma exceção no AGENTS.md para tarefas que só mexem no protocolo.
4. **Runtime do orquestrador (ADR-004):** Node 24 (instalado) ou Python via uv (CPython 3.14.7 gerenciado).
5. **API paga:** o rascunho do ADR-003 mantém a proibição do ADR-001. Se um dia entrar (por exemplo, opt-in por execução), exige ADR próprio.
6. **Revisor padrão** enquanto só o Claude Code está instalado: instalar Codex ou Gemini CLI, revisar manualmente pela interface web de outro fornecedor, ou aceitar sessão nova do Claude Code como mínimo, sinalizada.
7. **Onde ficam os recibos:** frontmatter versionado com JSON local (recomendado) ou JSON versionado ao lado de cada handoff.
8. **Limites:** ciclos de revisão (2, por analogia com o teto de 2 rodadas de correção do archify em `archify:archify/references/delivery-contract.md:117`, que vale para a autocorreção após a revisão visual; ou 3, o ponto em que `docs/guides/workflow.md:168-169` recomenda parar e rever a tarefa, embora diga "Não há limite de ciclos"), rodadas internas e dias por etapa.
9. **Agentes commitam ou não.** Mudar afeta AGENTS.md:129 e os prompts 01 a 05.
10. **Recibo no lugar de "cole a saída":** mudar AGENTS.md:107, `docs/policies/anti-hallucination.md:29` e `handoffs/README.md:20`.
11. **Confirmação humana do kickoff** no modo manual: manter por padrão?
12. **Termos de uso** de automação headless de cada assinatura: confirmar antes de ligar cada adaptador. Autorizar também o smoke test, que consome cota.
13. **Archify ou Mermaid:** Mermaid agora. Archify só com ADR (Node), versão fixada e como artefato não versionado.
14. **Configuração local:** `core.hooksPath` para o hook de commit e `.gitattributes` com `eol=lf`.
15. **Layout de tarefas:** achatar `tasks/` na Fase 2? Manter o limite de 2 tarefas paralelas, agora só por capacidade e cota?

---

## 8. Riscos e o que não foi verificado

**Limites de uso dos planos (risco principal).**
- Cada rodada extra de agente, cada re-revisão, cada reparo de JSON e cada smoke test consome a janela de uso. Suponho, sem ter verificado, que o uso headless e o interativo disputam a mesma cota.
- Mitigações: pré-voo determinístico (AG-8) tira trabalho mecânico do LLM; limites de laço (AG-7); concorrência 1; gates rodam localmente e não gastam cota; benchmark rebaixado (AG-9).
- Não há sinal documentado de "limite atingido" no help. A detecção é heurística (`limite_provavel`), e uma execução travada sem timeout de relógio gastaria cota à toa.

**Outros riscos.**
- **Termos de uso:** a automação de assinaturas não foi verificada para nenhum fornecedor.
- **Mudanças de contrato:** muitas propostas mexem no AGENTS.md, nos prompts e nos templates. Há risco de rotatividade de regras, o que pede uma sequência disciplinada e o validador ORG-7.
- **Independência de sessão:** o mesmo modelo em sessão nova tem viés correlacionado. A auto-memory do Claude Code pode vazar contexto entre sessões (hipótese, a confirmar na doc).
- **Windows:**
  - no PowerShell, `bash` resolve para `WindowsApps\bash.exe`; segundo a revisão, o WSL não está instalado (`wsl --status` falhou com REGDB_E_CLASSNOTREG);
  - o Git Bash (`C:\Program Files\Git\bin\bash.exe`) não está no PATH do PowerShell;
  - `core.autocrlf=true` com `.gitattributes` só `* text=auto` afeta hashes e hooks;
  - não há `jq`.
- **Protocolo nunca exercitado:** todos os desenhos são sem dados reais. A TASK-002 piloto serve de linha de base.
- **Atribuição de commit:** o Claude Code injeta "Co-Authored-By: Claude", o que conflita com AGENTS.md:144-147.
- **Flags mudam entre versões:** a versão da CLI vai no recibo e o `doctor` confere as flags antes de despachar.

**Não verificado ou não executado.**
- `claude -p` não foi executado. Continuam desconhecidos o formato do JSON de saída, os campos de uso e sessão, o campo da saída estruturada e se `--json-schema` aceita arquivo.
- `claude auth` e `claude doctor` não foram executados; só confirmei que existem no help.
- A adequação de `claude --bg` e `claude logs` para progresso não foi verificada.
- Codex e Gemini: `command -v` não encontra nenhum dos dois. Flags não verificadas.
- Os testes do protótipo estão NÃO EXECUTADOS: `uv run --offline --frozen` falhou porque o cache não tem mypy 1.20.2 nem anthropic 1.4.0.
- Limites do GitHub Free para repositório privado (2.000 min/mês segundo `docs/guides/git-github.md` §8.2), disponibilidade de branch protection e CODEOWNERS: hipótese, a confirmar no GitHub.
- Se o Mermaid renderiza no job summary: não verificado.
- Uso do `claude setup-token` no CI: não verificado. A política proposta proíbe de qualquer forma.
- Tabela de diretórios de skills por CLI (`archify:README_EN.md:372-373`): é afirmação do archify, não verificada nas CLIs.

**Comandos executados pelo agente de síntese (somente leitura):** `claude --version` (2.1.280), `claude --help`, `git status --short` (vazio), `git log`, `wc -l AGENTS.md` (218), `sed` em `ci.yml`, nos ADR-000, 001 e 002, no AGENTS.md e no `workflow.md`, `node --version`, `uv python list --only-installed`, `command -v jq codex gemini` (nenhum encontrado), `git config core.autocrlf`, `ls` nas pastas citadas e `grep` em `archify:archify/SKILL.md` e no JSON de resultados do benchmark.