# Handoff — TASK-112 — e2e da entrega

| Campo | Valor |
|-------|-------|
| **Data** | 2026-10-17 |
| **Tarefa** | `tasks/in-progress/TASK-112-e2e-entrega-defasado.md` |
| **Papel exercido** | Implementador |
| **Branch** | `task/TASK-112-e2e-entrega-defasado` (base `anderson/development` @ `65e3784`) |

## Suíte E2E local sem backend, na `development` pura (antes da correção)

Passam: auth (modo sem autenticação), collision (2), loadChartImport (navegador), objetosReais, outriggers,
rotationZones (navegador, 2), scene (7), simulatorEvaluation (navegador), tipoDeCarga (2). **Falha: só
`cargoDelivery`** (Engatar desabilitado). Pulados (exigem backend): auth com servidor (4), catalogEdit (2),
evaluation (2), loadChartImport com backend, rotationZones com backend (2). Dos testes de navegador pulados no
CI (outriggers, rotationZones, simulatorEvaluation), todos passam localmente.

## O que mudou (`frontend/e2e/tests/cargoDelivery.spec.ts`)

- Engate: desce o cabo de 0,2 em 0,2 m até o Engatar liberar (a janela é de −0,1 a +0,5 m em torno da
  altura das lingas) e confere a dica "Toque em Engatar".
- Engatada com a folga do engate, a base fica ~0,4 m acima do chão: a dica agora é "Carga engatada: leve a
  carga até o ponto de entrega…" e o Soltar fica desabilitado (antes: "Toque em Soltar"). Assertiva trocada pela
  real e reforçada com o Soltar desabilitado.
- Sem `test.skip(hasBackend)`: com a stack, o navegador avalia por WebSocket, então o spec responde ao
  WebSocket (`routeWebSocket`) além do REST.

## Verificação

`playwright cargoDelivery`: passa sem backend (vite preview) e com a stack Docker (`E2E_BACKEND=1`, projeto
`e2e112`, derrubado). Suíte completa com a stack: 26 passam, 3 pulados (os de navegador, por design). `vitest`
1355, `tsc`, `eslint`, `prettier`, `check-structure` OK.
