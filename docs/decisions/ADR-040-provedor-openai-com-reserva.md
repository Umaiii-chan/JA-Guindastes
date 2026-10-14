# ADR-040 — Provedor OpenAI para o assistente de IA, com reserva entre provedores

| Campo | Valor |
|-------|-------|
| **Status** | Aceito (Anderson Sehnem, em chat em 2026-10-14) |
| **Tarefa** | TASK-079 |
| **Regras** | RN-004 e RN-008 (a IA nunca decide capacidade, utilização nem segurança) |

## Contexto

O ADR-039 ligou o assistente ao Gemini. A pessoa usuária vai usar uma chave da API da OpenAI no app
publicado (Render). A porta `LlmProvider` já isola o fornecedor, então basta um segundo adaptador.

## Decisão

- **Adaptador:** `OpenAiProvider` (`app.infrastructure.ai.openai_provider`), por `urllib`, sem
  dependência nova. `POST https://api.openai.com/v1/chat/completions`, chave em
  `Authorization: Bearer` (nunca em URL, log ou mensagem de erro; só `error.message` dos 4xx vai ao log).
- **Saída estruturada:** `response_format` `json_schema` com `strict: false`, a partir do mesmo esquema
  do Gemini (convertido: tipos em minúsculas, `nullable` vira `["tipo","null"]`). Se o modelo recusar o
  `response_format`, repete com `json_object` e o esquema no texto do sistema. A validação pydantic do
  caso de uso continua valendo.
- **Parâmetros recusados:** modelos de raciocínio (gpt-5, o1, o3, o4) não recebem `temperature`;
  recebem `reasoning_effort` (`low`). Se o provedor recusar um parâmetro (HTTP 400 com `error.param`),
  ele sai do pedido e a recusa fica lembrada para o modelo.
- **Resiliência:** mesma política do Gemini: 429 e 5xx repetidos com espera de 1,5 s (até 2
  tentativas por modelo; `insufficient_quota` não é repetido), depois o próximo modelo de
  `OPENAI_FALLBACK_MODELS`; 20 s por chamada.
- **Seleção (`AI_PROVIDER`):** `auto` (padrão): com `OPENAI_API_KEY`, a OpenAI é a primária; sem ela,
  o Gemini. Com as duas chaves, `FallbackLlmProvider` tenta o outro provedor quando o primário falha
  por 429, 5xx ou prazo (recusas e respostas inutilizáveis não trocam). O orçamento de ~55 s é
  dividido: 35 s para o primário e 20 s para o secundário. `openai` e `gemini` usam só o escolhido.
- **Variáveis:** `OPENAI_API_KEY`, `OPENAI_MODEL` (padrão `gpt-5-mini`), `OPENAI_FALLBACK_MODELS`
  (padrão vazio), `AI_PROVIDER`. Sem chave do provedor escolhido, a IA fica desligada.
- **API:** `GET /ai/status` continua `{enabled, model, ...}`; `model` é o modelo primário efetivo
  (por exemplo `gpt-5-mini`) e a tela mostra, em "Respondido por", o modelo que respondeu de fato.

## Consequências

- Os nomes de modelo da OpenAI mudam; ficam em variáveis. O comportamento de cada modelo diante dos
  parâmetros é descoberto em tempo de execução (uma 400 extra na primeira chamada).
- `strict: false` não garante o formato; quem garante é a validação do caso de uso.
