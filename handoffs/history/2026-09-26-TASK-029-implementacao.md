# Handoff — TASK-029 — implementação

| Campo | Valor |
|-------|-------|
| **Data/hora** | 2026-09-26 (UTC-3, Brasília) |
| **Tarefa** | `tasks/in-progress/TASK-029-composicao-com-banco.md` |
| **Etapa concluída** | implementação (com testes) |
| **Papel exercido** | Planejador + Engenheiro de testes + Implementador (mesma sessão; revisão independente pendente) |
| **Ferramenta/agente** | Claude Code (Opus 5.5), agente em segundo plano num git worktree isolado |
| **Branch** | `task/TASK-029-composicao-com-banco` @ último commit desta branch (ver `git log -1`) |
| **Duração aproximada** | 1 h 30 min |

---

## 1. Objetivo desta etapa

Ligar os repositórios SQLAlchemy da TASK-022 à avaliação REST e WebSocket na raiz de composição,
aceitar a `Load` da TASK-028 no caso de uso e criar a rota de saúde pedida pela stack Docker.

## 2. O que foi feito

- Verifiquei `git log -1` após `git switch task/TASK-029-composicao-com-banco`:
  `e5a8945 chore(tasks): mover TASK-020 a 028 para completed e abrir a leva B`.
- `backend/app/application/use_cases/evaluate_operation.py`: novo `execute_for_load(configuration_id,
  state, load: Load)`, que usa `weight_compared_with_capacity(load)` e delega a `execute`. `execute`
  continua recebendo `load_weight: Mass` (entrada dos contratos REST/WS, que só têm
  `load_weight_kg`). Docstring do módulo atualizada (não dizia mais a verdade: "não tem endpoint").
- `backend/app/presentation/api/health.py` (novo): `GET /api/v1/health` → 200 com
  `{"status": "UP", "database": "NOT_CONFIGURED" | "UP" | "DOWN"}`. Recebe a verificação do banco
  pronta (`DatabaseHealthCheck = Callable[[], bool]`).
- `backend/app/presentation/api/evaluations.py`: `create_evaluations_router` aceita
  `EvaluationDependencies` (como antes; um caso de uso só) **ou** `EvaluateOperationDependency`
  (dependência FastAPI com `yield`, por requisição). A rota declara
  `use_case: Annotated[EvaluateOperation, Depends(...)]`. `shared_evaluate_operation(use_case)`
  embrulha um caso de uso fixo. Contrato REST (corpo, respostas, OpenAPI) sem mudança.
- `backend/app/presentation/api/main.py`: `create_app` ganhou `evaluation_websocket`
  (registra `create_evaluation_websocket_router`), `database_health_check` e `on_shutdown`
  (lifespan); a rota de saúde entra sempre. Registro dos routers organizado em um bloco por router.
- `backend/app/main.py`: `compose_app(environ)` escolhe a composição por `DATABASE_URL`:
  - com URL: `create_database_app(engine)` → REST com `evaluate_operation_per_request(engine)`
    (uma conexão do pool por requisição, devolvida no `with`, também em erro), WebSocket com um
    `EvaluateOperation` sobre a fábrica de sessões do engine, saúde com `SELECT 1`,
    `engine.dispose` no encerramento;
  - sem URL (ausente/em branco): `create_app_without_database()` → provedores "não configurados",
    aviso no log (`app.main`: "DATABASE_URL não definida: persistência não configurada; ...");
  - URL inválida: `DatabaseConfigurationError` (a app não sobe; a mensagem não repete a URL).
  - REST e WS usam a mesma montagem (`build_evaluate_operation`) e a mesma estratégia
    (`load_chart_interpolator = ConservativeTabulatedLookup()`).
