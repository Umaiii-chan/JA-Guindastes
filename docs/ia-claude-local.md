# IA com o Claude Code local (só uso pessoal)

> **Aviso.** Este modo usa o plano de assinatura do Claude de quem está logado no `claude` desta
> máquina. É **só para uso pessoal, local**. **Nunca** ative em deploy (Railway, Render, Vercel ou
> qualquer servidor público): o plano não pode servir outras pessoas. Em deploy, use chave de API
> (`OPENAI_API_KEY`, `GROQ_API_KEY` ou `GEMINI_API_KEY`).

## Como funciona

`AI_PROVIDER=claude_cli` troca o provedor por `ClaudeCliProvider`
(`backend/app/infrastructure/ai/claude_cli_provider.py`), que chama
`claude -p --output-format json --model <modelo>` com o prompt pelo stdin, num diretório temporário
vazio, sem ferramentas, sem sessão gravada, sem configurações de projeto, sem skills e sem MCP. Lê o
campo `result`; para JSON, o esquema vai no prompt e a resposta é extraída (sem cercas ```json) e
validada pelo mesmo caso de uso. A IA continua só redigindo: capacidade e segurança vêm do cálculo.

Trava dupla: o provedor só é montado com `AI_PROVIDER=claude_cli` **e** `CLAUDE_CLI_ENABLED=true`. Ele
nunca entra no modo `auto`. Sem a flag, o assistente fica desligado.

| Variável | Padrão | Uso |
|----------|--------|-----|
| `AI_PROVIDER` | `auto` | `claude_cli` escolhe este modo |
| `CLAUDE_CLI_ENABLED` | vazio | precisa ser `true` |
| `CLAUDE_CLI_MODEL` | `sonnet` | alias ou nome do modelo (`--model`) |
| `CLAUDE_CLI_PATH` | `claude` | caminho do executável |

`GET /api/v1/ai/status` mostra o modelo como `claude-cli/<modelo>`. Cada chamada leva em torno de
20 a 30 s (medido: 26,9 s em `scenario_from_text`); o prazo do provedor é de 55 s.

## Rodar (Windows, backend no host)

O backend no Docker não tem o CLI nem o login do host, então o backend roda no host.

Pré-requisitos: Docker Desktop, `uv`, Node/npm e `claude` logado (rode `claude` uma vez). Na raiz,
com o `.env` preenchido (o script não imprime valores):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\run-local-claude.ps1            # modelo sonnet
powershell -ExecutionPolicy Bypass -File scripts\run-local-claude.ps1 -Model haiku
```

O script para os containers `backend` e `frontend` do compose, sobe só o Postgres, aplica migrations,
seed e admin (se houver `ADMIN_PASSWORD`), inicia o backend em `127.0.0.1:8000` e o Vite em
`http://localhost:5173` (proxy `/api` para `127.0.0.1:8000`). Ctrl+C encerra os dois. Logs do backend:
`%TEMP%\ja-guindastes-local`. Para voltar à stack Docker: `docker compose up -d`.
