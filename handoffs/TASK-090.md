# Handoff — TASK-090 — tandem avaliado com ambiente, acessórios e gancho no ponto

| Campo | Valor |
|-------|-------|
| **Data/hora** | 2026-10-16 23:50 (UTC-3) |
| **Tarefa** | `tasks/in-progress/TASK-090-tandem-ambiente.md` |
| **Etapa concluída** | implementação |
| **Papel exercido** | Implementador (também escrevi os testes; revisão independente pendente) |
| **Ferramenta/agente** | Claude Code (Opus 5.5) |
| **Branch** | `task/TASK-090-tandem-ambiente`, de `anderson/development` @ `784a9e1` |

Achados F-05 e F-16 da auditoria de 2026-10-16.

## O que foi feito

- **Backend (F-05)**
  - `POST /evaluations/tandem` aceita, por guindaste, `outriggers`, `ground_slope_deg`, `accessory_ids`, `soil_kinds` e `obstacle_conflicts`, com os tipos da avaliação individual. `wind_speed_ms` vale para os dois. `EvaluateTandem` repassa tudo ao `EvaluateOperation`. Sem esses campos, o resultado é o mesmo de antes.
  - `domain/services/tandem_hook_alignment.py` põe o gancho no mundo: posição + rumo + `geometry.hook` do estado. A conta é a mesma de `localToWorld` no frontend (rumo como `rotation.y`).
  - Com o gancho a mais de `TANDEM_HOOK_POINT_TOLERANCE_M` = 0,5 m (FICTÍCIO) do `hook_point`, a resposta traz o alerta CRITICAL `TANDEM_HOOK_OFF_POINT` e `tandem_ok = false`.
- **Frontend (F-05)**
  - `app/tandemInput.ts` (`buildTandemInput`): o guindaste 1 vai com o mesmo ambiente e os mesmos acessórios da avaliação individual (`input` de `buildEvaluationInput`).
  - O guindaste 2 vai com inclinação, solo e obstáculos da posição dele, e com as patolas que a cena desenha (100 %, apoiadas).
  - O vento é comum aos dois.
  - `hook_point` agora é o ponto de içamento da carga içada. Antes era a posição do gancho, e assim o prumo nunca podia falhar.
  - `SimulatorRoute.tsx`: mudou só o trecho do tandem. Um tandem com `tandemOk = false` não pinta mais a cena de verde.
- **Frontend (F-16)**
  - `TandemLoad.hookDropsM` guarda a distância de G até o engate de cada gancho (engate do gancho em uso + cadeia de acessórios).
  - Altura de engate = chão + carga + lingas (1,5 m) + essa distância.
  - No quadro, as lingas dos dois guindastes saem da mesma altura, e a carga pende do fim do gancho de quem conduz.
  - `TandemCargo` desenha as lingas a partir do fim do gancho.
  - `three/scene/tandemRigging.ts` (`withLiveHookDrops`) lê `currentAttachOffsetM` e `currentAccessoriesDropM` de cada `HookLoad` na hora do cálculo, com um getter. `mountCraneScene.setTandemCargo` usa esse helper. `MultiCrane.ts` e `HookLoad.ts` não foram editados.

## Arquivos (`git diff --stat 784a9e1...HEAD`, antes deste handoff)

```text
 backend/app/application/use_cases/evaluate_tandem.py   |  84 ++++++-
 backend/app/domain/services/tandem_hook_alignment.py   |  41 ++++
 backend/app/presentation/api/evaluation_schemas.py     |   3 +
 backend/app/presentation/api/tandem.py                 |  74 +++++-
 backend/tests/application/test_evaluate_tandem.py      | 127 ++++++++
 backend/tests/domain/test_tandem_hook_alignment.py     |  65 ++++
 backend/tests/presentation/test_evaluations_tandem.py  |  10 +-
 backend/tests/presentation/test_evaluations_tandem_environment.py | 254 ++++++++++++
 frontend/src/app/routes/SimulatorRoute.tsx             |  41 ++--
 frontend/src/app/tandemInput.ts                        | 124 ++++++++
 frontend/src/domain/tandem/tandem.ts                   |  78 ++++-
 frontend/src/domain/tandem/tandemEvaluation.ts         |  20 +-
 frontend/src/infrastructure/api/tandemRestClient.ts    |  34 ++-
 frontend/src/three/scene/TandemCargo.ts                |  10 +-
 frontend/src/three/scene/mountCraneScene.ts            |  11 +-
 frontend/src/three/scene/tandemRigging.ts              |  35 +++
 frontend/tests/app/tandemInput.test.ts                 | 138 ++++++++
 frontend/tests/domain/tandem/tandem.test.ts            |  81 ++++-
 frontend/tests/helpers/craneGlb.ts                     |   7 +-
 frontend/tests/infrastructure/api/tandemRestClient.test.ts |  37 +++
 frontend/tests/three/scene/tandemRigging.test.ts       | 129 ++++++++
 tasks/in-progress/TASK-090-tandem-ambiente.md          |  17 ++
 22 files changed, 1365 insertions(+), 55 deletions(-)
```