- Testes:
  - `backend/tests/test_composition.py` (novo; recebeu os dois testes da raiz de composição que
    estavam em `tests/presentation/test_evaluations.py`, adaptados);
  - `backend/tests/test_composition_integration.py` (novo, marcador `integration`, padrão
    `REQUIRE_INTEGRATION_DB`): grava pelos repositórios uma configuração FICTÍCIA com ficha e tabela
    `ACTIVE` e avalia por REST e WS → `EVALUATED`; configuração inexistente → `NOT_EVALUABLE`;
    saúde `UP`. Os dados são **commitados** (a app abre as próprias conexões) com ids de sufixo
    único e apagados no `finally`;
  - `backend/tests/presentation/test_health.py` (novo);
  - `backend/tests/application/test_evaluate_operation.py`: 3 testes de `execute_for_load`.

## 3. Arquivos modificados

```text
$ git diff --stat e5a8945...HEAD   (antes do commit do handoff/tarefa)
 .../application/use_cases/evaluate_operation.py    |  37 +++-
 .../app/domain/services/compared_load_weight.py    |   4 +-
 backend/app/main.py                                | 177 ++++++++++++---
 backend/app/presentation/api/evaluations.py        |  69 ++++--
 backend/app/presentation/api/health.py             |  70 ++++++
 backend/app/presentation/api/main.py               |  56 ++++-
 .../tests/application/test_evaluate_operation.py   |  58 +++++
 backend/tests/presentation/test_evaluations.py     |  35 +--
 backend/tests/presentation/test_health.py          |  38 ++++
 backend/tests/test_composition.py                  | 240 +++++++++++++++++++++
 backend/tests/test_composition_integration.py      | 195 +++++++++++++++++
 11 files changed, 893 insertions(+), 86 deletions(-)
```

Mais `handoffs/TASK-029.md` e `tasks/in-progress/TASK-029-composicao-com-banco.md`.

Fora da lista de arquivos da tarefa (justificativa):
- `backend/app/presentation/api/evaluations.py` — a dependência por requisição precisa estar
  declarada na rota; nenhuma tarefa paralela da leva B mexe nele.
- `backend/app/domain/services/compared_load_weight.py` — só a docstring, que dizia que a integração
  com o `EvaluateOperation` "fica para a leva B".
- `backend/tests/presentation/test_evaluations.py` — removidos os 2 testes da raiz de composição
  (movidos para `tests/test_composition.py`) e o import de `app.main`.

## 4. Comandos executados e resultados

| Comando (em `backend/`) | Resultado | Saída (resumo) |
|---------|-----------|----------------|
| `uv sync --locked` | ✅ | ambiente instalado, sem mudança no lock |
| `uv run ruff check .` | ✅ | `All checks passed!` |
| `uv run ruff format --check .` | ✅ | `122 files already formatted` |
| `uv run mypy app` | ✅ | `Success: no issues found in 71 source files` |
| `uv run lint-imports` | ✅ | `Contracts: 3 kept, 0 broken.` |
| `uv run pytest` | ✅ | `661 passed, 19 skipped in 17.59s` (skips = integração sem banco; 4 deles são desta tarefa) |
| `DATABASE_URL=<postgres FICTÍCIO em 127.0.0.1:1> uv run pytest` | ✅ | `661 passed, 19 skipped in 68.21s` (simula o CI: `app.main` importado com URL definida e banco que não responde) |
| `bash scripts/check-structure.sh` (raiz) | ✅ | `OK: 0 erros, 0 aviso(s)` |
| integração com PostgreSQL (`REQUIRE_INTEGRATION_DB=1`) | ⚠️ NÃO EXECUTADO | Docker não sobe nesta máquina; o CI valida (job de backend roda `alembic upgrade head` + `pytest`) |

## 5. Decisões tomadas

