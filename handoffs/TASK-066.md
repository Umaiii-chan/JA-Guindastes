# Handoff — TASK-066 — editor 3D livre do ambiente

| Campo | Valor |
|-------|-------|
| **Data/hora** | 2026-10-14 (UTC-3) |
| **Tarefa** | `tasks/in-progress/TASK-066-editor-3d-ambiente.md` |
| **Papel exercido** | Implementador (sem revisor independente ainda) |
| **Ferramenta/agente** | Claude Code |
| **Branch** | `task/TASK-066-editor-3d-ambiente`, a partir de `anderson/task/TASK-062-auditoria-visual` |

## O que foi feito

- Domínio (`environment.ts`): `SoilKind`, `SoilZone`, `WindSpec`, `soilAt`, feição `flatten` (em `terrainHeightAt`, na ordem da lista). `craneAttitude.ts`: altura sob o centro, inclinação pelo plano das 4 sapatas e compensação dos macacos.
- Aplicação: `editorOps.ts` (esculpir, aplainar, pintar solo, adicionar obstáculo, vento, solo sob as sapatas) e `obstacleConflicts.ts`.
- Cena: `SceneEditor.ts` (TransformControls, raycast no terreno, pincel, seleção), `SoilOverlay.ts`, `WindArrow.ts`; `setScenario` só refaz o que mudou e inclina o guindaste; `setLevelingDeg`; `setEditor` em `mountCraneScene` e prop `editor` em `CraneViewport`.
- UI: seções recolhíveis (`CollapsibleSection`, `useSectionOpen`, cabeçalho recolhível do `GuidedStepsPanel`), botão "Editar ambiente" e faixa `EnvironmentEditorToolbar`; desfazer no `ScenarioProvider`.
- Contrato: REST de cenários e avaliação (`soil_kinds`, `wind_speed_ms`, `obstacle_conflicts`; só enviados quando existem).
- Backend: `scenario.py` e `scenario_schemas.py` aceitam e validam `soil_zones`, `wind` e `flatten`.
- ADR-032 e índice.

## Comandos

| Comando | Resultado |
|---------|-----------|
| frontend: `npm run lint`, `format:check`, `typecheck`, `build` | passou |
| frontend: `npm test` | passou: 90 arquivos, 830 testes (1 pulado) |
| backend: `ruff check`, `ruff format --check`, `mypy app`, `lint-imports` | passou |
| backend: `pytest` | passou (testes de integração pulam sem Postgres); a falha conhecida de `test_create_admin` foi excluída |
| `npm run e2e` | NÃO EXECUTADO: com a stack Docker no ar, o e2e local cai no login (ver handoff da TASK-062) |

Validação manual no navegador (vite dev, backend Docker): adicionei e arrastei uma caixa, esculpi o
terreno e o guindaste subiu e inclinou, pintei solo argiloso e ajustei vento e direção. Capturas em
`docs/assets/screenshots/leva-e/task-066-*`. O pane de teste era estreito (594 px), usei zoom CSS.

## Decisões e limites

- A avaliação do backend usa `extra="forbid"`: solo, vento e conflitos só funcionam com a TASK-067 integrada; o backend Docker usado na validação não tem a mudança dos cenários.
- Colisões ainda tratam o guindaste na vertical; a inclinação é visual.
- `obstacleConflicts` usa o disco de raio igual ao raio de trabalho (leitura conservadora do pedido).
- Sapatas ainda fictícias (6 m × 5 m). Macacos tiram a inclinação sem animar.

## Próximo passo

Revisor: conferir o `SceneEditor` com o mouse num monitor maior; depois TASK-067 (backend da avaliação).
