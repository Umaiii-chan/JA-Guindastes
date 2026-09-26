# Handoff — TASK-020 — implementação (consulta conservadora provisória, ADR-015)

> **Tarefas em paralelo (TASK-006):** este handoff fica em `handoffs/TASK-020.md` e
> `handoffs/current.md` **não** foi editado.

| Campo | Valor |
|-------|-------|
| **Data/hora** | 2026-09-26 16:10 (UTC-3, Brasília) |
| **Tarefa** | `tasks/in-progress/TASK-020-consulta-conservadora-provisoria.md` |
| **Etapa concluída** | implementação |
| **Papel exercido** | Planejador + Engenheiro de testes + Implementador (um único agente, declarado conforme AGENTS.md § 3) |
| **Ferramenta/agente** | Claude Code (modelo Opus 5.5), subagente num git worktree isolado |
| **Branch** | `task/TASK-020-consulta-conservadora-provisoria` @ `d024ab1` (antes do commit deste handoff), a partir de `6388903` |
| **Duração aproximada** | ~40 min |

---

## 1. Objetivo desta etapa

Implementar no domínio a estratégia `ConservativeTabulatedLookup` exatamente como o ADR-015 define,
atrás da porta `LoadChartInterpolator`, com um resultado que informa o raio consultado, o ponto
tabelado usado e a marca de estratégia provisória conservadora, e mostrar o `EvaluateOperation`
chegando a "avaliado" com ela, sem mudar o caso de uso.

## 2. O que foi feito

- Verifiquei que o worktree começou em `b471b6e`; fiz `git switch
  task/TASK-020-consulta-conservadora-provisoria` e confirmei com `git log -1` (`6388903
  docs(decisions): registrar ADR-015 da consulta conservadora provisória escolhida pela pessoa
  (TASK-020)`). A branch não estava em uso em outro worktree.
- Rodei a suíte antes de mexer: `329 passed, 2 skipped` (a instrução falava em 314; a diferença
  são os testes da TASK-018, já em `development`).
- Criei `tasks/in-progress/TASK-020-consulta-conservadora-provisoria.md` (CA-1..CA-9); o Contexto
  registra que a estratégia foi escolhida pela pessoa em chat e está no ADR-015 (commit `6388903`).
- Criei `backend/app/domain/services/conservative_tabulated_lookup.py`:
  - `NUMERIC_TOLERANCE_M = 1e-6` (ε do ADR-015); "coincide" é `|tabelado − consultado| ≤ ε`;
  - `ConservativeTabulatedLookup.calculate_capacity(chart, query)`:
    1. pontos cujo comprimento coincide (±ε) com o consultado formam a coluna; coluna vazia →
       `CapacityUnsupported(BOOM_LENGTH_NOT_IN_CHART)`;
    2. raio coincide (±ε) com um raio da coluna → esse ponto;
    3. senão, abaixo do menor raio → `RADIUS_BELOW_CHART_MIN`; acima do maior →
       `RADIUS_ABOVE_CHART_MAX`;
    4. senão, os dois vizinhos (maior raio abaixo e menor raio acima) → o de **menor** capacidade;
  - não olha o status da tabela nem a escolhe (contrato da porta).
- Criei `backend/app/domain/value_objects/conservative_capacity_result.py`:
  - `ConservativeCapacityFound(CapacityFound)` com `query: CapacityQuery`, `used_point:
    LoadChartPoint`, `strategy: CapacityLookupStrategy` (padrão e único valor:
    `CONSERVATIVE_PROVISIONAL`) e a propriedade `queried_radius`;
  - invariante no `__post_init__`: `max_capacity` tem de ser a capacidade de `used_point` (RN-004),
    senão `ValueError`.
- Alterei `backend/app/domain/value_objects/capacity_result.py` (mudança mínima, § 3): três
  membros novos em `CapacityUnsupportedReason` — `BOOM_LENGTH_NOT_IN_CHART`,
  `RADIUS_BELOW_CHART_MIN`, `RADIUS_ABOVE_CHART_MAX` — com docstring.
- Criei a fixture FICTÍCIA `backend/tests/fixtures/consulta_conservadora_ficticia.py` (nome novo):
  uma tabela típica (L = 20 m e 30 m) e uma atípica (em 20 m, 11,5 m tem 6500 kg > 8 m com 5000 kg).
- Escrevi 55 testes em `backend/tests/domain/test_conservative_tabulated_lookup.py` e 4 em
  `backend/tests/application/test_evaluate_operation_conservative_lookup.py` (cenários na tarefa,
  § 9). O teste de aplicação reusa, sem alterar, as fixtures FICTÍCIAS da TASK-014 e da TASK-015.
- Teste de mutação manual, com um script fora do repositório que altera o arquivo, roda os testes
  de domínio e restaura (restauração conferida byte a byte: `restaurado: True`):

  ```text
  vizinho sempre o de raio maior: 1 failed, 54 passed in 0.08s
  maior capacidade: 14 failed, 41 passed in 0.09s
  sem tolerancia: 8 failed, 47 passed in 0.09s
  tolerancia 1e-3: 5 failed, 50 passed in 0.08s
  troca motivos abaixo/acima: 7 failed, 48 passed in 0.08s
  restaurado: True
  ```

  A primeira rodada mostrou que a mutação "ε = 1e-3" sobrevivia (os testes derivavam o ruído do
  próprio ε); passei a escrever 0,5 µm e 2 µm por extenso e acrescentei um teste que fixa ε.

## 3. Arquivos modificados

`git diff --stat 6388903...HEAD` antes do commit deste handoff (este arquivo e a atualização dos
§§ 8 e 9 da tarefa entram no commit final):

```text
 .../services/conservative_tabulated_lookup.py      |  94 +++++
 .../app/domain/value_objects/capacity_result.py    |   6 +
 .../value_objects/conservative_capacity_result.py  |  59 +++
 .../test_evaluate_operation_conservative_lookup.py | 141 ++++++++
 .../domain/test_conservative_tabulated_lookup.py   | 394 +++++++++++++++++++++
 .../fixtures/consulta_conservadora_ficticia.py     |  53 +++
 .../TASK-020-consulta-conservadora-provisoria.md   | 157 ++++++++
 7 files changed, 904 insertions(+)
```

**Arquivo existente alterado (único):** `backend/app/domain/value_objects/capacity_result.py`, +6
linhas, só três membros novos no enum `CapacityUnsupportedReason`. Motivo:

- em Python, um `Enum` com membros não pode ser estendido por subclasse (verificado:
  `TypeError: <enum 'X'> cannot extend <enum 'CapacityUnsupportedReason'>`);
- `CapacityUnsupported.reason` é tipado como `CapacityUnsupportedReason`, e o `EvaluateOperation`
  repassa `capacity.reason` sem tradução para `NotEvaluableOperation.reasons` (o
  `EvaluationReason` inclui esse enum). Um enum novo em arquivo novo exigiria mudar o
  `CapacityUnsupported` e o caso de uso, ou esconder o motivo real atrás de `POINT_NOT_IN_CHART`;
- nenhum código trata o enum de forma exaustiva (verificado com `grep`: só há comparações com
  `POINT_NOT_IN_CHART`), e nenhuma tarefa paralela (TASK-016, TASK-019) toca esse arquivo.

Tipo de resultado novo em arquivo novo (e não campos no `CapacityFound`): `ConservativeCapacityFound`
é subclasse de `CapacityFound`, então cabe no `CapacityResult`, no `EvaluatedOperation.capacity` e
no estreitamento `isinstance(capacity, CapacityUnsupported)` do caso de uso, sem mudar a
`ExactPointLookup` nem o `EvaluateOperation`.

Fora do escopo: nenhum. Nenhum arquivo de `docs/`, `handoffs/current.md`, `frontend/`,
`backend/app/presentation/`, `backend/tests/presentation/`, `backend/pyproject.toml` ou
`backend/uv.lock` foi alterado.

## 4. Comandos executados e resultados

Todos em `backend/`, exceto o `check-structure.sh` (raiz), com o código final (commit `d024ab1`).

