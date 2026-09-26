# Handoff — TASK-019 — implementação (endpoint REST de validação da importação CSV)

> **Tarefas em paralelo (TASK-006):** este handoff fica em `handoffs/TASK-019.md`;
> `handoffs/current.md` não foi editado. Tarefas paralelas desta leva: TASK-015
> (`backend/app/application/`, `backend/tests/application/`), TASK-016 (`frontend/`) e TASK-018
> (CI, `docs/`, `backend/tests/infrastructure/database/`). Nenhum arquivo delas foi tocado.

| Campo | Valor |
|-------|-------|
| **Data/hora** | 2026-09-26 16:05 (relógio local da máquina, UTC-3) |
| **Tarefa** | `tasks/in-progress/TASK-019-endpoint-validacao-importacao.md` |
| **Etapa concluída** | implementação |
| **Papel exercido** | Planejador + Engenheiro de testes + Implementador (um único agente, declarado conforme AGENTS.md § 3) |
| **Ferramenta/agente** | Claude Code 2.1.280 (modelo Opus 5.5), subagente num git worktree isolado |
| **Branch** | `task/TASK-019-endpoint-validacao-importacao` @ `eea802d` (antes do commit deste handoff), a partir de `438d812` |
| **Duração aproximada** | ~60 min |

---

## 1. Objetivo desta etapa

Expor por REST a validação da importação de tabela de carga em CSV (RF-006, RF-009, RNF-006,
RNF-007), usando o caso de uso `ValidateLoadChartImport` e o `CsvLoadChartParser` da TASK-010, sem
persistência e sem ativação, com um limite de tamanho de upload provisório.

## 2. O que foi feito

- Verifiquei que o worktree veio em `f545c78` e criei a branch a partir de `438d812`, como pedido
  (`git switch -c task/TASK-019-endpoint-validacao-importacao 438d812`; `git log -1` confirmou
  `438d812`).
- Verifiquei que o FastAPI 0.141.1 exige o `python-multipart` para `Form`/`File`
  (`fastapi/dependencies/utils.py`, `ensure_multipart_is_installed`) e adicionei-o com
  `uv add python-multipart` (0.0.32; § 5.9).
- Verifiquei, com um módulo de sonda temporário (apagado em seguida), que o contrato de camadas do
  import-linter **proíbe** `app.presentation` de importar `app.infrastructure`, direta ou
  indiretamente (as duas são camadas independentes, `|`), e que um módulo fora das camadas que
  importa as duas passa (`Contracts: 3 kept, 0 broken`). Por isso a composição ficou em
  `backend/app/main.py` (§ 5.3), sem alterar `backend/pyproject.toml` além da dependência.
- Criei em `backend/app/presentation/api/`:
  - `load_charts.py`: `create_load_charts_router(parser, upload_limits)` com
    `POST /api/v1/load-charts/validate` (multipart: `file`, `configuration_id`, `chart_id`,
    `version`), que instancia `ValidateLoadChartImport(parser)` a cada requisição;
  - `load_chart_schemas.py`: schemas Pydantic `LoadChartValidationResponse`,
    `LoadChartPointResponse` e `LoadChartImportIssueResponse`, com o mapeamento do resultado do caso
    de uso;
  - `upload_limits.py`: `UploadLimits` (limite do arquivo, padrão **1 MiB PROVISÓRIO — A VALIDAR
    (P-008)**), a classe de rota que recusa corpo grande demais antes de ler o formulário, a leitura
    do arquivo com limite exato e o schema `ErrorResponse` do 413.
- Alterei `backend/app/presentation/api/main.py`: agora tem `create_app(*, load_chart_parser=None,
  upload_limits=None)`, que registra o router quando recebe um parser. O `app` do módulo continua
  existindo (base do contrato, sem a rota nova) por compatibilidade (§ 5.4).
- Criei a raiz de composição `backend/app/main.py`: `app = create_app(load_chart_parser=
  CsvLoadChartParser(), upload_limits=UploadLimits())`. **A API completa agora é `app.main:app`.**
- Escrevi 32 testes em `backend/tests/presentation/` (`test_load_charts_validate.py`,
  `test_upload_limits.py`, `test_openapi_load_charts.py`), com os CSVs e metadados FICTÍCIOS já
  existentes em `backend/tests/fixtures/` (só lidos, não alterados).
- Rodei o `app.main:app` num uvicorn real (script temporário fora do repositório, que sobe o servidor
  numa thread em `127.0.0.1:8765`, faz as requisições e o derruba; nenhum servidor ficou rodando):
  válido → 200 `DRAFT` com 6 pontos; inconsistências → 200 `INVALID` com 8 itens; 1 MiB + 1 byte →
  413; 5 MiB com `Content-Length` → 413; 5 MiB em blocos, sem `Content-Length` → 413; rota presente
  no `/openapi.json`.
- Criei `tasks/in-progress/TASK-019-endpoint-validacao-importacao.md` (CA-1..CA-9, plano e cenários).

### Contrato do endpoint

`POST /api/v1/load-charts/validate`, corpo `multipart/form-data`, todos obrigatórios:

| Campo | Tipo | Observação |
|-------|------|------------|
| `file` | arquivo | CSV no formato provisório da TASK-010 (P-006); não é gravado |
| `configuration_id` | texto | RN-001; não se verifica se existe (sem persistência) |
| `chart_id` | texto | id da tabela |
| `version` | texto | RN-005 |

| Resposta | Quando | Corpo |
|----------|--------|-------|
| 200 | validação concluída, com ou sem inconsistências | `LoadChartValidationResponse`: `chart_id`, `version`, `configuration_id`, `status` (`DRAFT` \| `INVALID`), `point_count`, `points[]` (`boom_length_m`, `working_radius_m`, `max_capacity_kg`), `issues[]` (`code`, `message`, `line`, `column`) |
| 413 | arquivo maior que o limite, ou corpo maior que o limite + 16 KiB | `{"detail": "..."}` (`ErrorResponse`) |
| 422 | arquivo ou campo obrigatório ausente, campo vazio, texto no lugar do arquivo (validação do FastAPI) | `HTTPValidationError` do FastAPI |

`DRAFT`: `points` com todos os pontos e `issues` vazio. `INVALID`: `issues` com o relatório do caso
de uso e `points` vazio (§ 5.6).

## 3. Arquivos modificados

`git diff --stat 438d812...HEAD` antes do commit deste handoff (este arquivo entra no commit final):

```text
 backend/app/main.py                                |  19 ++
 backend/app/presentation/api/load_chart_schemas.py | 101 +++++++++
 backend/app/presentation/api/load_charts.py        |  95 ++++++++
 backend/app/presentation/api/main.py               |  41 +++-
 backend/app/presentation/api/upload_limits.py      | 139 ++++++++++++
 backend/pyproject.toml                             |   1 +
 backend/tests/presentation/__init__.py             |   0
 .../presentation/test_load_charts_validate.py      | 250 +++++++++++++++++++++
 .../tests/presentation/test_openapi_load_charts.py |  91 ++++++++
 backend/tests/presentation/test_upload_limits.py   | 149 ++++++++++++
 backend/uv.lock                                    |  11 +
 .../TASK-019-endpoint-validacao-importacao.md      | 167 ++++++++++++++
 12 files changed, 1059 insertions(+), 5 deletions(-)
```

Fora da lista de arquivos combinada (justificativa):
- `backend/app/main.py` — módulo de composição, previsto no pedido para o caso de o contrato de camadas
  proibir a apresentação de importar a infraestrutura (e proíbe; § 2 e § 5.3).
- `backend/pyproject.toml` e `backend/uv.lock` — só a dependência `python-multipart`, autorizada no
  pedido se o FastAPI a exigisse (e exige).

Conflito com `development` atual (`b471b6e`, já com TASK-015 e TASK-018): nenhum arquivo em comum;
`git merge-tree --write-tree --name-only development HEAD` devolveu só o hash da árvore, sem conflito.

## 4. Comandos executados e resultados

Em `backend/`, exceto o `check-structure.sh` (raiz). Rodados depois do último commit de código
(`eea802d`).

| Comando | Resultado | Saída (resumo) |
|---------|-----------|----------------|
| `uv add python-multipart` | ✅ | `Resolved 49 packages` / `+ python-multipart==0.0.32` |
| `uv run python -c "import sys, python_multipart; ..."` | ✅ | `3.14.7 ...` / `0.0.32` / `Apache-2.0` / `Requires-Python >=3.10` |
| `uv sync --locked` | ✅ | `Resolved 49 packages in 1ms` / `Checked 46 packages in 2ms` |
| `uv run ruff check .` | ✅ | `All checks passed!` |
| `uv run ruff format --check .` | ✅ | `74 files already formatted` |
| `uv run mypy app` | ✅ | `Success: no issues found in 45 source files` |
| `uv run lint-imports` | ✅ (exit 0) | `Contracts: 3 kept, 0 broken.` |
| `uv run pytest` | ✅ | `330 passed, 2 skipped in 4.85s` |
| `uv run pytest --ignore=tests/presentation` | ✅ | `298 passed, 2 skipped` (o que já existia; nenhum quebrou) |
| `uv run pytest tests/presentation tests/test_openapi.py` | ✅ | `33 passed` (32 novos + o de OpenAPI existente) |
| `uv run pytest -rs` | ✅ | os 2 pulos: `test_postgres_integration.py`, `DATABASE_URL não definida` (anteriores a esta tarefa) |
| `uv run mypy tests/presentation` (informativo, não é gate) | ✅ | `Success: no issues found in 4 source files` |
| uvicorn real + requisições HTTP (script temporário, § 2) | ✅ | `valido: 200 DRAFT 6`, `inconsistencias: 200 INVALID 8`, `1 MiB + 1: 413`, `5 MiB (Content-Length): 413`, `5 MiB chunked: 413 ... False` (sem `Content-Length`), `openapi: 200 True`, `servidor parado: True` |
| `bash scripts/check-structure.sh` | ✅ | `OK: 0 erros, 0 aviso(s)` |

```text
7. Branches
  ✓ branch de tarefa: task/TASK-019-endpoint-validacao-importacao
8. Autoria dos commits (sem co-autoria de IA)
  ✓ 4 commit(s) desta branch sem co-autoria de IA

OK: 0 erros, 0 aviso(s)
```

`uv run mypy tests` (tudo, informativo) acusa 10 erros em `tests/domain/` e
`tests/infrastructure/database/test_engine.py`, que já existiam e não são desta tarefa; nenhum em
`tests/presentation/`.

## 5. Decisões tomadas

1. **Rota `POST /api/v1/load-charts/validate`, sem id.** A doc-fonte § 15.2 tem
   `POST /import` (cria a tabela) e `POST /{load_chart_id}/validate` (valida uma tabela já
   persistida). Sem tabelas no banco, não há `load_chart_id` para pôr na rota, e chamar de `/import`
   prometeria uma gravação que não acontece. `/validate` na coleção diz o que a rota faz: valida o
   arquivo sem criar nada. Quando houver persistência, `/import` pode gravar a tabela (e o arquivo-
   fonte, RF-008) reaproveitando o mesmo caso de uso, e esta rota pode virar um "dry run" ou sair;
   isso fica para a pessoa (pendência 2).
2. **Tabela inválida responde 200 com `status: INVALID`, não 422.** A requisição estava bem formada e
   o relatório é o produto pedido (RNF-006); o 422 fica com o significado que o FastAPI já dá, a
   requisição malformada (arquivo ou campo faltando), com o schema `HTTPValidationError`. Usar 422
   para os dois casos daria dois corpos diferentes no mesmo código (o OpenAPI só documenta um schema
   por código sem recorrer a `oneOf`) e obrigaria o cliente a adivinhar qual é. Com 200, o contrato
   tem um schema só, e `status` diz se a tabela é `DRAFT` ou `INVALID`.
