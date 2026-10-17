# Handoff — TASK-094 — implementação

| Campo | Valor |
|-------|-------|
| **Data/hora** | 2026-10-16 23:45 (UTC-3) |
| **Tarefa** | `tasks/in-progress/TASK-094-nivelamento-area-ia.md` |
| **Etapa concluída** | implementação |
| **Papel exercido** | Implementador (também escrevi os testes; não houve Planejador nem Revisor separados) |
| **Ferramenta/agente** | Claude Code (Opus 5.5), em worktree `C:\dev\JA-Guindastes-wt\avaliacao` |
| **Branch** | `task/TASK-094-nivelamento-area-ia`, criada de `development` @ 784a9e1 |

Origem: achados F-12, F-14, F-15 e F-29 da auditoria de 2026-10-16. Na auditoria, o pacote aparece
como "TASK-093"; a pessoa responsável numerou esta frente como TASK-094.

## O que foi feito

- **F-12, inclinação residual** (CA-1). `residualGroundSlopeDeg(terreno, patolas)` em
  `frontend/src/app/evaluationInput.ts` usa `residualSlopeDeg` (que não tinha uso em produção),
  arredonda a 0,01° e devolve `undefined` com terreno plano. `SimulatorRoute.tsx` manda esse valor a
  `buildEvaluationInput`, e `outriggers.levelingDeg` entrou nas dependências do `useEffect` que
  reenvia a avaliação. O painel "Ambiente" continua mostrando a inclinação bruta do terreno.
  Conferi a área de operação e a gravação: nenhuma delas manda inclinação (a gravação guarda as
  patolas inteiras e o resultado), então não mudaram nisso.
- **F-15, acessórios na área de operação** (CA-2). `ComputeOperatingArea` recebe
  `accessory_provider` e `accessory_ids`, resolve na ordem e com repetições, como
  `EvaluateOperation._resolve_accessories`, e soma com `weight_compared_with_capacity`. Um id
  desconhecido (ou ids sem catálogo) levanta `OperatingAreaInvalidInputError`: a rota responde 422
  com `acessório não encontrado: '<id>'`, a mesma mensagem do planejamento. A rota aceita
  `accessory_ids` (até 20 ids de 1 a 64 caracteres, os tipos de `evaluation_schemas.py`).
  `app/main.py` liga o `SqlAlchemyAccessoryRepository`. No frontend, `useOperatingArea` recebe
  `accessoryIds` (eles entram na chave do pedido) e o cliente manda `accessory_ids` quando a lista
  não está vazia.
- **F-14, layout seguro da IA** (CA-3). `scenario_layout.py`: a carga tem largura em X local e
  comprimento em Z local, como a cena. A zona do guindaste usa `BODY_MIN/MAX_X/Z_M` de
  `planning/crane_body.py` (só importado, sem alteração) mais `CRANE_MARGIN_M = 1,0 m`
  (FICTÍCIO), com o centro deslocado para o meio do corpo (Z +2,045 m) e girado pelo rumo. O
  docstring foi corrigido.
- **F-29, docstrings** (CA-4). `compute_operating_area.py`, `evaluate_operation.py`, `main.py`
  (docstring de `load_chart_interpolator`), `load_chart_interpolator.py` e as descrições OpenAPI de
  `POST /evaluations` e `POST /operating-area` passam a citar a `LinearInterpolationLookup` do
  ADR-030.

## Arquivos modificados

`git diff --stat 784a9e1..HEAD` (antes do commit deste handoff): 20 arquivos, +454 −55.

- backend: `compute_operating_area.py`, `evaluate_operation.py`, `load_chart_interpolator.py`,
  `scenario_layout.py`, `main.py`, `api/evaluations.py`, `api/operating_area.py`; testes
  `test_operating_area.py`, `test_scenario_layout.py`, `test_ai_assistant.py`, `test_ai.py`
- frontend: `app/evaluationInput.ts`, `app/routes/SimulatorRoute.tsx` (só o trecho de
  `buildEvaluationInput`, as dependências do `useEffect`, a chamada de `useOperatingArea` e o
  import), `app/useOperatingArea.ts`, `domain/evaluation/operatingArea.ts`,
  `infrastructure/api/operatingAreaRestClient.ts`; testes `evaluationInput.test.ts`,
  `useOperatingArea.test.tsx`, `operatingAreaRestClient.test.ts`
- `tasks/in-progress/TASK-094-nivelamento-area-ia.md` e este handoff

Fora do escopo pedido, com motivo:
- `api/evaluations.py` e `load_chart_interpolator.py`: tinham o mesmo texto desatualizado do F-29
  ("na composição, a `ConservativeTabulatedLookup`"). Só mudou texto.
- `test_ai_assistant.py` e `test_ai.py`: o cenário FICTÍCIO de `tests/fixtures/ai_fakes.py` tem uma
  viga de 6 m em (12; 0) e uma parede em (12; 4). Com o comprimento em Z, a parede fica a 0,85 m da
  ponta, dentro da folga de 1,5 m, e passa a ser movida para (12; 5). Os dois testes agora esperam
  essa suposição a mais. É a correção do F-14 aparecendo, não uma regressão.

## Testes novos

- `backend/tests/domain/services/test_scenario_layout.py`: comprimento em Z (caixa em (0; 4,5) sai),
  folga ao lado da largura (caixa em (4,5; 0) fica), zona girada com a carga (90°), carro na frente
  da cabine com rumo 0°, 90° e 180° sai e deixa de encostar no `crane_body` do planejador, e carro
  logo depois da folga fica. O teste antigo do carro sobre o guindaste passou a conferir o corpo
  mais a folga.
- `backend/tests/presentation/test_operating_area.py`: acessórios somam ao peso (1700 → 1935 kg, a
  célula vai de GREEN a YELLOW), moitão leva a célula de YELLOW a RED, id repetido soma duas vezes,
  id desconhecido dá 422 com o id, ids sem catálogo dão 422, e ids malformados (vazio, 65
  caracteres, 21 ids, string em vez de lista) dão 422.
- `frontend/tests/app/evaluationInput.test.ts`: o caso da auditoria (2° de terreno com 3° de
  nivelamento dá 0°), 4° − 3° = 1°, macacos recolhidos ficam com a bruta, terreno plano fica
  `undefined`, o arredondamento e o residual 0° indo ao backend.
- `frontend/tests/app/useOperatingArea.test.tsx`: os acessórios vão no pedido; um array novo com o
  mesmo conteúdo não pede de novo; trocar a cadeia pede de novo.
- `frontend/tests/infrastructure/api/operatingAreaRestClient.test.ts`: `accessory_ids` vai no corpo
  (com repetição) e a lista vazia é omitida.

## Comandos executados e resultados

| Comando | Resultado | Saída (resumo) |
|---------|-----------|----------------|
| `uv run ruff check .` (backend) | ✅ | `All checks passed!` |
| `uv run ruff format --check .` | ✅ | `320 files already formatted` |
| `uv run mypy app` | ✅ | `Success: no issues found in 174 source files` |
| `uv run lint-imports` | ✅ | `Contracts: 3 kept, 0 broken.` |
| `uv run pytest` | ✅ | `1769 passed, 88 skipped in 59.34s` (skips: integração sem PostgreSQL) |
| `npm ci` (frontend, uma vez) | ✅ | concluído, exit 0 (avisos de `npm audit`) |
| `npm run lint` | ✅ | `eslint .` sem erros |
| `npm run format:check` | ❌ (problema anterior) | `Code style issues found in 6 files`: seis `.module.css` (`SimulatorPage`, `BackendEvaluationPanel`, `panels`, `CargoOperationPanel`, `RecordingPanel`, `TandemHud`) sem quebra de linha no fim. Eles já estão assim em 784a9e1, e esta branch não os toca. `npx prettier --check` só nos arquivos alterados: `All matched files use Prettier code style!` |
| `npm run typecheck` | ✅ | `tsc -b && tsc -p e2e` sem erros |
| `npm test` | ✅ | `Test Files 121 passed (121)`, `Tests 1073 passed \| 1 skipped (1074)` |
| `npm run build` | ✅ | `✓ built in 1.77s`, com o aviso de chunk > 500 kB que já existia (`index` 543 kB) |
| `bash scripts/check-structure.sh` | ❌ (problemas anteriores) | antes deste handoff: 18 tarefas em `tasks/in-progress/` (máx. 15; já eram 17 na base), TASK-080 sem handoff e TASK-094 sem handoff. Este arquivo resolve o último item |
| sonda `p7_layout.py` da auditoria (`uv run python`, apontada para esta worktree) | ✅ | na base: caixa "movida? False", carro "movido? False" e sobrepondo o corpo; depois: caixa movida para (0; 8,5), carro movido e sem sobrepor o `crane_body` |

