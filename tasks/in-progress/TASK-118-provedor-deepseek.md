# TASK-118 — provedor de IA DeepSeek

Pedido da pessoa responsável (2026-11-25): rodar o projeto localmente usando o modelo DeepSeek Flash
com a chave `DEEPSEEK_API_KEY` já definida na máquina. O assistente de IA só tinha OpenAI, Groq,
Gemini e o Claude CLI local.

## Critérios de aceite

- [x] **CA-1** — `AI_PROVIDER=deepseek` (ou `auto` com só `DEEPSEEK_API_KEY`) liga o assistente pela API da DeepSeek, compatível com a da OpenAI (`https://api.deepseek.com`), com `deepseek-flash` como modelo padrão.
- [x] **CA-2** — `DEEPSEEK_MODEL`, `DEEPSEEK_FALLBACK_MODELS` e `DEEPSEEK_REASONING_EFFORT` seguem o mesmo contrato das variáveis do Groq e estão em `.env.example`.
- [x] **CA-3** — A resposta estruturada funciona: a DeepSeek recusa `response_format` `json_schema` com HTTP 400 sem `error.param`; o adaptador reconhece a recusa pela mensagem e repete com `json_object`.
- [x] **CA-4** — Em `auto`, a DeepSeek entra por último (OpenAI, Groq, Gemini, DeepSeek): a ordem dos provedores existentes não muda.
- [x] **CA-5** — Testes automatizados para a composição e para a recusa sem `param`.