3. **Composição fora das camadas, em `backend/app/main.py`.** O contrato de camadas trata
   `app.presentation` e `app.infrastructure` como independentes: nem o router nem um módulo
   intermediário importado por ele podem chegar ao `CsvLoadChartParser` (testado com sonda, § 2). A
   saída que respeita o contrato sem mudá-lo é uma raiz de composição fora das camadas, que importa as
   duas e injeta o parser no router (é o componente "Main" da Clean Architecture, ADR-004). Nenhum
   módulo das camadas importa `app.main`. Alternativas descartadas: mudar o contrato para `:` ou
   `ignore_imports` (mudaria a regra de dependência do `docs/architecture.md` § 3 — decisão da
   pessoa); import dinâmico com `importlib` (burlaria o contrato sem que o linter visse).
4. **`create_app` na apresentação e `app` de compatibilidade.** O router é montado por fábrica
   (`create_load_charts_router(parser, upload_limits)`), e `create_app` o registra quando recebe um
   parser. O `app = create_app()` de `app/presentation/api/main.py` continua existindo, **sem** a rota
   nova, porque `tests/test_openapi.py`, `docs/development-guide.md` § 3 e o `README.md` apontam para
   ele e eu não podia alterá-los nesta tarefa. Consequência: `uvicorn app.presentation.api.main:app`
   sobe a API sem a rota; a API completa é `uvicorn app.main:app` (pendência 1, docs no § 10).
5. **Limite de upload em dois pontos** (`upload_limits.py`). O Starlette lê o formulário inteiro antes
   de o endpoint rodar e guarda cada arquivo num `SpooledTemporaryFile(max_size=1 MiB)`
   (`starlette/formparsers.py`), que passa para um **arquivo temporário em disco** acima de 1 MiB. Só
   checar o tamanho no endpoint deixaria um upload de qualquer tamanho ser lido e ir para o disco antes
   do 413. Por isso:
   - a classe de rota do router recusa com 413 o corpo acima de `limite do arquivo + 16 KiB` **antes**
     de o formulário ser lido: pelo `Content-Length` declarado e, sem ele (envio em blocos), contando
     os bytes recebidos e interrompendo a leitura. O FastAPI repassa `HTTPException` levantada durante
     a leitura do corpo (`fastapi/routing.py`), então o cliente recebe o 413 em JSON;
   - o endpoint lê no máximo `limite + 1` bytes do arquivo e recusa com 413 o que passar do limite,
     com precisão de byte.
   A margem de 16 KiB (`MULTIPART_FORM_ALLOWANCE_BYTES`, também A VALIDAR) cobre delimitadores,
   cabeçalhos das partes e os três campos de texto.
6. **Formato da resposta.** `points` e `point_count` só têm conteúdo em `DRAFT`. Em `INVALID`, a lista
   vem vazia e `point_count` é 0, porque o caso de uso da TASK-010 decidiu que uma importação inválida
   não devolve tabela nem pontos parciais (`InvalidLoadChartImport` não os tem). Mostrar quantas linhas
   eram válidas numa tabela inválida exigiria mudar o caso de uso (área da TASK-015 nesta leva);
   pendência 3. Os metadados enviados voltam nos dois casos. Nomes com sufixo de unidade (`_m`, `_kg`),
   como em `docs/development-guide.md` § 5.
7. **Limite como parâmetro de código, não variável de ambiente.** `UploadLimits(max_file_bytes=...)` é
   passado a `create_app` pela raiz de composição. Uma variável de ambiente exigiria atualizar o
   `.env.example` e o `docs/development-guide.md` § 6 na mesma tarefa (regra do guia), fora dos
   arquivos permitidos; pendência 5.
8. **Rota síncrona (`def`).** O FastAPI roda a rota numa thread à parte, então ler o arquivo
   (`UploadFile.file`) e validar a tabela (CPU) não travam o laço de eventos.
9. **Dependência nova** (fonte: PyPI, via `uv add`; o `uv` confirmou o pacote no registro; repositório
   `github.com/Kludex/python-multipart`, do mantenedor do Starlette):

| Pacote | Versão | Motivo | Alternativa considerada | Licença |
|--------|--------|--------|-------------------------|---------|
| `python-multipart` | 0.0.32 | o FastAPI 0.141.1 exige para `Form`/`File` (`multipart/form-data`); sem ele a rota nem é criada | ler o corpo cru (`application/octet-stream`) com os metadados na query — descartada porque o pedido é multipart com campos, e o parser de formulário do Starlette também depende do `python-multipart` | Apache-2.0 |

   Python puro, `Requires-Python >=3.10`; instalou e importou no Python 3.14.7. Nenhuma dependência
   transitiva nova. `docs/policies/security.md` § 4.4 pede ADR para dependência "relevante (framework,
   ORM, cliente de serviço externo)": considerei que não é o caso (é o parser de formulário exigido
   pelo próprio FastAPI, ADR-006), sem criar ADR; pendência 7.
10. **Nenhum ADR.** A raiz de composição aplica o ADR-004 e o contrato existente, sem mudar a regra de
    dependência. Se a pessoa quiser registrar a troca do ponto de entrada (`app.main:app`), é a
    pendência 6.
11. **Fixtures reaproveitadas.** Os testes leem os CSVs e metadados FICTÍCIOS de `backend/tests/fixtures/`
    (TASK-008/010) sem alterá-los; nenhuma fixture nova foi necessária. O `README.md` de
    `backend/tests/fixtures/load_chart_csv/` diz que eles são usados em `tests/infrastructure/`; não o
    atualizei (fora dos arquivos permitidos) — § 10.

## 6. Regras de negócio aplicadas

- Nenhuma regra funcional nova: o endpoint só expõe o caso de uso da TASK-010.
- RN-001 e RN-005 — `configuration_id` e `version` obrigatórios no formulário (422 se ausentes ou
  vazios, pelo FastAPI) e, se só com espaços, `MISSING_METADATA` pelo caso de uso
  (`test_blank_metadata_returns_invalid_with_missing_metadata`); os dois voltam na resposta.
- RN-006 — pontos devolvidos em m e kg, com o sufixo no nome do campo
  (`test_ficticio_valid_csv_returns_200_draft_with_the_points`).
- Doc-fonte § 13.2 — o endpoint só devolve `DRAFT` ou `INVALID` (enum do OpenAPI,
  `test_200_response_is_the_validation_result_with_status_draft_or_invalid`); não ativa nada.
- Regra **não documentada** encontrada: nenhuma nova; as dúvidas de formato continuam as da TASK-010.

## 7. O que NÃO foi feito e por quê

- **Persistência** da tabela, dos pontos, do relatório e do arquivo-fonte (RF-008, RNF-005), `POST
  /import`, `GET /{load_chart_id}` e `activate` (doc-fonte § 15.2): não há tabelas no banco.
- **Verificar se a configuração existe** (doc-fonte § 13.1): depende de persistência.
- **Autenticação e autorização** (P-009, known-gaps L-003): qualquer cliente que alcance a API pode
  chamar o endpoint. Nada é gravado nem ativado, o que limita o dano ao consumo de CPU/memória
  (limitado pelo tamanho).
- **Outros limites de P-008** (número de linhas, número de inconsistências no relatório, tamanho dos
  campos de texto, tipo de conteúdo/extensão do arquivo): não pedidos nesta tarefa. Hoje: o Starlette
  limita cada campo de texto a 1 MiB, e o limite do corpo (arquivo + 16 KiB) limita o conjunto; o tipo
  declarado do arquivo (`text/csv` ou outro) não é verificado — o parser recusa o que não for UTF-8.
- **Atualizar `docs/`, `README.md`, `tests/test_openapi.py` e o README das fixtures**: fora dos arquivos
  permitidos nesta leva; lista exata no § 10.
- **Auditoria de vulnerabilidades da dependência nova:** NÃO EXECUTADA — não há ferramenta definida
  (`docs/security.md` § 5 e `docs/development-guide.md` § 3: "A VALIDAR").
- **Revisão independente:** NÃO EXECUTADA (próximo passo).

## 8. Pendências / decisões necessárias (para a pessoa responsável)

