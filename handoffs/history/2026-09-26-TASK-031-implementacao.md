# Handoff — TASK-031 — implementação

| Campo | Valor |
|-------|-------|
| **Data/hora** | 2026-09-26 (fuso local) |
| **Tarefa** | `tasks/in-progress/TASK-031-importacao-com-gravacao.md` |
| **Etapa concluída** | implementação (com planejamento e testes) |
| **Papel exercido** | Planejador + Engenheiro de testes + Implementador (mesma sessão) |
| **Ferramenta/agente** | Claude Code (Claude Opus 5.5), subagente em git worktree isolado |
| **Branch** | `task/TASK-031-importacao-com-gravacao` (base `e5a8945`) |
| **Duração aproximada** | 1 h |

---

## 1. Objetivo desta etapa

Importar CSV/XLSX gravando a tabela em `DRAFT` com o arquivo-fonte preservado, consultar e ativar
tabelas (a `ACTIVE` anterior vira `SUPERSEDED`), com limites de zip bomb no XLSX.

## 2. O que foi feito

- Criei a branch com `git switch -c task/TASK-031-importacao-com-gravacao e5a8945`; `git log -1`
  confirmou `e5a8945 chore(tasks): mover TASK-020 a 028 para completed e abrir a leva B`.
- **Porta `FileStoragePort`** (`application/ports/file_storage.py`; doc-fonte § 22.1): `save(content)
  -> StoredFile(uri, sha256, size_bytes)` e `read(uri)`, com erros `InvalidStoredFileUriError`,
  `StoredFileNotFoundError`, `StoredFileIntegrityError`.
- **`LocalFileStorage`** (`infrastructure/storage/local_file_storage.py`): grava em
  `<FILE_STORAGE_DIR>/<sha256>`, URI `local://<sha256>`; nome só do hash calculado (nunca do nome
  enviado); `read` confere a URI com regex estrita e o caminho resolvido dentro do diretório;
  escrita num temporário do diretório + `os.link` (falha se o destino existe → nunca sobrescreve);
  idempotente; arquivo existente com conteúdo diferente → `StoredFileIntegrityError` sem tocar nele;
  diretório criado só na primeira gravação.
- **Caso de uso `ImportLoadChart`** (`application/use_cases/import_load_chart.py`): valida com
  `ValidateLoadChartImport` (qualquer parser); inválido → devolve `InvalidLoadChartImport` sem gravar
  nada; válido → `FileStoragePort.save`, confere o sha256 devolvido, `LoadChartRepository.save_draft`
  com `LoadChartSource(file_name, file_type, sha256, uri)`. Erros do repositório propagam
  (`DuplicateLoadChartVersionError`, `LoadChartAlreadyExistsError`,
  `LoadChartConfigurationNotFoundError`).
- **Porta `LoadChartActivationRepository`** (`application/ports/load_chart_activation.py`) com
  `activate_superseding_current(id, *, expected_status) -> str | None` e
  `LoadChartStatusChangedError`; adapter `SqlAlchemyLoadChartActivationRepository`
  (`infrastructure/repositories/sqlalchemy_load_chart_activation_repository.py`): uma transação com
  `SELECT … FOR UPDATE`, confere o status, `UPDATE … SET SUPERSEDED WHERE status='ACTIVE'` da
  configuração (RETURNING id), flush, e só então a tabela vira `ACTIVE`; violação do índice único →
  `ActiveLoadChartConflictError`.
- **Caso de uso `ActivateLoadChart`** (`application/use_cases/activate_load_chart.py`): `DRAFT` →
  `change_status(VALIDATED)` → troca atômica `VALIDATED → ACTIVE` + anterior `SUPERSEDED`;
  `VALIDATED` → direto à troca; `INVALID`/`ACTIVE`/`SUPERSEDED` → `LoadChartNotActivatableError`.
- **Limites do XLSX** (`infrastructure/importers/xlsx_resource_limits.py`; PROVISÓRIOS, A VALIDAR
  P-008): `XlsxLimits(max_uncompressed_bytes=10 MiB, max_rows=10 000)`; `ensure_xlsx_within_limits`
  soma o tamanho descompactado declarado de todas as partes do ZIP e conta os `<row>` de todas as
  planilhas em fluxo (`iterparse`), **antes** do openpyxl; excedeu → `LoadChartFileLimitExceededError`
  (nova porta `application/ports/load_chart_file_limits.py`). Não-ZIP/XML ilegível segue para o
  parser (que reporta `MALFORMED_FILE`). `LimitedXlsxLoadChartParser` e
  `select_limited_load_chart_parser` (envolve só o XLSX do seletor da TASK-023).
- **Rotas** (`presentation/api/load_chart_persistence.py` + `load_chart_persistence_schemas.py`),
  contrato abaixo. Composição em módulo novo `backend/app/load_chart_persistence_composition.py`
  (fora das camadas, como `app.main`).
- `.env.example`: variável nova `FILE_STORAGE_DIR`.
- Criei `tasks/in-progress/TASK-031-importacao-com-gravacao.md` (CA-1..CA-9).

### Contrato dos endpoints

Registrados só quando `create_app(load_chart_persistence=...)` recebe as dependências; em
`app.main`, só com `DATABASE_URL` **e** `FILE_STORAGE_DIR` definidas. Sem autenticação (P-009).

| Rota | Entrada | Respostas |
|------|---------|-----------|
| `POST /api/v1/load-charts/import` | multipart: `file` (CSV/XLSX), `configuration_id`, `chart_id`, `version` (mesmos campos do `/validate`) | **201** `LoadChartResponse` (`DRAFT`); **422** `LoadChartValidationResponse` (`status: INVALID`, `issues`; nada gravado) — ou 422 padrão do FastAPI (`detail` lista) para requisição malformada, ou `{"detail": str}` para arquivo sem nome; **404** configuração inexistente; **409** versão duplicada na configuração ou id existente; **413** arquivo > 1 MiB / corpo grande / XLSX > limites; **415** formato não reconhecido pelo seletor |
| `GET /api/v1/load-charts/{chart_id}` | — | **200** `LoadChartResponse`; **404** |
| `POST /api/v1/load-charts/{chart_id}/activate` | — | **200** `LoadChartActivationResponse` (= `LoadChartResponse` + `superseded_chart_id`); **404**; **409** status não ativável (`INVALID`, `ACTIVE`, `SUPERSEDED`) ou mudança concorrente |

`LoadChartResponse`: `chart_id`, `version`, `configuration_id`, `status` (um dos 5 de § 13.2),
`point_count`, `points[]` (`boom_length_m`, `working_radius_m`, `max_capacity_kg`), `source`
(`file_name`, `file_type` = content-type sem parâmetros ou `application/octet-stream`, `sha256`,
`uri`). Erros 404/409/413/415: `{"detail": str}`.

## 3. Arquivos modificados

```text
$ git diff --stat e5a8945   (antes do commit de docs)
 .env.example                                       |   5 +
 backend/app/application/ports/file_storage.py      |  72 +++++
 .../app/application/ports/load_chart_activation.py |  50 +++
 .../application/ports/load_chart_file_limits.py    |  18 ++
 .../application/use_cases/activate_load_chart.py   |  79 +++++
 .../app/application/use_cases/import_load_chart.py | 109 +++++++
 .../importers/xlsx_resource_limits.py              | 125 ++++++++
 .../sqlalchemy_load_chart_activation_repository.py |  74 +++++
 .../infrastructure/storage/local_file_storage.py   | 105 +++++++
 backend/app/load_chart_persistence_composition.py  |  54 ++++
 backend/app/main.py                                |   3 +
 .../app/presentation/api/load_chart_persistence.py | 226 ++++++++++++++
 .../api/load_chart_persistence_schemas.py          |  77 +++++
 backend/app/presentation/api/main.py               |  11 +-
 .../tests/application/test_activate_load_chart.py  | 115 +++++++
 .../tests/application/test_import_load_chart.py    | 160 ++++++++++
 .../tests/fixtures/load_chart_persistence_fakes.py | 130 ++++++++
 ...est_load_chart_import_activation_integration.py | 223 ++++++++++++++
 .../infrastructure/test_local_file_storage.py      | 132 ++++++++
 .../infrastructure/test_xlsx_resource_limits.py    | 142 +++++++++
 .../presentation/test_load_chart_persistence.py    | 334 +++++++++++++++++++++
 21 files changed, 2243 insertions(+), 1 deletion(-)
```

Mais este handoff e o arquivo da tarefa. Fora das pastas combinadas (todos arquivos **novos**, sem
conflito com as paralelas): `infrastructure/importers/xlsx_resource_limits.py`,
`infrastructure/repositories/sqlalchemy_load_chart_activation_repository.py` (a troca atômica
precisa de SQLAlchemy) e `backend/app/load_chart_persistence_composition.py` (para a mudança em
`app/main.py` ser de 3 linhas).

## 4. Comandos executados e resultados

Em `backend/`, Windows, Python do `uv`:

| Comando | Resultado | Saída (resumo) |
|---------|-----------|----------------|
| `uv sync --locked` | ✅ | sem mudança no lock; nenhuma dependência nova |
| `uv run ruff check .` | ✅ | `All checks passed!` |
| `uv run ruff format --check .` | ✅ | `136 files already formatted` |
| `uv run mypy app` | ✅ | `Success: no issues found in 81 source files` |
| `uv run lint-imports` | ✅ | `Contracts: 3 kept, 0 broken.` |
| `uv run pytest` | ✅ | `721 passed, 23 skipped` (89 testes novos: 81 passaram, 8 de integração pulados) |
| `bash scripts/check-structure.sh` (raiz) | ✅ | `OK: 0 erros, 0 aviso(s)` |
| testes `integration` (PostgreSQL) | ⚠️ NÃO EXECUTADO | sem `DATABASE_URL` local; pulados. O CI valida |

## 5. Decisões tomadas

- **Mudança mínima nos `main.py` (para a mescla com a TASK-029):**
  - `backend/app/presentation/api/main.py`: import de `LoadChartPersistenceDependencies` e
    `create_load_chart_persistence_router`; parâmetro novo `load_chart_persistence:
    LoadChartPersistenceDependencies | None = None` em `create_app`; 2 linhas na docstring; `if
    load_chart_persistence is not None: app.include_router(...)`.
  - `backend/app/main.py`: `from app.load_chart_persistence_composition import
    build_load_chart_persistence` e o argumento `load_chart_persistence=build_load_chart_persistence()`
    em `create_app(...)`. Se a TASK-029 criar o engine/`sessionmaker` em `app.main`, vale passar a
    mesma fábrica de sessões para cá (hoje a composição cria o próprio engine: dois pools).
- `DATABASE_URL` ausente ou `FILE_STORAGE_DIR` ausente → rotas não registradas (API sobe como antes,
  `app.main` continua importável nos testes). `DATABASE_URL` definida mas inválida → erro na subida.
- Armazenamento endereçado pelo conteúdo, sem extensão no nome (o tipo fica no banco).
- Ordem: grava o arquivo antes da tabela. Se o `save_draft` falhar (409/404), o arquivo fica órfão,
  mas é inofensivo (não sobrescreve nada, reaproveitado na próxima importação igual).
- Importação inválida → **422** com o relatório (no `/validate` é 200): na importação o pedido era
  criar a tabela, e ela não foi criada. Corpo distingue-se do 422 do FastAPI pelo campo `status`.
- Configuração inexistente → 404 (recurso referenciado não existe).
- Troca atômica numa porta nova em vez de mudar `LoadChartRepository.change_status` (arquivo da
  TASK-022 não alterado). `DRAFT → VALIDATED` numa transação à parte: se a ativação falhar, a tabela
  fica `VALIDATED` (estado válido) e pode ser ativada de novo.
- Linhas do XLSX contadas em todas as planilhas (mais restritivo; o parser só lê a primeira).

## 6. Regras de negócio aplicadas

- RN-001 (tabela por configuração): vínculo validado pela FK (404). RN-005 (versão): duplicada → 409.
- RN-006 (unidades internas): pontos pelos parsers existentes.
- Regras **não documentadas** usadas como interpretação → § 8 (itens 1–3).

## 7. O que NÃO foi feito e por quê

- `POST /{id}/validate` (doc-fonte § 15.2) não criado: a validação acontece na importação.
- Tabelas `INVALID` e o relatório não são gravados (TASK-022 § 8 item 4 continua aberto).
- Limite de linhas do CSV não criado (pedido só para XLSX; o CSV é limitado pelo 1 MiB).
- `docker-compose.yml` não recebe `FILE_STORAGE_DIR` nem volume (fora do escopo): no Compose as rotas
  novas **não aparecem** até isso ser feito.
- Testes de integração NÃO EXECUTADOS localmente.

## 8. Pendências / decisões necessárias (para a pessoa responsável)