Mudanças fora do caminho óbvio, com o motivo:

- `evaluation_schemas.py`: só ganhou o alias `ObstacleConflictId` e `MAX_OBSTACLE_CONFLICTS`, para o tandem reaproveitar o tipo. `EvaluationRequest` ficou como estava, para não conflitar com a TASK-094.
- `tests/helpers/craneGlb.ts`: o caminho do GLB agora sai de `dirname(fileURLToPath(import.meta.url))`. No jsdom, o `URL` global é o do jsdom, e o `fileURLToPath` recusava. O teste do GLB com a `MultiCrane` precisa do jsdom.
- `test_evaluations_tandem.py`: os dois guindastes estavam na origem, com o gancho longe dos pontos de içamento. Agora cada um fica a 11,5 m do ponto dele. As asserções não mudaram.

## Comandos e saída real (resumo)

| Comando | Resultado |
|---------|-----------|
| backend `uv run ruff check .` | `All checks passed!` |
| backend `uv run ruff format --check .` | `324 files already formatted` |
| backend `uv run mypy app` | `Success: no issues found in 175 source files` |
| backend `uv run lint-imports` | `Contracts: 3 kept, 0 broken.` |
| backend `uv run pytest` | `1785 passed, 88 skipped in 51.60s` (os 88 pulados são de integração, sem PostgreSQL local) |
| frontend `npm ci` | exit 0 |
| frontend `npm run lint` | sem erros |
| frontend `npm run format:check` | ❌ `Code style issues found in 6 files`. Os 6 são `.module.css` que não toquei e que estão sem quebra de linha no fim já na base `784a9e1` (conferido com `git show 784a9e1:...`). Os arquivos desta tarefa passam: `npx prettier --check <arquivos alterados>` → `All matched files use Prettier code style!` |
| frontend `npm run typecheck` | sem erros |
| frontend `npm test` | `Test Files 123 passed (123)`, `Tests 1082 passed \| 1 skipped (1083)` |
| frontend `npm run build` | `✓ built in 1.18s` (o aviso de chunk acima de 500 kB já existia) |
| frontend `npm run e2e` (sem backend) | `16 passed`, `11 skipped`, ❌ `3 failed`: `collision.spec.ts:34`, `objetosReais.spec.ts:65` e `rotationZones.spec.ts:98`. As mesmas 3 falham na base `784a9e1`, rodadas numa worktree temporária (lá falhou também `rotationZones.spec.ts:135`). Nenhuma toca o tandem |
| `bash scripts/check-structure.sh` | ❌ antes deste handoff: 3 erros. Dois já existiam: 18 tarefas em `tasks/in-progress/` (máximo 15; já havia 17) e TASK-080 sem handoff. O terceiro era a falta deste handoff |
| `git merge-tree` contra TASK-088, 091, 092, 093, 094, 095 e 096 | sem conflito, depois de mudar o import de `buildTandemInput` de lugar (ele colava na linha que a TASK-094 muda) |
| árvore 090 + 093 numa worktree temporária: `npx vitest run` dos testes do tandem, `MultiCrane` e `HookLoad`, e `tsc -b` | `5 passed (5)`, `51 passed (51)`; tsc sem erros |
| mutação manual | rumo com o sinal trocado em `crane_point_to_world` → falham os testes de domínio e de rota. Sem a distância do gancho em `tandemFrame` → 6 testes do frontend falham, inclusive o do GLB |

Testes novos:

- backend: `tests/presentation/test_evaluations_tandem_environment.py` (patolas, vento, solo, inclinação, acessórios, obstáculos, gancho fora do ponto, tolerância, rumo e ψ ≠ 0 em 5 combinações, sinal do rumo trocado, 422), `tests/application/test_evaluate_tandem.py` (repasse ao `EvaluateOperation`, limite da tolerância) e `tests/domain/test_tandem_hook_alignment.py`. São 32 casos novos.
- frontend: `tests/three/scene/tandemRigging.test.ts` (GLB 80 t nos dois guindastes: moitão medido em 1,965 m e o fim dele 1,5 m acima do topo da carga, contra os 0,465 m de penetração de antes; lingas saindo do fim do moitão; cadeia de acessórios lida na hora), 5 casos novos em `tests/domain/tandem/tandem.test.ts`, `tests/app/tandemInput.test.ts` (6) e 1 caso em `tandemRestClient.test.ts`.

## Decisões

