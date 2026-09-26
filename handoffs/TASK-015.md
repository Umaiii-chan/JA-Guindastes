# Handoff — TASK-015 — implementação (caso de uso de avaliação operacional)

> **Tarefas em paralelo (TASK-006):** este handoff fica em `handoffs/TASK-015.md` e
> `handoffs/current.md` **não** foi editado.

| Campo | Valor |
|-------|-------|
| **Data/hora** | 2026-09-26 15:45 (UTC-3, Brasília) |
| **Tarefa** | `tasks/in-progress/TASK-015-caso-de-uso-avaliacao.md` |
| **Etapa concluída** | implementação |
| **Papel exercido** | Planejador + Engenheiro de testes + Implementador (um único agente, declarado conforme AGENTS.md § 3) |
| **Ferramenta/agente** | Claude Code (modelo Opus 5.5), subagente num git worktree isolado |
| **Branch** | `task/TASK-015-caso-de-uso-avaliacao` @ `5f4015e` (antes do commit deste handoff), a partir de `d5eedab` |
| **Duração aproximada** | ~35 min |

---

## 1. Objetivo desta etapa

Criar na camada de aplicação o caso de uso `EvaluateOperation` (doc-fonte § 14.1: geometria →
tabela ativa → consulta → utilização), com portas para a ficha técnica geométrica e a tabela ativa,
sem endpoint e sem persistência, testado com fakes e dados FICTÍCIOS.

## 2. O que foi feito

- Verifiquei que o worktree começou em `f18dd9e`; criei `task/TASK-015-caso-de-uso-avaliacao` com
  `git switch -c ... d5eedab` e confirmei com `git log -1` (`d5eedab chore(tasks): mover TASK-010,
  013 e 014 para completed e abrir a leva TASK-015..017`).
- Criei `tasks/in-progress/TASK-015-caso-de-uso-avaliacao.md` (CA-1..CA-9).
- Li o ADR-013 C-6: a tolerância para comparar L com os comprimentos tabelados existe, mas "o valor
  fica para a tarefa do `LoadChartInterpolator`". **Não há valor definido**, então mantive a busca
  exata do domínio (`ExactPointLookup`) e não inventei número (§ 7 e § 8, item 1).
- Criei as portas (`typing.Protocol`) em `backend/app/application/ports/`:
  - `crane_geometry_provider.py`: `CraneGeometryProvider.get_crane_geometry(configuration_id) ->
    CraneGeometry | None`;
  - `active_load_chart_provider.py`: `ActiveLoadChartProvider.get_active_load_chart(configuration_id)
    -> LoadChart | None` (papel de "identificar a tabela ativa" do `LoadChartResolver`).
- Criei `backend/app/application/use_cases/evaluate_operation.py`:
  - `EvaluateOperation(crane_geometry_provider=..., active_load_chart_provider=...,
    load_chart_interpolator=...)` e `execute(*, configuration_id, state: OperationalState,
    load_weight: Mass) -> OperationEvaluation`;
  - resultado como união `EvaluatedOperation | NotEvaluableOperation`:
    - `EvaluatedOperation`: `geometry`, `capacity: CapacityFound`, `utilization_percent`, e as
      propriedades `load_chart_id`, `load_chart_version` (RN-005) e `reasons` (sempre `()`);
    - `NotEvaluableOperation`: `reasons` (nunca vazio), `geometry` (quando calculável),
      `capacity` (quando a tabela foi consultada), `load_chart_id`/`load_chart_version` derivados
      de `capacity`. **Não tem** `utilization_percent`;
  - motivos (`EvaluationReason`) são `StrEnum` legíveis por máquina: `NotEvaluableReason`
    (`CRANE_GEOMETRY_NOT_FOUND`, `OUTSIDE_GEOMETRIC_DOMAIN`, `ACTIVE_LOAD_CHART_NOT_FOUND`,
    `UTILIZATION_UNDEFINED`), mais os do domínio sem tradução: `OperationalLimitViolation` (um por
    faixa violada) e `CapacityUnsupportedReason.POINT_NOT_IN_CHART`;
  - `OperationalStateOutOfLimitsError` e `OutsideGeometricDomainError` (TASK-014) **não são
    propagados**: viram `NotEvaluableOperation` com as violações; a tabela não é consultada;
  - `InconsistentActiveLoadChartError` se o provedor devolver tabela não `ACTIVE` ou de outra
    configuração (quebra do contrato da porta; RN-001, RN-004).
- Criei a fixture FICTÍCIA `backend/tests/fixtures/avaliacao_operacional_ficticia.py` (nome novo),
  com raios escolhidos para a ficha FICTÍCIA da TASK-014 (a = 1,5 m) alcançar com θ = 0°
  (R = 1,5 + L, exato em ponto flutuante), um ponto que só coincide na conta à mão (L = 20 m,
  θ = 60°) e um ponto FICTÍCIO de 0 kg.
- Escrevi 31 testes em `backend/tests/application/test_evaluate_operation.py`, com fakes das duas
  portas, um espião do interpolador e uma estratégia falsa de capacidade fixa (cenários em
  `tasks/in-progress/TASK-015-caso-de-uso-avaliacao.md` § 9).
- Teste de mutação manual (código restaurado antes dos gates, conferido com `cmp`):
  - removi a checagem de status `ACTIVE` → `4 failed, 27 passed`;
  - troquei o raio da consulta por `state.cable_length` → `11 failed, 20 passed`.

## 3. Arquivos modificados

`git diff --stat d5eedab...HEAD` antes do commit deste handoff (este arquivo e a atualização dos
§§ 8 e 9 da tarefa entram no commit final):

```text
 .../ports/active_load_chart_provider.py            |  23 ++
 .../application/ports/crane_geometry_provider.py   |  24 ++
 .../application/use_cases/evaluate_operation.py    | 236 +++++++++++
 .../tests/application/test_evaluate_operation.py   | 454 +++++++++++++++++++++
 .../fixtures/avaliacao_operacional_ficticia.py     |  43 ++
 .../in-progress/TASK-015-caso-de-uso-avaliacao.md  | 152 +++++++
 6 files changed, 932 insertions(+)
```

Fora do escopo: nenhum. Só arquivos novos; nenhum arquivo existente (domínio, docs,
`handoffs/current.md`, arquivos das TASK-011, TASK-016 e TASK-017) foi alterado. Nenhum arquivo
novo no domínio foi necessário.

## 4. Comandos executados e resultados

Todos em `backend/`, exceto o `check-structure.sh` (raiz), com o código final (commit `5f4015e`).

| Comando | Resultado | Saída (resumo) |
|---------|-----------|----------------|
| `uv sync --locked` | ✅ passou | `Resolved 41 packages in 1ms` / `Checked 38 packages in 3ms` |
| `uv run ruff check .` | ✅ passou | `All checks passed!` |
| `uv run ruff format --check .` | ✅ passou | `62 files already formatted` |
| `uv run mypy app` | ✅ passou | `Success: no issues found in 41 source files` |
| `uv run lint-imports` | ✅ passou | `Contracts: 3 kept, 0 broken.` |
| `uv run pytest` | ✅ passou | `314 passed in 5.09s` (283 anteriores + 31 novos) |
| `bash scripts/check-structure.sh` | ✅ passou | `OK: 0 erros, 0 aviso(s)` |

`uv run lint-imports` (os acentos saem trocados no console do Windows):

```text
Camadas: apresentação e infraestrutura dependem de aplicação, que depende de domínio KEPT
Domínio não depende de frameworks (RNF-002) KEPT
Aplicação não depende de framework web nem de ORM (RNF-002) KEPT

Contracts: 3 kept, 0 broken.
```

Contagem dos testes: `uv run pytest --ignore=tests/application/test_evaluate_operation.py` →
`283 passed`; `uv run pytest tests/application/test_evaluate_operation.py` → `31 passed`.

`bash scripts/check-structure.sh` (antes do commit deste handoff; seção 1 resumida, toda com ✓):

```text
3. Tarefas
  ✓ 1 tarefa(s) em in-progress
  ✓ nenhum ID de tarefa duplicado
5. Segurança básica
  ✓ .env está no .gitignore
  ✓ nenhum .env versionado
  ✓ nenhum padrão óbvio de segredo encontrado
6. Links Markdown internos quebrados (docs/, AGENTS.md, README.md, tasks/, handoffs/)
  ✓ nenhum link interno quebrado
7. Branches
  ✓ branch de tarefa: task/TASK-015-caso-de-uso-avaliacao
8. Autoria dos commits (sem co-autoria de IA)
  ✓ 3 commit(s) desta branch sem co-autoria de IA

OK: 0 erros, 0 aviso(s)
```

## 5. Decisões tomadas

- **"Avaliado" = houve utilização.** `EvaluatedOperation` só existe quando a tabela suporta o
  estado e a carga foi comparada com a capacidade (RF-017). Todo o resto é `NotEvaluableOperation`
  com motivos, inclusive ponto fora da tabela (RN-007, RF-020). "Avaliado" não quer dizer "seguro":
  não há status nem limiar (PEND-004), e 125 % continua só "avaliado". Pergunta em § 8, item 2.
- **Resultado como união de dois tipos**, no padrão do `CapacityResult` (TASK-008) e do resultado
  da importação (TASK-010): o "não avaliável" não tem `utilization_percent` para ler por engano.
- **Motivos sem tradução:** as violações do domínio (`OperationalLimitViolation`) e o motivo da
  consulta (`CapacityUnsupportedReason`) entram como vieram; só os motivos que nascem no caso de uso
  ganharam um enum novo. Assim não há duas listas de códigos para manter iguais.
- **Ficha técnica e tabela ativa são buscadas sempre**, para listar de uma vez os problemas das duas
  (ex.: `BOOM_LENGTH_ABOVE_MAX` e `ACTIVE_LOAD_CHART_NOT_FOUND`), na ordem das etapas. A tabela só é
  **consultada** (interpolador) quando há geometria, como pede o ADR-013 C-5 para R < 0.
- **Geometria mantida sem capacidade:** sem tabela ativa ou fora do domínio da tabela, a geometria
  continua no resultado (ADR-013 C-6: "a geometria continua aparecendo; a capacidade, não").
- **Id e versão da tabela derivados de `capacity`:** presentes sempre que a tabela foi consultada
  (inclusive no "fora da tabela", RN-005) e `None` quando não foi, para nunca sugerir que uma
  versão produziu um resultado que ela não produziu.
- **Sem ficha técnica → "não avaliável"** (`CRANE_GEOMETRY_NOT_FOUND`), como a tabela ausente; a
  tarefa não definia esse caso. Pergunta em § 8, item 4.
- **Capacidade 0 kg → "não avaliável"** (`UTILIZATION_UNDEFINED`), com a `CapacityFound` de 0 kg no
  resultado, em vez de propagar `UndefinedUtilizationError`. Pergunta em § 8, item 3.
- **Contrato da porta da tabela verificado:** tabela não `ACTIVE` ou de outra configuração levanta
  `InconsistentActiveLoadChartError` (erro de programação do adapter), porque a capacidade nunca
  pode vir da tabela errada (RN-001, RN-004). Pergunta em § 8, item 5.
- **Portas só com `configuration_id`:** onde a ficha técnica fica (guindaste ou configuração,
  ADR-013 G-2; TASK-014 pendência 4) é decisão do adapter; a porta não fecha essa pergunta.
- **Estratégia injetada e obrigatória** no construtor (sem padrão): quem monta o caso de uso escolhe
  a estratégia de forma explícita (doc-fonte § 14.4).
- **Sem ADR:** portas e caso de uso seguem ADR-004 e doc-fonte §§ 14 e 18; não houve decisão
  arquitetural nova.

## 6. Regras de negócio aplicadas

- RN-001 — a tabela vem da configuração pedida; tabela de outra configuração é erro de contrato
  (`test_provider_returning_a_chart_of_another_configuration_breaks_the_contract`).
- RN-004 — capacidade só da tabela, pela estratégia injetada
  (`test_ficticio_state_on_a_chart_point_is_evaluated_with_capacity_and_utilization`,
  `test_capacity_comes_from_the_injected_strategy`).
- RN-005 — id e versão da tabela no resultado sempre que ela foi consultada
  (`test_evaluated_result_carries_the_chart_id_and_version`,
  `test_not_evaluable_off_chart_result_carries_the_chart_id_and_version`).
- RN-006 — entradas e saídas em m, graus e kg (value objects do domínio).
- RN-007 — fora da tabela, estado fora das faixas, R < 0 e falta de dados: "não avaliável" com
  motivo explícito, nunca vazio (`test_not_evaluable_result_requires_at_least_one_reason` e os
  testes de CA-3..CA-5).
- RN-008 — a geometria do resultado é a do backend, calculada com a ficha técnica
  (`test_evaluated_geometry_is_the_domain_geometry_of_the_state`).
- "Testes relacionados" de `docs/business-rules.md` **não** foi preenchido (arquivo protegido).
- Regras **não documentadas** encontradas: § 8.

## 7. O que NÃO foi feito e por quê

- **Limitação conhecida — raio calculado × busca exata:** o raio sai de R = a + L·cos θ em ponto
  flutuante e **raramente coincide** com um raio tabelado. Mesmo quando a conta à mão coincide
  (L = 20 m, θ = 60° → 11,5 m), o cálculo dá `11.500000000000002` e a `ExactPointLookup` não acha o
  ponto (`test_ficticio_radius_on_chart_point_only_by_hand_is_not_found_by_the_exact_search`). Na
  prática, com a estratégia atual, quase todo estado real volta "não avaliável
  (`POINT_NOT_IN_CHART`)"; só estados especiais (como θ = 0°) chegam a um ponto. Isso só muda com a
  tolerância (ADR-013 C-6, sem valor) e com a regra de interpolação no raio (PEND-001). Não inventei
  nenhuma das duas (§ 8, item 1).
- Endpoint REST/WebSocket, schemas Pydantic e adapters das portas: fora do escopo (a persistência é
  a TASK-011).
- `SafetyValidator`, status (`WARNING`/`CRITICAL`), limiares e mensagens ao usuário: PEND-004,
  known-gaps P-005, doc-fonte § 26 pergunta 9.
- Registro persistente do cálculo (`SimulationResult`, RN-005 "registrar"): o resultado traz id e
  versão da tabela, mas nada é gravado; o resultado também não repete as entradas.
- Documentação: não alterei `docs/architecture.md` (o caso de uso agora existe) nem
  `docs/known-gaps.md` (L-004 ainda diz que não há `LoadChartResolver`), porque TASK-011 e TASK-017
  estão mexendo nesses arquivos (§ 8, item 7).
- Push e PR: não feitos, por instrução desta tarefa.
- Revisão independente: NÃO EXECUTADA (próximo passo).

## 8. Pendências / decisões necessárias (para a pessoa responsável)

| # | Pergunta | Bloqueia? | Resposta | Respondida em |
|---|----------|-----------|----------|---------------|
| 1 | Tolerância na busca do ponto: o ADR-013 C-6 prevê tolerância "só para absorver erro de ponto flutuante" ao comparar **L** com os comprimentos tabelados, mas não dá o valor; para o **raio**, o ADR não fala de tolerância (interpolação no raio é PEND-001). Mantive a busca exata (TASK-008, pendência 1). Qual tolerância usar em L e no raio, e onde (na estratégia ou num novo ADR)? | não para esta tarefa; **sim** para a avaliação dar capacidade fora de casos especiais (§ 7) | | |
| 2 | Ponto fora da tabela (`POINT_NOT_IN_CHART`) foi classificado como "não avaliável", com a geometria e a versão da tabela, e não como "avaliado sem capacidade". Confirma? | não | | |
| 3 | Capacidade 0 kg num ponto da tabela: devolvi "não avaliável" (`UTILIZATION_UNDEFINED`) com a capacidade 0 kg visível no resultado (liga-se à TASK-008, pendência 4: o que significa capacidade 0). Confirma, ou 0 kg deve ser tratado de outro jeito (ex.: posição proibida)? | não | | |
| 4 | Configuração sem ficha técnica geométrica: devolvi "não avaliável" (`CRANE_GEOMETRY_NOT_FOUND`), sem distinguir "configuração inexistente" de "ficha não cadastrada". Confirma, ou configuração inexistente deve ser erro (ex.: 404 na API)? | não (sim, antes do endpoint) | | |
| 5 | Provedor que devolve tabela não `ACTIVE` ou de outra configuração: tratei como erro de programação (`InconsistentActiveLoadChartError`). Se o "modo técnico de validação" da doc-fonte § 13.2 for adotado (tabela não ativa em simulação), essa checagem muda. Confirma por ora? | não | | |
| 6 | Estado com violação de faixa **e** R < 0 ao mesmo tempo: o domínio (TASK-014) checa as faixas primeiro, então só as violações aparecem. Deve listar `OUTSIDE_GEOMETRIC_DOMAIN` junto? | não | | |
| 7 | Autoriza, depois do merge de TASK-011 e TASK-017, atualizar `docs/architecture.md` (caso de uso de avaliação e portas) e `docs/known-gaps.md` (L-004 cita a falta de `LoadChartResolver`; nova limitação "raio calculado × busca exata", § 7)? | não | | |
| 8 | Preencher "Testes relacionados" de RN-001, RN-004, RN-005, RN-007 e RN-008 em `docs/business-rules.md` com os testes do § 6 (arquivo protegido; agente não edita) | não | | |
| 9 | O `load_weight` é comparado como veio: se é a carga bruta, com acessórios, moitão ou cabos, segue em aberto (PEND-006, known-gaps P-005) | não | | |

## 9. ⚠️ Segurança (se houver algo)

- nada a relatar

## 10. Próximo passo

**Papel:** Revisor (outra sessão ou ferramenta, AGENTS.md § 3), depois Pessoa responsável

**O que fazer, concretamente:**
1. Revisor: revisar `git diff d5eedab...task/TASK-015-caso-de-uso-avaliacao` com
   `docs/templates/code-review-template.md`.
2. Pessoa: responder as pendências do § 8 (a 1 é a que mais limita o uso real) e decidir o push e o
   PR.
3. Tarefa seguinte sugerida (não criada): adapters das portas sobre a persistência da TASK-011 e o
   endpoint/WebSocket de avaliação (doc-fonte §§ 15.3 e 15.4), mapeando `EvaluatedOperation` e
   `NotEvaluableOperation` para `simulation.evaluated` sem inventar `status`.

**Ler primeiro (nesta ordem):**
1. `AGENTS.md`
2. este handoff
3. `tasks/in-progress/TASK-015-caso-de-uso-avaliacao.md` § 3
4. `backend/app/application/use_cases/evaluate_operation.py` (o fluxo e os tipos do resultado)
5. `docs/decisions/ADR-013-convencoes-geometricas-provisorias.md` C-5 e C-6 (validade e tolerância)

**Cuidado com:**
- Os raios da fixture FICTÍCIA foram escolhidos para θ = 0°, onde cos 0° = 1 exato. Com outro ângulo,
  um teste que espere capacidade vai falhar por ponto flutuante, não por erro do caso de uso (§ 7).
- `NotEvaluableOperation.capacity` pode ser `CapacityFound` (0 kg): não use a presença de
  `CapacityFound` como sinônimo de "avaliado"; use o tipo do resultado.

## 11. Como revisar este trabalho

- Comece por `backend/app/application/use_cases/evaluate_operation.py`: `execute`, depois
  `_calculate_geometry` e `_resolve_active_load_chart`.
- Depois `backend/tests/application/test_evaluate_operation.py`: os comentários de cada teste trazem
  a conta do raio.
- Tenho menos certeza sobre a classificação dos casos de borda (§ 8, itens 2 a 5): são escolhas do
  agente, coerentes com a RN-007 e com o padrão das TASK-008 e TASK-010, mas não estão na doc.
- O gate do mypy roda só em `app/`. Rodei à parte `uv run mypy
  tests/application/test_evaluate_operation.py tests/fixtures/avaliacao_operacional_ficticia.py` →
  `Success: no issues found in 2 source files`: os fakes satisfazem as portas por tipagem
  estrutural, sem `cast`.