| # | Pergunta | Bloqueia? | Resposta | Respondida em |
|---|----------|-----------|----------|---------------|
| 1 | O ponto de entrada da API completa passou a ser `app.main:app` (raiz de composição). Autoriza atualizar `docs/development-guide.md` § 3, o `README.md` e `tests/test_openapi.py` para ele e, depois, remover o `app` de compatibilidade de `app/presentation/api/main.py` (que hoje sobe **sem** a rota nova)? | não (sim, antes de alguém rodar a API pelo comando antigo esperando a rota) | | |
| 2 | Nome da rota: mantém `POST /api/v1/load-charts/validate` (validação sem gravar) quando vier `POST /import` com persistência, ou ela sai / vira opção de "dry run" do `/import`? | não | | |
| 3 | Numa tabela `INVALID`, a resposta deve informar quantas linhas eram válidas (ou listá-las)? Hoje não: o caso de uso não devolve pontos parciais (TASK-010 § 5) | não | | |
| 4 | Confirmar o limite provisório de 1 MiB por arquivo e a margem de 16 KiB para o resto do formulário, ou definir os valores (P-008); definir também limites de linhas, de tamanho dos campos e se o tipo/extensão do arquivo deve ser verificado | não (sim, antes de uso fora do ambiente local) | | |
| 5 | O limite deve ser configurável por variável de ambiente (ex.: `LOAD_CHART_MAX_UPLOAD_BYTES`)? Exigiria atualizar `.env.example` e `docs/development-guide.md` § 6 | não | | |
| 6 | Quer um ADR registrando a raiz de composição (`backend/app/main.py`, fora das camadas) como o lugar onde os adapters da infraestrutura são ligados à API? | não | | |
| 7 | `python-multipart` (Apache-2.0) exige ADR pela `docs/policies/security.md` § 4.4? Considerei que não (é exigido pelo próprio FastAPI) | não | | |
| 8 | Autenticação (P-009): enquanto não houver, o endpoint fica aberto a qualquer cliente que alcance a API; OK para o ambiente local? | não (sim, antes de expor a API fora da máquina) | | |

## 9. ⚠️ Segurança

- Sem segredos e sem dados reais: os CSVs e metadados dos testes são FICTÍCIOS e rotulados.
- **Endpoint sem autenticação** (P-009, L-003) — pendência 8.
- **Limite provisório** de 1 MiB (A VALIDAR, P-008). O código não grava o arquivo. Ressalva: o
  Starlette mantém o arquivo do formulário em memória até 1 MiB e passaria para um arquivo temporário
  (apagado no fim da requisição) acima disso; com o limite padrão e a margem de 16 KiB, isso só pode
  acontecer com um arquivo entre 1 MiB e 1 MiB + 16 KiB, que é recusado com 413 logo depois. Se o
  limite configurado passar de 1 MiB, uploads maiores que 1 MiB e dentro do limite passam por arquivo
  temporário. Quando o corte acontece no meio do envio em blocos, o Starlette fecha (e assim apaga) os
  arquivos temporários parciais (`starlette/formparsers.py`, `except BaseException` em `parse`).

## 10. Próximo passo

**Papel:** Revisor (outra sessão/ferramenta, AGENTS.md § 3); depois a pessoa responsável (pendências e
atualização da documentação)

**O que fazer, concretamente:**
1. Revisar `git diff development...task/TASK-019-endpoint-validacao-importacao` com
   `docs/templates/code-review-template.md`, conferindo: `app.presentation` não importa
   `app.infrastructure`; o limite está rotulado PROVISÓRIO/A VALIDAR (P-008); nada é gravado.
