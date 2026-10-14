# TASK-053 — colisões da carga

| Campo                 | Valor                                                       |
| --------------------- | ----------------------------------------------------------- |
| **Status**            | in-progress                                                 |
| **Prioridade**        | alta                                                        |
| **Criada em**         | 2026-10-14 por Anderson Sehnem (leva E, pedido em chat)     |
| **Iniciada em**       | 2026-10-14                                                  |
| **Concluída em**      | —                                                           |
| **Branch**            | `task/TASK-053-colisoes` (a partir de `leva-e/contratos`)   |
| **PR**                | —                                                           |
| **Regras de negócio** | RN-012, RN-008                                              |
| **ADR**               | ADR-028 (Proposto)                                          |

## 1. Objetivo

A carga suspensa não atravessa o terreno, o corpo do guindaste nem os obstáculos; o comando que
causaria colisão é bloqueado no último estado seguro e sinalizado.

## 2. Critérios de aceite

- CA-1 — módulo puro `domain/collision/` com OBB, SAT, segmento contra caixa e a avaliação contra
  terreno (`terrainHeightAt`), corpo do guindaste e obstáculos (`Obstacle`). Teste:
  `tests/domain/collision/*`.
- CA-2 — cabo e lança contra obstáculos só geram alerta. Teste: `collisions.test.ts`,
  `SceneCollisions.test.ts`.
- CA-3 — guarda de comandos no `SwitchableCrane`, com busca binária pelo estado seguro mais próximo.
  Teste: `tests/three/crane/collisionGuard.test.ts`.
- CA-4 — o cabo para quando a carga toca o chão; sem carga, o gancho não atravessa o chão. Teste:
  `SceneCollisions.test.ts` e `e2e/tests/collision.spec.ts`.
- CA-5 — handle da cena com `setEnvironment(ScenarioSpec)`, callback do estado de colisão e destaque
  vermelho no objeto atingido. Teste: `SceneCollisions.test.ts`.
- CA-6 — alertas na UI e hook `useCollisionState` para a gravação (TASK-057).
- CA-7 — captura em `docs/assets/screenshots/leva-e/colisao-cabo-no-chao.png`.
- CA-8 — nenhum teste existente quebra; gates do frontend passam.

## 3. Fora do escopo

Desenho do terreno e dos obstáculos (TASK-052); colisão do corpo do guindaste com obstáculos;
patolas (TASK-054); acessórios (TASK-056); qualquer decisão de capacidade (backend, RN-008).


## Encerramento

Mergeada pela pessoa responsável em 2026-10-14. Revisão independente (AGENTS.md § 3) dispensada por ela (autorização permanente, `handoffs/current.md` § 3, item 1).
