# ADR-001 — Workflow de múltiplas IAs baseado em arquivos versionados, sem API

| Campo | Valor |
|-------|-------|
| **Status** | Aceito |
| **Data** | 2026-09-05 |
| **Autor** | Anderson Sehnem |
| **Decisores** | Anderson Sehnem |
| **Tarefa relacionada** | — (decisão fundadora do template) |
| **Substitui** | — |

## Contexto

Queremos desenvolver projetos grandes usando várias ferramentas de IA (ChatGPT/Codex, Claude,
Gemini e outras que surgirem), de forma que uma possa continuar o trabalho da outra sem depender
da memória interna de cada plataforma. Os problemas a resolver são perda de contexto, alucinação,
falta de rastreabilidade do que cada agente fez e ausência de uma fonte de verdade.

Restrições no momento da decisão:

- não há assinatura paga do GitHub (plano gratuito);
- não há chaves de API dos provedores, e não se deseja consumo pago de API;
- as assinaturas das interfaces (ChatGPT, Claude, Gemini) **não** equivalem a créditos de API;
- o workflow precisa servir para projetos diferentes, com stacks diferentes.

Uma primeira versão (ver `reference/langgraph-prototype/`) foi construída com Python + LangGraph e
SDKs dos três provedores. Funciona tecnicamente, mas exige chaves pagas para executar o fluxo.

## Decisão

A primeira versão do workflow será **gratuita e baseada em arquivos versionados no Git**:

- o repositório é a única fonte de verdade;
- as IAs não compartilham memória; compartilham contexto por documentos (`AGENTS.md`, `docs/`,
  `tasks/`, `handoffs/`);
- cada agente é acionado **manualmente** pela pessoa, na interface que ela já tem acesso;
- a continuidade entre agentes é feita por `handoffs/current.md`;
- o GitHub Actions executa apenas verificações determinísticas (lint, testes, build), sem chamar IA;
- o protótipo LangGraph é mantido apenas como referência para uma futura segunda versão.

## Alternativas consideradas

| Alternativa | Vantagens | Desvantagens | Por que não |
|-------------|-----------|--------------|-------------|
| **Arquivos versionados + acionamento manual (escolhida)** | custo zero; funciona com qualquer IA; auditável pelo Git; sem lock-in | mais passos manuais; depende de disciplina no handoff | — |
| Orquestrador LangGraph com APIs (protótipo) | automático; papéis bem definidos; já validado | exige chaves pagas; custo por execução; complexidade de manutenção | restrição de orçamento e de chaves |
| CrewAI / AutoGen / frameworks similares | ecossistema pronto | mesma dependência de API; mais uma camada a aprender | idem |
| Serviço de memória compartilhada (Mem0, Zep etc.) | contexto persistente entre IAs | serviço pago ou auto-hospedado; mais uma fonte de verdade | conflita com "repositório é a fonte de verdade" |
| Obsidian como fonte de verdade | ótimo para anotações e links | não versionado por padrão; não é lido pelo CI; mistura pessoal com projeto | fica como ferramenta pessoal opcional (ver `guides/obsidian.md`) |
| Não fazer nada (usar cada IA isoladamente) | zero esforço inicial | perda de contexto e alucinação continuam | é o problema que queremos resolver |

## Consequências

**Positivas:**
- nenhum custo obrigatório; funciona no GitHub gratuito;
- qualquer ferramenta que leia Markdown participa do fluxo;
- todo o histórico (tarefas, handoffs, decisões) fica no Git, revisável e pesquisável;
- o mesmo protocolo serve para qualquer stack;
- fácil de evoluir para automação depois, porque os artefatos já estão padronizados.

**Negativas / custos:**
- a pessoa precisa copiar/colar prompts e abrir cada IA manualmente;
- a qualidade depende de os agentes seguirem `AGENTS.md` (mitigado com prompts prontos e checklists);
- sem CI com IA, a revisão independente depende de a pessoa acionar outra IA.

**Riscos e como mitigar:**
- *Handoff desatualizado* → `scripts/check-structure.sh` no CI falha se `handoffs/current.md`
  estiver vazio ou sem os campos mínimos; Definition of Done exige handoff.
- *Agente ignora AGENTS.md* → arquivos `CLAUDE.md`, `GEMINI.md` e `copilot-instructions.md`
  apontam para ele; prompts de kickoff exigem leitura explícita.
- *Documentação diverge do código* → regra em `docs/README.md`: código vence, doc é corrigida na
  mesma tarefa; item no checklist de revisão.

## Impacto na documentação

- [x] `docs/architecture.md` — referenciado em § 8
- [x] `docs/development-guide.md` — não aplicável (template)
- [x] `docs/known-gaps.md` — não aplicável (template)
- [x] índice em `docs/decisions/README.md` atualizado

## Evidências

- Protótipo com APIs validado (lint, MyPy, Pytest) em `reference/langgraph-prototype/` — verificado.
- Limites do GitHub Free (Actions, branch protection em repositórios públicos) — ver
  `docs/guides/git-github.md`; **hipótese** a confirmar na documentação oficial no momento do uso,
  pois os limites mudam.
