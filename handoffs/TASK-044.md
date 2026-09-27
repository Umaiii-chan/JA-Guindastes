# Handoff — TASK-044 — implementação (backend)

| Campo | Valor |
|-------|-------|
| **Data/hora** | 2026-09-26 (UTC-3, Brasília) |
| **Tarefa** | `tasks/in-progress/TASK-044-rotas-listagem-e-edicao.md` |
| **Etapa concluída** | implementação — parte de backend (CA-1, CA-2, CA-3 e o backend do CA-7) |
| **Papel exercido** | Planejador, Engenheiro de testes e Implementador (mesma sessão) |
| **Ferramenta/agente** | Claude Code (Opus 5.5), agente em worktree isolada, disparado pela sessão principal |
| **Branch** | `task/TASK-044-rotas-backend` @ commit deste handoff (base `2e7313b`) |
| **Duração aproximada** | 1 h 30 min |

> O frontend (CA-4, CA-5, CA-6) foi feito em paralelo, em outra sessão, contra o contrato da
> tarefa. As notas dele vão para a sessão principal, que as junta neste arquivo (seção "Frontend").

---

## 1. Objetivo desta etapa

Criar no backend a rota que lista as tabelas de carga de uma configuração, com a ativa, e as rotas
`PATCH` de edição de fabricante, guindaste e configuração, com o contrato snake_case da tarefa.

## 2. O que foi feito (backend)

- **Edição do catálogo (CA-2)**:
  - porta nova `CraneCatalogEditing` (`update_manufacturer`, `update_crane`,
    `update_configuration`; devolvem `False` se o id não existe). O `CraneCatalogStore` passou a
    juntar gravação, listagem e edição;
  - `ManageCraneCatalog` ganhou `rename_manufacturer`, `rename_crane` e `update_configuration`
    (nome e/ou ficha inteira; `None` mantém o atual; nenhum dos dois → `ValueError`);
  - `SqlAlchemyCraneCatalogRepository` implementa a porta: `SELECT … FOR UPDATE` e um único
    `UPDATE` por chamada. A ficha é gravada coluna a coluna, inclusive as opcionais, então substituir
    a ficha não deixa sobrar limite de giro ou cabo máximo da anterior;
  - schemas `ManufacturerUpdateRequest`, `CraneUpdateRequest` e `ConfigurationUpdateRequest`
    (estritos, `extra="forbid"`, mesma validação da criação);
  - rotas `PATCH` no router do catálogo, com `write_dependencies` (perfil `ADMIN`); o CSRF vem do
    middleware da TASK-038.
- **Listagem das tabelas de uma configuração (CA-1)**:
  - porta nova `LoadChartListing.list_by_configuration` → `LoadChartSummary` (cabeçalho, contagem de
    pontos e origem, sem pontos);
  - caso de uso `ListConfigurationLoadCharts` (verifica a configuração no catálogo, ordena e acha a
    `ACTIVE`);
  - `SqlAlchemyLoadChartRepository.list_by_configuration`: só as colunas do cabeçalho mais
    `COUNT` dos pontos (`LEFT JOIN` + `GROUP BY load_charts.id`), sem carregar os pontos;
  - router novo `configuration_load_charts.py`; schemas `LoadChartSummaryResponse` e
    `ConfigurationLoadChartsResponse`;
  - `create_app(load_chart_listing=...)`: a rota entra com o catálogo e a listagem. Em `app.main`,
    com `DATABASE_URL`, **sem depender de `FILE_STORAGE_DIR`** (diferente de `GET /load-charts/{id}`).
- **Testes (CA-3)**: unitários com fakes, API com `TestClient` (perfil, CSRF, 404/422), composição, e
  integração com PostgreSQL (marcador `integration`).
- `docs/architecture.md`: portas, casos de uso, repositórios e uma **lista de rotas REST** nova no § 4.

## 3. Arquivos modificados

```text
backend/app/application/ports/crane_catalog_editing.py            (novo)
backend/app/application/ports/crane_catalog_listing.py
backend/app/application/ports/load_chart_listing.py               (novo)
backend/app/application/use_cases/crane_catalog.py
backend/app/application/use_cases/list_configuration_load_charts.py (novo)
backend/app/infrastructure/repositories/sqlalchemy_crane_catalog_repository.py
backend/app/infrastructure/repositories/sqlalchemy_load_chart_repository.py
backend/app/main.py
backend/app/presentation/api/catalog.py
backend/app/presentation/api/catalog_schemas.py
backend/app/presentation/api/configuration_load_charts.py         (novo)
backend/app/presentation/api/load_chart_persistence_schemas.py
backend/app/presentation/api/main.py
backend/tests/application/test_crane_catalog.py
backend/tests/application/test_list_configuration_load_charts.py  (novo)
backend/tests/fixtures/crane_catalog_ficticio.py
backend/tests/fixtures/load_chart_persistence_fakes.py
backend/tests/infrastructure/repositories/test_catalog_editing_and_listing_integration.py (novo)
backend/tests/presentation/test_catalog.py
backend/tests/presentation/test_catalog_integration.py
backend/tests/presentation/test_configuration_load_charts.py      (novo)
backend/tests/presentation/test_route_authorization.py
backend/tests/test_composition.py
docs/architecture.md
handoffs/TASK-044.md                                              (novo)
```

Nenhuma migration nova. Nada em `frontend/**`, `handoffs/current.md` ou ADRs.

## 4. Comandos executados e resultados

Em `backend/`:

| Comando | Resultado | Saída (resumo) |
|---------|-----------|----------------|
| `uv run ruff check .` | ✅ | `All checks passed!` |
| `uv run ruff format --check .` | ✅ | `196 files already formatted` |
| `uv run mypy app` | ✅ | `Success: no issues found in 111 source files` |
| `uv run lint-imports` | ✅ | `Contracts: 3 kept, 0 broken.` |
| `uv run pytest` | ✅ | `1096 passed, 65 skipped` (com `-o addopts=""` para ver o resumo) |
| testes `integration` (PostgreSQL) | ⚠️ NÃO EXECUTADO | sem PostgreSQL local: pulados (estão entre os 65); rodam no CI |

Na raiz:

| Comando | Resultado | Saída (resumo) |
|---------|-----------|----------------|
| `bash scripts/check-structure.sh` | ✅ | `OK: 0 erros, 0 aviso(s)` |

Conferi o SQL da listagem compilando a consulta com o dialeto do PostgreSQL:
`SELECT load_charts.id, …, count(load_chart_points.position) AS point_count FROM load_charts LEFT
OUTER JOIN load_chart_points ON … WHERE load_charts.configuration_id = … GROUP BY load_charts.id`.

## 5. Decisões tomadas

- **Ordem da listagem, sem migration**: `load_charts` não tem coluna de criação, e o CA-3 pede para
  não criar migration salvo se indispensável. Não é indispensável, porque o CA-1 aceita "senão,
  documente o critério". Critério:
  - versão da maior para a menor, em **ordem natural**: trechos de dígitos comparados como números,
    texto sem diferenciar maiúsculas, espaços das pontas ignorados (`v10` > `v9` > `v2.1` > `v2`);
  - na mesma chave de versão, `chart_id` decrescente.
  - A ordem **não é a da importação**. Se a pessoa responsável quiser a ordem real de importação, é
    preciso uma coluna `created_at` (migration nova); ver § 8.
- **A ordem fica no caso de uso**, não no SQL, para fakes e banco se comportarem igual.
- **Sem 409 na edição**: não há regra de unicidade de nomes (pendência 2 da TASK-022), então editar
  nunca conflita. A rota não documenta 409.
- **`PATCH /configurations/{id}`**: campo ausente mantém o valor atual; `{}` e `null` explícito
  (`name` ou `geometry`) → 422. `crane_id` e `manufacturer_id` no corpo → 422 (`extra="forbid"`):
  o vínculo com o pai não muda.
- **O corpo é validado antes de procurar o registro**: corpo inválido num id inexistente → 422
  (comportamento padrão do FastAPI).
- **Porta de edição separada** (`CraneCatalogEditing`), como a de listagem da TASK-030, e
  **`LoadChartListing` separada** da `LoadChartRepository`, para não obrigar outros adapters e fakes.
- **Listagem registrada sem `FILE_STORAGE_DIR`**: ela só lê o banco. `GET /load-charts/{id}` e a
  importação continuam exigindo `FILE_STORAGE_DIR`.
- **Ficha nova vale para as próximas avaliações**: o `CraneGeometryProvider` já lê o cadastro a cada
  avaliação (REST por requisição; WebSocket por mensagem). As tabelas não são tocadas (teste de
  integração confere).

## 6. Regras de negócio aplicadas

