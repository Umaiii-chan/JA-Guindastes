# TASK-030 — Expor cadastros REST de fabricante, guindaste e configuração

| Campo | Valor |
|-------|-------|
| **Status** | completed |
| **Prioridade** | alta |
| **Criada em** | 2026-09-26 por pessoa responsável (leva B, via orquestrador) |
| **Iniciada em** | 2026-09-26 |
| **Concluída em** | 2026-09-26 |
| **Branch** | `task/TASK-030-cadastros-rest` (a partir de `e5a8945`) |
| **PR** | [#30](https://github.com/Umaiii-chan/JA-Guindastes/pull/30), mergeado em 2026-09-26 com CI verde |
| **Requisitos** | RF-001, RF-002, RF-005, RF-010 (seleção: listagem e leitura) |
| **Regras de negócio** | RN-001, RN-003, RN-006, RN-008 |
| **Estimativa** | M |

---

## 1. Objetivo

Cadastrar e consultar pela API REST fabricantes, guindastes (modelos) e configurações operacionais
com a ficha técnica geométrica (`CraneGeometry`, ADR-013 C-4), gravando no PostgreSQL pelos
repositórios da TASK-022.

## 2. Contexto

- A TASK-022 criou a porta `CraneCatalogRepository` (só `add_*`/`get_*`) e o repositório SQLAlchemy.
- A doc-fonte § 15.1 prevê os endpoints de cadastro; a ficha técnica vem do cadastro por API, nunca
  do GLB (ADR-013 C-4 regra 1; RN-003).
- Leva B em paralelo: TASK-029 (dona de `app/main.py`, `presentation/api/main.py` e
  `evaluate_operation.py`), TASK-031 (importação/ativação), TASK-032 (frontend). Esta tarefa só
  acrescenta o mínimo em `presentation/api/main.py` e `app/main.py`.

## 3. Critérios de aceite

- [x] **CA-1** — Dado um nome não vazio, quando `POST /api/v1/manufacturers`, então responde 201 com o fabricante e um `id` gerado pelo servidor (UUID); `GET /api/v1/manufacturers` lista e `GET /api/v1/manufacturers/{id}` lê.
- [x] **CA-2** — Dado um fabricante existente, quando `POST /api/v1/cranes` com `manufacturer_id` e `model_name`, então responde 201; `GET /api/v1/cranes` lista (filtro opcional `manufacturer_id`) e `GET /api/v1/cranes/{crane_id}` lê.
- [x] **CA-3** — Dado um guindaste existente, quando `POST /api/v1/cranes/{crane_id}/configurations` com nome e ficha técnica opcional (campos do ADR-013 C-4, em unidades internas), então responde 201; `GET /api/v1/cranes/{crane_id}/configurations` lista e `GET /api/v1/configurations/{configuration_id}` lê, com a ficha.
- [x] **CA-4** — Recurso inexistente (na rota ou referenciado no corpo) responde 404; conflito de unicidade sinalizado pelo repositório responde 409.
- [x] **CA-5** — Corpo malformado responde 422: nome vazio ou só espaços, campo desconhecido, tipo errado, `NaN`/infinito, comprimento negativo, ficha incoerente (mínimo > máximo, θ fora de (−90°, 90°], giro com um só limite).
- [ ] **CA-6** — Casos de uso cobertos com repositório falso; endpoints com `TestClient` e fakes; integração com banco (marcador `integration`) grava fabricante → guindaste → configuração e lê de volta. (unitários e endpoints ✅; integração NÃO EXECUTADA localmente, o CI valida)
- [x] **CA-7** — Gates do backend e `scripts/check-structure.sh` passam; nenhum teste existente quebra.

## 4. Escopo

### Dentro do escopo

- Casos de uso de criação, listagem e leitura do catálogo (camada de aplicação).
- Porta de listagem do catálogo e implementação no repositório SQLAlchemy.
- Router REST, schemas Pydantic estritos e registro mínimo na composição.

### Fora do escopo (explicitamente — o agente NÃO faz)

- Editar e excluir cadastros (sem regra de exclusão; `ON DELETE RESTRICT` da TASK-022).
- Unicidade de nomes (pendência 2 da TASK-022), paginação, autenticação (P-009).
- Atributos físicos da configuração (PEND-005), origem documental da ficha (ADR-013 C-4 regra 1).
- `handoffs/current.md`, `README.md`, `docs/*.md` (mudanças listadas no handoff § 10).

## 5. Arquivos provavelmente afetados

| Arquivo | Tipo de mudança | Verificado? |
|---------|-----------------|-------------|
| `backend/app/application/ports/crane_catalog_listing.py` | criar | sim |
| `backend/app/application/use_cases/crane_catalog.py` | criar | sim |
| `backend/app/infrastructure/repositories/sqlalchemy_crane_catalog_repository.py` | alterar (métodos de listagem) | sim |
| `backend/app/presentation/api/catalog.py`, `catalog_schemas.py` | criar | sim |
| `backend/app/presentation/api/main.py`, `backend/app/main.py` | alterar (mínimo) | sim |
| `backend/tests/...` | criar | sim |

## 6. Riscos e dependências

- Depende de: TASK-022 (mergeada).
- Risco: conflito de mescla com a TASK-029 em `app/main.py` e `presentation/api/main.py` → mitigação:
  acréscimos mínimos e descritos no handoff.

## 7. Teste manual (se houver)

Com o banco em `head` e `DATABASE_URL` definida: `uv run uvicorn app.main:app`, depois `POST` e `GET`
nas rotas acima pelo `/docs`. **Esperado:** o que foi gravado volta igual.

---

## 8. Plano (preenchido pelo Planejador)

| # | Passo | Arquivos | Como verificar | Feito |
|---|-------|----------|----------------|-------|
| 1 | Porta de listagem + métodos no repositório SQLAlchemy | ports, repositories | mypy, integração | [x] |
| 2 | Casos de uso do catálogo | use_cases | testes com fake | [x] |
| 3 | Router e schemas; registro na composição | presentation, main | TestClient | [x] |
| 4 | Teste de integração | tests/presentation/test_catalog_integration.py | CI | [x] |

**Análise de impacto:**
- Arquivos que podem quebrar indiretamente: testes que importam `app.main` (composição).
- Regras de negócio aplicáveis: RN-003 (ficha só do cadastro), RN-006 (unidades internas).
- Decisões necessárias: ver handoff § 8.

## 9. Cenários de teste (preenchido pelo Engenheiro de testes)

Ver handoff § 2.

## 10. Parecer da revisão (preenchido pelo Revisor)

**Resultado:** —

## 11. Encerramento (preenchido ao mover para completed/)

> Movida para `completed/` em 2026-09-26 pela autorização permanente da pessoa responsável (revisão independente dispensada).

- O que foi entregue (2–3 linhas):
- O que ficou de fora e virou tarefa nova: TASK-...
- Aprendizados para o template/docs:
