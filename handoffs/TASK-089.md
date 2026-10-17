# Handoff — TASK-089 — implementação

| Campo | Valor |
|-------|-------|
| **Data/hora** | 2026-10-17 (UTC-3, Brasília) |
| **Tarefa** | `tasks/in-progress/TASK-089-planejador-zonas-tandem.md` |
| **Etapa concluída** | implementação |
| **Papel exercido** | Planejador, Engenheiro de testes e Implementador (a mesma sessão; a revisão fica para outra) |
| **Ferramenta/agente** | Claude Code (Opus 5.5), agente em worktree `C:\dev\JA-Guindastes-wt\fisica` |
| **Branch** | `task/TASK-089-planejador-zonas-tandem`, empilhada sobre `task/TASK-088-planejador-caminho` @ `c775a67` (que já tem `anderson/development` @ `d493879`) |

## 1. Objetivo desta etapa

Corrigir no planejador os achados F-06 (fronteira de zona), F-18 (rumo e sentido), F-28 (busca
cortada sem aviso), F-04 (pares de tandem impossíveis) e F-03 (CG e pontos de içamento).

## 2. O que foi feito

- **F-06** — `planner.py`: `_boundary_states` acrescenta, à avaliação da opção e do plano, o giro
  logo antes e logo depois (±0,001°) de cada fronteira de zona atravessada entre dois quadros-chave,
  no estado interpolado como a cena (L, θ, ψ e c em linha reta), então com o raio de lá.
  `PlannerCrane.zone_boundaries_deg` vem das zonas da configuração (`_zone_boundaries` no caso de uso).
- **F-18** — `_sites` devolve todos os rumos viáveis de cada posição; `_routes` junta rumos e os dois
  sentidos, do mais rápido ao mais lento; `plan_crane` fica com o primeiro que atende (válidas
  primeiro, o tempo só desempata) e, se nenhum atende, com o mais rápido. Sem zonas de giro, rumos
  com o mesmo sentido, a mesma altura de transporte e o mesmo chão dão a mesma avaliação (ψ só entra
  na avaliação pelas zonas e pelo limite de giro), e só o primeiro é avaliado.
- **F-28** — `PlanningResult.timed_out` (qualquer busca que parou no orçamento) e o campo
  `timed_out` da resposta de `POST /api/v1/planning/recommend`. No frontend, o cliente lê o campo
  (ausente = busca completa) e o painel "Planejar operação" mostra o aviso "A busca parou no tempo
  limite: pode haver uma opção melhor que não foi avaliada."
- **F-04** — `crane_bodies_overlap` (`crane_body.py`, teste exato entre os dois retângulos) e
  `_impossible_pair` no caso de uso: o par com os corpos sobrepostos ou com giros em sentidos opostos
  é recusado, com a nota "Pares de guindastes descartados para o tandem: ...". Cada lado guarda até
  6 planos por configuração (`TANDEM_PLANS_PER_SIDE`, eram 3).
- **F-03 (a)** — `SimulatorRoute.tsx` (só o trecho do `PlanningSection`) passa o CG da Carga ao longo
  do comprimento como `cgOffsetM`; `planningRestClient.ts` o manda como `cg_offset_m`.
- **F-03 (b)** — `HOIST_POINT_FRACTION = 0,25` (`tandem.py`): pontos a 1/4 e 3/4, como a cena.
  Criei o `docs/decisions/ADR-041-pontos-de-icamento-do-tandem.md` com status **Aceito** (decisão da
  pessoa responsável em chat em 2026-10-16, repassada pelo coordenador) e a linha no índice.
- Testes novos: `backend/tests/application/test_recommend_lift_plan_zonas_tandem.py` (11),
  `test_pior_ponto_na_fronteira_de_zona_entre_dois_quadros_chave` em `test_planner.py`,
  `test_busca_cortada_pelo_tempo_vem_marcada` em `tests/presentation/test_planning.py`, o fixture
  `backend/tests/fixtures/planejamento_zonas_ficticio.py` (zonas FICTÍCIAS); no frontend, 2 testes
  em `planningRestClient.test.ts` e `frontend/tests/presentation/simulator/planningPanel.test.tsx` (2).
- Verifiquei que os testes pegam os bugs: no código da TASK-088 o caso F-18 dá `valid=False`, 189,7 %
  (agora `valid=True`, 75,9 %); com `_boundary_states` desligado, o teste de fronteira falha (plano
  36,60 % contra 36,62 % na trajetória executada).
- Os três testes de tandem antigos (`test_recommend_lift_plan.py` e `test_planning.py`) usavam a
  carga de 3 m entre dois guindastes de frente um para o outro, girando em sentidos opostos: o par
  que o F-04 recusa. Passaram a usar uma viga FICTÍCIA de 16 m, levada 4 m em X, em que os dois
  guindastes ficam em linha e giram no mesmo sentido (+19°), com o que cada teste afirmava antes.

## 3. Arquivos modificados

`git diff --stat task/TASK-088-planejador-caminho...HEAD` (antes do commit dos documentos):

```text
 .../application/use_cases/recommend_lift_plan.py   | 109 +++++++++-
 backend/app/domain/services/planning/crane_body.py |  36 ++++
 backend/app/domain/services/planning/models.py     |   3 +
 backend/app/domain/services/planning/planner.py    | 133 +++++++++---
 backend/app/domain/services/planning/tandem.py     |   5 +-
 backend/app/presentation/api/planning.py           |   7 +-
 .../tests/application/test_recommend_lift_plan.py  |  19 +-
 .../test_recommend_lift_plan_zonas_tandem.py       | 240 +++++++++++++++++++++
 .../tests/domain/services/planning/test_planner.py |  73 +++++++
 .../tests/fixtures/planejamento_zonas_ficticio.py  | 127 +++++++++++
 backend/tests/presentation/test_planning.py        |  20 +-
 frontend/src/app/planning/PlanningSection.tsx      |   3 +
 frontend/src/app/routes/SimulatorRoute.tsx         |   3 +
 frontend/src/domain/planning/planning.ts           |   4 +
 .../src/infrastructure/api/planningRestClient.ts   |  10 +
 .../src/presentation/simulator/PlanningPanel.tsx   |   5 +
 .../infrastructure/planningRestClient.test.ts      |  21 ++
 .../presentation/simulator/planningPanel.test.tsx  |  72 +++++++
 .../TASK-089-planejador-zonas-tandem.md            |  12 ++
 19 files changed, 859 insertions(+), 43 deletions(-)
```

Mais, no commit dos documentos: `docs/decisions/ADR-041-pontos-de-icamento-do-tandem.md`,
`docs/decisions/README.md` (uma linha) e este handoff.

Fora do escopo: nenhum. Em `SimulatorRoute.tsx`, só o trecho do `PlanningSection` (3 linhas).

## 4. Comandos executados e resultados

Backend (`backend/`, com a TASK-088 @ `c775a67` mesclada):

| Comando | Resultado | Saída (resumo) |
|---------|-----------|----------------|
| `uv run ruff check .` | ✅ | `All checks passed!` |
| `uv run ruff format --check .` | ✅ | `330 files already formatted` |
| `uv run mypy app` | ✅ | `Success: no issues found in 176 source files` |
| `uv run lint-imports` | ✅ | `Contracts: 3 kept, 0 broken.` |
| `uv run pytest` | ✅ | `1860 passed, 88 skipped in 41.04s` (TASK-088 mesclada: `1847 passed`) |

Frontend (`frontend/`, depois de `npm ci`):

| Comando | Resultado | Saída (resumo) |
|---------|-----------|----------------|
| `npm run lint` | ✅ | `eslint .` sem erros |
| `npm run format:check` | ✅ | `All matched files use Prettier code style!` |
| `npm run typecheck` | ✅ | `tsc -b && tsc -p e2e` sem erros |
| `npm test` | ✅ | `Test Files 132 passed (132)`, `Tests 1172 passed \| 1 skipped (1173)` |
| `npm run build` | ✅ | `✓ built`; aviso "Some chunks are larger than 500 kB" (`index-*.js` 552,49 kB). **Já existia** sem as mudanças desta tarefa (552,06 kB, conferido com `git stash`) |
| `npm run e2e` | ⚠️ NÃO EXECUTADO | fora do pedido; sem stack local |
| `bash scripts/check-structure.sh` (na raiz) | ✅ | `OK: 0 erros, 1 aviso(s)` — "há 10 tarefas em tasks/in-progress/" (frentes paralelas) |

Tempo de `RecommendLiftPlan.execute` (FICTÍCIO; scripts fora do repositório; mediana de 7
execuções, 2ª de duas rodadas alternadas; orçamento 2,5 s):

| Caso | Base `784a9e1` | TASK-088 (`c775a67`) | TASK-089 |
|------|----------------|----------------------|----------|
| 2000 kg, container, 1 configuração | 0,061 s | 0,024 s | 0,026 s |
| 6000 kg, container, tandem | 0,190 s | 0,081 s | 0,092 s |
| 40 000 kg, nada atende | 0,185 s | 0,082 s | 0,096 s |
| 9000 kg, com o guindaste grande | 0,122 s | 0,054 s | 0,061 s |
| 6000 + 40 000 kg com o grande | 0,504 s | 0,221 s | 0,252 s |
| cenário cheio, 6000 kg | 0,397 s | 0,160 s | 0,142 s |
| zonas, 40 000 kg (nada atende; todos os rumos) | — | 0,074 s | 0,391 s |
| viga de 16 m, 4000 kg (tandem válido) | — | 0,116 s | 0,257 s |

