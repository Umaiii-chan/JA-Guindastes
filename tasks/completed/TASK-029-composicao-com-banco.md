# TASK-029 — Compor a API com o banco: repositórios reais, WebSocket registrado, carga e saúde

| Campo | Valor |
|-------|-------|
| **Status** | completed |
| **Prioridade** | alta |
| **Criada em** | 2026-09-26 por pessoa responsável (leva B, via orquestrador) |
| **Iniciada em** | 2026-09-26 |
| **Concluída em** | 2026-09-26 |
| **Branch** | `task/TASK-029-composicao-com-banco` (a partir de `development` @ `e5a8945`) |
| **PR** | [#30](https://github.com/Umaiii-chan/JA-Guindastes/pull/30), mergeado em 2026-09-26 com CI verde |
| **Requisitos** | RF-011, RF-015..RF-018, RF-020, RNF-007 |
| **Regras de negócio** | RN-001, RN-004..RN-008; PEND-006 (sem mudança de regra) |
| **Estimativa** | M |

---

## 1. Objetivo

Com `DATABASE_URL` definida, a API completa (`app.main:app`) avalia operações com a ficha técnica e a
tabela ativa gravadas no PostgreSQL, por REST e por WebSocket, e expõe uma rota de saúde. Sem
`DATABASE_URL`, a API continua subindo e respondendo "não avaliável".

## 2. Contexto

A leva A deixou as peças prontas, mas soltas: repositórios SQLAlchemy (TASK-022), endpoint REST com
provedores "não configurados" (TASK-024), router WebSocket não registrado (TASK-025), `Load` só no
domínio (TASK-028) e stack Docker sem rota de saúde dedicada (TASK-027, healthcheck em
`/openapi.json`).

## 3. Critérios de aceite

- [ ] **CA-1** — Dado `DATABASE_URL` definida e uma configuração FICTÍCIA com ficha técnica e tabela
  `ACTIVE` gravadas pelos repositórios, quando `POST /api/v1/evaluations` é chamado, então responde
  `EVALUATED` com a capacidade e a versão da tabela gravada (teste de integração, marcador
  `integration`).
- [ ] **CA-2** — Dado `DATABASE_URL` definida, a avaliação REST usa uma conexão do pool por requisição
  (dependência FastAPI), devolvida no fim mesmo com erro.
- [ ] **CA-3** — Dado `DATABASE_URL` ausente ou em branco, a API sobe, a avaliação responde
  `NOT_EVALUABLE` com `CRANE_GEOMETRY_NOT_FOUND` e `ACTIVE_LOAD_CHART_NOT_FOUND`, e o log diz que a
  persistência não está configurada. `DATABASE_URL` inválida impede a subida sem repetir a URL.
- [ ] **CA-4** — O WebSocket `/api/v1/ws/evaluation` está registrado em `app.main:app` e responde com o
  mesmo caso de uso (sessões curtas por mensagem, justificadas no handoff).
- [ ] **CA-5** — `EvaluateOperation` aceita a `Load` (`execute_for_load`) usando
  `weight_compared_with_capacity`, sem mudar a regra (peso informado; PEND-006); REST e WS continuam
  recebendo `load_weight_kg`.
- [ ] **CA-6** — `GET /api/v1/health` responde 200 com `status: UP` e `database` em
  `NOT_CONFIGURED`/`UP`/`DOWN`, sem URL, host ou mensagem do driver.
- [ ] **CA-7** — Nenhum teste existente quebra; gates do backend e `check-structure.sh` passam.

## 4. Escopo

### Dentro do escopo

- `backend/app/main.py`, `backend/app/presentation/api/main.py`,
  `backend/app/application/use_cases/evaluate_operation.py` e testes correspondentes.
- `backend/app/presentation/api/evaluations.py` (a dependência por requisição precisa ser declarada
  na rota) e `backend/app/presentation/api/health.py` (novo).

### Fora do escopo (explicitamente — o agente NÃO faz)

- Mudar a regra do peso comparado (PEND-006), cadastros (TASK-030), importação com gravação
  (TASK-031), frontend (TASK-032).
- Trocar o healthcheck do Dockerfile/compose e atualizar `docs/`, `README.md` e
  `handoffs/current.md` (listado no handoff § 10).

## 5. Arquivos provavelmente afetados

| Arquivo | Tipo de mudança | Verificado? |
|---------|-----------------|-------------|
| `backend/app/main.py` | alterar | sim |
| `backend/app/presentation/api/main.py` | alterar | sim |
| `backend/app/presentation/api/evaluations.py` | alterar | sim |
| `backend/app/presentation/api/health.py` | criar | sim |
| `backend/app/application/use_cases/evaluate_operation.py` | alterar | sim |
| `backend/app/domain/services/compared_load_weight.py` | alterar (docstring) | sim |
| `backend/tests/test_composition.py`, `test_composition_integration.py`, `presentation/test_health.py` | criar | sim |
| `backend/tests/application/test_evaluate_operation.py`, `presentation/test_evaluations.py` | alterar | sim |

## 6. Riscos e dependências

- Depende de TASK-022, 024, 025, 027, 028 (mescladas).
- Risco: `app.main` é montado na importação; no CI (`DATABASE_URL` definida) os testes que importam
  `app.main:app` passam a usar a composição com banco → mitigação: criar o engine não conecta, e a
  suíte foi rodada também com uma `DATABASE_URL` apontando para um banco que não responde.
- Risco: conflito de mescla com TASK-030/031 em `create_app`/`app.main` → mitigação: um bloco por
  router em `create_app`, um parâmetro opcional por router.

## 7. Teste manual (se houver)

1. `docker compose up -d --build` e `docker compose run --rm --no-deps backend alembic upgrade head`.
2. `curl http://127.0.0.1:8000/api/v1/health`
   **Esperado:** `{"status":"UP","database":"UP"}`.

---

## 8. Plano (preenchido pelo Planejador)

| # | Passo | Arquivos | Como verificar | Feito |
|---|-------|----------|----------------|-------|
| 1 | `execute_for_load` com `weight_compared_with_capacity` | `evaluate_operation.py` | testes da aplicação | [x] |
| 2 | Rota de saúde | `health.py`, `presentation/api/main.py` | `test_health.py` | [x] |
| 3 | Composição com/sem banco, dependência por requisição, WebSocket | `app/main.py`, `evaluations.py`, `presentation/api/main.py` | `test_composition*.py` | [x] |

**Análise de impacto:**
- Arquivos que podem quebrar indiretamente: testes que importam `app.main:app` (OpenAPI, validação
  de importação) — rodados com e sem `DATABASE_URL`.
- Regras de negócio aplicáveis: RN-001, RN-004..RN-008; PEND-006 inalterada.
- Decisões necessárias: nenhuma funcional; decisões técnicas no handoff § 5.

## 9. Cenários de teste (preenchido pelo Engenheiro de testes)

| Cenário | Critério | Tipo | Arquivo de teste | Status |
|---------|----------|------|------------------|--------|
| REST avalia configuração FICTÍCIA gravada pelos repositórios → `EVALUATED` | CA-1 | integração | `tests/test_composition_integration.py` | NÃO EXECUTADO local (CI) |
| WS avalia a mesma configuração → `EVALUATED` | CA-1, CA-4 | integração | `tests/test_composition_integration.py` | NÃO EXECUTADO local (CI) |
| dependência segura 1 conexão e devolve; devolve com erro (500) | CA-2 | unitário (SQLite só como dublê do pool) | `tests/test_composition.py` | verde |
| sem `DATABASE_URL`: `NOT_EVALUABLE`, log, WS responde, saúde `NOT_CONFIGURED` | CA-3, CA-4, CA-6 | unitário | `tests/test_composition.py` | verde |
| URL inválida impede a subida sem ecoar a senha | CA-3 | unitário | `tests/test_composition.py` | verde |
| banco fora do ar: saúde `DOWN` sem vazar URL; avaliação 500 | CA-6 | unitário | `tests/test_composition.py` | verde |
| `execute_for_load` = `execute` com o peso informado | CA-5 | unitário | `tests/application/test_evaluate_operation.py` | verde |
| saúde `UP`/`DOWN`/`NOT_CONFIGURED`, sempre 200, no OpenAPI | CA-6 | unitário | `tests/presentation/test_health.py` | verde |

## 10. Parecer da revisão (preenchido pelo Revisor)

**Resultado:** — (pendente)

## 11. Encerramento (preenchido ao mover para completed/)

> Movida para `completed/` em 2026-09-26 pela autorização permanente da pessoa responsável (revisão independente dispensada).

- O que foi entregue (2–3 linhas):
- O que ficou de fora e virou tarefa nova: TASK-...
- Aprendizados para o template/docs:
