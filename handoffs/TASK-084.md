# Handoff — TASK-084

- `keepLibraryProportions` e `withLibraryProportions` em `frontend/src/application/ai/scenarioDraft.ts`, chamados em `applyAiDraft` (`SimulatorRoute.tsx`).
- As dimensões vindas da IA continuam no backend (pós-processamento de obstáculos da TASK-081). A proporção é corrigida só ao aplicar no simulador.
- Teste: `frontend/tests/application/ai/libraryProportions.test.ts`.
