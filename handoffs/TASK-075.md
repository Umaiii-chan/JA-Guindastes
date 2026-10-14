# Handoff — TASK-075 — implementação

| Campo | Valor |
|-------|-------|
| **Data/hora** | 2026-10-14 (America/Sao_Paulo) |
| **Tarefa** | `tasks/in-progress/TASK-075-planejamento.md` |
| **Etapa concluída** | implementação |
| **Papel exercido** | Implementador (e Engenheiro de testes) |
| **Ferramenta/agente** | Claude Code |
| **Branch** | `task/TASK-075-planejamento` (a partir de `anderson/development`) |

## 1. Objetivo desta etapa

Recomendar guindaste (um ou dois), posição e trajetória para levar uma carga da coleta à entrega, com
execução animada e modo passo a passo. Decisão em `docs/decisions/ADR-038-planejamento-da-operacao.md`.

## 2. O que foi feito

- Backend, domínio puro em `backend/app/domain/services/planning/`: `terrain.py` (espelho Python de
  `terrainHeightAt`, inclinação sob as sapatas, sapatas e `soilAt`), `scene.py`, `crane_body.py`,
  `tandem.py`, `trajectory.py`, `models.py` e `planner.py` (busca).
- Aplicação: `recommend_lift_plan.py` (`RecommendLiftPlan`): lê catálogo e tabelas ativas uma vez e
  avalia cada estado com o `EvaluateOperation` sobre esse retrato em memória; ranking, tandem, notas.
- API: `POST /api/v1/planning/recommend` (`presentation/api/planning.py`), ligada em `main.py`.
- Cenário: `cargo` e `delivery` opcionais (entidade, JSON do banco, schemas, cliente do frontend).
- Frontend: tipos e cliente REST do planejamento, `stepGuide.ts` e `trajectoryPlayback.ts` (puros),
  `usePlanning`, `usePlanPlayback`, `PlanningSection` + `PlanningPanel` (seção "Planejar operação"),
  marcadores de coleta e entrega na cena (`PlanMarkers.ts`) e `hookAttachOffsetM()` no viewport.
- Validação no navegador (Playwright, backend local desta branch na porta 8175 e o Postgres do Docker),
  coleta e entrega a 15 m com um container de 3 m no meio; capturas em
  `docs/assets/screenshots/leva-f/task-075-*.png`.

## 3. Arquivos modificados

`git status --short` no fim: ver o PR. Fora do escopo estrito (necessário ao contrato da leva F): a
entidade `Scenario` e o cliente de cenários ganharam `cargo`/`delivery` (a TASK-073 ainda não estava
na `development`); `buildCraneScene.ts`/`mountCraneScene.ts`/`CraneViewport.tsx` ganharam os marcadores
e `hookAttachOffsetM`.

## 4. Comandos executados e resultados

| Comando | Resultado | Saída (resumo) |
|---------|-----------|----------------|
| `uv run ruff check . && uv run ruff format --check .` | ✅ | `All checks passed!`, `293 files already formatted` |
| `uv run mypy app` | ✅ | `no issues found in 157 source files` |
| `uv run lint-imports` | ✅ | `3 kept, 0 broken` |
| `uv run pytest` | ✅ | passou (integração com Postgres pulada, como sem Docker no CI local) |
| `npm run lint`, `format:check`, `typecheck` | ✅ | sem erros |
| `npm test` | ✅ | `93 passed, 857 tests` (uma vez `tablesPage.test.tsx` falhou sob carga e passou isolado e na rodada seguinte) |
| `npm run build` | ✅ | `built` |
| `npm run e2e` | ✅ | `15 passed, 11 skipped` (sem backend, como o padrão local) |

## 5. Decisões tomadas

- Sentido do giro por menor tempo (giro + subida extra), não "o mais curto que não cruze": ver ADR-038.
- O corpo do guindaste (medidas do GLB 80 t) é obstáculo do planejamento; sem isso a carga passava pela
  cabine e a guarda de colisão da cena cortava o movimento.
- `hook_attach_m` (opcional) vem da cena: o gancho do modelo desce ~1,97 m abaixo de G, e o padrão de
  1,05 m deixava a carga encostar no chão antes do fim.
- Contratos aditivos: `details[].manufacturer_id/crane_id`, `valid`, `summary`, `notes` de topo,
  `load.cg_offset_m`, `pick/delivery.rotation_y_deg`, `hook_attach_m`.

## 6. Regras de negócio aplicadas

RN-004 (capacidade só da tabela), RN-008 (backend decide), RN-011 (limite), RN-013 (risco), RN-015
(inclinação, vento e solo). Nenhuma regra nova de negócio.

## 7. O que NÃO foi feito e por quê

- Os dois guindastes do tandem não são animados juntos na cena (o contrato `cranes` da TASK-074 não
  está nesta branch); a tela anima o primeiro e mostra a posição do segundo nas notas.
- Gravação da execução (`pode virar gravação`): não ligada; a execução só anima.
- Testes de componente do `PlanningPanel`/`PlanningSection` e da animação (rAF): fora desta entrega.
- IA (TASK-076) não participa: nada aqui depende dela.

## 8. Pendências / decisões necessárias

| # | Pergunta | Bloqueia? |
|---|----------|-----------|
| 1 | O sentido do giro por menor tempo atende ("o mais curto que não cruze obstáculo")? | não |
| 2 | Com o contrato `cranes` da TASK-074, ligar a animação dos dois guindastes do tandem. | não |

## 10. Próximo passo

**Papel:** Revisor. Ler `ADR-038`, `backend/app/domain/services/planning/planner.py` e
`frontend/src/app/planning/PlanningSection.tsx`.

**Cuidado com:** a cópia de terreno/solo em Python precisa acompanhar `environment.ts` (os testes
de paridade avisam); as medidas do corpo do guindaste (`crane_body.py`) são do GLB 80 t.

## 11. Como revisar

- Mais arriscado: a escolha do sentido do giro e da altura de transporte, e o descarte por corpo do
  guindaste (`_site_at`, `_swings`).
- Menos certeza: o tandem (aproximação de duas trajetórias independentes).
