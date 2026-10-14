# TASK-076 — assistente de IA: cenário por texto, explicação, relatório e revisão

Decisão: [ADR-039](../../docs/decisions/ADR-039-assistente-de-ia-gemini.md). Regras: RN-004 e RN-008 (a IA nunca decide capacidade, utilização nem segurança; só explica números já calculados).

- [x] **CA-1** — `GET /api/v1/ai/status` responde `{enabled, model, fallback_models, usage_limit_per_hour}`; sem `GEMINI_API_KEY`, `enabled=false` e as demais rotas não existem; a tela esconde tudo do assistente.
- [x] **CA-2** — `POST /ai/scenario-from-text`: JSON estruturado do Gemini (`responseMimeType` e `responseSchema`), validado pelo mesmo domínio dos cenários salvos e convertido em `ScenarioSpec` + carga + `cargo` e `delivery`; o usuário vê a prévia e só então aplica.
- [x] **CA-3** — `POST /ai/explain-recommendation`, `POST /ai/lift-report` (o backend avalia de novo o estado; a tabela de números é montada por código) e `POST /ai/review-recording` (indicadores calculados por código).
- [x] **CA-4** — Porta `LlmProvider` e adaptador `GeminiProvider` (urllib, chave só no cabeçalho `x-goog-api-key`): retry com espera curta, troca para o modelo reserva, timeouts, limite de entrada, mensagens de erro amigáveis; a resposta diz qual modelo respondeu e a tela mostra isso.
- [x] **CA-5** — Limite de 20 usos por hora por usuário (em memória); autorização como a da avaliação (sessão de qualquer perfil, CSRF nos `POST`).
- [x] **CA-6** — Variáveis documentadas em `.env.example` (sem valores), `render.yaml` (`sync: false`) e `docker-compose.yml`.
- [x] **CA-7** — Frontend: botão "Assistente" (descreva a operação, prévia, Aplicar), "Explicar" (componente `ExplainRecommendationButton`, por props), "Gerar relatório de içamento" (Markdown renderizado, imprimível e exportável em `.md`) e "Revisar" nas gravações.
- [x] **CA-8** — Testes com provedor falso (sem rede) no backend e no frontend; uma execução real com a chave do `.env` local gerou o cenário de "içar uma viga de 8 t de 6 m de dentro do barracão até a carreta a 20 m" (capturas em `docs/assets/screenshots/leva-f/TASK-076-*.jpg`).

Testes essenciais: `backend/tests/infrastructure/test_gemini_provider.py`, `backend/tests/application/test_ai_assistant.py`, `backend/tests/presentation/test_ai.py`, `frontend/tests/presentation/ai/assistant.test.tsx`.
