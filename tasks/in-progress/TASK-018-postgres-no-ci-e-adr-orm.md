# TASK-018 — PostgreSQL no CI e ADR-014 do ORM

| Campo | Valor |
|-------|-------|
| **Status** | in-progress |
| **Prioridade** | média |
| **Criada em** | 2026-09-26 por Anderson Sehnem (pedido em sessão com o agente Claude Code) |
| **Iniciada em** | 2026-09-26 |
| **Concluída em** | — |
| **Branch** | `task/TASK-018-postgres-no-ci-e-adr-orm` (a partir de `438d812`) |
| **PR** | — |
| **Requisitos** | RNF-001 |
| **Regras de negócio** | — |
| **Estimativa** | P |

---

## 1. Objetivo

Os testes de integração com PostgreSQL passam a rodar de verdade no CI, e a escolha de ORM e driver
feita na TASK-011 fica registrada em ADR, como pede `docs/policies/security.md` § 4.4.

## 2. Contexto

Pendências 2 e 5 da TASK-011 (`handoffs/history/2026-09-26-TASK-011-implementacao.md`): os testes de
integração eram pulados no CI (sem banco) e o ORM/driver não tinha ADR. A alteração do `ci.yml` está
dentro da autorização permanente da pessoa (gates de backend e frontend). Esta branch leva também o
commit-base `438d812` da leva TASK-018..019.

## 3. Critérios de aceite

- [ ] **CA-1** — Dado o PR desta tarefa, quando o CI roda, então o job Backend sobe um PostgreSQL 18 de
  serviço, roda `uv run alembic upgrade head` e os 2 testes de integração **passam** (não pulam).
- [ ] **CA-2** — Dado `REQUIRE_INTEGRATION_DB=1` sem banco disponível, quando rodo
  `uv run pytest -m integration`, então os testes falham em vez de pular; sem a variável, continuam pulando.
- [ ] **CA-3** — Existe `docs/decisions/ADR-014-orm-e-driver-postgresql.md` com status `Proposto`, no
  índice e em `docs/architecture.md` § 8.
- [ ] **CA-4** — `docs/known-gaps.md` registra L-005 (banco local não verificado nesta máquina) e a
  cobertura de integração atual; gates do backend e `check-structure.sh` passam.

## 4. Escopo

### Dentro do escopo

- `.github/workflows/ci.yml` (job backend), `backend/tests/infrastructure/database/test_postgres_integration.py`,
  ADR-014, índice de ADRs, `docs/architecture.md` § 8, `docs/known-gaps.md`, `docs/development-guide.md` (1 linha).

### Fora do escopo (explicitamente — o agente NÃO faz)

- Tabelas de negócio, repositórios, endpoints.

## 5. Arquivos provavelmente afetados

| Arquivo | Tipo de mudança | Verificado? |
|---------|-----------------|-------------|
| `.github/workflows/ci.yml` | alterar | sim |
| `backend/tests/infrastructure/database/test_postgres_integration.py` | alterar | sim |
| `docs/decisions/ADR-014-orm-e-driver-postgresql.md`, `docs/decisions/README.md`, `docs/architecture.md`, `docs/known-gaps.md`, `docs/development-guide.md` | criar / alterar | sim |

## 6. Riscos e dependências

- As credenciais do PostgreSQL no `ci.yml` valem só para o container efêmero do CI (não são segredo).

## 7. Teste manual (se houver)

Não se aplica: a evidência é o job Backend do PR.

---

## 8. Plano (preenchido pelo Planejador)

| # | Passo | Arquivos | Como verificar | Feito |
|---|-------|----------|----------------|-------|
| 1 | Serviço PostgreSQL e Alembic no job | `ci.yml` | CA-1 | [x] |
| 2 | Falhar em vez de pular com `REQUIRE_INTEGRATION_DB=1` | teste de integração | CA-2 | [x] |
| 3 | ADR-014 e docs | `docs/` | CA-3, CA-4 | [x] |

## 9. Cenários de teste (preenchido pelo Engenheiro de testes)

| Cenário | Critério | Tipo | Arquivo de teste | Status |
|---------|----------|------|------------------|--------|
| integração com banco de serviço | CA-1 | integração (CI) | `backend/tests/infrastructure/database/test_postgres_integration.py` | a verificar no CI |
| falha sem banco com a variável ligada | CA-2 | local | idem | verificado |

## 10. Parecer da revisão (preenchido pelo Revisor)

**Resultado:** — (aguardando revisão)

## 11. Encerramento (preenchido ao mover para completed/)

- O que foi entregue (2–3 linhas):
- O que ficou de fora e virou tarefa nova: TASK-...
- Aprendizados para o template/docs:
