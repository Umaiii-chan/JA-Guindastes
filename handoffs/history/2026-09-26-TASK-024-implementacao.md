# Handoff — TASK-024 — implementação (endpoint REST de avaliação)

| Campo | Valor |
|-------|-------|
| **Data/hora** | 2026-09-26 (UTC-3, Brasília) |
| **Tarefa** | `tasks/in-progress/TASK-024-endpoint-avaliacao.md` |
| **Etapa concluída** | implementação (com testes) |
| **Papel exercido** | Planejador, Engenheiro de testes e Implementador (agente único; AGENTS.md § 3) |
| **Ferramenta/agente** | Claude Code (modelo Opus 5.5), agente em segundo plano num worktree isolado |
| **Branch** | `task/TASK-024-endpoint-avaliacao` (a partir de `a5b1ab0`) |
| **Duração aproximada** | ~1 h (com uma pausa por limite de uso) |

---

## 1. Objetivo desta etapa

Expor o `EvaluateOperation` por REST, com provedores e estratégia injetados em `create_app` e a
`ConservativeTabulatedLookup` (ADR-015) na composição.

## 2. O que foi feito

- Criei `backend/app/presentation/api/evaluations.py`: `POST /api/v1/evaluations`,
  `EvaluationDependencies` (provedor da ficha técnica, provedor da tabela ativa, estratégia) e
  `create_evaluations_router`.
- Criei `backend/app/presentation/api/evaluation_schemas.py`: `EvaluationRequest` (strict, sem
  `NaN`/infinito, sem campos extras, `ge=0` em comprimentos e carga) e `EvaluationResponse`
  (geometria, capacidade com ponto usado e estratégia, utilização, id/versão da tabela, motivos).
- Criei `backend/app/presentation/api/validation_errors.py`: handler do 422 que troca números não
  finitos por texto em `detail[].input`. **Achado:** sem ele, `NaN`/`Infinity`/`1e400` no corpo
  davam `ValueError` na serialização do 422 padrão do FastAPI (500 no servidor real).
- Alterei `backend/app/presentation/api/main.py`: `create_app(..., evaluation=None)` registra a rota
  só com as dependências; registra o handler do 422 (vale para todas as rotas; o formato do corpo
  não muda).
- Alterei `backend/app/main.py`: `UnconfiguredCraneGeometryProvider` e
  `UnconfiguredActiveLoadChartProvider` (PROVISÓRIOS, sempre `None`) + `ConservativeTabulatedLookup`
  em `evaluation_dependencies`, passados a `create_app`.
- Escrevi `backend/tests/presentation/test_evaluations.py` e `test_openapi_evaluations.py` (dados
  FICTÍCIOS das fixtures existentes, só importadas).

### Contrato

`POST /api/v1/evaluations` — corpo JSON:

```json
{"configuration_id": "CFG-FICTICIA-AVALIACAO", "boom_length_m": 20.0, "boom_angle_deg": 30.0,
 "turret_rotation_deg": 0.0, "cable_length_m": 1.0, "load_weight_kg": 1500.0}
```

Resposta 200 (dados FICTÍCIOS, saída real do teste):

```json
{"status": "EVALUATED", "configuration_id": "CFG-FICTICIA-AVALIACAO",
 "geometry": {"working_radius_m": 18.8205, "tip_height_m": 12.5, "hook_height_m": 11.5,
   "boom_pivot": {"x_m": 0.0, "y_m": 2.5, "z_m": 1.5},
   "boom_tip": {"x_m": 0.0, "y_m": 12.5, "z_m": 18.8205},
   "hook": {"x_m": 0.0, "y_m": 11.5, "z_m": 18.8205}},
 "capacity": {"maximum_capacity_kg": 2000.0, "strategy": "CONSERVATIVE_PROVISIONAL",
   "queried_boom_length_m": 20.0, "queried_working_radius_m": 18.8205,
   "used_point": {"boom_length_m": 20.0, "working_radius_m": 21.5, "max_capacity_kg": 2000.0}},
 "utilization_percent": 75.0, "load_chart_id": "LC-FICTICIO-AVALIACAO-001",
 "load_chart_version": "FICTICIO-AVALIACAO-v1", "reasons": []}
```

"Não avaliável" (composição atual, sem repositórios):

```json
{"status": "NOT_EVALUABLE", "configuration_id": "...", "geometry": null, "capacity": null,
 "utilization_percent": null, "load_chart_id": null, "load_chart_version": null,
 "reasons": [{"code": "CRANE_GEOMETRY_NOT_FOUND", "category": "EVALUATION"},
             {"code": "ACTIVE_LOAD_CHART_NOT_FOUND", "category": "EVALUATION"}]}
```

Códigos: **200** avaliado ou não avaliável; **422** requisição malformada; **500** provedor da tabela
quebrando o contrato (`InconsistentActiveLoadChartError`). Categorias dos motivos: `EVALUATION`
(`NotEvaluableReason`), `OPERATIONAL_LIMIT` (`OperationalLimitViolation`), `LOAD_CHART_DOMAIN`
(`CapacityUnsupportedReason`).

## 3. Arquivos modificados

```text
 backend/app/main.py                                |  42 +-
 backend/app/presentation/api/evaluation_schemas.py | 269 ++++++++++++
 backend/app/presentation/api/evaluations.py        | 113 +++++
 backend/app/presentation/api/main.py               |  17 +-
 backend/app/presentation/api/validation_errors.py  |  36 ++
 backend/tests/presentation/test_evaluations.py     | 483 +++++++++++++++++++++
 .../tests/presentation/test_openapi_evaluations.py | 140 ++++++
 7 files changed, 1096 insertions(+), 4 deletions(-)
```

Mais esta tarefa e este handoff. Fora do escopo: nada.

## 4. Comandos executados e resultados

Em `backend/`, depois dos commits de código:

| Comando | Resultado | Saída (resumo) |
|---------|-----------|----------------|
| `uv sync --locked` | ✅ | `Checked 46 packages` |
| `uv run ruff check .` | ✅ | `All checks passed!` |
| `uv run ruff format --check .` | ✅ | `89 files already formatted` |
| `uv run mypy app` | ✅ | `Success: no issues found in 53 source files` |
| `uv run lint-imports` | ✅ | `Contracts: 3 kept, 0 broken.` |
| `uv run pytest` | ✅ | `464 passed, 2 skipped` (os 2 pulados são de integração com PostgreSQL) |
| `uv run pytest tests/presentation` | ✅ | `76 passed` |
| `bash scripts/check-structure.sh` (raiz) | ✅ | `OK: 0 erros, 2 aviso(s)` antes de criar esta tarefa (um aviso era a branch sem tarefa em `in-progress/`); rodado de novo no commit de encerramento |

Nenhum servidor foi iniciado.

## 5. Decisões tomadas

- **`POST /api/v1/evaluations` em vez de `/simulations/{id}/evaluate`** (doc-fonte § 15.3): não há
  simulações persistidas nem caso de uso de simulação; um id sem recurso seria inventado. A rota da
  doc-fonte pode reusar o mesmo caso de uso e os mesmos schemas quando as simulações existirem.
- **200 também para "não avaliável"**: é o resultado pedido, não erro de requisição (mesmo critério
  da TASK-019). Estado fora das faixas é `NOT_EVALUABLE`, não 422: quem conhece as faixas é a ficha
  técnica no backend (ADR-013 C-5; RN-008). O 422 só cobre forma (tipo, finito, `ge=0` como os value
  objects `Length`/`Mass`, id não vazio).
- **`strict` + `extra="forbid"`**: `"20"` e `true` não viram número; campo desconhecido (ex.:
  `crane_id` da doc-fonte § 14.2) dá 422, para um nome errado não ser ignorado. Inteiros são aceitos.
- **Nomes da doc-fonte § 14.3** onde havia: `working_radius_m`, `hook_height_m`,
  `maximum_capacity_kg`, `utilization_percent`, `load_chart_version`. O ponto usado reusa o
  `LoadChartPointResponse` da TASK-019 (`max_capacity_kg`). Sem `messages`: o texto das mensagens
  está pendente (doc-fonte § 26, pergunta 9); os motivos vão como código + categoria.
- **Sem nível de alerta** (PEND-004): `status` é `EVALUATED | NOT_EVALUABLE`; 150 % continua
  `EVALUATED` (testado).
- **Marca provisória** = `capacity.strategy: "CONSERVATIVE_PROVISIONAL"` (enum do domínio). Com uma
  estratégia sem marca (ex.: `ExactPointLookup`), `strategy`, consulta e ponto usado vêm `null`.
- **Capacidade 0 kg** (`UTILIZATION_UNDEFINED`) aparece em `capacity` do `NOT_EVALUABLE`, como no
  resultado do caso de uso; `CapacityUnsupported` vira `capacity: null` com o motivo.
- **Provedores provisórios em `app/main.py`** (não em `infrastructure/`, que é de outras tarefas
  nesta leva): nomes explícitos, docstring "PROVISÓRIO", sempre `None`, sem dados inventados. O
  motivo "configuração não encontrada" sai como os dois motivos já existentes
  (`CRANE_GEOMETRY_NOT_FOUND`, `ACTIVE_LOAD_CHART_NOT_FOUND`); não criei motivo novo na aplicação.
- **Handler do 422 em `create_app`**, para todas as rotas: corrige o 500 com número não finito sem
  mudar o formato do corpo `{"detail": [...]}`.
- **Rota síncrona**, caso de uso montado uma vez no router (sem estado).
- Sem ADR novo: segue ADR-004, 006, 010, 013 e 015.

## 6. Regras de negócio aplicadas

- RN-001/RN-004 — capacidade só da tabela ativa da configuração, pela estratégia injetada
  (`test_ficticio_radius_between_points_is_evaluated_with_the_conservative_capacity`).
- RN-005 — id e versão da tabela na resposta sempre que ela foi consultada (mesmo teste e
  `test_ficticio_state_outside_the_chart_domain_is_not_evaluable_with_the_chart_version`).
