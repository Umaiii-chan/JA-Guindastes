# Handoff — TASK-079 — implementação

| Campo | Valor |
|-------|-------|
| **Data** | 2026-10-14 |
| **Tarefa** | `tasks/in-progress/TASK-079-provedor-openai.md` |
| **Etapa concluída** | implementação |
| **Papel exercido** | Implementador |
| **Ferramenta/agente** | Claude Code (subagente) |
| **Branch** | `task/TASK-079-provedor-openai` (a partir de `anderson/leva-f/integracao-2`, rebaseada em `anderson/development`) |
| **ADR** | `docs/decisions/ADR-040-provedor-openai-com-reserva.md` |

## O que foi feito

- `backend/app/infrastructure/ai/openai_provider.py` (`OpenAiProvider`, `to_openai_schema`) e `fallback_provider.py` (`FallbackLlmProvider`).
- `backend/app/ai_composition.py`: `AI_PROVIDER`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_FALLBACK_MODELS`; Gemini intacto.
- `.env.example`, `render.yaml` (`sync: false`), `docker-compose.yml`, ADR-040 e índice de ADRs.
- Testes: `tests/infrastructure/test_openai_provider.py`, `tests/test_ai_composition.py` (transporte falso, sem rede).

## Não feito

- Nenhuma chamada real à OpenAI (sem chave no ambiente; chaves do `.env` não foram lidas). Ver "Testes a escrever depois" na tarefa.
- Frontend sem mudança: `ModelNote` já mostra `model` da resposta.
- Gates: pytest dos testes de IA e config, ruff, mypy e lint-imports passaram (saídas na conversa); suíte completa e frontend NÃO EXECUTADOS.

## Próximo passo

Revisor (outra sessão/ferramenta): revisar o diff; a pessoa responsável configura `OPENAI_API_KEY` no Render e testa uma vez.

## Groq (adicionado a pedido da pessoa usuária, 14/10/2026)

- `AI_PROVIDER` aceita `groq`. Em `auto`, a ordem é OpenAI, Groq e Gemini: o primeiro com chave é o primário e o segundo, a reserva.
- Variáveis: `GROQ_API_KEY` e `GROQ_MODEL` (padrão `openai/gpt-oss-120b`); `GROQ_FALLBACK_MODELS` é opcional.
- Reaproveita `OpenAiProvider` com `base_url=https://api.groq.com/openai/v1`. O nome do modelo passou a aceitar prefixo de organização (`openai/...`).
- Testes a escrever depois: chamada real ao Groq com o esquema completo do cenário.
- Groq: o Cloudflare recusa o User-Agent padrão do urllib (HTTP 403, código 1010). O provedor agora envia `User-Agent: ja-guindastes-simulador/1.0`.
- Chamada real verificada em 14/10/2026: scenario-from-text com `openai/gpt-oss-120b` no Groq respondeu em 3,9 s, usando os modelos da biblioteca.