## Decisões tomadas

- Folga do guindaste: **1,0 m, FICTÍCIA** (ADR-012). Com ela, a largura fica em 8,2 m, perto dos
  8 m antigos, e a zona vai de −6,13 a +10,22 m em Z. Não é regra de negócio, é margem de layout;
  não abri ADR.
- Acessório desconhecido na área de operação responde **422**, e não "grade toda vermelha". A
  grade não tem estado "não avaliável", e a TASK pedia erro claro. A mensagem é a mesma do
  planejamento.
- `residualGroundSlopeDeg` ficou em `app/evaluationInput.ts`, e não em `domain/crane/outriggers.ts`,
  para não mexer num arquivo de patolas que outra frente pode editar. Ela só envolve
  `residualSlopeDeg`.
- A inclinação usa o estado **comandado** das patolas, como a extensão e os macacos já usavam (a
  animação leva até 6,5 s; isso é o F-27, de outra frente).

## O que NÃO foi feito

- A área de operação ainda não recebe inclinação nem vento da tela. O backend aceita
  `ground_slope_deg` e `wind_speed_ms` desde a TASK-067, mas `useOperatingArea` nunca os mandou.
  Fiquei no pedido ("se mandam inclinação, use o residual"); ver a pendência 1.
- Não há teste de componente do `SimulatorRoute` para o valor enviado depois de "Apoiar e
  nivelar". O teste cobre a função pura (ver "Testes a escrever depois" na tarefa).
- Não corrigi os seis CSS do `format:check` nem o limite de 15 tarefas do `check-structure.sh`.
  Os dois já falhavam na base e estão fora do escopo.
- Testes E2E (`npm run e2e`): NÃO EXECUTADO, não estavam na lista de verificação pedida.
- Nenhuma revisão independente foi feita (AGENTS.md § 3).

## Pendências / decisões necessárias

| # | Pergunta | Bloqueia? | Resposta | Respondida em |
|---|----------|-----------|----------|---------------|
| 1 | A tela deve mandar a inclinação residual e o vento também à área de operação (RN-015: o ambiente sempre conta)? Hoje o mapa ignora os dois, e o painel não | não | | |
| 2 | Folga de 1 m em volta do corpo do guindaste no layout da IA: serve? | não | | |
| 3 | Há 18 tarefas em `tasks/in-progress/` (o limite é 15); as já mergeadas (TASK-081..087) podem ir para `completed/`? | não (o CI acusa) | | |

## Próximo passo

**Papel:** Revisor (outra sessão ou ferramenta), depois a pessoa responsável faz o merge.

1. Ler este handoff e `git diff development...task/TASK-094-nivelamento-area-ia`.
2. Começar por `backend/app/domain/services/scenario_layout.py` (convenção dos eixos e o centro
   deslocado da zona do guindaste) e por `compute_operating_area.py` (`_resolve_accessories`).
3. Conferir no `SimulatorRoute.tsx` que só os trechos da avaliação, do `useEffect` e da área de
   operação mudaram (outras frentes editam o tandem, o planejamento e as patolas).

**Cuidado com:** a mudança do F-14 move obstáculos que antes passavam (como a parede do cenário de
exemplo). Rascunhos da IA podem trazer uma suposição "movido" a mais.
