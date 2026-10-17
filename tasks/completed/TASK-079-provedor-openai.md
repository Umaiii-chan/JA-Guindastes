# TASK-079 — provedor OpenAI para o assistente de IA, com reserva entre provedores

Decisão: [ADR-040](../../docs/decisions/ADR-040-provedor-openai-com-reserva.md). Regras: RN-004 e RN-008. Base: TASK-076 (ADR-039).

## Critérios de aceite

- [x] **CA-1** — `OpenAiProvider` implementa a porta `LlmProvider` (urllib, `Authorization: Bearer`, `response_format` `json_schema` com `strict: false`, ou `json_object` se recusado); a chave nunca vai a log, URL ou mensagem.
- [x] **CA-2** — Retry com espera em 429/5xx, próximo modelo de `OPENAI_FALLBACK_MODELS`, orçamento total ~55 s; `error.message` dos 4xx vai ao log; parâmetro recusado (ex.: `temperature`) sai do pedido.
- [x] **CA-3** — `OPENAI_API_KEY`, `OPENAI_MODEL` (padrão `gpt-5-mini`), `OPENAI_FALLBACK_MODELS` (padrão vazio) e `AI_PROVIDER` (`auto`|`openai`|`gemini`, padrão `auto`): em `auto`, OpenAI com a chave, senão Gemini; com as duas, 429/5xx/prazo no primário passa ao outro.
- [x] **CA-4** — `GET /ai/status` continua `{enabled, model}`; `model` é o primário efetivo e a UI ("Respondido por") mostra o modelo que respondeu (lê `model` da resposta; sem mudança no frontend).
- [x] **CA-5** — `.env.example`, `render.yaml` (`sync: false`), `docker-compose.yml` e ADR-040 atualizados.
- [x] **CA-6** — Testes sem rede: pedido, parse, 429 para o outro provedor, seleção por `AI_PROVIDER`.

Testes: `backend/tests/infrastructure/test_openai_provider.py`, `backend/tests/test_ai_composition.py`.

## Testes a escrever depois

- Chamada real à OpenAI com chave de teste (nenhuma foi feita: sem chave no ambiente), confirmando o `json_schema` não estrito com o esquema do cenário e o nome do modelo em "Respondido por".
- Teste de frontend/e2e do "Respondido por gpt-5-mini" (a UI só repassa `model`).
- Conversão do esquema com todos os campos de `SCENARIO_RESPONSE_SCHEMA` contra a validação de um modelo real.


## Encerramento

Mergeada pela pessoa responsável em 2026-10-14 (PRs #31 e #32). Revisão independente (AGENTS.md § 3) dispensada por ela (autorização permanente, `handoffs/current.md` § 3, item 1).