A TASK-089 fica um pouco mais lenta que a TASK-088 (todos os rumos e sentidos, 6 planos por lado no
tandem); o pior caso medido é o guindaste com zonas quando nada atende (0,39 s).

## 5. Decisões tomadas

- F-18: chave (válida?, tempo): entre as rotas de uma posição, a primeira válida na ordem de tempo;
  sem válida, a mais rápida (como antes). Entre posições, continua a menor utilização (ADR-038).
- F-18: deduplicar rumos equivalentes sem zonas, para o custo não multiplicar por quatro.
- F-06: ±0,001° em volta da fronteira; na fronteira exata (±1e-6) a avaliação já usa a menor das
  duas zonas, então os dois lados ficam cobertos.
- F-04: giro com menos de 0,5° não tem sentido e não recusa o par. O critério de corpos usa o
  retângulo do `crane_body.py` (exato), não as amostras de 1 m.
- F-28: `timed_out` ausente na resposta é lido como `false` (servidor anterior à mudança).
- ADR-041 Aceito (decisão da pessoa responsável); não é pendência.

## 6. Regras de negócio aplicadas

- RN-016 (tandem: alavanca do CG e 75 % por guindaste): o CG da tela agora chega ao planejador, e os
  pontos de içamento são os da cena (ADR-041).
- RN-009 (zona de giro): o pior ponto de cada zona atravessada entra no plano.

## 7. O que NÃO foi feito e por quê

- Tandem completo (trajetória da carga e os dois guindastes derivados dela, com a distância entre os
  ganchos fixa): fora do escopo, só a correção mínima. Mesmo no mesmo sentido, os dois guindastes
  giram em volta de eixos diferentes, e a distância entre os ganchos ainda muda um pouco no caminho.
- Com a recusa dos pares impossíveis, cargas curtas entre dois guindastes de frente um para o outro
  deixam de ter tandem: no fixture, só cargas longas (viga de 16 m) têm par compatível.
- Achados da revisão do PR #48 (TASK-088) que afetam esta tarefa e que, por instrução do
  coordenador, **não** foram tocados aqui: a carga dentro do "barracao-aberto" é recusada (o galpão
  é um prisma cheio); falso positivo do cabo contra a carreta com carga baixa na entrega; altura da
  carroceria do caminhão da biblioteca. As correções da TASK-088 entram nesta branch depois, por
  merge do coordenador.
- O orçamento de 2,5 s continua único para todas as configurações (a auditoria cita isso no F-28);
  só o aviso foi feito.
- E2E NÃO EXECUTADO.

## 8. Pendências / decisões necessárias (para a pessoa responsável)

| # | Pergunta | Bloqueia? | Resposta | Respondida em |
|---|----------|-----------|----------|---------------|
| 1 | Aceitar que cargas curtas entre dois guindastes de frente um para o outro fiquem sem tandem até o "tandem completo" (auditoria § 4)? | não | | |
| 2 | Dividir o orçamento de 2,5 s por configuração (hoje é um só para tudo, na ordem do catálogo)? | não | | |

## 9. ⚠️ Segurança

- nada a relatar

## 10. Próximo passo

**Papel:** Revisor (outra sessão ou ferramenta)

**O que fazer, concretamente:**
1. Revisar o PR da TASK-089 (empilhado sobre o da TASK-088) com `docs/templates/code-review-template.md`.
2. Depois que as correções da TASK-088 entrarem, mesclar a branch dela nesta e rodar as verificações.

**Ler primeiro (nesta ordem):**
1. `AGENTS.md`
2. este handoff e o `handoffs/TASK-088.md`
3. `docs/decisions/ADR-041-pontos-de-icamento-do-tandem.md`
4. `backend/app/domain/services/planning/planner.py` (`_routes`, `_boundary_states`, `plan_crane`)
5. `backend/app/application/use_cases/recommend_lift_plan.py` (`_impossible_pair`, `tracked`)

**Cuidado com:**
- O diff do PR é contra a TASK-088, não contra a `development`.

## 11. Como revisar este trabalho

- Comece por `_routes` e pelo laço de `plan_crane`: a deduplicação sem zonas assume que ψ só entra
  na avaliação pelas zonas e pelo limite de giro (verifiquei em `evaluate_operation.py` e
  `geometry_service.py`; o avaliador é injetado, então outro avaliador poderia usar ψ).
- `_boundary_states` trata ψ contínuo (pode passar de ±180°): a fronteira é procurada em todas as
  voltas dentro do trecho.
- `test_o_pior_ponto_na_fronteira_de_zona_entra_no_plano` (caso de uso) passa também no código antigo,
  porque a busca escolhe posições sem o problema; a prova do F-06 é o teste de domínio em
  `test_planner.py`, com o giro limitado.