- RN-006 — sufixos `_m`, `_deg`, `_kg`.
- RN-007 — "não avaliável" explícito com motivos (testes da seção "Não avaliável").
- RN-008 — geometria calculada no backend e estado validado contra a ficha técnica.
- PEND-001..004 continuam abertas. `docs/business-rules.md` não foi alterado.

## 7. O que NÃO foi feito e por quê

- **Repositórios reais** na composição: são da TASK-022; trocar na leva B (§ 10).
- **Registro do WebSocket (TASK-025) em `create_app`**: esta tarefa é a única que edita `create_app`
  nesta leva; a TASK-025 precisará ser ligada na leva B.
- **Documentação** (`docs/`, `README.md`, `handoffs/current.md`): fora dos arquivos permitidos; lista
  em § 10.
- Push e PR: não feitos (instrução da leva).

## 8. Pendências / decisões necessárias (para a pessoa responsável)

| # | Pergunta | Bloqueia? | Resposta | Respondida em |
|---|----------|-----------|----------|---------------|
| 1 | A rota fica `POST /api/v1/evaluations` (estado avulso) até existirem simulações, e depois ganha `/simulations/{id}/evaluate`? Ou a avaliação avulsa deve sumir quando houver simulações? | não | | |
| 2 | Quer um motivo próprio `CONFIGURATION_NOT_FOUND` quando a configuração não existe (hoje saem `CRANE_GEOMETRY_NOT_FOUND` + `ACTIVE_LOAD_CHART_NOT_FOUND`)? Exigiria a porta distinguir "configuração inexistente" de "sem ficha/tabela" (aplicação). | não | | |
| 3 | `crane_id` (doc-fonte § 14.2) é recusado com 422 (`extra="forbid"`). Deve ser aceito (e ignorado ou conferido com a configuração)? | não | | |
| 4 | Mensagens legíveis para os motivos (doc-fonte § 26, pergunta 9): a resposta hoje só tem código e categoria. | não | | |

## 9. ⚠️ Segurança

- Rota sem autenticação (P-009; known-gaps L-003), como a da TASK-019. Nada é gravado.
- O 500 por `NaN`/infinito no 422 padrão foi corrigido (handler em `validation_errors.py`).

## 10. Próximo passo

**Papel:** Revisor (outra sessão/ferramenta); depois a pessoa responsável.

**O que fazer, concretamente:**
1. Revisar `git diff a5b1ab0...task/TASK-024-endpoint-avaliacao` com
   `docs/templates/code-review-template.md`: `app.presentation` não importa `app.infrastructure`;
   nenhum dado inventado na composição; `status` sem nível de alerta.
2. **Leva B:** em `backend/app/main.py`, trocar `UnconfiguredCraneGeometryProvider` e
   `UnconfiguredActiveLoadChartProvider` pelos repositórios da TASK-022 e ajustar
   `test_composed_app_answers_not_evaluable_without_inventing_data` (ele deixa de valer como está).
   Ligar também o router do WebSocket (TASK-025) em `create_app`.
3. Mudanças de documentação **necessárias** que não fiz:
   - `docs/architecture.md`: § 6/§ 9 — existe `POST /api/v1/evaluations` (avaliação sem
     persistência, consulta conservadora provisória, sem autenticação); § 2 — a raiz de composição
     também liga a avaliação (provedores provisórios até a TASK-022); citar
     `presentation/api/evaluations.py`.
   - `docs/known-gaps.md`: L-001 (há endpoint de avaliação, sem persistência nem simulação); L-003
     (mais um endpoint sem autenticação); L-004 (a estratégia em uso na composição é a
     `ConservativeTabulatedLookup`); nota de que a composição ainda não encontra nenhuma
     configuração até a TASK-022.
   - `docs/development-guide.md` § 3 e `README.md`: `uv run uvicorn app.main:app --reload` para a
     API completa (pendência herdada da TASK-019), agora também com a avaliação.
   - `docs/requirements/functional.md` / `non-functional.md`: RF-015..RF-018, RF-020 e RNF-007
     parcialmente expostos por REST, se a coluna de status acompanhar a implementação.
   - `handoffs/current.md`: registrar a TASK-024 e o § 8 acima.
   - Docstring de `backend/app/application/use_cases/evaluate_operation.py` ("não tem endpoint"):
     desatualizada; fora dos arquivos desta leva.

**Ler primeiro (nesta ordem):**
1. `AGENTS.md`
2. este handoff (§ 2 contrato, § 5 decisões)
3. `backend/app/presentation/api/evaluations.py` e `evaluation_schemas.py`
4. `backend/app/main.py`

**Cuidado com:**
- `app.main` fica fora das camadas do import-linter; os provedores provisórios estão lá de propósito.
- O handler do 422 vale para todas as rotas da app.

## 11. Como revisar este trabalho

- Comece por `evaluation_schemas.py` (`EvaluationResponse.from_evaluation`): é o mapeamento do
  resultado do caso de uso para o contrato.
- Tenho menos certeza sobre `extra="forbid"` (pendência 3) e sobre registrar o handler do 422 para a
  app inteira em vez de só para a rota de avaliação.
