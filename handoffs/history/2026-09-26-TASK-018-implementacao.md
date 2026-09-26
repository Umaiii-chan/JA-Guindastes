# Handoff — TASK-018 — implementação (PostgreSQL no CI e ADR-014)

| Campo | Valor |
|-------|-------|
| **Data/hora** | 2026-09-26 16:35 (UTC-3, Brasília) |
| **Tarefa** | `tasks/in-progress/TASK-018-postgres-no-ci-e-adr-orm.md` |
| **Etapa concluída** | implementação |
| **Papel exercido** | Implementador (agente único; declarado conforme AGENTS.md § 3) |
| **Ferramenta/agente** | Claude Code 2.1.280 (modelo Opus 5.5), app desktop |
| **Branch** | `task/TASK-018-postgres-no-ci-e-adr-orm`, a partir de `438d812` |
| **Duração aproximada** | ~15 min |

---

## 1. Objetivo desta etapa

Testes de integração rodando no CI e ADR do ORM/driver.

## 2. O que foi feito

- Job Backend do CI: serviço `postgres:18` com healthcheck, `DATABASE_URL` e `REQUIRE_INTEGRATION_DB=1`
  no ambiente do job, e novo passo `uv run alembic upgrade head` antes dos testes.
- Teste de integração: com `REQUIRE_INTEGRATION_DB=1`, falha em vez de pular quando o banco falta.
- ADR-014 (`Proposto`): SQLAlchemy 2 + psycopg 3, registrando a escolha da TASK-011.
- `docs/known-gaps.md`: L-005 e § 6; `docs/development-guide.md`: nota do CI na linha de migrations;
  índice de ADRs e `docs/architecture.md` § 8.
- Commit-base da leva: TASK-011 e 017 para `completed/`, handoffs arquivados, índice atualizado.

## 3. Arquivos modificados

Ver tarefa § 5, mais esta tarefa e este handoff.

## 4. Comandos executados e resultados

| Comando (em `backend/`) | Resultado | Saída (resumo) |
|---------|-----------|----------------|
| `uv run ruff check .` / `format --check` / `mypy app` | ✅ | OK |
| `uv run pytest` (sem banco local) | ✅ | `298 passed, 2 skipped` |
| `REQUIRE_INTEGRATION_DB=1 uv run pytest -m integration` (sem banco) | ✅ (esperado falhar) | `2 errors` |
| YAML do CI | ✅ | serviço `postgres`, passos "Migrations (Alembic)" e "Testes (inclui integração com PostgreSQL)" |
| `bash scripts/check-structure.sh` | ✅ | `OK: 0 erros, 0 aviso(s)` |
| CI do PR | ⏳ | é a evidência do CA-1 |

## 5. Decisões tomadas

- Credenciais fixas no `ci.yml` só para o container efêmero do CI (não é segredo; comentado no arquivo).
- O ADR-014 fica `Proposto`: a pessoa aceita ou pede outra escolha.

## 6. Regras de negócio aplicadas

- nenhuma

## 7. O que NÃO foi feito e por quê

- Verificação com banco local: depende de a pessoa ativar a virtualização (L-005).

## 8. Pendências / decisões necessárias (para a pessoa responsável)

- Aceitar o ADR-014; licença LGPL-3.0 do psycopg (em `handoffs/current.md`).

## 9. ⚠️ Segurança

- nada a relatar

## 10. Próximo passo

**Papel:** Pessoa responsável — mergear (squash) depois de ver os 2 testes de integração passando no job Backend.

## 11. Como revisar este trabalho

- Olhar o log do job Backend no PR: passo "Migrations (Alembic)" e "2 passed" nos testes de integração.
