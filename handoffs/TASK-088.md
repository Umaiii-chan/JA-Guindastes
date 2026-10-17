# Handoff — TASK-088 — implementação

| Campo | Valor |
|-------|-------|
| **Data/hora** | 2026-10-17 (UTC-3, Brasília) |
| **Tarefa** | `tasks/in-progress/TASK-088-planejador-caminho.md` |
| **Etapa concluída** | implementação |
| **Papel exercido** | Planejador, Engenheiro de testes e Implementador (a mesma sessão; a revisão fica para outra) |
| **Ferramenta/agente** | Claude Code (Opus 5.5), agente em worktree `C:\dev\JA-Guindastes-wt\fisica` |
| **Branch** | `task/TASK-088-planejador-caminho` (de `development` @ `784a9e1`, com `anderson/development` @ `a1c7754` mesclada) |

## 1. Objetivo desta etapa

Fazer o planejador conferir o caminho inteiro: giro denso (F-01), lança e cabo (F-02), coleta,
entrega e fases verticais (F-13), sem estourar o orçamento de 2,5 s.

## 2. O que foi feito

- Criei `backend/app/domain/services/planning/sweep.py`: giro em grade densa (até 0,25 m entre
  amostras no maior raio, teto de 1440 trechos) com margem de meio passo e pulo das amostras
  certamente longe; obstáculos cruzados pela carga, corpo do guindaste e pico do terreno no giro;
  pegada da carga na coleta (`pick_cover`) e na entrega (`delivery_surface`, `delivery_cover`);
  conferência da opção (`first_path_collision`): carga, cabo com gancho e lingas e lança em cada
  amostra do movimento como a cena o interpola, mais pose de partida, aproximação e poses de coleta
  e de entrega. Meias-medidas FICTÍCIAS nomeadas: `BOOM_HALF_SECTION_M = 0,6`,
  `HOOK_HALF_WIDTH_M = 0,3`.
- Alterei `planner.py`: as posições são avaliadas em ordem de raio máximo e a busca para nas 30
  primeiras livres (o mesmo resultado de antes, com menos trabalho); os sentidos do giro usam a grade
  densa; cada opção é conferida antes de ser aceita (a melhor que não bate em nada); coleta coberta e
  entrega bloqueada viram motivos `coleta` e `entrega`; a carga pousa no topo da carreta; a base da
  carga na coleta e na entrega segue `cargoBaseY`. Novos parâmetros de `plan_crane`: `cargo_pick` e
  `cargo_delivery` (no tandem, a carga inteira fica no centro dela, com o giro pedido).
- Alterei `terrain.py`: `cargo_base_y` (espelho de `cargoBaseY`), `feature_distance_m`,
  `feature_peak_near`, `terrain_peak_near` (limite superior do terreno num círculo).
- Alterei `trajectory.py`: `approach_states` (pose de partida e gancho acima da carga), usada pela
  trajetória e pela conferência, sem mudar a trajetória.
- Alterei `crane_body.py`: pré-filtro por círculos em `crane_body_overlaps_obstacle` (mesmo
  resultado; conferido em 40 000 casos aleatórios, 0 diferenças).
- Alterei `recommend_lift_plan.py`: recusa antes da busca, com o nome do obstáculo, quando a carga
  na coleta está sob ou dentro de um obstáculo, ou quando o ponto de entrega fica dentro de um que
  não é a carreta; textos dos novos descartes nas notas.
- Escrevi `backend/tests/domain/services/planning/test_sweep.py` (25 testes) e
  `backend/tests/application/test_recommend_lift_plan_caminho.py` (8 testes, a partir das provas
  p1, p2 e p8 da auditoria) e acrescentei 2 testes em `test_planner.py`. Os testes de regressão
  reproduzem a trajetória como `trajectoryPlayback.ts` (L, θ, ψ e c em linha reta entre quadros).
- Verifiquei que esses testes pegam os bugs: as mesmas conferências contra o código original
  (`git archive 784a9e1`) dão 55 quadros da carga dentro dos postes, 164 quadros da lança dentro do
  prédio, plano para a coleta no galpão e para a entrega no container, e a carga solta a 0,03 m (dentro
  da carreta de 1,3 m); no código novo, 0, 0, recusas com o nome e 1,33 m.
- Criei o `docs/decisions/ADR-042-conferencia-continua-do-plano.md` (Proposto) e a linha no índice.

## 3. Arquivos modificados

`git diff --stat anderson/development...HEAD` (antes do commit deste handoff):

```text
 .../application/use_cases/recommend_lift_plan.py   |  49 +-
 backend/app/domain/services/planning/crane_body.py |  17 +-
 backend/app/domain/services/planning/planner.py    | 427 +++++++++-----
 backend/app/domain/services/planning/sweep.py      | 651 +++++++++++++++++++++
 backend/app/domain/services/planning/terrain.py    | 110 ++++
 backend/app/domain/services/planning/trajectory.py |  33 +-
 .../test_recommend_lift_plan_caminho.py            | 270 +++++++++
 .../tests/domain/services/planning/test_planner.py |  37 ++
 .../tests/domain/services/planning/test_sweep.py   | 459 +++++++++++++++
 tasks/in-progress/TASK-088-planejador-caminho.md   |  12 +
 10 files changed, 1913 insertions(+), 152 deletions(-)
```