| Comando | Resultado | Saída (resumo) |
|---------|-----------|----------------|
| `uv sync --locked` | ✅ passou | `Resolved 48 packages in 3ms` / `Checked 45 packages in 67ms` |
| `uv run ruff check .` | ✅ passou | `All checks passed!` |
| `uv run ruff format --check .` | ✅ passou | `76 files already formatted` |
| `uv run mypy app` | ✅ passou | `Success: no issues found in 46 source files` |
| `uv run lint-imports` | ✅ passou | `Contracts: 3 kept, 0 broken.` |
| `uv run pytest` | ✅ passou | `388 passed, 2 skipped in 4.83s` (329 anteriores + 59 novos) |
| `bash scripts/check-structure.sh` | ✅ passou | `OK: 0 erros, 0 aviso(s)` |

Contagem dos testes:

```text
$ uv run pytest --ignore=tests/domain/test_conservative_tabulated_lookup.py --ignore=tests/application/test_evaluate_operation_conservative_lookup.py
329 passed, 2 skipped in 2.64s
$ uv run pytest tests/domain/test_conservative_tabulated_lookup.py tests/application/test_evaluate_operation_conservative_lookup.py
59 passed in 0.10s
```

Os 2 `skipped` são os testes de integração com PostgreSQL (sem `DATABASE_URL` nesta máquina),
como antes.

`uv run lint-imports` (os acentos saem trocados no console do Windows):

```text
Camadas: apresentação e infraestrutura dependem de aplicação, que depende de domínio KEPT
Domínio não depende de frameworks (RNF-002) KEPT
Aplicação não depende de framework web nem de ORM (RNF-002) KEPT

Contracts: 3 kept, 0 broken.
```

mypy nos testes novos (fora do gate, que só olha `app/`):

```text
$ uv run mypy tests/application/test_evaluate_operation_conservative_lookup.py tests/domain/test_conservative_tabulated_lookup.py tests/fixtures/consulta_conservadora_ficticia.py
Success: no issues found in 3 source files
```

`bash scripts/check-structure.sh` (antes do commit deste handoff; seções 1 e 2 resumidas, todas com ✓):

```text
3. Tarefas
  ✓ 1 tarefa(s) em in-progress
  ✓ nenhum ID de tarefa duplicado
4. Contexto mínimo do projeto (marcadores <preencher>)
  ✓ docs/project-overview.md sem marcadores <preencher>
  ✓ docs/architecture.md sem marcadores <preencher>
  ✓ docs/business-rules.md sem marcadores <preencher>
  ✓ docs/development-guide.md sem marcadores <preencher>
5. Segurança básica
  ✓ .env está no .gitignore
  ✓ nenhum .env versionado
  ✓ nenhum padrão óbvio de segredo encontrado
6. Links Markdown internos quebrados (docs/, AGENTS.md, README.md, tasks/, handoffs/)
  ✓ nenhum link interno quebrado
7. Branches
  ✓ branch de tarefa: task/TASK-020-consulta-conservadora-provisoria
8. Autoria dos commits (sem co-autoria de IA)
  ✓ 5 commit(s) desta branch sem co-autoria de IA

OK: 0 erros, 0 aviso(s)
```

(Os 5 commits são os 2 do commit-base `6388903` que ainda não estão em `development` e os 3 desta
etapa.)

## 5. Decisões tomadas

- **Tudo o que o ADR-015 fixa foi seguido à letra:** ε = 1·10⁻⁶ m; comprimento precisa coincidir;
  raio igual usa o ponto; entre dois raios, menor capacidade dos vizinhos; fora da faixa, "fora do
  domínio"; resultado com raio consultado, ponto usado e marca provisória; capacidade sempre de um
  ponto da tabela.
- **"Coincidir (±ε)" = `|Δ| ≤ ε`**, e "além de ε" = `|Δ| > ε`. Os testes não usam a borda exata,
  porque a soma em ponto flutuante já desloca o valor (ex.: `11,5 + 1e-6 − 11,5 ≈ 9,99999999e-7`).
- **A faixa de raio é a do comprimento consultado**, não a da tabela inteira: em 30 m, 7,9 m é
  "abaixo do mínimo" mesmo com a coluna de 20 m começando em 5 m (é o que o ADR diz: "dentro do
  comprimento encontrado").
- **Resultado como subclasse de `CapacityFound`**, em arquivo novo (§ 3). O raio consultado está em
  `query.working_radius` (exposto como `queried_radius`); guardei a consulta inteira porque, com ε,
  o comprimento consultado pode diferir do tabelado por ruído, e os dois ficam visíveis.
- **Marca de estratégia como `StrEnum`** (`CapacityLookupStrategy.CONSERVATIVE_PROVISIONAL`), legível
  por máquina, no padrão dos motivos; uma estratégia futura (PEND-001) ganha outro membro.
- **Invariante RN-004 no tipo:** `max_capacity` diferente da capacidade de `used_point` levanta
  `ValueError` (mesmo padrão do `NotEvaluableOperation` da TASK-015 para erro de construção).
- **Motivos novos no enum existente** (mudança mínima, § 3), com nomes no padrão de
  `OperationalLimitViolation` (`..._BELOW_MIN`, `..._ABOVE_MAX`) e sem colidir com os valores dele,
  já que os dois convivem no `EvaluationReason`.
- **Casos que o ADR-015 não cobre** (comportamento escolhido para ser determinístico e do lado
  seguro, coberto por teste e levado à pessoa no § 8, item 1):
  - tabela com dois raios (ou dois comprimentos) distintos a menos de ε um do outro: todos os que
    coincidem com a consulta contam, e vale o de menor capacidade;
  - empate de capacidade entre os pontos candidatos: o ponto informado é o de maior raio (a
    capacidade é a mesma).
- **Sem ADR novo:** a decisão é o ADR-015; a implementação não tomou decisão arquitetural nova.

## 6. Regras de negócio aplicadas

- RN-004 — capacidade sempre de um ponto da tabela: invariante do tipo
  (`test_conservative_result_rejects_a_capacity_other_than_the_used_point`) e varredura de 0 a 22 m
  (`test_ficticio_capacity_always_comes_from_a_point_of_the_chart`).
- RN-005 — id e versão da tabela em todo resultado, suportado ou não
  (`test_ficticio_every_result_carries_the_chart_id_and_version`, 5 casos × 2 versões; e no teste
  de aplicação).
- RN-007 — fora do domínio, `CapacityUnsupported` com motivo e sem capacidade
  (`test_ficticio_radius_outside_the_chart_range_is_unsupported_with_its_reason`,
  `test_ficticio_boom_length_not_in_chart_is_unsupported`), repassado pelo caso de uso
  (`test_ficticio_state_outside_the_chart_domain_is_not_evaluable_with_the_strategy_reason`).
- PEND-001, PEND-002 e PEND-003 continuam abertas (ADR-015 é provisório); `docs/business-rules.md`
  não foi alterado (arquivo protegido).
- Regras **não documentadas** encontradas: § 8.

## 7. O que NÃO foi feito e por quê

- **Nenhum ponto de composição usa a estratégia nova ainda:** não existe endpoint nem composição do
  `EvaluateOperation` fora dos testes. A troca fica para a tarefa do endpoint de avaliação (§ 10).
- **Documentação e docstrings existentes não foram atualizadas**, porque a instrução desta tarefa
  foi não alterar arquivos existentes além da mudança mínima. Ficaram desatualizados (§ 8, item 3):
  - `backend/app/application/use_cases/evaluate_operation.py` (docstring do módulo: "hoje só existe
    `ExactPointLookup`" e o parágrafo sobre tolerância);
  - `backend/app/domain/services/load_chart_interpolator.py` e
    `backend/app/domain/value_objects/capacity_query.py` (citam só a pendência, não o ADR-015);
  - `docs/known-gaps.md` L-004 ("só tem a estratégia `ExactPointLookup`");
  - `docs/architecture.md` (não cita a estratégia nova).
- **Marca provisória na UI:** o resultado traz a marca; mostrar na tela é trabalho do frontend.
- **Risco G-1 do ADR-013 (deflexão da lança no raio da tabela):** não resolvido aqui, como o próprio
  ADR-015 registra.
- Push e PR: não feitos, por instrução desta tarefa.
- Revisão independente: NÃO EXECUTADA (próximo passo).

## 8. Pendências / decisões necessárias (para a pessoa responsável)

| # | Pergunta | Bloqueia? | Resposta | Respondida em |
|---|----------|-----------|----------|---------------|
| 1 | Tabela com valores distintos a menos de ε (ex.: raios 8,0 e 8,0000005 m, ou comprimentos 20,0 e 20,0000005 m): o ADR-015 não cobre. Implementei "todos os que coincidem contam, vale a menor capacidade" (e, no empate, o ponto de maior raio). Confirma, ou prefere recusar essa tabela na importação/validação (`InvalidLoadChartError`) ou devolver "não suportado"? | não (tabela assim não é esperada) | | |
| 2 | Capacidade 0 kg como vizinho: pela regra do menor vizinho, qualquer raio entre um ponto com carga e um ponto FICTÍCIO de 0 kg dá 0 kg, e o caso de uso devolve "não avaliável" (`UTILIZATION_UNDEFINED`). Liga-se à TASK-008, pendência 4 (o que significa 0 kg). Confirma esse efeito? | não | | |
| 3 | Autoriza atualizar, numa tarefa de sincronização, as docstrings e docs listadas no § 7 (`evaluate_operation.py`, `load_chart_interpolator.py`, `capacity_query.py`, `docs/known-gaps.md` L-004, `docs/architecture.md`) para citar a `ConservativeTabulatedLookup` e o ADR-015? | não | | |
| 4 | Na composição do `EvaluateOperation` (tarefa do endpoint de avaliação), a estratégia injetada deve ser a `ConservativeTabulatedLookup` (como o ADR-015 indica), mantendo a `ExactPointLookup` só como referência e nos testes? | não (sim, antes do endpoint) | | |
| 5 | Preencher "Testes relacionados" de RN-004, RN-005 e RN-007 em `docs/business-rules.md` com os testes do § 6 (arquivo protegido; agente não edita) | não | | |

## 9. ⚠️ Segurança (se houver algo)

- nada a relatar

## 10. Próximo passo

**Papel:** Revisor (outra sessão ou ferramenta, AGENTS.md § 3), depois Pessoa responsável

**O que fazer, concretamente:**
1. Revisor: revisar `git diff 6388903...task/TASK-020-consulta-conservadora-provisoria` com
   `docs/templates/code-review-template.md`, conferindo a estratégia contra o ADR-015 item a item.
2. Pessoa: responder o § 8 e decidir o push e o PR (a autorização permanente 5 de
   `handoffs/current.md` permite, mas esta tarefa foi instruída a não fazer).
3. Tarefa seguinte sugerida (não criada): composição do `EvaluateOperation` com a
   `ConservativeTabulatedLookup` no endpoint/WebSocket de avaliação, expondo `used_point`,
   `queried_radius` e `strategy` no contrato, para a UI mostrar "provisório conservador".

**Ler primeiro (nesta ordem):**
1. `AGENTS.md`
2. este handoff
3. `docs/decisions/ADR-015-consulta-conservadora-provisoria.md` (a especificação)
4. `backend/app/domain/services/conservative_tabulated_lookup.py` (a estratégia)
5. `backend/app/domain/value_objects/conservative_capacity_result.py` (o resultado)
6. `tasks/in-progress/TASK-020-consulta-conservadora-provisoria.md` §§ 3 e 9

**Cuidado com:**
- Quem precisar da marca ou do ponto usado deve testar `isinstance(capacity,
  ConservativeCapacityFound)`: o tipo declarado continua `CapacityFound`.
- `ConservativeCapacityFound(...) == CapacityFound(...)` é sempre falso, mesmo com os mesmos campos
  herdados (o `__eq__` do dataclass compara a classe).
- A `ExactPointLookup` continua existindo e continua exata; os testes da TASK-015 que mostram a
  limitação dela seguem valendo, porque usam a `ExactPointLookup`.

## 11. Como revisar este trabalho

- Comece por `conservative_tabulated_lookup.py`: são ~30 linhas de lógica em
  `calculate_capacity`, na ordem do ADR-015.
- Depois `test_conservative_tabulated_lookup.py`: cada grupo de testes tem o CA no título da seção,
  e os comentários trazem os vizinhos e as capacidades FICTÍCIAS.
- Tenho menos certeza sobre os casos não cobertos pelo ADR (§ 8, itens 1 e 2): são escolhas do
  agente, do lado seguro, mas não estão na doc.
- A mudança em `capacity_result.py` é a única em arquivo existente; confira a justificativa no § 3.
