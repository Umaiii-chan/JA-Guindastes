# AI Dev Orchestrator

Template genérico para coordenar modelos diferentes em um fluxo de desenvolvimento auditável:

1. arquiteto analisa tarefa e repositório;
2. engenheiro de testes mapeia critérios para testes;
3. desenvolvedor propõe um patch;
4. revisor independente aprova ou rejeita;
5. GitHub Actions preserva o handoff como artefato.

O fluxo **não aplica o patch automaticamente**. Essa barreira é intencional: primeiro valide a qualidade no seu projeto e só depois adicione abertura automática de PR.

## Requisitos

- Python 3.12+
- `uv`
- uma ou mais chaves dos provedores configurados

## Início local

```bash
cp .env.example .env
uv sync --extra dev
uv run pytest
set -a && source .env && set +a
uv run ai-flow run --task-file tasks/example.md --repo .
```

Os resultados ficam em `.ai/runs/<run-id>/`:

- `01-architecture.md`
- `02-tests.md`
- `03-implementation.patch`
- `04-review.md`
- `manifest.json`

## GitHub Actions

1. Crie um repositório e envie estes arquivos.
2. Em **Settings → Secrets and variables → Actions**, adicione `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` e `GOOGLE_API_KEY` conforme os modelos usados em `config.yaml`.
3. Abra **Actions → AI development workflow → Run workflow**.
4. Informe um arquivo Markdown dentro de `tasks/`.
5. Baixe o artefato produzido e revise o patch.

O workflow recebe apenas `contents: read`, tem timeout e não roda automaticamente em PRs. Nunca salve chaves em `.env` no Git.

## Adaptar para um projeto real

- Copie `.github/`, `src/ai_orchestrator/`, `tasks/`, `config.yaml` e as dependências para o repositório alvo.
- Ajuste `TEXT_SUFFIXES` ao stack.
- Troque os identificadores de modelo em `config.yaml`, sem alterar o workflow.
- Coloque comandos reais de lint, teste e build em `ci.yml`.
- Acrescente arquivos de contexto estável como `AGENTS.md`, `docs/architecture.md` e ADRs.

## O que reduz alucinações

- snapshot real e limitado do repositório;
- tarefa escrita com critérios de aceite;
- papéis com entradas e saídas explícitas;
- modelo revisor separado;
- proibição de afirmar que testes foram executados;
- patch e parecer preservados para auditoria;
- CI determinístico separado das chamadas de IA.

## Próximas evoluções seguras

1. schema estruturado para todas as respostas;
2. checkpointer SQLite/Postgres para retomada no meio da execução;
3. execução do patch em container descartável;
4. testes reais antes da aprovação;
5. abertura automática de PR com ambiente protegido e aprovação humana.

