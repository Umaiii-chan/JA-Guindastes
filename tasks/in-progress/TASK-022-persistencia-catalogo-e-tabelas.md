# TASK-022 — Persistir o catálogo de guindastes e as tabelas de carga no PostgreSQL

| Campo | Valor |
|-------|-------|
| **Status** | in-progress |
| **Prioridade** | alta |
| **Criada em** | 2026-09-26 por Anderson Sehnem (leva A, pedido em sessão com o agente Claude Code) |
| **Iniciada em** | 2026-09-26 |
| **Concluída em** | — |
| **Branch** | `task/TASK-022-persistencia-catalogo-e-tabelas` (a partir de `a5b1ab0`, commit-base da leva A) |
| **PR** | — |
| **Requisitos** | RF-001, RF-002, RF-005, RF-007, RF-008, RNF-002, RNF-005, RNF-006 |
| **Regras de negócio** | RN-001, RN-003, RN-005, RN-006 |
| **Estimativa** | M |

---

## 1. Objetivo

Gravar e consultar no PostgreSQL fabricantes, guindastes, configurações (com a ficha técnica do
ADR-013) e tabelas de carga com pontos, status e origem, e servir as portas `CraneGeometryProvider` e
`ActiveLoadChartProvider` a partir do banco.

## 2. Contexto

A TASK-011 montou engine, `Base` e Alembic sem tabelas; a TASK-018 pôs PostgreSQL de serviço no CI
(`alembic upgrade head` antes do `pytest`, `REQUIRE_INTEGRATION_DB=1`). ADR-007, ADR-009, ADR-013 C-4,
ADR-014; doc-fonte §§ 10, 13 e 19. Localmente o Docker não sobe (sem virtualização).

## 3. Critérios de aceite

- [ ] **CA-1** — Modelos SQLAlchemy só na infraestrutura para `manufacturers`, `cranes`, `crane_configurations` (com a ficha técnica do ADR-013 C-4), `load_charts` (id, versão, configuração, status, nome/tipo/sha256/uri do arquivo-fonte) e `load_chart_points`, com FKs e `ON DELETE` coerentes.
- [ ] **CA-2** — Unicidade (configuração, versão) e no máximo uma tabela `ACTIVE` por configuração, garantidas pelo banco.
- [ ] **CA-3** — Uma revisão Alembic cria as tabelas; `alembic upgrade head` e `alembic downgrade base` funcionam, e o esquema resultante bate com os modelos.
- [ ] **CA-4** — Repositórios implementam `CraneGeometryProvider`, `ActiveLoadChartProvider` e as portas novas `CraneCatalogRepository` e `LoadChartRepository` (salvar DRAFT, mudar status, buscar por id), com mapeamento escrito à mão; domínio e aplicação sem SQLAlchemy (`lint-imports`).
- [ ] **CA-5** — Testes: ida e volta entidade→banco→entidade, unicidade de `ACTIVE`, provedores devolvendo `None` sem dado, migration sobe e desce (integração no CI); mapeamento e tradução de erros sem banco.
- [ ] **CA-6** — Gates do backend e `check-structure.sh` passam; nenhum teste existente quebra.

## 4. Escopo

### Dentro do escopo

- `backend/app/infrastructure/database/models/`, `backend/app/infrastructure/repositories/` (arquivos
  novos), a primeira revisão em `backend/alembic/versions/`, portas novas em
  `backend/app/application/ports/`, testes novos em `backend/tests/infrastructure/{database,repositories}/`.

### Fora do escopo (explicitamente — o agente NÃO faz)

- Endpoints, casos de uso de cadastro/ativação, armazenamento do arquivo-fonte, entidades de domínio
  do catálogo, regras de transição de status, `pyproject.toml`/`uv.lock`, `docs/*.md`, `README.md`,
  `handoffs/current.md`.

## 5. Arquivos provavelmente afetados

| Arquivo | Tipo de mudança | Verificado? |
|---------|-----------------|-------------|
| `backend/app/infrastructure/database/models/*.py` | criar | sim |
| `backend/app/infrastructure/repositories/*.py` | criar | sim |
| `backend/app/application/ports/{crane_catalog,load_chart}_repository.py` | criar | sim |
| `backend/alembic/versions/1f4cfaff16e8_*.py` | criar | sim |
| `backend/alembic/env.py` | alterar (1 import) | sim |
| `backend/tests/infrastructure/{database,repositories}/*` | criar | sim |

## 6. Riscos e dependências

- Os testes de integração só rodam no CI (Docker local indisponível).
- A migration foi renderizada pelo autogenerate contra esquema vazio, não contra um banco vivo; o teste
  de integração compara o banco migrado com os modelos (`compare_metadata`).

## 7. Teste manual (se houver)

Com banco no ar: `uv run alembic upgrade head`, `uv run pytest -m integration -rs` (esperado: nenhum
pulado), `uv run alembic downgrade base`, `uv run alembic upgrade head`.

---

## 8. Plano (preenchido pelo Planejador)

| # | Passo | Arquivos | Como verificar | Feito |
|---|-------|----------|----------------|-------|
| 1 | Portas novas | `application/ports/` | mypy, lint-imports | [x] |
| 2 | Modelos e migration | `database/models/`, `alembic/` | `alembic upgrade head --sql` | [x] |
| 3 | Repositórios | `infrastructure/repositories/` | testes | [x] |
| 4 | Testes | `tests/infrastructure/` | pytest (integração no CI) | [x] |

## 9. Cenários de teste (preenchido pelo Engenheiro de testes)

| Cenário | Critério | Tipo | Arquivo de teste | Status |
|---------|----------|------|------------------|--------|
| mapeamento modelo ↔ domínio, ordem e pontos repetidos | CA-4 | unitário | `tests/infrastructure/repositories/test_repository_mapping.py` | verde |
| tradução de violações por nome de restrição | CA-2, CA-4 | unitário | idem | verde |
| SQL offline da migration (subida e descida) | CA-1..3 | unitário | `tests/infrastructure/database/test_catalog_load_chart_migration.py` | verde |
| migration sobe/desce e bate com os modelos | CA-3 | integração | idem | CI |
| ida e volta, `ACTIVE` único, `None` sem dado, CASCADE/RESTRICT | CA-1, CA-2, CA-5 | integração | `tests/infrastructure/repositories/test_repositories_integration.py` | CI |

## 10. Parecer da revisão (preenchido pelo Revisor)

**Resultado:** — (aguardando revisão)

## 11. Encerramento (preenchido ao mover para completed/)

- O que foi entregue (2–3 linhas):
- O que ficou de fora e virou tarefa nova: TASK-...
- Aprendizados para o template/docs:
