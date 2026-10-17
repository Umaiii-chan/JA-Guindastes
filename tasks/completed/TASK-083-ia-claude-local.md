# TASK-083 — IA com o Claude Code CLI local (só uso pessoal)

Contexto: a pessoa usuária quer rodar o projeto localmente usando o plano do Claude dela (CLI logado) como provedor de IA, sem chave de API. Nunca em deploy. Depende do PR #35 (TASK-081; mexe em `ai_composition.py` e `openai_provider.py`).

## Critérios de aceite

- [x] **CA-1** — `ClaudeCliProvider` (`backend/app/infrastructure/ai/claude_cli_provider.py`) implementa `LlmProvider` chamando `claude -p --output-format json` com o prompt pelo stdin, em diretório temporário vazio, sem ferramentas, sessão, settings de projeto, skills nem MCP; lê `result`.
- [x] **CA-2** — `CLAUDE_CLI_MODEL` (padrão `sonnet`) e `CLAUDE_CLI_PATH` (padrão `claude`); JSON via esquema no prompt, sem cercas ```json; timeout de 55 s; erros claros (não encontrado, não logado, timeout) como `LlmError`, sem registrar o prompt.
- [x] **CA-3** — `AI_PROVIDER=claude_cli` explícito, fora do `auto`, e só montado com `CLAUDE_CLI_ENABLED=true`; `GET /ai/status` mostra `claude-cli/<modelo>`.
- [x] **CA-4** — `scripts/run-local-claude.ps1` sobe Postgres, migrations, seed, admin, backend (127.0.0.1:8000) e Vite (proxy `/api` para 127.0.0.1:8000), sem imprimir o `.env`.
- [x] **CA-5** — `docs/ia-claude-local.md` com o aviso de uso pessoal local e de nunca ativar em deploy.
- [x] **CA-6** — Uma chamada real ao CLI (`scenario_from_text`) funcionou; tempo no handoff.

Testes essenciais: `backend/tests/infrastructure/test_claude_cli_provider.py` (comando, JSON do CLI com cerca, timeout/não encontrado/não logado, trava de composição).

## Testes a escrever depois

- Saída do CLI com `is_error` e códigos de saída diversos; resposta vazia; JSON sem objeto.
- `build_prompt` sem esquema e `CLAUDE_CLI_PATH` inválido.
- Teste do script `run-local-claude.ps1` (hoje só verificado à mão).
- `.claude/launch.json` para o painel de preview (não feito).
