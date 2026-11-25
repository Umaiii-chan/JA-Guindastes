# Handoff — TASK-118 — implementação (provedor de IA DeepSeek)

> **Tarefas em paralelo:** este handoff fica em `handoffs/TASK-118.md`; `handoffs/current.md` não foi
> editado.

| Campo | Valor |
|-------|-------|
| **Data** | 2026-11-25 |
| **Tarefa** | `tasks/in-progress/TASK-118-provedor-deepseek.md` |
| **Etapa concluída** | implementação com testes |
| **Papel exercido** | Planejador + Engenheiro de testes + Implementador (um único agente; AGENTS.md § 3) |
| **Ferramenta/agente** | Claude Code |
| **Branch** | `task/TASK-118-provedor-deepseek`, a partir de `development` @ `4e3c62e` |

## 1. O que foi feito

- `backend/app/ai_composition.py`: provedor `deepseek` sobre o `OpenAiProvider` (como o Groq), com
  `DEEPSEEK_BASE_URL = https://api.deepseek.com` e modelo padrão `deepseek-flash`; variáveis
  `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL`, `DEEPSEEK_FALLBACK_MODELS`, `DEEPSEEK_REASONING_EFFORT`;
  último na ordem do `auto`.
- `backend/app/infrastructure/ai/openai_provider.py`: HTTP 400 sem `error.param` cuja mensagem cita
  `response_format` passa a ser tratado como recusa do `response_format` (cai para `json_object`).
- `.env.example`: as quatro variáveis novas e `AI_PROVIDER` com `deepseek`.
- Testes: `test_deepseek_uses_the_compatible_endpoint_and_its_default_model`,
  `test_a_response_format_refusal_without_param_is_read_from_the_message`; o teste do app sem banco
  passou a limpar também `GROQ_API_KEY` e `DEEPSEEK_API_KEY` do ambiente (falhava na máquina que tem
  a chave definida).

## 2. Comandos executados (saída real, resumida)

- `GET https://api.deepseek.com/models` com a chave local: lista `deepseek-flash` (DeepSeek-V4.1-Flash)
  e `deepseek-v4-pro`.
- Chamada real pelo adaptador com esquema JSON: 1ª resposta HTTP 400 `This response_format type is
  unavailable now` (sem `param`); com a correção, 2ª chamada devolve `{"ok":true,"n":2}`.
- Stack local com `AI_PROVIDER=deepseek`: `GET /api/v1/ai/status` → `enabled: true, model:
  deepseek-flash`; `POST /api/v1/ai/scenario-from-text` → 200 com cenário.
- `uv run ruff check .`, `ruff format --check .`, `mypy app`, `lint-imports`, `pytest`: ver o PR.

## 3. Decisões

- Sem adaptador novo: a API é compatível com a da OpenAI, como a do Groq (ADR-040).
- Sem ADR: segue o mesmo desenho do Groq, que entrou sem ADR próprio.
- A chave não foi gravada em nenhum arquivo; vem do ambiente.

## 4. O que NÃO foi feito

- `docs/deployment-railway.md` não mudou: o deploy continua com Groq.
- Houve um 504 (prazo) do `deepseek-flash` em uma das chamadas de cenário no uso local; não
  investigado. `DEEPSEEK_REASONING_EFFORT=low` pode reduzir o tempo (não medido).
- Os outros endpoints de IA (explicar, relatório, revisão) não foram exercitados com a DeepSeek.

## 5. Próximo passo

Revisor (outra sessão/ferramenta): revisar o diff `development...task/TASK-118-provedor-deepseek`.
