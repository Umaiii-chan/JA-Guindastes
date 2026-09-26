# Handoff — TASK-030 — implementação

| Campo | Valor |
|-------|-------|
| **Data/hora** | 2026-09-26 (UTC-3, Brasília) |
| **Tarefa** | `tasks/in-progress/TASK-030-cadastros-rest.md` |
| **Etapa concluída** | implementação |
| **Papel exercido** | Planejador, Engenheiro de testes e Implementador (uma só sessão; revisão independente pendente) |
| **Ferramenta/agente** | Claude Code (Opus 5.5), agente em segundo plano num worktree isolado |
| **Branch** | `task/TASK-030-cadastros-rest` @ ver `git log -1` (a partir de `e5a8945`) |
| **Duração aproximada** | 1 h |

---

## 1. Objetivo desta etapa

Cadastrar e consultar pela API REST fabricantes, guindastes e configurações com a ficha técnica
geométrica (ADR-013 C-4), gravando pelos repositórios da TASK-022.

## 2. O que foi feito

- Criei a porta `CraneCatalogListing` (`list_manufacturers`, `list_cranes(manufacturer_id=None)`,
  `list_configurations(crane_id)`) e a junção `CraneCatalogStore` (= `CraneCatalogRepository` +
  listagem) em `backend/app/application/ports/crane_catalog_listing.py`.
- Acrescentei os três métodos de listagem ao `SqlAlchemyCraneCatalogRepository` (ordem por nome e id).
- Criei o caso de uso `ManageCraneCatalog` (`backend/app/application/use_cases/crane_catalog.py`):
  criar/listar/obter fabricante, guindaste e configuração; ids UUID gerados no servidor (gerador
  injetável); `CatalogEntryNotFoundError` para registro pedido ou referenciado inexistente.
- Criei o router (`backend/app/presentation/api/catalog.py`) e os schemas estritos
  (`catalog_schemas.py`); a ficha inteira é validada pela `CraneGeometry` num `model_validator`, então
  ficha incoerente é 422 padrão do FastAPI.
- Registrei o router com o **mínimo** (ver § 5, item 6, para a mescla com a TASK-029).
- Testes: `tests/application/test_crane_catalog.py` (fake em memória), `tests/presentation/test_catalog.py`
  (`TestClient` + fake: 201/200/404/409/422, OpenAPI, composição) e
  `tests/presentation/test_catalog_integration.py` (marcador `integration`: fabricante → guindaste →
  configuração com ficha, lidos de volta pelas rotas). Fake e dados em `tests/fixtures/crane_catalog_ficticio.py`
  (FICTÍCIOS, ADR-012).

### Contrato dos endpoints

| Método e rota | Corpo | Sucesso | Erros |
|---------------|-------|---------|-------|
| `POST /api/v1/manufacturers` | `{name}` | 201 `{id, name}` | 409, 422 |
| `GET /api/v1/manufacturers` | — | 200 `[{id, name}]` por nome | — |
| `GET /api/v1/manufacturers/{manufacturer_id}` | — | 200 | 404 |
| `POST /api/v1/cranes` | `{manufacturer_id, model_name}` | 201 `{id, manufacturer_id, model_name}` | 404 (fabricante), 409, 422 |
| `GET /api/v1/cranes[?manufacturer_id=]` | — | 200 lista por `model_name` | 404 (filtro com fabricante inexistente) |
| `GET /api/v1/cranes/{crane_id}` | — | 200 | 404 |
| `POST /api/v1/cranes/{crane_id}/configurations` | `{name, geometry?}` | 201 `{id, crane_id, name, geometry\|null}` | 404 (guindaste), 409, 422 |
| `GET /api/v1/cranes/{crane_id}/configurations` | — | 200 lista por nome | 404 (guindaste) |
| `GET /api/v1/configurations/{configuration_id}` | — | 200 | 404 |

`geometry`: `boom_pivot_offset_m`, `boom_pivot_height_m`, `boom_length_min_m`, `boom_length_max_m`,
`boom_angle_min_deg`, `boom_angle_max_deg`, `cable_length_min_m` (obrigatórios) e
`cable_length_max_m`, `turret_rotation_min_deg`, `turret_rotation_max_deg` (opcionais; na resposta
vêm como `null`). 404/409 têm corpo `{"detail": "<mensagem>"}`; 422 é o `{"detail": [...]}` do FastAPI.

## 3. Arquivos modificados

```text
 .../app/application/ports/crane_catalog_listing.py |  39 ++   (novo)
 backend/app/application/use_cases/crane_catalog.py | 125 ++++++ (novo)
 .../sqlalchemy_crane_catalog_repository.py         |  32 +-   (3 métodos de listagem + docstrings)
 backend/app/main.py                                |  30 ++   (mínimo; ver § 5 item 6)
 backend/app/presentation/api/catalog.py            | 172 +++++ (novo)
 backend/app/presentation/api/catalog_schemas.py    | 207 +++++ (novo)
 backend/app/presentation/api/main.py               |   8 +-   (mínimo; ver § 5 item 6)
 backend/tests/application/test_crane_catalog.py    | 180 +++++ (novo)
 backend/tests/fixtures/crane_catalog_ficticio.py   | 101 +++++ (novo)
 backend/tests/presentation/test_catalog.py         | 423 +++++ (novo)
 .../tests/presentation/test_catalog_integration.py | 111 +++++ (novo)
 tasks/in-progress/TASK-030-cadastros-rest.md       | 108 +++++ (novo)
 handoffs/TASK-030.md                                         (novo)
```

Fora da lista de "arquivos novos" (justificativa):
- `sqlalchemy_crane_catalog_repository.py` — a porta da TASK-022 não lista; os três métodos novos
  ficam no fim da classe (antes de `_add`), sem mudar os existentes.
- `presentation/api/main.py` e `app/main.py` — registro do router, autorizado pelo pedido da leva B.

## 4. Comandos executados e resultados

| Comando (em `backend/`) | Resultado | Saída (resumo) |
|---------|-----------|----------------|
| `uv sync --locked` | ✅ | ambiente sincronizado sem mudar o lock |
| `uv run ruff check .` | ✅ | `All checks passed!` |
| `uv run ruff format --check .` | ✅ | `126 files already formatted` (após `ruff format`) |
| `uv run mypy app` | ✅ | `Success: no issues found in 74 source files` |
| `uv run lint-imports` | ✅ | `Contracts: 3 kept, 0 broken.` |
| `uv run pytest` | ✅ | `706 passed, 18 skipped` (os 3 novos de integração pulam: `DATABASE_URL não definida`) |
| `uv run pytest -m integration` com PostgreSQL | ⚠️ **NÃO EXECUTADO localmente; o CI valida** | Docker sem virtualização |
| `bash scripts/check-structure.sh` (raiz) | ✅ | `OK: 0 erros, 0 aviso(s)` |

## 5. Decisões tomadas

1. **Ids UUID gerados no servidor** (`str(uuid4())`, no caso de uso, gerador injetável). A porta aceita
   qualquer texto não vazio, então nada nela exige id do cliente; o `id` no corpo é recusado (422,
   `extra="forbid"`). Diverge da decisão 8 da TASK-022 ("ids informados por quem cadastra"), que
   era sobre a porta e continua valendo para ela.
2. **Listagem em porta à parte** (`CraneCatalogListing`) e não na `CraneCatalogRepository`: acrescentar
   métodos àquela porta quebraria (no mypy) fakes que outras tarefas da leva B possam tipar com ela.
3. **404 também para referência no corpo** (`manufacturer_id` inexistente em `POST /cranes`) e para o
   filtro `?manufacturer_id=` inexistente, como o pedido ("404 para inexistente"); a listagem filtrada
   não confunde "fabricante sem guindastes" com "fabricante que não existe".
4. **409 só para id repetido** (`CatalogEntryAlreadyExistsError`), o único conflito que o repositório
   sinaliza. Nomes repetidos são aceitos (sem regra; pendência 1).
5. **Ficha técnica validada na borda pela `CraneGeometry`** (`model_validator`): ficha incoerente vira o
   422 padrão com a mensagem do domínio. Comprimentos com `ge=0` no schema.