- **Acessórios por guindaste.** Cada gancho tem a própria cadeia, como diz a RN-014 para cada guindaste. A tela só tem a cadeia do guindaste 1: ela vai para o 1, e o 2 vai sem acessórios (pendência 1).
- **Vento comum, o resto por guindaste.** O vento é do local. Patolas, inclinação, solo e obstáculos dependem da posição de cada guindaste.
- **Guindaste 2 com patolas `{100 %, apoiadas}`.** É o que a `ExtraCrane` desenha (ADR-037). A inclinação vai bruta, porque o 2 não nivela (nivelamento 0).
- **Obstáculos do guindaste 2 só pelo raio.** O estado de colisão da tela mistura os guindastes, então não entra na conta do 2.
- **Gancho fora do ponto.** O cálculo usa a geometria que o próprio `EvaluateOperation` devolve. Sem geometria (sem ficha técnica ou fora das faixas), não há o que conferir, e o guindaste já sai como `TANDEM_NOT_EVALUABLE`. A tolerância de 0,5 m é FICTÍCIA.
- **Medida ausente.** Sem `hookDropsM` (ou com valor inválido), vale `HOOK_ATTACH_OFFSET_M` (1,05 m, o gancho provisório), o mesmo padrão do `computeLoadBox`.
- **Distância lida com getter.** A `MultiCrane` (que não podia ser editada) monta o `TandemSetup` a cada comando a partir de `tandem.load`. Com o getter, o engate, o quadro e a colisão usam a medida atual mesmo depois que o GLB de um guindaste chega.
- **Sem ADR novo.** As decisões são funcionais e completam o ADR-037 (Aceito, não editado). Registrar em ADR fica a critério da pessoa (pendência 4).

## Regras aplicadas

- RN-014: os acessórios do guindaste 1 entram no peso comparado dele. Teste: `test_acessorios_somam_so_no_gancho_do_guindaste_deles`.
- RN-015: patolas, inclinação, solo, vento e obstáculos mudam o resultado do tandem. Testes `test_patolas_*`, `test_vento_*`, `test_solo_*`, `test_inclinacao_*` e `test_obstaculo_*`.
- RN-016: cada guindaste é avaliado com a parte dele mais o gancho e os acessórios. A divisão pela alavanca não mudou.

## O que NÃO foi feito

- A cadeia de acessórios do guindaste 2 não existe na tela nem na cena (pendência 1).
- A correção do `HookLoad.currentAttachOffsetM` com o moitão trocado é da TASK-093. Até ela entrar, com o "Moitão de 4 polias" a distância do guindaste 1 sai 1,965 + 1,4 m em vez de 0,01 + 1,4 m, e a carga do tandem desce ~1,95 m a mais.
- Trocar a cadeia de acessórios com o tandem já engatado não refaz o quadro na hora: vale no próximo comando.
- A validação no navegador com backend e banco NÃO FOI EXECUTADA (sem Docker local, L-005).
- O e2e com backend NÃO FOI EXECUTADO.
- `docs/business-rules.md`, `handoffs/current.md` e o ADR-037 não foram editados, conforme as regras.

## Pendências (para a pessoa responsável)

| # | Pergunta | Bloqueia? |
|---|----------|-----------|
| 1 | O guindaste 2 deve ter a própria cadeia de acessórios na tela (e na cena)? Hoje ele vai sem acessórios | não |
| 2 | A tolerância de 0,5 m (FICTÍCIA) do gancho ao ponto de içamento serve? Há valor de norma? | não |
| 3 | No tandem, a altura das lingas é fixa em 1,5 m; no guindaste único, `slingDropM` usa metade do maior lado (0,6 a 3 m). Unificar? (ligado ao F-19) | não |
| 4 | Registrar em ADR novo o contrato do tandem com ambiente e o prumo do gancho? | não |

## Próximo passo

**Papel:** Revisor (outra sessão ou outra ferramenta), depois a pessoa responsável (merge).

1. Revisar `git diff 784a9e1...task/TASK-090-tandem-ambiente`.
2. Depois do merge da TASK-093, rodar `npx vitest run tests/three/scene/tandemRigging.test.ts` e conferir com o "Moitão de 4 polias" na cadeia.

**Ler primeiro:** este handoff, `backend/app/application/use_cases/evaluate_tandem.py`, `frontend/src/domain/tandem/tandem.ts`, `frontend/src/app/tandemInput.ts` e `frontend/src/three/scene/tandemRigging.ts`.

**Cuidado com:**
- `SimulatorRoute.tsx` também é editado por outras frentes (patolas, avaliação, planejamento, tela). Aqui só mudaram o bloco do tandem (cerca das linhas 524-566) e dois imports.
- O `getter` de `hookDropsM` some se alguém fizer `JSON.parse(JSON.stringify(load))` depois do `mountCraneScene`; hoje ninguém faz.