2. Rodar os gates em `backend/` (tabela do § 4) e confirmar as saídas.
3. Pessoa: responder o § 8. A sessão principal faz push e PR (o agente não fez).
4. Atualizações de documentação que **não** fiz (fora dos arquivos permitidos nesta leva) e que
   precisam acontecer, de preferência na mesma PR ou logo depois:
   - `docs/development-guide.md` § 3: comando `uv run uvicorn app.main:app --reload` (hoje
     `app.presentation.api.main:app`, que sobe sem a rota); § 4: acrescentar `app/main.py` (raiz de
     composição) à árvore do backend; linha "Stack": citar `python-multipart`, se quiser.
   - `README.md` (raiz, linha 61): o mesmo comando do uvicorn.
   - `docs/architecture.md`: cabeçalho de status e § 9 ("o backend só expõe o contrato OpenAPI" deixou
     de ser verdade: existe `POST /api/v1/load-charts/validate`); § 2: a apresentação passa a existir
     (`app/presentation/api/load_charts.py`) e entra uma linha "Raiz de composição —
     `backend/app/main.py` — liga adapters da infraestrutura à API"; § 3: dizer que só a raiz de
     composição importa apresentação e infraestrutura; § 6: a importação de tabela de carga é
     `POST /api/v1/load-charts/validate` (só valida), importador em
     `backend/app/infrastructure/importers/` (não é mais "planejado"), sem autenticação.
   - `docs/known-gaps.md`: L-001 (há um endpoint de validação, sem persistência); L-003 (o endpoint
     existe sem autenticação); P-008 (limite provisório de 1 MiB adotado na TASK-019, ver
     `handoffs/TASK-019.md`); § 5 e § 6 ("endpoint de negócio"/"API de negócio" não existem): agora
     existe um, testado em `backend/tests/presentation/`.
   - `docs/security.md` § 4 (linha modelo "upload de arquivo"): preencher com o upload de CSV (limite
     provisório, UTF-8, sem gravação, sem autenticação).
   - `docs/requirements/functional.md` / `non-functional.md`: se a coluna de status de RF-006, RF-009 e
     RNF-007 acompanhar a implementação, registrar a implementação parcial.
   - `backend/tests/fixtures/load_chart_csv/README.md`: coluna "Usado em" passa a incluir
     `tests/presentation/`.
   - `backend/tests/test_openapi.py`: importar de `app.main` depois da pendência 1.

**Ler primeiro (nesta ordem):**
1. `AGENTS.md`
2. este handoff (§ 2, contrato; § 5, decisões)
3. `tasks/in-progress/TASK-019-endpoint-validacao-importacao.md` § 3 (critérios de aceite)
4. `backend/app/main.py` (raiz de composição) e `backend/app/presentation/api/main.py` (`create_app`)
5. `backend/app/presentation/api/load_charts.py` (rota) e `load_chart_schemas.py` (resposta)
6. `backend/app/presentation/api/upload_limits.py` (limite em dois pontos)
7. `backend/app/application/use_cases/validate_load_chart_import.py` (TASK-010, `DRAFT` × `INVALID`)

**Cuidado com:**
- `uvicorn app.presentation.api.main:app` sobe **sem** a rota nova; use `uvicorn app.main:app`.
- O `TestClient` entrega o corpo inteiro numa mensagem só; o teste do envio em blocos sem
  `Content-Length` chama a aplicação ASGI direto (`test_upload_limits.py`).
- No Windows, a saída do `lint-imports` mostra acentos trocados no console; com
  `PYTHONIOENCODING=utf-8` sai correta (já documentado no guia § 9).

## 11. Como revisar este trabalho

- Comece por `upload_limits.py`: é onde está o que é menos óbvio (a classe de rota que envolve o
  `receive` do ASGI e depende de o FastAPI repassar `HTTPException` levantada na leitura do corpo). Os
  testes `test_request_body_over_the_limit_returns_413_before_the_form_is_read` e
  `test_body_without_content_length_over_the_limit_is_cut_while_streaming` provam que o parser não é
  chamado e que a leitura para cedo; o script com uvicorn real (§ 4) confirmou o mesmo por HTTP.
- Depois `app/main.py` + `create_app`: confira que a escolha de manter o `app` de compatibilidade
  (sem a rota) é aceitável até a documentação ser atualizada (pendência 1).
- Tenho menos certeza sobre: a margem fixa de 16 KiB (poderia ser proporcional); instanciar o caso de
  uso a cada requisição em vez de uma vez (é barato e evita estado compartilhado); e o `point_count` 0
  em `INVALID`, que pode ser lido como "nenhuma linha válida" — a descrição no OpenAPI explica.
- Os testes não cobrem desempenho com arquivos de 1 MiB de pontos válidos (resposta grande) nem
  concorrência.
