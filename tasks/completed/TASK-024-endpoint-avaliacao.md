# TASK-024 — Expor a avaliação operacional por um endpoint REST

| Campo | Valor |
|-------|-------|
| **Status** | completed |
| **Prioridade** | alta |
| **Criada em** | 2026-09-26 por Anderson Sehnem (leva A, pedido em sessão com o agente Claude Code) |
| **Iniciada em** | 2026-09-26 |
| **Concluída em** | 2026-09-26 |
| **Branch** | `task/TASK-024-endpoint-avaliacao` (a partir de `a5b1ab0`, commit-base da leva A, TASK-021) |
| **PR** | [#23](https://github.com/Umaiii-chan/JA-Guindastes/pull/23), mergeado em 2026-09-26 |
| **Requisitos** | RF-015..RF-018, RF-020, RNF-007 |
| **Regras de negócio** | RN-001, RN-004, RN-005, RN-006, RN-007, RN-008 |
| **Estimativa** | M |

---

## 1. Objetivo

Um cliente (o frontend) consegue enviar um estado operacional e a carga e receber a geometria, a
capacidade (com o ponto tabelado usado e a marca "provisório conservador"), a utilização e a versão da
tabela, ou os motivos de "não avaliável", por REST.

## 2. Contexto

O caso de uso `EvaluateOperation` (TASK-015) e a consulta conservadora provisória (TASK-020, ADR-015)
existem, mas não havia composição nem endpoint. A doc-fonte § 15.3 prevê
`POST /api/v1/simulations/{simulation_id}/evaluate`, mas ainda não há simulações persistidas. Os
repositórios de banco da ficha técnica e da tabela ativa são da TASK-022 (mesma leva): até lá, a
composição liga provedores explícitos que não encontram nada.

## 3. Critérios de aceite

- [ ] **CA-1** — Dado um estado com raio entre dois raios tabelados (dados FICTÍCIOS), quando `POST /api/v1/evaluations`, então 200 com `status: EVALUATED`, a menor capacidade dos vizinhos, `strategy: CONSERVATIVE_PROVISIONAL`, o ponto tabelado usado, a utilização, a geometria (raio, alturas, posições) e o id/versão da tabela.
- [ ] **CA-2** — Dado estado fora das faixas, configuração sem tabela ativa, consulta fora do domínio da tabela ou ponta atrás do eixo de giro, então 200 com `status: NOT_EVALUABLE`, os motivos (código e categoria), sem utilização.
- [ ] **CA-3** — Dada requisição malformada (campo ausente/desconhecido, tipo errado, `NaN`/infinito, negativo, id em branco), então 422 (sem 500 por número não finito).
- [ ] **CA-4** — A rota, o corpo, as respostas 200/422/500 e o `status` só com `EVALUATED`/`NOT_EVALUABLE` (sem nível de alerta, PEND-004) estão no `/openapi.json`.
- [ ] **CA-5** — `create_app` recebe provedores e estratégia por injeção; a composição (`app.main:app`) injeta a `ConservativeTabulatedLookup` e provedores que não encontram nada, e responde `NOT_EVALUABLE` com `CRANE_GEOMETRY_NOT_FOUND` e `ACTIVE_LOAD_CHART_NOT_FOUND`, sem dados inventados.
- [ ] **CA-6** — Nenhum teste existente quebra; gates do backend e `check-structure.sh` passam.

## 4. Escopo

### Dentro do escopo

- Arquivos novos em `backend/app/presentation/api/`; `backend/app/presentation/api/main.py`;
  `backend/app/main.py`; testes novos em `backend/tests/presentation/`; esta tarefa; `handoffs/TASK-024.md`.

### Fora do escopo (explicitamente — o agente NÃO faz)

- WebSocket (TASK-025), repositórios/banco (TASK-022), importadores e `pyproject` (TASK-023),
  domínio (TASK-028), frontend, Docker (TASK-027).
- Níveis de alerta (PEND-004), mensagens para o usuário (doc-fonte § 26, pergunta 9), autenticação (P-009).
- `handoffs/current.md`, `README.md`, `docs/*.md` (mudanças listadas no handoff § 10).

## 5. Arquivos provavelmente afetados

| Arquivo | Tipo de mudança | Verificado? |
|---------|-----------------|-------------|
| `backend/app/presentation/api/evaluations.py` | criar | sim |
| `backend/app/presentation/api/evaluation_schemas.py` | criar | sim |
| `backend/app/presentation/api/validation_errors.py` | criar | sim |
| `backend/app/presentation/api/main.py` | alterar | sim |
| `backend/app/main.py` | alterar | sim |
| `backend/tests/presentation/test_evaluations.py`, `test_openapi_evaluations.py` | criar | sim |

## 6. Riscos e dependências

- Depende da TASK-020 (consulta conservadora), já no commit-base.
- Leva B: trocar os provedores provisórios da composição pelos repositórios da TASK-022.
- Risco: a TASK-025 (WebSocket) precisa ser registrada em `create_app`, que só esta tarefa edita nesta leva → fazer na leva B.

## 7. Teste manual (se houver)

Não se aplica (coberto por `TestClient`).