Mais, no commit deste handoff: `handoffs/TASK-088.md`, `docs/decisions/ADR-042-...md` e
`docs/decisions/README.md` (uma linha).

Fora do escopo: nenhum. `crane_body.py` mudou só no desempenho (sem mudar resultado), para a
conferência densa caber no orçamento.

## 4. Comandos executados e resultados

Em `backend/`, depois do merge de `anderson/development`:

| Comando | Resultado | Saída (resumo) |
|---------|-----------|----------------|
| `uv run ruff check .` | ✅ | `All checks passed!` |
| `uv run ruff format --check .` | ✅ | `323 files already formatted` |
| `uv run mypy app` | ✅ | `Success: no issues found in 175 source files` |
| `uv run lint-imports` | ✅ | `Contracts: 3 kept, 0 broken.` |
| `uv run pytest` | ✅ | `1788 passed, 88 skipped in 36.00s` (antes: `1753 passed, 88 skipped`) |
| `uv run pytest` (planejamento: `tests/domain/services/planning`, `test_recommend_lift_plan*.py`, `tests/presentation/test_planning.py`) | ✅ | `113 passed in 1.90s` |
| `bash scripts/check-structure.sh` (na raiz) | ✅ | `OK: 0 erros, 1 aviso(s)` — o aviso: "há 2 tarefas em tasks/in-progress/" (TASK-088 e TASK-097, sem arquivos em comum) |
| Frontend (`npm run lint`, `format:check`, `typecheck`, `test`, `build`) | ⚠️ NÃO EXECUTADO | a tarefa não muda o frontend |
| E2E (`npm run e2e`) | ⚠️ NÃO EXECUTADO | idem |

Provas da auditoria (`uv run python <script>` em `backend/`, scripts fora do repositório):

```text
p1 (poste entre amostras)   antes: valid True, 230 quadros com a carga dentro do poste
                            depois: 0 quadros (o giro vai pelo outro lado)
p2 (lança no prédio)        antes: lança dentro do prédio em ψ = 270°, a 8,27 m
                            depois: None (o giro vai pelo outro lado)
p8 (galpão e carreta)       antes: valid True, gancho a 2,50 m dentro do galpão de 6 m
                            depois: 0 recomendações, nota "A carga na coleta fica sob ou dentro de
                            «Galpão com frente aberta»: o gancho não chega a ela por cima. ..."
```

Tempo de `RecommendLiftPlan.execute` no fixture `planejamento_ficticio.py` (orçamento 2,5 s).
Script de medição fora do repositório; três rodadas alternadas, 7 execuções cada, o código original
exportado de `784a9e1`. Mediana da 2ª rodada (as três ficaram parecidas):

| Caso (FICTÍCIO) | Antes | Depois |
|-----------------|-------|--------|
| 2000 kg, container, 1 configuração | 0,061 s | 0,022 s |
| 6000 kg, container, tandem | 0,186 s | 0,071 s |
| 40 000 kg, nada atende | 0,186 s | 0,071 s |
| 9000 kg, com o guindaste grande | 0,121 s | 0,046 s |
| 6000 + 40 000 kg com o grande (o teste de < 3 s) | 0,489 s | 0,191 s |
| cenário cheio (8 obstáculos, 3 feições, rampa), 2000 kg | 0,115 s | 0,040 s |
| cenário cheio, 6000 kg (tandem) | 0,356 s | 0,137 s |
| cenário cheio, 6000 kg com o grande | 0,227 s | 0,081 s |

A máquina estava carregada (outras frentes rodando): uma medição isolada do original chegou a
1,23 s no cenário cheio com tandem, e o perfil (`cProfile`) mostrou que o custo dominante era o
`crane_body_overlaps_obstacle` pré-existente, não a conferência nova; daí o pré-filtro.

## 5. Decisões tomadas

- Grade densa com margem de meio passo, em vez de mais quadros-chave (a animação ficaria mais lenta)
  ou de interseção analítica (muitos casos). ADR-042 (Proposto).
- A conferência de lança, cabo e carga é feita no movimento interpolado da cena, não na reta que o
  planejador amostra; a escolha dos obstáculos cruzados ganha 0,15 m de folga para cobrir a diferença.
- Obstáculo crescido da meia-seção em quina (não arredondado): um pouco conservador.
- Coleta: qualquer obstáculo na pegada da carga recusa (a cena assenta a carga no terreno, então
  carga "sobre a carreta" na coleta fica dentro dela na cena).