6. **Registro mínimo, para a mescla com a TASK-029:**
   - `presentation/api/main.py`: 1 import da porta, 1 do router, parâmetro opcional
     `catalog_repository: CraneCatalogStore | None = None` no fim de `create_app` e um
     `if catalog_repository is not None: app.include_router(create_catalog_router(catalog_repository))`.
   - `app/main.py`: função `build_catalog_repository(environ=None)` (sem `DATABASE_URL` → `None` e
     as rotas não entram; URL inválida → `DatabaseConfigurationError` na subida; cria engine sem
     conectar), um parágrafo na docstring e `catalog_repository=build_catalog_repository()` no
     `create_app`. **Na mescla:** se a TASK-029 criar o seu próprio engine/`sessionmaker` ou
     `SqlAlchemyCraneCatalogRepository`, reusar a mesma instância em `catalog_repository` e apagar a
     construção duplicada desta função.
7. **Ordem das listagens** por nome (ou `model_name`) e id: estável e útil para a seleção (RF-010);
   não há regra de ordem documentada.

## 6. Regras de negócio aplicadas

- RN-003 — a ficha vem só do cadastro por API (ADR-013 C-4 regra 1).
- RN-006 — campos em unidades internas com sufixo (`_m`, `_deg`).
- ADR-013 C-2/C-4 — faixas da ficha validadas pela `CraneGeometry` (testes de 422 em `test_catalog.py`).
- Regras **não documentadas** encontradas → § 8.

## 7. O que NÃO foi feito e por quê

- Editar e excluir cadastros: fora do escopo (e `ON DELETE RESTRICT`, sem regra de exclusão).
- Paginação, limite de tamanho de nomes, autenticação (P-009): sem regra definida.
- **Integração NÃO EXECUTADA localmente; o CI valida** (`tests/presentation/test_catalog_integration.py`).
- `docs/*.md`, `README.md` e `handoffs/current.md` não foram tocados (regra da leva B); ver § 10.

## 8. Pendências / decisões necessárias (para a pessoa responsável)

| # | Pergunta | Bloqueia? | Resposta | Respondida em |
|---|----------|-----------|----------|---------------|
| 1 | Nome de fabricante, modelo ou configuração deve ser único (repete a pendência 2 da TASK-022)? Hoje nomes repetidos são aceitos e 409 só ocorre com id repetido | não | | |
| 2 | Editar e excluir cadastros: quando e com que regra (exclusão com tabelas vinculadas é bloqueada pelo banco)? | não | | |
| 3 | Nomes devem ser normalizados (espaços nas pontas) ou ter tamanho máximo? Hoje são gravados como recebidos | não | | |
| 4 | Sem `DATABASE_URL`, a API sobe sem as rotas do catálogo. Preferem que a subida falhe? | não | | |

## 9. ⚠️ Segurança

- nada a relatar (dados FICTÍCIOS; a URL de banco nos testes é FICTÍCIA e `.invalid`).

## 10. Próximo passo

**Papel:** Revisor (outra sessão/ferramenta), depois Pessoa responsável

**O que fazer, concretamente:**
1. Conferir no CI o job de backend com PostgreSQL (`test_catalog_integration.py`).
2. Revisar `git diff e5a8945...task/TASK-030-cadastros-rest`; na mescla com a TASK-029, seguir § 5 item 6.
3. **Mudanças de documentação para a tarefa de consolidação** (não feitas aqui):
   - `docs/architecture.md`: rotas do catálogo, porta `CraneCatalogListing`/`CraneCatalogStore`, caso
     de uso `ManageCraneCatalog`.
   - `docs/development-guide.md` § 3: as rotas do catálogo só existem com `DATABASE_URL` definida.
   - `docs/known-gaps.md`: sem editar/excluir, sem unicidade de nomes, sem paginação.
   - `README.md`: listar os endpoints de cadastro.
   - `handoffs/current.md`: registrar a TASK-030 e as pendências da § 8.

**Ler primeiro (nesta ordem):**
1. `AGENTS.md`
2. este handoff
3. `backend/app/presentation/api/catalog.py` (contrato e códigos HTTP)
4. `backend/app/application/use_cases/crane_catalog.py`

**Cuidado com:**
- `app.main` é importado pelos testes; `build_catalog_repository` não pode abrir conexão na importação.

## 11. Como revisar este trabalho

- Comece por `catalog.py` e `catalog_schemas.py`.
- Tenho menos certeza sobre a decisão 3 (404 para referência no corpo; 422 também seria defensável) e
  sobre a decisão 6 (rotas ausentes sem `DATABASE_URL`).
