# Leva E — contratos compartilhados (TASK-051..057)

Plano aprovado pela pessoa responsável em 14/10/2026: o simulador completo. A pessoa pediu as sete
tarefas **em paralelo**, cada uma com branch, handoff e PR próprios no repositório
`Anderson-Sehn3m/JA-Guindastes` (remote `anderson`), base `development`.

Este documento fixa o que as tarefas compartilham, para codificarem contra a mesma interface sem
esperar umas pelas outras. **Mudar um contrato exige registrar o motivo no handoff** e avisar no PR.

Os valores numéricos são **FICTÍCIOS** e configuráveis até haver dado oficial (ADR-012).

## 1. Tarefas, ADRs e regras

| Tarefa | Conteúdo | ADR | Regras |
|--------|----------|-----|--------|
| TASK-051 | Limite de capacidade por modelo; faixas OK, WARNING e OVER | ADR-022 | RN-011 |
| TASK-052 | Cenários persistidos: terreno editável, obstáculos e posição do guindaste | ADR-023 | — |
| TASK-053 | Colisões da carga com o terreno, o guindaste e os obstáculos | ADR-028 | RN-012 |
| TASK-054 | Patolas animadas no modelo 3D | ADR-024 | RN-013 (entradas) |
| TASK-055 | Risco de tombamento e área de operação verde, amarela e vermelha | ADR-025 | RN-013 |
| TASK-056 | Acessórios com modelos 3D de terceiros | ADR-026 | RN-014 |
| TASK-057 | Gravar, salvar e reproduzir simulações | ADR-027 | RN-005 |

## 2. Frontend: módulos já criados (commit de contratos)

- `frontend/src/domain/environment/environment.ts`: `TerrainSpec`, `TerrainFeature`, `Obstacle`,
  `CranePlacement`, `ScenarioSpec`, `terrainHeightAt`, `terrainSlopeDegAt` e
  `terrainSlopeUnderFootprintDeg`. Fonte única da forma do terreno: a TASK-052 desenha e salva, a
  053 colide, a 054 calcula a inclinação sob as sapatas e a 057 grava.
- `frontend/src/domain/crane/outriggers.ts`: `OutriggerState`, `outriggersReady` e
  `residualSlopeDeg`.
- `frontend/src/domain/evaluation/evaluation.ts`: campos opcionais da leva E em `EvaluationInput`
  (`outriggers`, `groundSlopeDeg`, `accessoryIds`) e no resultado (`capacityLimit`, `tippingRisk`,
  `alerts`, `accessoriesWeightKg`, `accessories`).

## 3. Backend: contrato JSON da avaliação (REST `POST /api/v1/evaluations` e WebSocket)

Todos os campos novos são **opcionais**: sem eles, a resposta é idêntica à anterior.

**Requisição** (`snake_case`):

| Campo | Tipo | Tarefa |
|-------|------|--------|
| `outriggers` | `{ "extension_percent": 0..100, "jacks_set": bool }` | 054 envia, 055 usa |
| `ground_slope_deg` | número ≥ 0 (inclinação residual sob o guindaste) | 052/054 enviam, 055 usa |
| `accessory_ids` | lista de ids de acessórios do catálogo | 056 |

**Resposta**, campos novos:

| Campo | Tipo | Tarefa |
|-------|------|--------|
| `capacity_limit` | `{ "limit_percent", "effective_capacity_kg", "limit_utilization_percent", "warning_band_percent", "level": "OK" \| "WARNING" \| "OVER" }` ou `null` | 051 |
| `tipping_risk` | `"LOW"` \| `"ATTENTION"` \| `"HIGH"` ou `null` | 055 |
| `alerts` | lista de `{ "code", "severity": "INFO" \| "ATTENTION" \| "CRITICAL", "message" }` | 055 (outras podem acrescentar) |
| `accessories_weight_kg` | número ou `null` | 056 |
| `accessories` | lista de `{ "id", "name", "weight_kg" }` | 056 |

## 4. Catálogo: colunas novas em `cranes` (todas na TASK-051)

| Coluna | Padrão | Uso |
|--------|--------|-----|
| `capacity_limit_percent` | 100 | RN-011 (1 a 100) |
| `warning_band_percent` | 90 | RN-011: atenção a partir desta % do limite |
| `max_ground_slope_deg` | 1.0 (FICTÍCIO) | RN-013: inclinação residual máxima (TASK-055) |
| `max_leveling_deg` | 3.0 (FICTÍCIO) | correção máxima dos macacos (TASK-054) |

A API do catálogo (`GET`/`PATCH` dos guindastes) expõe as quatro colunas. O frontend lê
`max_leveling_deg` e `max_ground_slope_deg` do guindaste escolhido.

## 5. Migrations

Todas as migrations da leva E usam `down_revision = "b4e1d7c93a52"` (a cabeça atual). Isso deixa
várias cabeças quando as branches se juntam; quem integra encadeia na ordem **051 → 052 → 056 →
057** (só trocando o `down_revision`). Nome do arquivo: `<rev>_<descricao>.py`, com `rev` de 12 hex
gerado pelo Alembic.

## 6. Cena 3D

- O handle de `mountCraneScene` e as props de `CraneViewport` ganham métodos e props **aditivos**
  (ex.: `setTerrain`, `setObstacles`, `setOutriggers`, `setOperatingArea`, `setAccessories`,
  `setCollision`). Não renomeie nem remova os existentes.
- O chão continua em y = 0 sob o eixo de giro quando o terreno é plano. Com terreno, o guindaste
  assenta em `terrainHeightAt(terrain, crane.x, crane.z)`.
- Nós novos do GLB das patolas (TASK-054): `crane-outrigger-{fl,fr,rl,rr}-{beam,jack,pad}`.

## 7. Arquivos de integração (onde haverá conflito)

`frontend/src/app/routes/SimulatorRoute.tsx`, `frontend/src/three/scene/mountCraneScene.ts`,
`frontend/src/presentation/components/CraneViewport.tsx`,
`frontend/src/infrastructure/api/evaluationRestClient.ts` / `evaluationContract.ts`,
`frontend/src/infrastructure/websocket/evaluationMessages.ts`,
`backend/app/presentation/api/evaluation_schemas.py`,
`backend/app/presentation/websocket/evaluation_messages.py` e
`backend/app/application/use_cases/evaluate_operation.py`.

Nesses arquivos, as mudanças devem ser **pequenas e aditivas**: um hook novo, uma prop nova ou um
campo novo. A lógica fica em módulo próprio da tarefa.

## 8. Regras para os agentes

- Seguir `AGENTS.md`. Sem rodapé de co-autoria de IA nos commits.
- Dados de teste **FICTÍCIOS**.
- Modelos 3D só de terceiros, com licença registrada. Nada modelado por código como substituto de
  um modelo pedido (decisão de 14/10/2026). Downloads só com confirmação da pessoa em chat.
