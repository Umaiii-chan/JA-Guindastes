# Handoff — TASK-077 — movimento suave (implementação)

| Campo | Valor |
|-------|-------|
| **Data/hora** | 2026-10-14 (UTC-3) |
| **Tarefa** | `tasks/in-progress/TASK-077-movimento-suave.md` |
| **Etapa concluída** | implementação |
| **Papel exercido** | Implementador (sem revisão independente) |
| **Ferramenta/agente** | Claude Code (subagente em worktree) |
| **Branch** | `task/TASK-077-movimento-suave`, a partir de `b2f17cc` (leva-f/integracao-2) |

## 1. Objetivo desta etapa

Parar o "tremer e pular" na trajetória planejada e na reprodução de gravações (itens a, b, c do pedido).

## 2. O que foi feito

- `CraneCommands.setState(parcial, { guarded? })`: `CraneController` aplica os quatro campos de uma vez (clamp em cada); `SwitchableCrane` checa a colisão só no estado final, recua em conjunto (busca binária na reta anterior → pedido) se colidir, e com `guarded: false` só reavalia uma vez para os destaques.
- `interpolateCraneState` e `shortestAngleDeltaDeg` (funções puras) em `application/recording/playback.ts`.
- `useSimulationRecording`: o laço de reprodução emite a pose interpolada a cada rAF; posição React e `uiRefresh` a ~5 Hz (`PLAYBACK_UI_REFRESH_MS` = 200); `positionRef` passou a ser a fonte de verdade (o efeito que o copiava do estado foi removido, pois sobrescreveria com valor atrasado).
- `SimulatorRoute.applyFrame`: `setState(..., { guarded: false })`; `setCrane` só com `uiRefresh`; carga só reaplicada quando o quadro muda.
- `usePlanPlayback`: `applyPlanState` usa `setState` guardado; progresso, fase e `onMoved` a `refreshMs` (padrão 200 ms; 100 ms enquanto grava, via `PlanningSection`/`SimulatorRoute`); fase atualizada no quadro-chave.
- Teste novo `frontend/tests/application/recording/interpolation.test.ts`; `usePlanPlayback.test.tsx` ganhou `setState` no fake.

## 3. Comandos executados e resultados

| Comando (em `frontend/`) | Resultado | Saída |
|---|---|---|
| `npx tsc -b` e `npx tsc -p e2e` | passou | sem erros |
| `npm run lint` | passou | sem avisos |
| `npm run format:check` | passou | All matched files use Prettier code style |
| `npx vitest run` (suíte inteira) | passou | 119 arquivos, 1059 passed, 1 skipped |
| `npm run build` | passou | built, só aviso de tamanho de chunk |
| `npm run e2e`, validação e capturas no navegador | NÃO EXECUTADO | prazo |

## 4. Decisões

- A guarda em lote recua na reta (todos os campos juntos), não campo a campo: evita a pose "pular" por combinação intermediária bloqueada.
- Reprodução sem guarda: o estado gravado já foi validado.
- Tela a 5 Hz, mas 10 Hz enquanto grava, porque o gravador depende de `crane.state` e limita a 10 Hz (`MIN_FRAME_INTERVAL_MS`). Hipótese (não verificada): os quadros espaçados de ~840 ms vinham do rAF + re-render pesado a 60 Hz; precisa ser conferido no navegador.
- Não toquei em CSS nem em componentes de painel (item d e estabilização de campos estão na TASK-078).

## 5. Não feito / pendências

- Itens d) e estabilização de campos (TASK-078).
- Validação no navegador e e2e.
- Testes listados na tarefa, em "Testes a escrever depois".

## 6. Próximo passo

Revisor (outra ferramenta): conferir o diff `git diff b2f17cc...HEAD`, rodar uma trajetória com gravação no navegador e medir o espaçamento dos quadros e a ausência de saltos na reprodução.