- **Sessão por requisição (REST) = uma conexão do pool por requisição.** Os repositórios da TASK-022
  recebem um `sessionmaker` e abrem/fecham uma sessão por método (não aceitam uma `Session`). Para
  não mexer neles, a dependência FastAPI faz `with engine.connect() as connection:` e entrega um
  `EvaluateOperation` com repositórios sobre `sessionmaker(bind=connection)`. As duas consultas da
  avaliação usam a mesma conexão; como ela não está em transação aberta por fora, cada sessão abre e
  encerra a própria (gravações futuras não seriam descartadas). O fechamento é garantido pelo `with`
  (o FastAPI repassa a exceção da rota ao gerador) — teste com contagem de checkout/checkin do pool.
- **WebSocket: sessões por mensagem, não por conexão.** O router da TASK-025 recebe um
  `EvaluateOperation` pronto; a composição o monta sobre a fábrica de sessões do engine, então cada
  mensagem abre e fecha as próprias sessões (uma por consulta) e nada fica preso à conexão WS. Sessão
  por conexão prenderia uma conexão do pool enquanto o cliente estivesse conectado (pool padrão 5 +
  10: o 16º cliente bloquearia) e leria dados velhos (tabela ativada depois da abertura). Assim o
  `websocket/evaluation.py` não mudou.
- **`execute_for_load` em vez de trocar a assinatura de `execute`.** Os contratos REST/WS só têm
  `load_weight_kg`; montar uma `Load` exigiria inventar descrição e dimensões (> 0). `execute` segue
  sendo a entrada deles; `execute_for_load` é a entrada para quem tem a carga completa.
- **Saúde responde 200 mesmo com banco `DOWN`.** A rota mede "processo vivo"; o banco é informativo.
  O log da falha leva só o tipo da exceção (sem URL, host nem mensagem do driver).
- **`DATABASE_URL` inválida derruba a subida** em vez de cair para "sem banco": configuração errada não
  deve parecer "não configurada".
- **SQLite só como dublê do pool** em `test_composition.py` (ciclo de vida da conexão); as tabelas da
  TASK-022 não sobem no SQLite (`num_nulls` do PostgreSQL). ADR-007 inalterado.
- Nenhuma dependência nova.

## 6. Regras de negócio aplicadas

- RN-006 / PEND-006 — peso comparado = peso informado (`weight_compared_with_capacity`), sem mudança;
  teste `test_evaluating_a_load_equals_evaluating_its_compared_weight`.
- RN-001, RN-004, RN-005 — tabela `ACTIVE` gravada pelo repositório e versão na resposta
  (`test_rest_evaluates_a_configuration_stored_by_the_repositories`, integração).
- RN-007 — sem banco, "não avaliável" com motivos explícitos (`test_composition.py`).

## 7. O que NÃO foi feito e por quê

- Testes de integração com PostgreSQL: NÃO EXECUTADOS localmente (Docker indisponível); ficam para o CI.
- Healthcheck do `backend/Dockerfile` e do `docker-compose.yml` continua em `/openapi.json`: fora dos
  arquivos desta tarefa (ver § 10).
- `--ws-max-size` do uvicorn (pendência da TASK-025) não configurado: é o comando do Dockerfile.
- Nenhum timeout de conexão foi imposto ao engine: valor não definido (ver § 8, item 2).

## 8. Pendências / decisões necessárias (para a pessoa responsável)

| # | Pergunta | Bloqueia? | Resposta | Respondida em |
|---|----------|-----------|----------|---------------|
| 1 | O healthcheck do Docker deve considerar o backend "unhealthy" quando `database` for `DOWN`? Hoje a rota responde 200 nos dois casos (processo vivo) | não | | |
| 2 | Timeout de conexão ao banco (hoje o do driver/SO; a saúde pode demorar com o banco inacessível na rede). Qual valor (ex.: `connect_timeout` na `DATABASE_URL`)? | não | | |
| 3 | Quer uma transação única (e isolamento `REPEATABLE READ`) por avaliação, para ler ficha e tabela no mesmo instantâneo? Hoje são duas sessões na mesma conexão (`READ COMMITTED`) | não | | |
| 4 | Com banco configurado mas fora do ar, a avaliação REST dá 500 e o WS responde `simulation.error` com `INTERNAL_ERROR` (tratamento da TASK-025; não testado aqui com banco real). Deve virar um erro próprio (ex.: 503) ou um motivo "não avaliável"? | não | | |
| 5 | A API deve receber a carga completa (`Load`: descrição, dimensões, CG) em vez de só `load_weight_kg`? `execute_for_load` já existe para isso | não | | |

