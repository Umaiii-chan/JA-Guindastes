# Handoff — TASK-076 — implementação

| Campo | Valor |
|-------|-------|
| **Data** | 2026-10-14 |
| **Tarefa** | `tasks/in-progress/TASK-076-ia-gemini.md` |
| **Etapa concluída** | implementação |
| **Papel exercido** | Implementador |
| **Ferramenta/agente** | Claude Code (subagente da leva F) |
| **Branch** | `task/TASK-076-ia-gemini`, a partir de `anderson/development` (346bb03) |
| **ADR** | `docs/decisions/ADR-039-assistente-de-ia-gemini.md` |

## O que foi feito

Backend
- Porta `LlmProvider` (`application/ports/llm_provider.py`) e `AiUsageLimiter`; adaptador `GeminiProvider` (`infrastructure/ai/gemini_provider.py`, `urllib`, sem dependência nova); limite em memória (`infrastructure/ai/in_memory_usage_limiter.py`, 20 por hora por usuário).
- Casos de uso em `application/use_cases/ai_assistant.py` (+ `ai_prompts.py` e `ai_facts.py`): cenário por texto, explicar recomendação, relatório de içamento e revisão de gravação.
- Rotas `/api/v1/ai/*` (`presentation/api/ai.py`), registradas em `create_app(ai_assistant=...)`; composição em `app/ai_composition.py` (`GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_FALLBACK_MODELS`, `AI_RATE_LIMIT_PER_HOUR`).
- Contrato da leva F criado porque não existia neste branch: `cargo` e `delivery` opcionais no `ScenarioSpec` (domínio, schemas, serialização e cliente do frontend), exatamente como em `regras-leva-f.md`. Se a TASK-073 integrar antes, o merge deve ficar só com uma cópia.
- `.env.example`, `render.yaml` (`sync: false`) e `docker-compose.yml` (repasse das variáveis).

Frontend
- Porta `application/ai/ports.ts`, cliente `infrastructure/api/aiRestClient.ts`, contexto `app/ai/` (`AiProvider` lê `/ai/status` uma vez; sem IA, `enabled=false` e nada aparece), hook `useAiTask` (a chamada parte de um clique, não de efeito, para o modo estrito do React não gastar o limite por hora).
- `presentation/ai/`: `AssistantButton`/`AssistantDialog`, `ExplainRecommendationButton` (exportado; recebe a recomendação por props, porque o painel da TASK-075 não existe neste branch), `LiftReportButton`, `ReviewRecordingButton` (usado em `RecordingPanel`), `AiTextDialog` (Markdown renderizado, imprimir com CSS `@media print`, exportar `.md`) e `Markdown` próprio (árvore de dados, nunca HTML).
- Integração pequena e aditiva em `SimulatorRoute.tsx` (botão na barra, relatório sob o resultado, "Aplicar" = `checkpoint` + `setSpec` + `setLoad`), `AppProviders.tsx` e `RecordingPanel.tsx`.

## Teste real (uma vez, com a chave do `.env` local; a chave não foi impressa nem gravada)

- Chave lida só por processo (`GEMINI_API_KEY` do `.env`), backend local na porta 8001 com o banco do Docker e o Vite com o proxy do admin de teste injetado fora da conversa.
- O `gemini-3.7-flash` e o `gemini-3-flash-preview` responderam 503 ("high demand") várias vezes: o retry com espera curta e a troca para a reserva funcionaram, e a tela mostrou "Respondido por gemini-3-flash-preview (modelo reserva)" e "gemini-flash-lite-latest".
- "içar uma viga de 8 t de 6 m de dentro do barracão até a carreta a 20 m" → viga de concreto 8.000 kg, 6 × 0,4 × 0,6 m; barracão com 3 paredes e vão aberto; carreta; retirada em (10, 0) e entrega em (-10, 0), raio 2 m (20 m entre elas); aplicado no simulador.
- Relatório de içamento e revisão de gravação também rodaram de verdade (a gravação de teste foi apagada depois).
- Medida: sem `thinkingLevel` o `gemini-3-flash-preview` levou 44 s para uma resposta estruturada; com `low`, 4 s. Por isso o adaptador manda `low` (e repete sem ele se o modelo recusar).
- Capturas: `docs/assets/screenshots/leva-f/TASK-076-assistente-previa.jpg`, `-cenario-aplicado-vista-de-topo.jpg`, `-relatorio-de-icamento.jpg`, `-revisao-de-gravacao.jpg`.

## Gates (saídas reais)

| Comando | Resultado |
|---------|-----------|
| `uv run ruff check .` / `ruff format --check .` | passou (291 arquivos formatados) |
| `uv run mypy app` | `Success: no issues found in 157 source files` |
| `uv run lint-imports` | `Contracts: 3 kept, 0 broken.` |
| `uv run pytest` | `1609 passed, 88 skipped` (integração pula sem Postgres/CI) |
| `npm run lint`, `format:check`, `typecheck` | passou |
| `npm test` | `Test Files 95 passed`, `Tests 869 passed, 1 skipped` |
| `npm run build` | passou |
| `npm run e2e` (preview, sem backend) | `15 passed`, `11 skipped` (os que exigem backend) |

## Decisões

- Sem `GEMINI_API_KEY`, a IA fica desligada e a API sobe normalmente; `/ai/status` sempre existe (sessão exigida).
- O relatório e a revisão separam o que é código (tabelas de números) do que é IA (texto): os números nunca passam por modelo. O relatório reavalia o estado no backend (RN-008).
- O limite por usuário é por processo (como o de login, ADR-016).
- `GET /ai/status` devolve também `fallback_models` e `usage_limit_per_hour` (aditivo ao contrato `{enabled, model}`).

## Não foi feito / pendências

- A carga (`cargo`) e a área de entrega (`delivery`) só são salvas no cenário; desenhá-las na cena e no passo "Posição" é da TASK-073.
- "Explicar" não está ligado a nenhuma tela: o painel de recomendações é da TASK-075 (o componente está pronto e exportado).
- O cenário do modelo menor (`gemini-flash-lite-latest`) pode vir simplificado (barracão como caixa única); o prompt orienta paredes com vão, mas a prévia mostra as suposições para revisão.
- Cota do plano gratuito e nomes de modelos mudam; revisar `GEMINI_*` no Render se algum modelo sair do ar.
- `npm run e2e` com backend não foi executado (sem stack neste worktree).

## Testes a escrever depois

- E2E com backend e provedor de IA simulado: abrir o Assistente, gerar, aplicar e ver o passo "Carga" concluído.
- Teste de contrato OpenAPI para as rotas `/ai/*` (esquemas de erro) em `tests/test_openapi.py`.
- Impressão real: validar o CSS `@media print` num navegador (no ambiente de teste só foi verificada a estrutura: cópia no `body` e classe `ai-printing`).
- Limite por usuário com mais de uma réplica (hoje por processo).
- Ligar "Explicar" ao painel de recomendações quando a TASK-075 integrar.

## Próximo passo

Revisão por outro agente/pessoa (AGENTS.md § 3). Arquivos para ler primeiro: `docs/decisions/ADR-039-assistente-de-ia-gemini.md`, `backend/app/application/use_cases/ai_assistant.py`, `backend/app/infrastructure/ai/gemini_provider.py`, `frontend/src/presentation/ai/`.