- Entrega: só o veículo-plataforma (`is_platform_vehicle`, a regra do layout da IA da TASK-081)
  recebe a carga por cima. No caminhão plataforma da biblioteca vale o topo da caixa do modelo
  (o backend não conhece a carroceria).
- Opção que bate é descartada (não volta como "não atende"); o motivo vai às notas quando nada
  atende.

## 6. Regras de negócio aplicadas

- RN-012 (a carga não atravessa terreno, guindaste nem obstáculos) passa a valer também no plano;
  a lança e o cabo, que na cena só geram alerta, fazem o plano ser descartado (decisão do ADR-042,
  Proposto — ver § 8).
- RN-004 e RN-008: capacidade e segurança continuam vindo só do `EvaluateOperation`.

## 7. O que NÃO foi feito e por quê

- **Frontend sem mudança** (pedido da tarefa). Diferença que resta: a cena só solta a carga perto do
  **terreno** — `checkRelease` (`frontend/src/domain/cargo/cargoOperation.ts:263`) mede a base da
  carga contra `cargoBaseY` (só terreno), e `releaseFromPlan` (`SimulatorRoute.tsx`) desce o cabo
  pela altura acima do terreno. Com a carga planejada sobre a carreta (1,33 m), a cena tenta descê-la
  até o chão, a guarda de colisão para na carreta e "Soltar" falha. Precisa de tarefa no frontend
  (soltura sobre a superfície de apoio).
- Caminhão plataforma da biblioteca: a cena tem caixas próprias (carroceria a 53 % da altura, cabine
  mais alta, `objectLibrary.ts`); o backend usa a caixa inteira do modelo, então a carga pousa no
  topo da caixa (3,5 m no tamanho padrão), acima da carroceria.
- Lança contra terreno e contra outros guindastes do cenário: não conferidos.
- Tandem: cada lado continua planejado sozinho, com o círculo da carga em volta do ponto de içamento
  (aproximação já existente). F-04, F-03, F-06, F-18 e F-28 ficam para a TASK-089.
- `crane_body_overlaps_obstacle` continua amostrando o corpo a cada 1 m: um muro fino que atravesse
  o corpo sem ter o centro dentro dele pode escapar (observado na leitura, não reproduzido; mesmo
  tipo do F-01, fora do escopo).
- Não editei `docs/known-gaps.md` (outras frentes editam em paralelo); as limitações acima estão
  aqui e no ADR-042.

## 8. Pendências / decisões necessárias (para a pessoa responsável)

| # | Pergunta | Bloqueia? | Resposta | Respondida em |
|---|----------|-----------|----------|---------------|
| 1 | Aceitar o ADR-042 (giro denso; lança e cabo descartam o plano; coleta coberta recusada; entrega só sobre a carreta)? | não | | |
| 2 | Entregar sobre um container ou outra caixa que não é a carreta deve ser permitido (hoje é recusado)? | não | | |
| 3 | O prompt da IA pede a carga **dentro** do "barracão aberto"; esses cenários agora são recusados com motivo. Mudar o prompt para a carga ficar na frente da porta? | não | | |
| 4 | Abrir tarefa no frontend para a soltura sobre a carreta (§ 7) | não | | |
| 5 | Meias-medidas FICTÍCIAS da lança (0,6 m) e do cabo com gancho (0,3 m): substituir pelas da ficha quando chegar | não | | |
| 6 | O número ADR-042 foi escolhido porque o ADR-041 ficou para a TASK-089 e a TASK-096 usa o 043; se outra frente também usar o 042, renumerar no merge | não | | |

## 9. ⚠️ Segurança

- nada a relatar

## 10. Próximo passo

**Papel:** Revisor (outra sessão ou ferramenta)

**O que fazer, concretamente:**
1. Revisar o PR da TASK-088 com `docs/templates/code-review-template.md`.
2. A pessoa responsável responde o § 8.

**Ler primeiro (nesta ordem):**
1. `AGENTS.md`
2. este handoff
3. `docs/decisions/ADR-042-conferencia-continua-do-plano.md`
4. `backend/app/domain/services/planning/sweep.py` (a conferência)
5. `backend/app/domain/services/planning/planner.py` (`_sites`, `_sweeps`, `_swings`, `plan_crane`)

**Cuidado com:**
- As contagens de descarte das notas mudaram de tamanho: só as posições avaliadas contam.
- A TASK-089 (empilhada sobre esta) mexe nos mesmos arquivos do planejador.

## 11. Como revisar este trabalho

- Comece por `sweep.py`: `samples_within` (o pulo de amostras), `_swing_collision` (a margem
  `move` entre amostras) e `segment_hits_solid`.
- Tenho menos certeza sobre o limite de desvio entre a reta e o movimento interpolado da cena
  (L·Δθ²/8 por trecho, coberto pelos 0,15 m): é dedução, conferida só nos testes.
- `test_recommend_lift_plan_caminho.py` reproduz a trajetória quadro a quadro e é a melhor prova
  de ponta a ponta no backend; não há teste na cena (frontend) desta tarefa.
