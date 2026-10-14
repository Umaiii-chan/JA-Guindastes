# ADR-023 — Cenários com terreno editável e obstáculos

| Campo                  | Valor                                  |
| ---------------------- | -------------------------------------- |
| **Status**             | Proposto                               |
| **Data**               | 2026-10-14                             |
| **Autor**              | agente Claude Code                     |
| **Tarefa relacionada** | TASK-052                               |

## Contexto

A leva E pede terreno com relevo, obstáculos e posição do guindaste, salvos e reabertos por qualquer
usuário. O contrato do frontend (`ScenarioSpec`, `docs/leva-e/contratos.md`) já existe.

## Decisão

- **Persistência:** tabela `scenario` (`id`, `name`, `author_user_id` → `app_user` com `CASCADE`,
  datas, `spec` JSON `snake_case`; `JSONB` no PostgreSQL). Validação no domínio
  (`app/domain/entities/scenario.py`): números finitos, inclinação de -100 a 100 %, raio e dimensões
  > 0, altura de feição >= 0, até 50 feições e 100 obstáculos, ids únicos, nome de 1 a 120.
- **API:** `/api/v1/scenarios` (listar, abrir, criar, `PUT`, `DELETE`). Todo usuário logado lista e
  abre; só o autor ou um `ADMIN` atualiza e apaga (403 `FORBIDDEN`, ADR-016). Só existe com banco e
  autenticação.
- **Cena:** malha de 160 m × 160 m com passo de 1 m deslocada por `terrainHeightAt`, com linhas a cada
  5 m; sem relevo, o plano de sempre. O guindaste, o anel de raio e as zonas ficam num grupo
  (`craneAnchor`) assentado em `terrainHeightAt` no eixo de giro.
- **Rumo:** `headingDeg` gira a cena como `rotation.y` (0 = chassi como modelado, frente em +Z). Isso
  mantém a cena atual com o cenário vazio; difere de "de +X" do contrato. Para a inclinação sob as
  sapatas usa-se `headingDeg - 90` em `terrainSlopeUnderFootprintDeg`, alinhando "ao longo" à frente.
- **`ground_slope_deg`:** inclinação sob sapatas FICTÍCIAS de 3 × 2,5 m de meia distância (constantes
  `FICTITIOUS_FOOTPRINT_*`), enviada nos clientes REST e WS só com terreno não plano; o backend aceita
  (>= 0) e ainda não usa.

## Consequências

Valores FICTÍCIOS. As sapatas reais virão da TASK-054. Sem `TransformControls` (edição só por campos).
