# Handoff — TASK-083 — implementação

| Campo | Valor |
|-------|-------|
| **Data** | 2026-10-14 |
| **Tarefa** | `tasks/in-progress/TASK-083-ia-claude-local.md` |
| **Etapa concluída** | implementação |
| **Papel exercido** | Implementador |
| **Ferramenta/agente** | Claude Code (subagente da leva F) |
| **Branch** | `task/TASK-083-ia-claude-local`, a partir de `task/TASK-081-ia-obstaculos-seguros` (PR #35) |

## O que foi feito

- `claude_cli_provider.py` (novo) e ramo `claude_cli` em `ai_composition.py`; variáveis em `.env.example`.
- `scripts/run-local-claude.ps1`: modo "backend no host". `frontend/vite.config.ts`: proxy `/api` para `127.0.0.1:8000` (antes `localhost`, que no Windows pode resolver para `::1`).
- `docs/ia-claude-local.md`.

## Verificado

- Flags reais conferidas em `claude --help` (2.1.300): `--tools ""`, `--no-session-persistence`, `--setting-sources ""`, `--strict-mcp-config`, `--disable-slash-commands`, `--system-prompt`.
- **Chamada real**: `scenario_from_text("Terreno plano com um barracão de 10 por 20 metros e uma árvore alta ao lado.")` com `AI_PROVIDER=claude_cli`, modelo `sonnet`: **26,9 s**, rascunho válido (2 obstáculos de modelo).
- **Script**: rodado de ponta a ponta (containers backend/frontend parados, Postgres, migrations, seed, admin, uvicorn em 127.0.0.1:8000 e Vite); `http://127.0.0.1:5173/api/v1/health` respondeu 200 pelo proxy. Depois, os processos foram encerrados.
- Gates (em `backend/`): `pytest` dos testes de IA (composição, Gemini, OpenAI, CLI) passou; `ruff check` e `ruff format --check` limpos; `mypy app` sem erros; `lint-imports` 3 contratos mantidos. (`mypy app tests` acusa erros antigos em testes alheios a esta tarefa.)

## Decisões e pendências

- A flag `CLAUDE_CLI_ENABLED` não está no `docker-compose.yml`, no `render.yaml` nem na Railway de propósito: o modo só existe no script local.
- Os containers `backend` e `frontend` do compose ficaram parados depois do teste do script; `docker compose up -d` os religa.
- Pendente: `.claude/launch.json` (pulado por prazo) e "Testes a escrever depois" da tarefa.