- ADR-016: leitura para qualquer perfil autenticado; `PATCH` só `ADMIN` e com o cabeçalho CSRF.
- ADR-009 / RN-001: tabelas no banco, de uma configuração; no máximo uma `ACTIVE` (índice do banco).
- RN-003 / ADR-013 C-4: a ficha vem só do cadastro e é validada pela `CraneGeometry` também na edição.
- ADR-004: portas e casos de uso na aplicação, repositórios SQLAlchemy, rotas finas; import-linter ok.

## 7. O que NÃO foi feito e por quê

- Excluir cadastros ou tabelas, histórico e auditoria: fora do escopo.
- Coluna `created_at` e ordem real de importação: sem migration (CA-3); ver § 5 e § 8.
- Testes de integração **NÃO EXECUTADOS** localmente (sem PostgreSQL); escritos com o marcador
  `integration` e rodam no CI.
- Frontend (CA-4 a CA-6): outra sessão.

## 8. Pendências / decisões necessárias (para a pessoa responsável)

| # | Pergunta | Bloqueia? | Resposta | Respondida em |
|---|----------|-----------|----------|---------------|
| 1 | A linha do tempo pode ficar na ordem natural da versão, ou precisa da ordem real de importação (exige coluna `created_at` e migration)? | não | | |

## 9. ⚠️ Segurança

Nada novo além do ADR-016: `PATCH` passa pelo middleware de CSRF e pela guarda de `ADMIN`. Nenhum
segredo ou dado real; todos os dados de teste são FICTÍCIOS.

## 10. Contrato final (para o frontend)

Todas as rotas em `/api/v1`, JSON em snake_case. Com banco: sem sessão → `401
{"detail", "code": "NOT_AUTHENTICATED"}`.

### `GET /configurations/{configuration_id}/load-charts` (qualquer perfil)

```text
200 {
  "items": [
    { "chart_id": str, "version": str, "configuration_id": str,
      "status": "DRAFT" | "VALIDATED" | "ACTIVE" | "SUPERSEDED" | "INVALID",
      "point_count": int,
      "source": { "file_name": str, "file_type": str, "sha256": str, "uri": str | null } }
  ],
  "active_chart_id": str | null
}
404 { "detail": "configuração com id '<id>' não existe" }
```

- Cada item é o corpo de `GET /load-charts/{chart_id}` **sem** `points`, com as mesmas chaves.
- Configuração sem tabelas → `200 {"items": [], "active_chart_id": null}`.
- **Ordem**: versão decrescente em ordem natural (`v10`, `v9`, `v2.1`, `v2`, `v1`), depois
  `chart_id` decrescente. **Não é a ordem de importação** (não há data gravada). A tela não deve
  reordenar supondo data.
- `active_chart_id` é o `chart_id` do item com `status: "ACTIVE"` (no máximo um).

### `PATCH /manufacturers/{id}` `{"name": str}` → `200 ManufacturerResponse` `{id, name}`

### `PATCH /cranes/{id}` `{"model_name": str}` → `200 CraneResponse` `{id, manufacturer_id, model_name}`

### `PATCH /configurations/{id}` `{"name"?: str, "geometry"?: CraneGeometryPayload}` → `200 ConfigurationResponse` `{id, crane_id, name, geometry}`

- Pelo menos um campo; ausente mantém o atual; `null` explícito é recusado.
- `geometry` substitui a ficha **inteira**: opcional omitido (`cable_length_max_m`,
  `turret_rotation_*`) volta `null`, não herda o valor antigo. Mande a ficha completa.
- Vale para as próximas avaliações; as tabelas de carga não mudam.

### Erros das três `PATCH`

| Status | Quando | Corpo |
|--------|--------|-------|
| 403 `CSRF_HEADER_MISSING` | sem `X-Requested-With: crane-simulator` (vem antes de tudo) | `{"detail", "code"}` |
| 401 `NOT_AUTHENTICATED` | sem sessão | `{"detail", "code"}` |
| 403 `FORBIDDEN` | perfil não é `ADMIN` | `{"detail": "esta ação exige o perfil ADMIN", "code": "FORBIDDEN"}` |
| 422 | corpo inválido: nome vazio/só espaços/não texto, `{}`, `null`, campo desconhecido (inclusive `id`, `crane_id`, `manufacturer_id`), ficha incoerente | `{"detail": [ {loc, msg, type, …} ] }` (padrão FastAPI) |
| 404 | registro não existe (só depois de o corpo ser válido) | `{"detail": "<entidade> com id '<id>' não existe"}` (sem `code`) |

**409 nunca acontece** na edição (nomes não são únicos). O 422 de `{}` na configuração tem a
mensagem "informe ao menos um campo: name ou geometry"; o de `null`, "<campo> não pode ser null".

## 11. Próximo passo

Sessão principal: juntar as notas do frontend neste handoff e integrar as branches. Depois, revisor
(outra sessão/ferramenta): `git diff 2e7313b...task/TASK-044-rotas-backend` com
`docs/templates/code-review-template.md`. Conferir no CI os testes `integration`.

Ler primeiro: este handoff, `backend/app/presentation/api/configuration_load_charts.py`,
`backend/app/application/use_cases/list_configuration_load_charts.py` e as `PATCH` em
`backend/app/presentation/api/catalog.py`.

## 12. Como revisar este trabalho

- Commits pequenos: edição do catálogo, listagem, testes de autorização/integração, documentação.
- Pontos de atenção: a ordem da listagem (§ 5), a substituição da ficha inteira no repositório
  (`write_geometry_columns`) e a composição sem `FILE_STORAGE_DIR` para a listagem.

## Frontend

> Notas da sessão de frontend (CA-4, CA-5, CA-6), repassadas pela sessão principal e resumidas aqui
> na TASK-045. Os resultados dos gates são os que a sessão de frontend informou: esta
> sessão não os executou de novo.

### F.1 O que foi feito

**Clientes REST e aplicação**
- `listConfigurationCharts` (`GET /configurations/{id}/load-charts`): o 404 vira o código
  `CONFIGURATION_NOT_FOUND`.
- `updateManufacturer`, `updateCrane` e `updateConfiguration` (`PATCH`). A ficha técnica vai sempre
  inteira, com os opcionais em `null`, porque o backend substitui a ficha toda (§ 10).
- `CatalogBrowser` ganhou os três métodos de edição. Cada um relê o nível editado e mantém a seleção.

**Página Tabelas (CA-4)**
- Saíram o `knownChartsStorage` (`localStorage`) e o campo "Acompanhar pelo id".
- A linha do tempo vem da rota nova e é relida depois de importar ou ativar.
- A versão ativa vem de `active_chart_id`.
- A ordem é a do backend, com o subtítulo "Da maior versão para a menor".

**Página Catálogo (CA-5)**
- O detalhe da configuração mostra a tabela ativa pela rota nova.
- "Editar" grava com `PATCH`: o botão diz "Salvar alterações", e com "Nada mudou" o backend não é
  chamado.
- Trocar a ficha de uma configuração abre o Dialog de confirmação quando há tabela ativa ou quando a
  lista ainda está carregando.
- Erros: 422 aparece nos campos; 404 mostra um toast, fecha o Drawer e relê; não há tratamento de
  409 (o backend não o devolve).

**E2E (CA-6)**
- `loadChartImport.spec.ts`: o bloco com backend passou a fazer login e mandar o cabeçalho CSRF, e
  confere a linha do tempo pela rota nova.
- `catalogEdit.spec.ts` (novo, só com backend): renomeia a configuração e troca a ficha com
  confirmação, sem criar item novo; renomeia o fabricante.
- `backendCatalog.ts` (helper novo): cria pela API um fabricante, um guindaste e uma configuração
  FICTÍCIOS, com nomes novos a cada execução.

### F.2 Decisões

- **Pontos por demanda:** a matriz de cada versão é baixada só quando pedida, com cache por página.
  O status vem sempre da listagem.
- **Ordem:** o frontend não reordena a listagem (P-020 em `docs/known-gaps.md`).
- **Sem voltar para "sem ficha":** numa configuração que já tem ficha, a edição esconde a opção "sem
  ficha", porque o `PATCH` não aceita `geometry: null`.
- **Dialog no lugar do Drawer:** enquanto o Dialog de confirmação está aberto, ele substitui o Drawer.

### F.3 Gates do frontend (informados pela sessão de frontend)

| Comando | Resultado |
|---------|-----------|
| `npm test` | ✅ 582 passaram, 1 pulado |
| `npm run e2e` (sem backend) | ✅ 9 passaram, 9 pulados (os que exigem `E2E_BACKEND=1`) |

### F.4 Pendências

- Os specs com backend (`catalogEdit.spec.ts` e o bloco "com backend" de `loadChartImport.spec.ts`)
  **não foram executados** localmente: só rodam no job `e2e` do CI.
