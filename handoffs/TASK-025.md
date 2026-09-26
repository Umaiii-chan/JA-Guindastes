# Handoff — TASK-025 — implementação (WebSocket de avaliação em tempo real)

> **Tarefas em paralelo (leva A, TASK-021):** este handoff fica em `handoffs/TASK-025.md` e
> `handoffs/current.md` **não** foi editado.

| Campo | Valor |
|-------|-------|
| **Data/hora** | 2026-09-26 16:55 (UTC-3, Brasília) |
| **Tarefa** | `tasks/in-progress/TASK-025-websocket-avaliacao.md` |
| **Etapa concluída** | implementação |
| **Papel exercido** | Planejador + Engenheiro de testes + Implementador (um único agente, declarado conforme AGENTS.md § 3) |
| **Ferramenta/agente** | Claude Code (modelo Opus 5.5), subagente num git worktree isolado |
| **Branch** | `task/TASK-025-websocket-avaliacao` @ `2ccd5c7` (antes do commit deste handoff), a partir de `a5b1ab0` |
| **Duração aproximada** | ~50 min (com uma interrupção por limite de uso) |

---

## 1. Objetivo desta etapa

Criar o endpoint WebSocket de avaliação em tempo real da doc-fonte § 15.4 (ADR-010) como um
`APIRouter` devolvido por uma factory, com validação estrita das mensagens (RN-008), erro
estruturado sem derrubar a conexão e testes com `TestClient.websocket_connect`.

## 2. O que foi feito

- Criei a branch com `git switch -c task/TASK-025-websocket-avaliacao a5b1ab0` e confirmei com
  `git log -1` (`a5b1ab0 chore(protocolo): permitir até 15 tarefas em paralelo e abrir a leva A
  (TASK-021)`).
- Criei `backend/app/presentation/websocket/evaluation_messages.py`: schemas Pydantic da entrada
  (`SimulationStateChangedMessage`, `OperationalStatePayload`), da saída
  (`SimulationEvaluatedMessage` com `EvaluatedPayload | NotEvaluablePayload` discriminados por
  `result`) e do erro (`SimulationErrorMessage`, `ErrorCode`), mais o mapeamento do
  `OperationEvaluation` para a mensagem.
- Criei `backend/app/presentation/websocket/evaluation.py`:
  - `create_evaluation_websocket_router(evaluate_operation, *, max_message_bytes=8192) -> APIRouter`;
  - rota `EVALUATION_WEBSOCKET_PATH = "/api/v1/ws/evaluation"`;
  - `DEFAULT_MAX_MESSAGE_BYTES = 8 * 1024`, rotulado **PROVISÓRIO — A VALIDAR (P-008)**;
  - laço: `receive()` → tamanho (bytes UTF-8) → `json.loads` recusando `NaN`/`Infinity` →
    objeto? → tipo conhecido? → validação Pydantic estrita → `EvaluateOperation.execute` numa
    thread (`run_in_threadpool`) → `send_text`. Qualquer recusa vira `simulation.error` e o laço
    continua.
- Escrevi 51 testes em `backend/tests/presentation/websocket/test_evaluation_websocket.py` (mais
  o `__init__.py`), numa app FastAPI montada no teste com o `EvaluateOperation` real e provedores
  falsos, reutilizando **sem alterar** as fixtures FICTÍCIAS `tests/fixtures/crane_geometry_ficticia.py`
  e `tests/fixtures/avaliacao_operacional_ficticia.py`. Cenários na tarefa, § 9.
- Teste de mutação manual (script no scratchpad, fora do repositório, que altera
  `evaluation.py`, roda os testes do WebSocket e restaura byte a byte):

  ```text
  sequence nao ecoada no erro: FAILED ...::test_missing_payload_gets_an_error
  limite off-by-one: FAILED ...::test_message_at_the_limit_is_evaluated_and_one_byte_above_is_rejected
  aceita NaN: FAILED ...::test_malformed_text_gets_an_error_without_sequence_and_keeps_the_connection[nan-nao-e-json]
  erro de validacao fecha a conexao: ERROR ...::test_default_limit_rejects_a_large_message
  restaurado: True
  ```
  (a saída mostra só a última linha do pytest; as quatro mutações foram detectadas.)

## 3. Arquivos modificados

`git diff --stat a5b1ab0...HEAD` antes do commit deste handoff e da tarefa:

```text
 backend/app/presentation/websocket/evaluation.py   | 226 +++++++++
 .../presentation/websocket/evaluation_messages.py  | 288 +++++++++++
 backend/tests/presentation/websocket/__init__.py   |   0
 .../websocket/test_evaluation_websocket.py         | 527 +++++++++++++++++++++
 4 files changed, 1041 insertions(+)
```