## 9. ⚠️ Segurança

Nada exposto. A saúde e os logs não levam URL, usuário, host nem mensagem do driver (testado com
uma senha FICTÍCIA). Os dados de teste são FICTÍCIOS.

## 10. Próximo passo

**Papel:** Revisor (outra sessão/ferramenta), depois Pessoa responsável.

**O que fazer, concretamente:**
1. Conferir no CI o job de backend (os 4 testes de `tests/test_composition_integration.py` precisam
   passar com `REQUIRE_INTEGRATION_DB=1`).
2. Revisar `git diff e5a8945...task/TASK-029-composicao-com-banco`.
3. Mescla com TASK-030/031: cada uma acrescenta um parâmetro opcional e um bloco `if ... is not None:
   app.include_router(...)` em `create_app`, e passa o adapter em `create_database_app` (e, se fizer
   sentido, em `create_app_without_database`) em `backend/app/main.py`.
4. **Mudanças fora dos arquivos desta tarefa (não feitas):**
   - `backend/Dockerfile` (`HEALTHCHECK`) e `docker-compose.yml` (`healthcheck` do backend): trocar
     `/openapi.json` por `/api/v1/health` e remover o comentário "Não há rota de saúde dedicada";
     decidir o item 1 do § 8.
   - `docs/architecture.md`: § 2 — a raiz de composição escolhe a composição por `DATABASE_URL`
     (repositórios SQLAlchemy ou provedores "não configurados"); conexão por requisição no REST,
     sessões por mensagem no WS; § 6/§ 9 — rotas `GET /api/v1/health` e WebSocket registrado.
   - `docs/known-gaps.md`: L-001 (avaliação já lê do banco quando configurado); nota "composição não
     encontra nenhuma configuração" deixa de valer com `DATABASE_URL`; novas pendências do § 8.
   - `docs/development-guide.md` § 3/§ 6: sem `DATABASE_URL` a API sobe em modo "persistência não
     configurada"; com URL, precisa do banco em `head`; `curl .../api/v1/health`.
   - `docs/testing-strategy.md`: testes de integração da composição gravam e apagam (não usam a
     transação desfeita), ids com sufixo único.
   - `docs/requirements/functional.md`: RF-011 (carga aceita pelo caso de uso via
     `execute_for_load`, sem API).
   - `README.md`: rota de saúde e WebSocket disponíveis em `app.main:app`.
   - `handoffs/current.md`: registrar a TASK-029 e o § 8.

**Ler primeiro (nesta ordem):**
1. `AGENTS.md`
2. este handoff (§ 5)
3. `backend/app/main.py`
4. `backend/app/presentation/api/main.py` e `evaluations.py`
5. `backend/tests/test_composition.py` e `test_composition_integration.py`

**Cuidado com:**
- `app.main:app` é montado na importação: no CI (`DATABASE_URL` definida) todos os testes que
  importam `app.main` usam a composição com banco (sem conectar até a primeira requisição).
- O teste de integração **commita** dados; se o `finally` falhar, o teste da migration da TASK-022
  (que desce só com tabelas vazias) quebra.

## 11. Como revisar este trabalho

- Comece por `backend/app/main.py` (`evaluate_operation_per_request`, `compose_app`).
- Tenho menos certeza sobre o comportamento das sessões em `sessionmaker(bind=connection)` para
  **gravações** (hoje só há leituras nessa via): pela documentação do SQLAlchemy 2.x, com a conexão
  sem transação externa a sessão é dona da transação e o commit vale; não há teste de escrita nessa
  via.
- A integração não foi executada localmente; conferir no CI.
