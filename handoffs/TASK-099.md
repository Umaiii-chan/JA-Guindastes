# Handoff — TASK-099

**Agente:** Claude Code (Opus 5.5), papel de implementador. Revisão independente não feita.

- `frontend/src/app/routes/SimulatorRoute.tsx`: `residualGroundSlopeDeg` recebe `reachedOutriggers`
  (antes, `outriggers`, o comando), e a dependência do efeito da sessão passa a ser
  `reachedOutriggers.levelingDeg`. A gravação, o alvo da animação e o painel continuam com o comando.
- 8 tarefas mergeadas (TASK-090 a 094, 096 a 098) foram para `tasks/completed/` com "Encerramento".

## Comandos (em `frontend/`)

- `npm run typecheck`, `npm run lint` → sem erros
- `npm run format:check` → All matched files use Prettier code style!
- `npm test` → 131 arquivos, 1168 passed, 1 skipped
- `npm run build` → ok
- `npx playwright test e2e/tests/outriggers.spec.ts` → 1 passed
- `bash scripts/check-structure.sh` → 0 erros

## Pendências

- Falta um teste de componente do `SimulatorRoute` para o valor enviado depois de "Apoiar e nivelar"
  (registrado também no handoff da TASK-094).
- ADR-044 (TASK-091) aguardando decisão.

## E2E `objetosReais.spec.ts` (único vermelho na development)

- **Causa (fato, do `error-context.md` do CI):** o bloqueio dizia "A carga atingiria o terreno"; o nome
  do barracão aparecia só nos dois itens do aviso (cabo e lança, TASK-091), e o `getByText` no grupo
  «Colisões» casava os dois (strict mode). Não é bug de produto: o bloqueio cita o alvo atingido.
- **Por que o alvo era o terreno (inferência, a partir do painel do CI e da geometria do ADR-013):** com a
  carga dentro do barracão, `Inclinação 40` já era barrada pelo telhado (a lança parou em ~14°); os
  comandos seguintes (lança 30, cabo 12) levavam o gancho abaixo do chão, e o aviso final citava o terreno.
- **Mudança:** só o teste. Levantar a lança (40°) com a carga dentro do barracão, e a asserção mira o
  `alert` de bloqueio: `toContainText(/atingiria o obstáculo «Galpão com frente aberta»/)`.
- Localmente o E2E falha antes (linha 54, ao posicionar o galpão por clique; sem backend, HTTP 404);
  a linha final só é exercitada no CI.
