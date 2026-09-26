# Handoff — TASK-008 — implementação (núcleo de domínio da tabela de carga)

> **Adaptação de protocolo (decisão da pessoa, 2026-09-26):** várias tarefas rodam em paralelo, então
> este handoff fica em `handoffs/TASK-008.md` e `handoffs/current.md` **não** foi editado. Por isso o
> `bash scripts/check-structure.sh` falha com "handoffs/current.md não menciona a tarefa em andamento
> TASK-008" até a pessoa consolidar os handoffs (ver § 4 e § 8).

| Campo | Valor |
|-------|-------|
| **Data/hora** | 2026-09-26 14:52 (UTC-3, Brasília) |
| **Tarefa** | `tasks/in-progress/TASK-008-nucleo-dominio-tabela-carga.md` |
| **Etapa concluída** | implementação |
| **Papel exercido** | Planejador + Engenheiro de testes + Implementador (um único agente, declarado conforme AGENTS.md § 3) |
| **Ferramenta/agente** | Claude Code (modelo Opus 5.5), subagente num git worktree isolado |
| **Branch** | `task/TASK-008-nucleo-dominio-tabela-carga` @ `8118776` (antes do commit deste handoff), a partir de `development` @ `c0955b2` |
| **Duração aproximada** | ~40 min |

---

## 1. Objetivo desta etapa

Criar o núcleo de domínio puro (só a biblioteca padrão) da tabela de carga, com testes, sem
implementar nenhuma regra pendente (PEND-001..004).

## 2. O que foi feito

- Verifiquei que `git log -1` no worktree era `c0955b2` e criei a branch a partir dele.
- Criei os value objects `Length` (m), `Angle` (graus) e `Mass` (kg): imutáveis, ordenáveis,
  recusam não número, `bool`, NaN, infinito e inteiro grande demais para `float`; `Length` e `Mass`
  recusam negativo; `Angle` aceita qualquer valor finito (P-001).
- Criei `LoadChartPoint` (`boom_length`, `working_radius`, `max_capacity`) e `LoadChart` (`id`,
  `version`, `configuration_id`, `status`, `points`), com `LoadChartStatus` = `DRAFT`, `VALIDATED`,
  `ACTIVE`, `SUPERSEDED`, `INVALID`. Invariantes: campos do cabeçalho informados; status do enum;
  capacidade não negativa (via `Mass`); nenhum par de pontos com o mesmo comprimento e raio e
  capacidades diferentes (`ConflictingLoadChartPointsError`).
- Criei a porta `LoadChartInterpolator` (Protocol, doc-fonte § 14.4) e o resultado
  `CapacityResult = CapacityFound | CapacityUnsupported`. Os dois trazem `load_chart_id` e
  `load_chart_version` (RN-005); `CapacityUnsupported` traz o motivo `POINT_NOT_IN_CHART` e não tem
  campo de capacidade (RN-007).
- Criei a estratégia `ExactPointLookup`: capacidade só para `(boom_length, working_radius)` que
  existe exatamente na tabela; todo o resto volta "não suportado". Sem interpolação, arredondamento
  ou valor conservador (docstring explica PEND-001..003).
- Criei `calculate_utilization_percent(load, capacity)`: `load / capacity × 100`, sem arredondamento
  e sem status; capacidade zero ou resultado não finito levantam `UndefinedUtilizationError`.
- Criei as exceções de domínio em `app/domain/exceptions/domain_errors.py`.
- Escrevi 83 testes em `backend/tests/domain/` com a tabela FICTÍCIA
  `backend/tests/fixtures/load_chart_ficticio.py` (rótulo FICTÍCIO no nome, no cabeçalho, nos
  identificadores da tabela e nos nomes dos testes que usam os dados).
- Acrescentei a linha L-004 em `docs/known-gaps.md` § 1 (consulta só por ponto exato).
- Criei `tasks/in-progress/TASK-008-nucleo-dominio-tabela-carga.md`.

## 3. Arquivos modificados

`git diff --stat c0955b2...HEAD` antes do commit deste handoff (mais `docs/known-gaps.md`, este
arquivo e a atualização da tarefa, que entram no commit final):

```text
 backend/app/domain/entities/load_chart.py          |  84 +++++++++++++
 backend/app/domain/entities/load_chart_point.py    |  30 +++++
 backend/app/domain/exceptions/domain_errors.py     |  36 ++++++
 backend/app/domain/services/exact_point_lookup.py  |  37 ++++++
 .../app/domain/services/load_chart_interpolator.py |  23 ++++
 backend/app/domain/services/utilization.py         |  23 ++++
 backend/app/domain/value_objects/_numeric.py       |  31 +++++
 backend/app/domain/value_objects/angle.py          |  17 +++
 backend/app/domain/value_objects/capacity_query.py |  16 +++
 .../app/domain/value_objects/capacity_result.py    |  42 +++++++
 backend/app/domain/value_objects/length.py         |  17 +++
 backend/app/domain/value_objects/mass.py           |  17 +++
 backend/tests/domain/__init__.py                   |   0
 backend/tests/domain/test_exact_point_lookup.py    | 101 +++++++++++++++
 backend/tests/domain/test_load_chart.py            | 140 +++++++++++++++++++++
 backend/tests/domain/test_quantities.py            |  92 ++++++++++++++
 backend/tests/domain/test_utilization.py           |  46 +++++++
 backend/tests/fixtures/__init__.py                 |   0
 backend/tests/fixtures/load_chart_ficticio.py      |  51 ++++++++
 .../TASK-008-nucleo-dominio-tabela-carga.md        | 139 ++++++++++++++++++++
 20 files changed, 942 insertions(+)
```

Fora do escopo: nenhum. `backend/pyproject.toml` e `backend/uv.lock` não mudaram (sem dependência nova).

## 4. Comandos executados e resultados

Todos em `backend/`, exceto o `check-structure.sh` (raiz do repositório).

| Comando | Resultado | Saída (resumo) |
|---------|-----------|----------------|
| `uv sync --locked` | ✅ | `Resolved 41 packages in 2ms` / `Checked 38 packages in 3ms` |
| `uv run ruff check .` | ✅ | `All checks passed!` |
| `uv run ruff format --check .` | ✅ | `39 files already formatted` |
| `uv run mypy app` | ✅ | `Success: no issues found in 30 source files` |
| `uv run lint-imports` | ✅ | `Contracts: 3 kept, 0 broken.` |
| `uv run pytest` | ✅ | `83 passed in 0.46s` |
| `uv run mypy tests/domain tests/fixtures` (informativo, não é gate) | ✅ | `Success: no issues found in 7 source files` |
| `bash scripts/check-structure.sh` | ❌ (esperado) | `FALHOU: 1 erro(s), 1 aviso(s)` — ver abaixo |

```text
3. Tarefas
  ! há 2 tarefas em tasks/in-progress/ — confirme que não tocam os mesmos arquivos
  ✗ handoffs/current.md não menciona a tarefa em andamento TASK-008
...
FALHOU: 1 erro(s), 1 aviso(s)
```

O erro é a consequência esperada da adaptação de protocolo (não editar `current.md`). O aviso é
porque `development` @ `c0955b2` ainda tem a TASK-005 em `tasks/in-progress/`. Todas as outras
verificações (arquivos, links, segurança, branch, autoria sem co-autoria de IA) passaram.

**Armadilha de ambiente encontrada (Windows):** `uv run lint-imports >/dev/null` termina com exit 1
(`UnicodeEncodeError` do `rich` ao escrever o spinner em cp1252 no dispositivo NUL). Com saída no
terminal, em arquivo ou em pipe, termina com exit 0; com `PYTHONIOENCODING=utf-8` também. Não tem
relação com o código. Sugestão para a pessoa: uma linha em `docs/development-guide.md` § 9 (não
editei para evitar conflito com a tarefa paralela que mexe nesse arquivo).

## 5. Decisões tomadas

- Unidade dentro do value object (`Length.meters`, `Mass.kilograms`, `Angle.degrees`) em vez de
  sufixo no nome do campo da entidade: os nomes pedidos na tarefa (`boom_length`, `working_radius`,
  `max_capacity`) ficam como na doc-fonte § 10.2 e a unidade continua explícita no acesso.
- `CapacityResult` como união de dois tipos (`CapacityFound | CapacityUnsupported`) em vez de uma
  classe com `capacity: Mass | None`: quem recebe "não suportado" não tem número para ler por engano,
  e o mypy obriga a tratar os dois casos (premissa de segurança, doc-fonte § 2.3).
- O resultado traz `load_chart_id` além de `load_chart_version`: a doc-fonte não diz se a versão é
  única entre configurações (pendência 6).
- Um único motivo de "não suportado" (`POINT_NOT_IN_CHART`), sem separar "fora dos limites" de
  "entre pontos": definir os limites de uma tabela (retângulo? faixa de raio por comprimento?) seria
  inventar regra. Para o usuário, os dois casos são "sem capacidade" (RN-007).
- `ExactPointLookup` herda explicitamente do Protocol para o mypy verificar a assinatura dentro de
  `app/` (os testes não passam pelo gate do mypy).
- Igualdade exata de `float` na busca do ponto, sem tolerância (pendência 1).
- `LoadChart` e os value objects são `dataclass(frozen=True)`; `LoadChart` não tem transições de
  status (pendência 3).
- Docstrings e comentários em português, como o comentário já existente em
  `backend/tests/test_openapi.py` (o idioma dos comentários está "A VALIDAR" em
  `docs/development-guide.md` § 5); identificadores em inglês.
- Nenhum ADR: não houve decisão arquitetural nova (a porta e a estratégia seguem a doc-fonte § 14.4
  e o ADR-004).

## 6. Regras de negócio aplicadas

- RN-001 — `LoadChart.configuration_id` obrigatório (`test_ficticio_chart_requires_id_version_and_configuration`).
- RN-004 — capacidade só vem de um ponto da tabela (`test_ficticio_chart_exact_point_returns_its_capacity`).
- RN-005 — id e versão da tabela em todo resultado (`test_ficticio_chart_result_carries_chart_id_and_version`).
- RN-006 — unidades internas m / graus / kg (`backend/tests/domain/test_quantities.py`).
- RN-007 — consulta fora de ponto exato → `CapacityUnsupported` com motivo
  (`test_ficticio_chart_query_off_exact_points_is_unsupported_because_interpolation_is_pending`).
- O campo "Testes relacionados" de `docs/business-rules.md` **não** foi preenchido: o arquivo é
  protegido (pendência 8).
- Regras **não documentadas** encontradas: ver § 8, itens 1 a 7.

## 7. O que NÃO foi feito e por quê

- Interpolação, arredondamento, valor conservador, extrapolação: PEND-001..003, RN-007.
- Níveis de status/alerta e `SafetyValidator`: PEND-004, P-005.
- Transições de status e `LoadChartResolver` (seleção da tabela `ACTIVE`): transições não definidas;
  fora do escopo desta tarefa.
- Campo de origem da tabela (RNF-005, doc-fonte § 13.1 "versão/origem informadas"): a tarefa pediu
  só id, versão, configuração, status e pontos (pendência 6).
- Validações de importação da doc-fonte § 13.1 que não são invariantes da entidade ("unidades
  reconhecidas", "comprimentos/raios ordenáveis", "vínculo com configuração existente", relatório de
  inconsistências): são do importador, que não existe ainda.
- Conversão de unidades: fora do escopo (PEND-008; doc-fonte § 26, pergunta 10).
- Endpoints, casos de uso, persistência: fora do escopo.
- Revisão independente: NÃO EXECUTADA (é o próximo passo).

## 8. Pendências / decisões necessárias (para a pessoa responsável)

| # | Pergunta | Bloqueia? | Resposta | Respondida em |
|---|----------|-----------|----------|---------------|
| 1 | A busca de ponto exato usa igualdade exata de `float` (5,000001 m ≠ 5,0 m). Quando o raio vier da geometria (P-001), haverá tolerância para "mesmo ponto"? Qual? (liga-se a PEND-002 e à tolerância dos golden tests, P-007) | não (hoje); sim para usar raio calculado | | |
| 2 | Tabela sem nenhum ponto é aceita hoje (e toda consulta volta "não suportada"). Deve ser recusada, sempre ou só em `ACTIVE`? | não | | |
| 3 | Quais transições de status são permitidas (a doc-fonte § 13.2 só "sugere" os estados)? O que é o "modo técnico de validação" que deixa tabela não `ACTIVE` participar de simulação? Hoje `ExactPointLookup` não olha o status; a seleção fica para o `LoadChartResolver` | não | | |
| 4 | O que significa capacidade 0 num ponto da tabela (posição proibida?). Hoje o ponto é aceito, a consulta devolve 0 kg e a utilização com capacidade 0 levanta `UndefinedUtilizationError` | não | | |
| 5 | Pontos repetidos com a mesma capacidade são aceitos e mantidos como vieram (a doc-fonte só proíbe duplicata **conflitante**). Deveriam ser recusados ou deduplicados? | não | | |
| 6 | A `version` da tabela é única no sistema ou só dentro da configuração? (o resultado traz id e versão por isso). A `LoadChart` deve ter campo de origem/documento-fonte (RNF-005)? | não | | |
| 7 | Comprimento de lança 0 m e raio 0 m são aceitos (só negativos são recusados). Deve haver mínimo? (P-001, P-002) | não | | |
| 8 | Preencher "Testes relacionados" de RN-001, RN-004, RN-005, RN-006 e RN-007 em `docs/business-rules.md` com os testes do § 6 (arquivo protegido; agente não edita) | não | | |
| 9 | Consolidar este handoff em `handoffs/current.md` quando as tarefas paralelas forem mergeadas (hoje o `check-structure.sh` falha por isso); conferir que `tasks/in-progress/` não passe de 2 tarefas (a TASK-005 ainda está lá em `c0955b2`) | sim, para o CI do PR ficar verde | | |
| 10 | O ID `L-004` em `docs/known-gaps.md` pode colidir com linhas criadas pelas tarefas paralelas; renumerar no merge se preciso | não | | |
| 11 | Idioma dos comentários/docstrings no código ("A VALIDAR" em `docs/development-guide.md` § 5): usei português | não | | |

## 9. ⚠️ Segurança

- nada a relatar (sem segredos, sem dados reais; dados de teste FICTÍCIOS e rotulados).

## 10. Próximo passo

**Papel:** Revisor (outra sessão/ferramenta, AGENTS.md § 3); depois a pessoa responsável (pendências e PR)

**O que fazer, concretamente:**
1. Revisar `git diff development...task/TASK-008-nucleo-dominio-tabela-carga` com
   `docs/templates/code-review-template.md`, conferindo que nada de PEND-001..004 foi implementado.
2. Rodar os gates em `backend/` (tabela do § 4) e confirmar as saídas.
3. Pessoa: responder o § 8, consolidar os handoffs em `current.md` e abrir o PR (o agente não fez push).

**Ler primeiro (nesta ordem):**
1. `AGENTS.md`
2. este handoff
3. `tasks/in-progress/TASK-008-nucleo-dominio-tabela-carga.md` § 3 (critérios de aceite)
4. `backend/app/domain/services/exact_point_lookup.py` e `load_chart_interpolator.py` (contrato da porta)
5. `backend/app/domain/entities/load_chart.py` (invariantes)
6. `docs/produto/documentacao-tecnica-v0.1.md` §§ 13 e 14

**Cuidado com:**
- Os números de `backend/tests/fixtures/load_chart_ficticio.py` são FICTÍCIOS; não usar fora dos testes.
- No Windows, `uv run lint-imports >/dev/null` falha por encoding (§ 4), não por contrato quebrado.

## 11. Como revisar este trabalho

- Comece por `backend/app/domain/services/exact_point_lookup.py` e
  `backend/app/domain/value_objects/capacity_result.py`: é onde está a garantia de "não inventar
  capacidade".
- Depois `backend/app/domain/entities/load_chart.py`: o índice `_points_by_key` é campo privado de
  dataclass congelada (`init=False`, `compare=False`), montado no `__post_init__`.
- Tenho menos certeza sobre a escolha de `CapacityResult` como união (em vez de classe única) e sobre
  herdar explicitamente do Protocol; as duas são de estilo e fáceis de trocar.
- Os testes cobrem ponto exato, entre pontos, fora da faixa, comprimento inexistente, quase igual,
  tabela vazia, versão no resultado; não cobrem desempenho (RNF-003) — tabela real ainda não existe.
