# Obsidian (opcional)

O Obsidian é útil para organizar conhecimento, planejar e anotar. Ele **não é a fonte de verdade
do desenvolvimento** — o repositório é. Este guia explica como usar os dois sem confundir os papéis.

---

## 1. Divisão de responsabilidades

| Informação | Fonte principal | Obsidian |
|------------|-----------------|----------|
| Código | repositório Git | não |
| Tarefas | `tasks/` (ou GitHub Issues como espelho) | rascunho antes de virar tarefa |
| Arquitetura | `docs/architecture.md` + ADRs | exploração, diagramas de rascunho |
| Regras de negócio | `docs/business-rules.md` | entrevistas, anotações de reunião |
| Decisões | `docs/decisions/` | discussão antes do ADR |
| Continuidade entre IAs | `handoffs/` | não |
| Resultado de testes | terminal e GitHub Actions | não |
| Anotações pessoais | — | **sim** |
| Explorações, ideias, leituras | — | **sim** |
| Segredos | variáveis locais / GitHub Secrets | **nunca** |

Regra: se uma informação do Obsidian passa a ser necessária para um agente fazer o trabalho, ela é
**promovida** para `docs/` (versionada). O Obsidian guarda o rascunho e o contexto pessoal.

---

## 2. Duas formas de organizar

### Opção A — Vault separado do repositório (recomendada)

```text
~/Obsidian/meu-vault/
├── projetos/
│   └── meu-projeto/          ← anotações sobre o projeto
│       ├── ideias.md
│       ├── reunioes/
│       └── rascunhos-adr/
└── ...

~/dev/meu-projeto/             ← o repositório, separado
├── AGENTS.md
├── docs/
└── ...
```

Vantagens: nada pessoal vaza para o Git; o vault pode ter vários projetos; plugins do Obsidian não
poluem o repositório.

Para "ver" a documentação do projeto dentro do Obsidian sem duplicar, adicione a pasta `docs/` do
repositório como **um segundo vault** ou use um link simbólico dentro do vault principal
(`ln -s ~/dev/meu-projeto/docs ~/Obsidian/meu-vault/projetos/meu-projeto/docs-repo`). Edições
feitas ali são edições no repositório — commite normalmente.

### Opção B — Vault dentro do repositório

Abra a pasta `docs/` (ou a raiz) do repositório como vault. Funciona porque tudo é Markdown.

Cuidados obrigatórios:

- `.obsidian/` está no `.gitignore` do template (configurações pessoais não vão para o Git);
- crie `notes-local/` para anotações pessoais — também está no `.gitignore`;
- **não** use sintaxe exclusiva do Obsidian (`[[wikilinks]]`, `![[embeds]]`, callouts `> [!note]`)
  nos arquivos versionados: GitHub e as IAs não renderizam. Use links Markdown padrão — colchetes
  com o texto seguidos de parênteses com o caminho relativo. O Obsidian tem a opção
  *Use [[Wikilinks]]* — desligue.
- Mermaid funciona nos dois (GitHub e Obsidian).

---

## 3. O que as IAs recebem do Obsidian

**Nada, automaticamente.** Para cada tarefa, a pessoa decide o que é relevante e:

- promove para `docs/` o que virou fato (regra de negócio, decisão, requisito);
- cola no prompt, como contexto adicional, o que é útil mas ainda não é oficial — marcando
  claramente: "isto é anotação pessoal, não é fonte de verdade; se contradizer `docs/`, `docs/` vence".

Nunca despeje o vault inteiro em uma IA. Além de estourar o contexto, mistura hipótese com fato — o
oposto do que o fluxo quer.

---

## 4. Fluxo típico com Obsidian

```text
Reunião / leitura / ideia
        │
        ▼
Anotação no Obsidian (livre, rápida, pessoal)
        │
        ▼
Revisão semanal: o que aqui virou fato ou decisão?
        │
        ├── regra de negócio ──► docs/business-rules.md (RN-NNN)
        ├── decisão técnica ───► docs/decisions/ADR-NNN
        ├── requisito ─────────► docs/requirements/
        ├── limitação ─────────► docs/known-gaps.md
        ├── trabalho a fazer ──► tasks/backlog/TASK-NNN
        └── ainda é ideia ─────► fica no Obsidian
```

---

## 5. Plugins úteis (opcionais)

- **Obsidian Git** — commita o vault (se for a opção B) ou sincroniza o vault pessoal em repositório
  privado separado. Não substitui o fluxo de PR do projeto.
- **Dataview** — tabelas dinâmicas sobre suas anotações (ex.: "rascunhos de ADR não promovidos").
  Só em arquivos pessoais; não funciona no GitHub.
- **Templater** — preencher modelos de anotação. Os templates do projeto continuam em `docs/templates/`.

Nenhum plugin é necessário para o fluxo funcionar.