| # | Pergunta | Bloqueia? | Resposta | Respondida em |
|---|----------|-----------|----------|---------------|
| 1 | INTERPRETAÇÃO A CONFIRMAR: ativar uma tabela rebaixa a `ACTIVE` anterior da mesma configuração a `SUPERSEDED` na mesma transação (derivado de "ACTIVE → SUPERSEDED", doc-fonte § 13.2). Confirma? | não | | |
| 2 | `DRAFT → VALIDATED` automático na ativação (a tabela já passou pela validação da importação) está bom, ou `VALIDATED` exige um passo explícito (`POST /{id}/validate`, doc-fonte § 15.2)? | não | | |
| 3 | Ativar tabela já `ACTIVE` responde 409 (não idempotente); reativar `SUPERSEDED` (rollback de versão) é recusado. Confirma ou define outra regra? | não | | |
| 4 | Importação inválida responde 422 com o relatório (no `/validate` é 200). Confirma? E o `/validate` continua existindo ao lado do `/import` (TASK-019 § 8 item 2)? | não | | |
| 5 | Limites PROVISÓRIOS do XLSX (P-008): 10 MiB descompactado e 10 000 linhas somando todas as planilhas. Confirmar ou definir; CSV também deve ter limite de linhas? | não (sim, antes de uso fora do ambiente local) | | |
| 6 | Configuração inexistente → 404. Ou deveria entrar no relatório `INVALID` (doc-fonte § 13.1 "vínculo com configuração existente")? | não | | |
| 7 | `docker-compose.yml`: adicionar `FILE_STORAGE_DIR` e um volume para o backend (sem isso as rotas não sobem no Compose). Em qual tarefa? | não (sim, para usar pela stack Docker) | | |
| 8 | Arquivo-fonte órfão quando o `save_draft` falha (409/404): aceitável (endereçado pelo conteúdo) ou precisa de limpeza? | não | | |
| 9 | `chart_id` continua vindo do cliente (como no `/validate`) ou deve ser gerado pelo servidor? | não | | |

## 9. ⚠️ Segurança

- Path traversal: o nome em disco vem só do sha256 calculado; URIs lidas passam por regex estrita e
  checagem do caminho resolvido (testado com `..`, `/`, `\`, maiúsculas, `\n`).
- Zip bomb: limites provisórios (P-008) antes do openpyxl; `defusedxml` continua não instalado
  (TASK-023 § 8 item 4). O `iterparse` usa o expat da biblioteca padrão (com proteção de amplificação
  de entidades nas versões atuais).
- Rotas de escrita sem autenticação (P-009): não expor fora da máquina.

## 10. Próximo passo

**Papel:** Revisor (outra sessão/ferramenta), depois pessoa responsável.

**O que fazer, concretamente:**
1. Revisar o diff `git diff development...task/TASK-031-importacao-com-gravacao`; conferir no CI os
   8 testes `integration` novos.
2. Pessoa responsável: responder § 8 e decidir a mescla dos dois `main.py` com a TASK-029 (§ 5).
3. Documentação a atualizar (não editada aqui, por protocolo da leva B): `docs/architecture.md`
   (FileStoragePort, storage local, troca atômica da ACTIVE, módulo de composição novo);
   `docs/development-guide.md` § 6 (`FILE_STORAGE_DIR`) e § 3 (rotas novas);
   `docs/known-gaps.md` (P-008: limites provisórios do XLSX; L-003/P-009 agora cobre rotas de
   escrita); `docs/business-rules.md` só se a pessoa confirmar § 8 itens 1–3; `README.md` (rotas);
   `handoffs/current.md` (índice: TASK-031 em revisão).

**Ler primeiro (nesta ordem):**
1. `AGENTS.md`
2. este handoff
3. `tasks/in-progress/TASK-031-importacao-com-gravacao.md` § 3
4. `backend/app/application/use_cases/import_load_chart.py` e `activate_load_chart.py`
5. `backend/app/infrastructure/repositories/sqlalchemy_load_chart_activation_repository.py`

**Cuidado com:**
- As rotas só existem com `DATABASE_URL` e `FILE_STORAGE_DIR`; `create_app()` sem dependências não
  as registra.
- `GET /api/v1/load-charts/{chart_id}` convive com `POST /validate` e `POST /import` no mesmo prefixo.

## 11. Como revisar este trabalho

- Comece pelo adapter da troca atômica: é o único SQL novo e só foi testado contra o banco no CI
  (ordem SUPERSEDED antes de ACTIVE por causa do índice único parcial não adiável).
- Tenho menos certeza sobre o comportamento concorrente real (duas ativações simultâneas): o
  raciocínio (FOR UPDATE + reavaliação do UPDATE em READ COMMITTED + índice único) não tem teste.
- `ensure_xlsx_within_limits` confia no tamanho declarado de cada parte. Verifiquei no código do
  `zipfile` instalado (`ZipExtFile`: `data = data[:self._left]` e `_eof` quando `_left <= 0`) que a
  leitura para no tamanho declarado; o openpyxl usa o mesmo `zipfile`.