Mais `tasks/in-progress/TASK-025-websocket-avaliacao.md` e este handoff, no commit final.

Fora do escopo: nenhum. Só arquivos novos. Não editei `backend/app/presentation/websocket/__init__.py`
(já existia), `backend/app/presentation/api/main.py`, `backend/app/main.py`, `backend/pyproject.toml`,
`backend/uv.lock`, `tests/fixtures/`, `docs/`, `README.md` nem `handoffs/current.md`.

## 4. Comandos executados e resultados

Em `backend/`, exceto o `check-structure.sh` (raiz), com o código final (`2ccd5c7`).

| Comando | Resultado | Saída (resumo) |
|---------|-----------|----------------|
| `uv sync --locked` | ✅ passou | instalou o ambiente do worktree, incluindo `websockets==17.1` (já no lock via `uvicorn[standard]`) |
| `uv run ruff check .` | ✅ passou | `All checks passed!` |
| `uv run ruff format --check .` | ✅ passou | `88 files already formatted` |
| `uv run mypy app` | ✅ passou | `Success: no issues found in 52 source files` |
| `uv run lint-imports` | ✅ passou | `Contracts: 3 kept, 0 broken.` |
| `uv run pytest` | ✅ passou | `471 passed, 2 skipped in 4.19s` (51 novos) |
| `uv run pytest tests/presentation/websocket` | ✅ passou | `51 passed in 0.83s` |
| `bash scripts/check-structure.sh` | ✅ passou | `OK: 0 erros, 1 aviso(s)` (aviso: 3 tarefas em `in-progress/`; antes deste handoff existir, falhava com "TASK-025 sem handoff"), ver § 4.1 |

### 4.1 `check-structure.sh` depois do handoff

Rodado com este handoff e a tarefa já no disco:

```text
  ! há 3 tarefas em tasks/in-progress/ — confirme que não tocam os mesmos arquivos
OK: 0 erros, 1 aviso(s)
```

O aviso é esperado na leva A (tarefas paralelas em arquivos disjuntos).

## 5. Decisões tomadas

- **Configuração informada em cada mensagem (`payload.configuration_id`), e não na rota.** A
  doc-fonte § 15.4 usa `WS /api/v1/ws/simulations/{simulation_id}` e a simulação é quem conhece a
  configuração e a carga; ela ainda não existe. Opções: (a) a configuração na rota, (b) no
  `payload`. Escolhi (b) porque: não inventa um recurso REST novo (`/configurations/{id}/...`) que
  depois seria abandonado; mantém o servidor sem estado por conexão (cada mensagem se basta, como a
  `load_weight_kg`, que a doc-fonte já põe no `payload`); e a migração é aditiva — quando a
  simulação existir, a rota ganha `simulation_id` e o campo sai do `payload`. **Decisão
  provisória**, pendência 1 no § 8.
- **Rota provisória `/api/v1/ws/evaluation`**, constante `EVALUATION_WEBSOCKET_PATH`, pelo mesmo
  motivo (sem `simulation_id`). Pendência 1.
- **Resposta sem `status`** (a doc-fonte mostra `"status": "WARNING"`): PEND-004. O campo
  `result` (`EVALUATED` | `NOT_EVALUABLE`) tem outro nome de propósito, para não ser confundido com
  nível de alerta. `NOT_EVALUABLE` não tem `utilization_percent` (mesmo raciocínio do domínio).
- **Nomes da doc-fonte mantidos** onde ela os define: `working_radius_m`, `maximum_capacity_kg`,
  `utilization_percent`, `load_weight_kg`, `boom_length_m`...
- **Marca provisória:** `capacity.strategy = "CONSERVATIVE_PROVISIONAL"`, com `queried_radius_m` e
  `used_point` (ADR-015 item 4). Com uma estratégia sem marca (`ExactPointLookup`), os três são
  `null`.
- **Validação estrita (RN-008):** Pydantic `strict=True`, `extra="forbid"`, `allow_inf_nan=False`.
  Só recusa o que os value objects já recusam (não finito; comprimento e massa negativos) e o que é
  malformado. As faixas da ficha técnica **não** são erro de mensagem: estado fora delas é
  `NOT_EVALUABLE` com os motivos (ADR-013 C-5). `sequence` só precisa ser inteiro (não booleano);
  nenhuma faixa nem ordem é exigida (a doc-fonte não define) — pendência 3.
- **Códigos de erro:** `MALFORMED_MESSAGE`, `MESSAGE_TOO_LARGE`, `UNKNOWN_MESSAGE_TYPE`,
  `INVALID_MESSAGE`, `INTERNAL_ERROR`. O `sequence` é ecoado sempre que for inteiro; na mensagem
  grande demais, não (ela não é lida).
- **Limite de 8 KiB (UTF-8), PROVISÓRIO — A VALIDAR (P-008).** Uma mensagem típica tem < 300
  bytes. É conferido depois de o servidor ASGI receber a mensagem; a proteção de memória real é o
  `--ws-max-size` do uvicorn (padrão 16 MiB), na composição — pendência 2.
- **Falha inesperada na avaliação** (ex.: `InconsistentActiveLoadChartError`): `logger.exception`
  e `INTERNAL_ERROR` genérico com o `sequence`, sem detalhes internos, mantendo a conexão.
- **`EvaluateOperation.execute` numa thread** (`run_in_threadpool`): os adapters reais dos
  provedores (TASK-022) podem fazer E/S síncrona no banco e não devem travar o laço de eventos.
- **Schemas próprios no pacote `websocket`**, sem importar `app.presentation.api.load_chart_schemas`,
  para não acoplar a arquivos que tarefas paralelas podem mudar. Pendência 4 (alinhar com a TASK-024).
- **Sem dependência nova:** `websockets` já vem com `uvicorn[standard]` e o `TestClient` do
  Starlette testa WebSocket sem nada a mais.

## 6. Regras de negócio aplicadas

- RN-008 — o backend valida a mensagem e calcula tudo; o cliente só envia o estado. Testes de erro.
- RN-007 — "não avaliável" com os motivos do caso de uso, sem tradução. Testes `NOT_EVALUABLE`.
- RN-004 / RN-005 — capacidade e id/versão da tabela vêm do `EvaluateOperation`.
- PEND-004 — nenhum nível de alerta (`test_ficticio_response_has_no_alert_status`).
- Regra **não documentada**: o que o servidor faz com `sequence` fora de ordem ou repetido →
  não inventei regra (ecoa sempre); § 8, pendência 3.

## 7. O que NÃO foi feito e por quê

- **Registro do router na aplicação**: fica para a leva B (`app.main`/`app.presentation.api.main`
  são da TASK-024). Por isso não há teste manual com `uvicorn` nem contra `app.main:app`.
- Rota `/api/v1/ws/simulations/{simulation_id}`: não há simulação persistida.
- Autenticação e validação de `Origin` (P-009), limite de taxa de mensagens e descarte de
  mensagens antigas no servidor: não definidos; não inventei.
- Documentação (`docs/`, `README.md`): proibido editar nesta leva; lista no § 10.

## 8. Pendências / decisões necessárias (para a pessoa responsável)

| # | Pergunta | Bloqueia? | Resposta | Respondida em |
|---|----------|-----------|----------|---------------|
| 1 | Aceita a rota provisória `/api/v1/ws/evaluation` com `configuration_id` no `payload` até existir a simulação persistida (depois: `/api/v1/ws/simulations/{simulation_id}`, doc-fonte § 15.4)? | não | | |
| 2 | Limite de 8 KiB por mensagem (A VALIDAR, P-008) e `--ws-max-size` do uvicorn a configurar na composição/Docker (TASK-027/leva B): qual valor? | não | | |
| 3 | O servidor deve rejeitar `sequence` negativo, repetido ou fora de ordem, ou descartar mensagens antigas enfileiradas? Hoje ecoa qualquer inteiro e avalia todas, na ordem | não | | |
| 4 | Leva B: alinhar o formato do resultado com o endpoint REST de avaliação (TASK-024), talvez num módulo de schemas compartilhado | não | | |
| 5 | Validação de `Origin`, autenticação e limite de taxa no WebSocket (P-009) | não | | |
| 6 | Texto das mensagens de erro para o usuário e dos motivos (doc-fonte § 26, pergunta 9); hoje só códigos e mensagens técnicas em português | não | | |

## 9. ⚠️ Segurança

- Nada exposto. Riscos conhecidos e registrados: sem autenticação/`Origin` (P-009) e limite de
  tamanho conferido só depois da recepção (pendência 2).

## 10. Próximo passo

**Papel:** Revisor (outra sessão/ferramenta), depois Implementador da leva B.

**O que fazer, concretamente:**
1. Revisar `git diff a5b1ab0...task/TASK-025-websocket-avaliacao`.
2. Leva B: na raiz de composição, montar o `EvaluateOperation` com os adapters reais e chamar
   `app.include_router(create_evaluation_websocket_router(evaluate_operation))`.
3. Mudanças de documentação necessárias (não feitas aqui, leva A):
   - `docs/architecture.md` § 1 (aviso) e § 4: o WebSocket existe, rota provisória
     `/api/v1/ws/evaluation`, `configuration_id` no `payload`, resposta sem `SafetyValidator`/alerta,
     e o `simulation.error`;
   - `docs/known-gaps.md` L-001 e "não presuma" (l. 75, 90): WebSocket existe (ainda não registrado
     na app até a leva B); nova limitação: limite de mensagem provisório (P-008) e sem `Origin` (P-009);
   - `docs/development-guide.md` § 3/§ 4: como testar o WebSocket (`uv run pytest
     tests/presentation/websocket`) e, após a leva B, `--ws-max-size` no comando do uvicorn;
   - `docs/testing-strategy.md`: testes de WebSocket com `TestClient.websocket_connect` existem;
   - `README.md`: mencionar o endpoint quando ele estiver registrado na app;
   - `docs/business-rules.md` RN-008 "Testes relacionados": apontar para
     `backend/tests/presentation/websocket/test_evaluation_websocket.py` (pela pessoa responsável).

**Ler primeiro (nesta ordem):**
1. `AGENTS.md`
2. este handoff
3. `tasks/in-progress/TASK-025-websocket-avaliacao.md`
4. `backend/app/presentation/websocket/evaluation.py` (laço e validação)
5. `backend/app/presentation/websocket/evaluation_messages.py` (contrato)

**Cuidado com:**
- `json.loads` aceita `NaN`/`Infinity` por padrão e transforma `1e400` em infinito: o
  `parse_constant` e o `allow_inf_nan=False` cobrem os dois casos.
- O limite é conferido depois da recepção; não confie nele como proteção de memória.

## 11. Como revisar este trabalho

- Comece por `evaluation.py::_parse_state_changed` (ordem das verificações e `sequence` nos erros).
- Tenho menos certeza sobre a decisão de pôr `configuration_id` no `payload` (pendência 1) e sobre
  capturar `Exception` genérica na avaliação (escolhi manter a conexão e logar).
- `test_ficticio_sequence_is_echoed_as_sent_without_order_requirement` fixa o comportamento atual
  (ecoa `-3` e `2**63`); se a pendência 3 mudar, esse teste muda.

### Contrato das mensagens (exemplos com dados FICTÍCIOS)

Entrada:

```json
{"type": "simulation.state.changed", "sequence": 101,
 "payload": {"configuration_id": "CFG-FICTICIA-AVALIACAO", "boom_length_m": 20.0,
             "boom_angle_deg": 30.0, "turret_rotation_deg": 0.0, "cable_length_m": 1.0,
             "load_weight_kg": 1500.0}}
```

Avaliado:

```json
{"type": "simulation.evaluated", "sequence": 101,
 "payload": {"result": "EVALUATED",
   "geometry": {"working_radius_m": 18.82, "tip_height_m": 12.5, "hook_height_m": 11.5,
                "boom_pivot": {"x_m": 0.0, "y_m": 2.5, "z_m": 1.5}, "boom_tip": {"...": "..."},
                "hook": {"...": "..."}},
   "capacity": {"maximum_capacity_kg": 2000.0, "strategy": "CONSERVATIVE_PROVISIONAL",
                "queried_radius_m": 18.82,
                "used_point": {"boom_length_m": 20.0, "working_radius_m": 21.5,
                               "max_capacity_kg": 2000.0}},
   "utilization_percent": 75.0, "load_chart_id": "LC-FICTICIO-AVALIACAO-001",
   "load_chart_version": "FICTICIO-AVALIACAO-v1", "reasons": []}}
```

(Saída real gerada com o `TestClient` e as fixtures FICTÍCIAS, com os números arredondados aqui
para leitura — ex.: `working_radius_m` real `18.820508075688775`, `tip_height_m`
`12.499999999999998`; `"..."` omite coordenadas.)

Não avaliável:

```json
{"type": "simulation.evaluated", "sequence": 8,
 "payload": {"result": "NOT_EVALUABLE", "geometry": {"working_radius_m": 16.5, "...": "..."},
             "capacity": null, "load_chart_id": "LC-FICTICIO-AVALIACAO-001",
             "load_chart_version": "FICTICIO-AVALIACAO-v1",
             "reasons": ["BOOM_LENGTH_NOT_IN_CHART"]}}
```

Erro:

```json
{"type": "simulation.error", "sequence": 21,
 "payload": {"code": "INVALID_MESSAGE",
             "message": "a mensagem tem campos ausentes, desconhecidos ou inválidos",
             "errors": [{"location": ["payload", "boom_length_m"],
                         "message": "Input should be greater than or equal to 0",
                         "error_type": "greater_than_equal"}]}}
```
