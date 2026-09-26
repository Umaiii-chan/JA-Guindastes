# TASK-031 — Importar tabela de carga com gravação e ativar

| Campo | Valor |
|-------|-------|
| **Status** | completed |
| **Prioridade** | alta |
| **Criada em** | 2026-09-26 por pessoa responsável (leva B) |
| **Iniciada em** | 2026-09-26 |
| **Concluída em** | 2026-09-26 |
| **Branch** | `task/TASK-031-importacao-com-gravacao` (a partir de `e5a8945`) |
| **PR** | [#30](https://github.com/Umaiii-chan/JA-Guindastes/pull/30), mergeado em 2026-09-26 com CI verde |
| **Requisitos** | RF-006, RF-007, RF-008, RF-009, RNF-005, RNF-006 |
| **Regras de negócio** | RN-001, RN-005, RN-006 |
| **Estimativa** | M |

---

## 1. Objetivo

Uma tabela de carga enviada em CSV ou XLSX, quando válida, fica gravada em `DRAFT` com o arquivo-fonte
preservado e rastreável; pode ser consultada e ativada, e a ativação rebaixa a tabela ativa anterior
da mesma configuração.

## 2. Contexto

- Validação sem gravar: TASK-010/019 (`ValidateLoadChartImport`, `POST /validate`).
- Persistência das tabelas: TASK-022 (`LoadChartRepository`; `source_uri` opcional, storage vazio).
- XLSX e seletor de parser: TASK-023 (não ligados na API; pendência de 415 e de zip bomb).
- Doc-fonte §§ 13, 15.2, 19.2 e 22.1 (`FileStoragePort`); known-gaps P-006 e P-008.

## 3. Critérios de aceite

- [ ] **CA-1** — Dado um conteúdo qualquer, quando o `LocalFileStorage` o grava, então o arquivo fica
  em `<FILE_STORAGE_DIR>/<sha256>`, a URI é `local://<sha256>`, gravar de novo o mesmo conteúdo
  devolve a mesma URI sem reescrever, um arquivo existente nunca é sobrescrito e URIs com path
  traversal são recusadas (`tests/infrastructure/test_local_file_storage.py`).
- [ ] **CA-2** — Dado um CSV/XLSX válido, quando `ImportLoadChart` roda, então o arquivo-fonte é
  preservado e a tabela é gravada em `DRAFT` com nome, tipo, sha256 e URI
  (`tests/application/test_import_load_chart.py`, integração).
- [ ] **CA-3** — Dado um arquivo com inconsistências, quando `ImportLoadChart` roda, então devolve o
  relatório `INVALID` e não grava nada, nem o arquivo, nem altera tabelas existentes (RNF-006).
- [ ] **CA-4** — Dada uma versão já existente na configuração, quando se importa de novo, então há
  conflito explícito (`DuplicateLoadChartVersionError` → 409).
- [ ] **CA-5** — Dada uma tabela `DRAFT`, quando `ActivateLoadChart` roda, então ela passa por
  `VALIDATED` e fica `ACTIVE`, e a `ACTIVE` anterior da mesma configuração vira `SUPERSEDED` na
  mesma transação; `INVALID` (e `ACTIVE`/`SUPERSEDED`) não é ativada
  (`tests/application/test_activate_load_chart.py`, integração).
- [ ] **CA-6** — `POST /api/v1/load-charts/import` (multipart; CSV/XLSX pelo seletor; 201/422/404/409/
  413/415), `GET /api/v1/load-charts/{id}` (200/404) e `POST /api/v1/load-charts/{id}/activate`
  (200/404/409) funcionam com `TestClient` (`tests/presentation/test_load_chart_persistence.py`).
- [ ] **CA-7** — XLSX acima do tamanho descompactado ou do número de linhas (limites PROVISÓRIOS,
  A VALIDAR P-008) é recusado com 413 antes de abrir com o openpyxl
  (`tests/infrastructure/test_xlsx_resource_limits.py`).
- [ ] **CA-8** — Integração com PostgreSQL (marcador `integration`): importar, ativar, e a antiga
  `ACTIVE` virar `SUPERSEDED` (`tests/infrastructure/repositories/test_load_chart_import_activation_integration.py`;
  validado no CI).
- [ ] **CA-9** — Nenhum teste existente quebra; ruff, format, mypy, lint-imports e check-structure passam.

## 4. Escopo

### Dentro do escopo

- Porta `FileStoragePort` e adapter em disco local; casos de uso `ImportLoadChart` e
  `ActivateLoadChart`; porta e adapter da troca atômica da `ACTIVE`; limites do XLSX; três rotas;
  composição mínima; testes; variável `FILE_STORAGE_DIR` no `.env.example`.

### Fora do escopo (explicitamente — o agente NÃO faz)

- `POST /{id}/validate` da doc-fonte § 15.2; gravar tabelas `INVALID` ou o relatório; reativar
  `SUPERSEDED`; autenticação (P-009); `docker-compose.yml`; docs em `docs/*.md`, `README.md` e
  `handoffs/current.md` (listados no handoff § 10).

## 5. Arquivos afetados

Lista verificada em `handoffs/TASK-031.md` § 3.

## 6. Riscos e dependências

- Paralelas: TASK-029 (dona de `backend/app/main.py`, `presentation/api/main.py`), TASK-030, TASK-032.
  Mudança mínima nos dois `main.py`, descrita no handoff § 5 para a mescla.
- Integração não executada localmente (sem PostgreSQL); o CI valida.

## 7. Teste manual (se houver)

1. Com `DATABASE_URL` e `FILE_STORAGE_DIR` definidas e o banco em `head`, com uma configuração
   FICTÍCIA cadastrada, `uv run uvicorn app.main:app`.
2. `POST /api/v1/load-charts/import` com um CSV FICTÍCIO válido → 201 `DRAFT`; o arquivo aparece em
   `FILE_STORAGE_DIR/<sha256>`.
3. `POST /api/v1/load-charts/<id>/activate` → 200 `ACTIVE`.
   **Esperado:** uma segunda tabela ativada devolve `superseded_chart_id` com a primeira.
