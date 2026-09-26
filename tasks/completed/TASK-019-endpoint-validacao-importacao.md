# TASK-019 — Expor por REST a validação da importação de tabela de carga em CSV

| Campo | Valor |
|-------|-------|
| **Status** | completed |
| **Prioridade** | alta |
| **Criada em** | 2026-09-26 por Anderson Sehnem (leva TASK-018..019, tarefas em paralelo) |
| **Iniciada em** | 2026-09-26 |
| **Concluída em** | 2026-09-26 |
| **Branch** | `task/TASK-019-endpoint-validacao-importacao` (a partir de `438d812`, commit-base da leva TASK-018..019) |
| **PR** | [#19](https://github.com/Umaiii-chan/JA-Guindastes/pull/19), mergeado em 2026-09-26 com CI verde |
| **Requisitos** | RF-006, RF-009, RNF-006, RNF-007 |
| **Regras de negócio** | RN-001, RN-005, RN-006 (aplicadas pelo caso de uso da TASK-010) |
| **Estimativa** | M |

---

## 1. Objetivo

Quem administra as tabelas de carga passa a poder enviar um arquivo CSV por HTTP e receber, na hora,
o resultado da validação: status `DRAFT` com os pontos da tabela, ou `INVALID` com o relatório de
inconsistências (código, mensagem, linha, coluna). Nada é gravado e nenhuma tabela é ativada.

## 2. Contexto

Pedido da pessoa responsável em 2026-09-26 (leva TASK-018..019). Por haver tarefas em paralelo
(TASK-015, 016 e 018), o handoff desta tarefa fica em `handoffs/TASK-019.md` e `handoffs/current.md`
não é editado.

Base: o caso de uso `ValidateLoadChartImport` e o `CsvLoadChartParser` da TASK-010 (formato CSV
**provisório**, known-gaps P-006 e PEND-008); ADR-004 (Clean Architecture), ADR-006 (FastAPI; schemas
Pydantic na apresentação), ADR-010 (REST para uploads e consultas); doc-fonte §§ 13 e 15.2.

Ainda não há tabelas no banco (TASK-011 só configurou a persistência). Por isso o endpoint só
**valida**: a doc-fonte § 15.2 prevê `POST /api/v1/load-charts/import` e
`POST /api/v1/load-charts/{load_chart_id}/validate` como etapas de uma tabela persistida; aqui entra um
`POST /api/v1/load-charts/validate`, sem id de tabela na rota (motivo em `handoffs/TASK-019.md` § 5).

Decisões da pessoa responsável para esta tarefa (2026-09-26):

- entrada: arquivo CSV em `multipart/form-data` e os campos `configuration_id`, `chart_id` e `version`;
- limite de tamanho do arquivo configurável, com valor padrão **PROVISÓRIO de 1 MiB, A VALIDAR (P-008)**;
  arquivo acima do limite recebe 413; o arquivo não é salvo em disco;
- sem autenticação (P-009 pendente), registrado como limitação;
- nenhuma dependência nova, exceto `python-multipart` se o FastAPI exigir para upload de arquivo.

## 3. Critérios de aceite

- [ ] **CA-1** — Dado um CSV FICTÍCIO válido no formato provisório e os campos `configuration_id`,
  `chart_id` e `version`, quando enviado a `POST /api/v1/load-charts/validate`, então a resposta é 200
  com status `DRAFT`, os metadados enviados, a quantidade e a lista dos pontos (em m e kg) e nenhuma
  inconsistência.
- [ ] **CA-2** — Dado um CSV FICTÍCIO com inconsistências (ou em encoding que não é UTF-8), quando
  enviado, então a resposta traz status `INVALID` e o relatório completo do caso de uso, cada item com
  código, mensagem, linha e coluna, e nenhum ponto.
- [ ] **CA-3** — Dado um arquivo maior que o limite configurado (padrão provisório de 1 MiB), quando
  enviado, então a resposta é 413 e o parser não é chamado; um arquivo com exatamente o limite não é
  recusado por tamanho. Uma requisição cujo corpo passa do limite é recusada com 413 antes de o
  formulário ser lido, com ou sem `Content-Length`.
- [ ] **CA-4** — Dada uma requisição sem o arquivo ou sem algum dos campos obrigatórios, quando
  enviada, então a resposta é o 422 de validação do próprio FastAPI.
- [ ] **CA-5** — O endpoint aparece em `/openapi.json` com o corpo `multipart/form-data` (os quatro
  campos obrigatórios), a resposta 200 com o schema Pydantic do resultado (status `DRAFT` ou
  `INVALID`) e as respostas 413 e 422 documentadas (RNF-007).
- [ ] **CA-6** — Os contratos do import-linter continuam valendo sem alteração: `app.presentation` não
  importa `app.infrastructure`; a composição (parser CSV da infraestrutura injetado no router) fica
  num módulo de composição fora das camadas.
- [ ] **CA-7** — Nenhuma dependência nova além de `python-multipart` (exigido pelo FastAPI para
  formulário/arquivo), registrada no handoff com versão, motivo e licença.
- [ ] **CA-8** — `uv sync --locked`, `uv run ruff check .`, `uv run ruff format --check .`,
  `uv run mypy app`, `uv run lint-imports` e `uv run pytest` passam em `backend/`, e
  `bash scripts/check-structure.sh` passa na raiz; nenhum teste existente quebra.
- [ ] **CA-9** — `handoffs/TASK-019.md` registra comandos e saídas reais, a escolha 200 × 422 para
  tabela inválida, o nome da rota, o limite provisório (A VALIDAR, P-008), a falta de autenticação
  (P-009) e o que precisaria mudar em `docs/`.

## 4. Escopo

### Dentro do escopo

- Router FastAPI e schemas Pydantic em `backend/app/presentation/api/` (arquivos novos).
- Registro do router em `backend/app/presentation/api/main.py`.
- Módulo de composição fora das camadas (arquivo novo), se o contrato de camadas proibir a
  apresentação de importar a infraestrutura.
- Testes em `backend/tests/presentation/` com `TestClient` e CSVs FICTÍCIOS.
- `python-multipart` em `backend/pyproject.toml` e `backend/uv.lock`, se o FastAPI exigir.

### Fora do escopo (explicitamente — o agente NÃO faz)

- Persistência da tabela, dos pontos, do arquivo-fonte ou do relatório; `POST /import` com
  persistência; `GET` e `activate` da doc-fonte § 15.2; transições de status.
- Verificar se a configuração existe (depende de persistência).
- Autenticação e autorização (P-009), CORS, limites além do tamanho (número de linhas, zip bomb etc.,
  P-008), XLSX.
- Alterar `docs/`, `handoffs/current.md`, `backend/pyproject.toml` além da dependência,
  `backend/app/application/`, `backend/app/infrastructure/` e os arquivos das tarefas paralelas
  (TASK-015: `backend/app/application/`, `backend/tests/application/`; TASK-016: `frontend/`;
  TASK-018: `.github/workflows/ci.yml`, `docs/decisions/`, `docs/known-gaps.md`,
  `docs/development-guide.md`, `backend/tests/infrastructure/database/`).
- Se algo daqui parecer necessário, registrar em "Pendências" do handoff e parar, não implementar.

## 5. Arquivos provavelmente afetados

| Arquivo | Tipo de mudança | Verificado? |
|---------|-----------------|-------------|
| `backend/app/presentation/api/load_charts.py` | criar | sim |
| `backend/app/presentation/api/load_chart_schemas.py` | criar | sim |
| `backend/app/presentation/api/upload_limits.py` | criar | sim |
| `backend/app/presentation/api/main.py` | alterar (registrar o router) | sim |
| `backend/app/main.py` (raiz de composição) | criar | sim |
| `backend/tests/presentation/` | criar | sim |
| `backend/pyproject.toml`, `backend/uv.lock` | alterar (`python-multipart`) | sim |

## 6. Riscos e dependências

- Depende de: TASK-010 (caso de uso e parser, já em `development`).
- Risco: o contrato de camadas do import-linter trata `app.presentation` e `app.infrastructure` como
  camadas independentes → mitigação: raiz de composição fora das camadas, que importa as duas.
- Risco: o Starlette guarda cada arquivo do formulário num `SpooledTemporaryFile` que passa para o
  disco acima de 1 MiB → mitigação: recusar o corpo grande demais antes de o formulário ser lido.
- Risco: sem autenticação, qualquer cliente que alcance a API pode chamar o endpoint (P-009) →
  mitigação: nada é gravado nem ativado; limitação registrada no handoff.

## 7. Teste manual (se houver)

1. Em `backend/`: `uv run uvicorn app.main:app` e abrir `http://127.0.0.1:8000/docs`.
2. Em `POST /api/v1/load-charts/validate`, enviar
   `backend/tests/fixtures/load_chart_csv/load_chart_ficticio_valido.csv` com `configuration_id`,
   `chart_id` e `version` preenchidos.
   **Esperado:** 200 com `"status": "DRAFT"` e 6 pontos. Com
   `load_chart_ficticio_inconsistencias.csv`: 200 com `"status": "INVALID"` e o relatório.

---

## 8. Plano (preenchido pelo Planejador)

| # | Passo | Arquivos | Como verificar | Feito |
|---|-------|----------|----------------|-------|
| 1 | Criar esta tarefa | `tasks/in-progress/TASK-019-endpoint-validacao-importacao.md` | `bash scripts/check-structure.sh` | [x] |
| 2 | Adicionar `python-multipart` (o FastAPI 0.141 exige para `Form`/`File`) | `backend/pyproject.toml`, `backend/uv.lock` | `uv sync --locked`; import no Python 3.14 | [x] |
| 3 | Limite de upload, schemas, router e registro no `create_app` | `backend/app/presentation/api/*` | `mypy`, `ruff` | [x] |
| 4 | Raiz de composição com o `CsvLoadChartParser` | `backend/app/main.py` | `uv run lint-imports` | [x] |
| 5 | Testes com `TestClient` e CSVs FICTÍCIOS | `backend/tests/presentation/` | `uv run pytest` | [x] |
| 6 | Handoff | `handoffs/TASK-019.md` | `bash scripts/check-structure.sh` | [x] |

**Análise de impacto:**
- Arquivos que podem quebrar indiretamente: `backend/tests/test_openapi.py` (importa
  `app.presentation.api.main.app`), o comando de `docs/development-guide.md` § 3 e do `README.md`.
- Regras de negócio aplicáveis: RN-001, RN-005, RN-006 (pelo caso de uso; o endpoint não acrescenta
  regra funcional).
- Decisões necessárias (→ ADR proposto ou pergunta): nenhuma nova de arquitetura; perguntas no handoff.

## 9. Cenários de teste (preenchido pelo Engenheiro de testes)

| Cenário | Critério | Tipo | Arquivo de teste | Status |
|---------|----------|------|------------------|--------|
| deve responder 200 `DRAFT` com metadados e os 6 pontos quando o CSV FICTÍCIO é válido | CA-1 | API (`TestClient`) | `backend/tests/presentation/test_load_charts_validate.py` | verde |
| deve responder 200 `INVALID` com o relatório completo (linha, coluna, código, mensagem) e sem pontos | CA-2 | API | idem | verde |
| deve devolver os metadados enviados também quando `INVALID` | CA-2 | API | idem | verde |
| deve reportar `INVALID_ENCODING` quando o arquivo não é UTF-8 | CA-2 | API | idem | verde |
| deve reportar `MISSING_METADATA` quando os campos têm só espaços | CA-2 | API | idem | verde |
| não deve recusar por tamanho o arquivo com exatamente 1 MiB | CA-3 | API | idem | verde |
| deve responder 413 sem chamar o parser quando o arquivo tem 1 MiB + 1 byte | CA-3 | API | idem | verde |
| deve responder 413 na aplicação composta (`app.main:app`) | CA-3 | API | idem | verde |
| deve responder 413 antes de ler o formulário quando o corpo passa do limite (`Content-Length`) | CA-3 | API | idem | verde |
| deve aplicar o limite configurado no lugar do padrão | CA-3 | API | idem | verde |
| deve responder 413 cortando a leitura quando o corpo sem `Content-Length` passa do limite | CA-3 | ASGI direto | `backend/tests/presentation/test_upload_limits.py` | verde |
| deve aceitar corpo sem `Content-Length` dentro do limite | CA-3 | ASGI direto | idem | verde |
| limite padrão é 1 MiB (provisório); corpo = arquivo + margem; limite inválido → `ValueError` | CA-3 | unitário | idem | verde |
| deve responder o 422 do FastAPI sem `configuration_id`, `chart_id`, `version` ou `file`, com campo vazio, com texto no lugar do arquivo e sem corpo | CA-4 | API | `backend/tests/presentation/test_load_charts_validate.py` | verde |
| deve publicar no OpenAPI o corpo multipart, o 200 (`DRAFT`/`INVALID`), o schema da inconsistência e os 413/422 | CA-5 | contrato | `backend/tests/presentation/test_openapi_load_charts.py` | verde |
| sem parser, `create_app` não registra a rota | CA-6 | contrato | idem | verde |

## 10. Parecer da revisão (preenchido pelo Revisor)

—

## 11. Encerramento (preenchido ao mover para completed/)

> Movida para `completed/` em 2026-09-26 pela autorização permanente da pessoa responsável (revisão independente dispensada).

- O que foi entregue (2–3 linhas):
- O que ficou de fora e virou tarefa nova: TASK-...
- Aprendizados para o template/docs:
