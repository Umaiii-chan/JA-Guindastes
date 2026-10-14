# Handoff — TASK-053 — implementação

| Campo | Valor |
|-------|-------|
| **Tarefa** | `tasks/in-progress/TASK-053-colisoes.md` |
| **Etapa** | implementação (papel: Implementador) |
| **Ferramenta** | Claude Code |
| **Branch** | `task/TASK-053-colisoes` (base `leva-e/contratos`; depende do PR #3 / TASK-050) |

## O que foi feito

- `frontend/src/domain/collision/` (`obb.ts`, `collisions.ts`, `loadBox.ts` movido de `three/scene/`, que reexporta).
- Guarda de comandos em `SwitchableCrane` (`setCollisionGuard`, `revalidate`), busca binária pelo estado seguro.
- `three/scene/SceneCollisions.ts`, `CollisionHighlight.ts`, `three/crane/craneBody.ts`; `HookLoad` ganhou `setCollisionHighlight` e `currentHookBox`.
- `mountCraneScene`: `setEnvironment`, `getCollisionState`, opção `onCollisionChange`. `CraneViewport`: props `scenario` e `onCollisionChange`.
- UI: `CollisionAlerts` (acima do resultado) e hook `useCollisionState` (para a TASK-057).
- ADR-028 (Proposto): `docs/decisions/ADR-028-colisoes-da-carga.md`. Índice de ADRs não editado (evita conflito na leva).

## Comandos (saída real)

`npm run lint`, `format:check`, `typecheck`, `build`: passaram. `npm test`: 760 passed, 1 skipped. `npm run e2e`: 13 passed, 11 skipped (precisam de backend).

Obs.: antes do pedido de pressa, já havia escrito testes (`tests/domain/collision/*`, `tests/three/crane/collisionGuard.test.ts`, `tests/three/scene/SceneCollisions.test.ts`, `e2e/tests/collision.spec.ts`) e uma captura em `docs/assets/screenshots/leva-e/`; todos passam e ficaram no PR.

## Testes a escrever depois

- Terreno inclinado (`slopeXPercent`) e rampa nas colisões da carga.
- Cilindro girado e obstáculo com `rotationYDeg` em SAT contra a carga.
- Corpo medido de um GLB real (`loadTruckCraneModel`), com a troca de modelo e `revalidate`.
- `CollisionAlerts` (RTL) e `useCollisionState`.
- `CraneViewport` repassando `scenario` e `onCollisionChange`; remontagem da cena.
- e2e: giro bloqueado por obstáculo (precisa da TASK-052 desenhando obstáculos).

## Pendências

1. `headingDeg` é aplicado como rotação em Y (0° = cena original); alinhar com a TASK-052/054, que usam "de +X" em `terrainSlopeUnderFootprintDeg`.
2. A pose inicial com carga de 4 m raspa na cabine do chassi (caixa do nó base): é comportamento esperado, ver ADR-028.
3. Se o estado anterior já colide, os comandos passam sem corte (ADR-028 § 4).
