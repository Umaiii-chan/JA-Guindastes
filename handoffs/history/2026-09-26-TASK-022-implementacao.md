# Handoff — TASK-022 — implementação

| Campo | Valor |
|-------|-------|
| **Data/hora** | 2026-09-26 17:10 (UTC-3, Brasília) |
| **Tarefa** | `tasks/in-progress/TASK-022-persistencia-catalogo-e-tabelas.md` |
| **Etapa concluída** | implementação |
| **Papel exercido** | Planejador, Engenheiro de testes e Implementador (uma só sessão; revisão independente pendente) |
| **Ferramenta/agente** | Claude Code (Opus 5.5), agente em segundo plano num worktree isolado |
| **Branch** | `task/TASK-022-persistencia-catalogo-e-tabelas` @ ver `git log -1` (a partir de `a5b1ab0`) |
| **Duração aproximada** | 1 h 30 min |

---

## 1. Objetivo desta etapa

Persistir catálogo (fabricante, guindaste, configuração com ficha técnica) e tabelas de carga no
PostgreSQL, com a primeira migration e repositórios que implementam as portas da aplicação.

## 2. O que foi feito

- Criei as portas `CraneCatalogRepository` (com os registros `Manufacturer`, `Crane`,
  `CraneConfiguration` e os erros `CatalogEntryAlreadyExistsError`/`CatalogReferenceNotFoundError`) e
  `LoadChartRepository` (`save_draft`, `change_status`, `get_by_id`; `LoadChartSource`,
  `StoredLoadChart` e erros próprios) em `backend/app/application/ports/`, sem SQLAlchemy.
- Criei os modelos em `backend/app/infrastructure/database/models/` (`catalog.py`, `load_chart.py`).
- Criei a revisão `backend/alembic/versions/1f4cfaff16e8_criar_catalogo_e_tabelas_de_carga.py`
  (primeira; `down_revision = None`).
- Importei `app.infrastructure.database.models` em `backend/alembic/env.py` (§ 3, fora da lista).
- Criei `SqlAlchemyCraneCatalogRepository` (catálogo + `CraneGeometryProvider`) e
  `SqlAlchemyLoadChartRepository` (tabelas + `ActiveLoadChartProvider`) em
  `backend/app/infrastructure/repositories/`, com mapeamento à mão e tradução das violações do banco
  para os erros das portas pelo nome da restrição (`diag.constraint_name` do psycopg).
- Escrevi testes: sem banco (mapeamento, tradução de erros com `IntegrityError` simulado, SQL offline
  da migration subindo e descendo) e de integração (migration `upgrade head` → `downgrade base` →
  `upgrade head` + `compare_metadata` sem diferenças; ida e volta; `ACTIVE` único; `None` sem dado;
  CASCADE dos pontos e RESTRICT da configuração; ficha pela metade recusada pelo banco).

## 3. Arquivos modificados

```text
 backend/alembic/env.py                                              (+4 -2)
 backend/alembic/versions/1f4cfaff16e8_criar_catalogo_e_tabelas_de_carga.py   (novo)
 backend/app/application/ports/crane_catalog_repository.py           (novo)
 backend/app/application/ports/load_chart_repository.py              (novo)
 backend/app/infrastructure/database/models/{__init__,catalog,load_chart}.py  (novos)
 backend/app/infrastructure/repositories/{_integrity,sqlalchemy_crane_catalog_repository,sqlalchemy_load_chart_repository}.py (novos)
 backend/tests/infrastructure/database/{postgres_integration_support,test_catalog_load_chart_migration}.py (novos)
 backend/tests/infrastructure/repositories/{__init__,catalog_ficticio,test_repository_mapping,test_repositories_integration}.py (novos)
 handoffs/TASK-022.md, tasks/in-progress/TASK-022-persistencia-catalogo-e-tabelas.md (novos)
```

Fora do escopo (justificar cada um):
- `backend/alembic/env.py` — uma linha de import dos modelos (e a docstring). Sem ela, um
  `alembic revision --autogenerate` futuro compararia o banco com uma `Base.metadata` vazia e
  proporia **apagar todas as tabelas**. O próprio `env.py` já dizia que os modelos precisam estar
  importados. Preferi isto a mexer em `base.py` (importar os modelos de dentro da `Base` criaria
  import circular). `base.py` não foi alterado.

## 4. Comandos executados e resultados

| Comando (em `backend/`) | Resultado | Saída (resumo) |
|---------|-----------|----------------|
| `uv sync --locked` | ✅ | `Checked 46 packages` |
| `uv run ruff check .` | ✅ | `All checks passed!` |
| `uv run ruff format --check .` | ✅ | `99 files already formatted` |
| `uv run mypy app` | ✅ | `Success: no issues found in 58 source files` |
| `uv run lint-imports` | ✅ | `Contracts: 3 kept, 0 broken.` |
| `uv run pytest` | ✅ | `452 passed, 15 skipped` (os 15 são de integração: `DATABASE_URL não definida`) |
| `uv run pytest -m integration` com PostgreSQL | ⚠️ **NÃO EXECUTADO localmente; validado no CI** | Docker sem virtualização |
| `alembic upgrade head` / `downgrade base` conectados | ⚠️ **NÃO EXECUTADO localmente; validado no CI** | idem |
| `uv run alembic upgrade head --sql` (URL FICTÍCIA) | ✅ | SQL abaixo |
| `bash scripts/check-structure.sh` (raiz) | ✅ | `OK: 0 erros, 1 aviso(s)` (aviso: 3 tarefas em in-progress) |

SQL gerado (resumido; `DATABASE_URL=postgresql+psycopg://usuario_ficticio:senha_ficticia@host-ficticio.invalid:5432/banco`):

```text
CREATE TABLE manufacturers (id VARCHAR NOT NULL, name VARCHAR NOT NULL, CONSTRAINT pk_manufacturers PRIMARY KEY (id));
CREATE TABLE cranes (... CONSTRAINT fk_cranes_manufacturer_id_manufacturers FOREIGN KEY(manufacturer_id) REFERENCES manufacturers (id) ON DELETE RESTRICT);
CREATE INDEX ix_cranes_manufacturer_id ON cranes (manufacturer_id);
CREATE TABLE crane_configurations (id, crane_id, name, boom_pivot_offset_m ... turret_rotation_max_deg DOUBLE PRECISION,
    CONSTRAINT ck_crane_configurations_geometry_required_all_or_none CHECK (num_nulls(<7 obrigatórios>) IN (0, 7)),
    CONSTRAINT ck_crane_configurations_geometry_optional_needs_required CHECK (...),
    CONSTRAINT ck_crane_configurations_turret_rotation_limits_together CHECK (num_nulls(turret_rotation_min_deg, turret_rotation_max_deg) IN (0, 2)),
    CONSTRAINT ck_..._non_negative CHECK (<comprimento> >= 0) (x5),
    CONSTRAINT fk_crane_configurations_crane_id_cranes FOREIGN KEY(crane_id) REFERENCES cranes (id) ON DELETE RESTRICT);
CREATE INDEX ix_crane_configurations_crane_id ON crane_configurations (crane_id);
CREATE TABLE load_charts (id, configuration_id, version, status VARCHAR(16), source_file_name, source_file_type, source_sha256 VARCHAR(64), source_uri (NULL),
    CONSTRAINT ck_load_charts_source_sha256_hex CHECK (source_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_load_charts_status_valid CHECK (status IN ('DRAFT', 'VALIDATED', 'ACTIVE', 'SUPERSEDED', 'INVALID')),
    CONSTRAINT fk_load_charts_configuration_id_crane_configurations FOREIGN KEY(configuration_id) REFERENCES crane_configurations (id) ON DELETE RESTRICT,
    CONSTRAINT uq_load_charts_configuration_id_version UNIQUE (configuration_id, version));
CREATE UNIQUE INDEX uq_load_charts_one_active_per_configuration ON load_charts (configuration_id) WHERE status = 'ACTIVE';
CREATE TABLE load_chart_points (load_chart_id, position INTEGER, boom_length_m, working_radius_m, max_capacity_kg DOUBLE PRECISION,
    CONSTRAINT pk_load_chart_points PRIMARY KEY (load_chart_id, position), CHECKs >= 0 (x4),
    CONSTRAINT fk_load_chart_points_load_chart_id_load_charts FOREIGN KEY(load_chart_id) REFERENCES load_charts (id) ON DELETE CASCADE);
INSERT INTO alembic_version (version_num) VALUES ('1f4cfaff16e8');
```

## 5. Decisões tomadas

1. **`ACTIVE` único por índice único parcial** (`WHERE status = 'ACTIVE'`), e não só regra no
   repositório: a checagem no repositório (ler e depois gravar) tem corrida entre duas transações; o
   índice garante no banco e ainda serve à busca da tabela ativa. O repositório traduz a violação
   para `ActiveLoadChartConflictError`.
2. **Ativar não rebaixa a anterior sozinho** e `change_status` não valida transições: as transições
   da doc-fonte § 13.2 não estão definidas (pendência 1).
3. **Ficha técnica em `crane_configurations`**, colunas anuláveis com CHECKs de "tudo ou nada" (como
   pedido; ADR-013 G-2 ainda aberto). As faixas (mín ≤ máx, θ em (−90°, 90°]) ficam na `CraneGeometry`,
   que revalida ao ler: valor incoerente gravado por fora levanta erro, não vira ficha inválida.
4. **`ON DELETE`**: `RESTRICT` em fabricante→guindaste→configuração→tabela (tabelas precisam continuar
   rastreáveis, RNF-005/RN-005); `CASCADE` tabela→pontos (os pontos são parte da tabela).
5. **Pontos com PK `(load_chart_id, position)`**: a `LoadChart` aceita pontos repetidos com a mesma
   capacidade e os mantém na ordem; por isso não há unicidade em (comprimento, raio).
6. **`DOUBLE PRECISION`** para números: o `float` volta idêntico (a consulta por ponto usa igualdade
   exata, PEND-002); `NUMERIC` devolveria `Decimal`. Teste de ida e volta usa `0.1 + 0.2`.
7. **Status como `VARCHAR(16)` + CHECK**, não `ENUM` nativo: acrescentar um status depois é um
   `ALTER` de CHECK, sem `ALTER TYPE`. A migration escreve os valores por extenso (não importa o domínio).
8. **Ids de texto informados por quem cadastra** (como os da `LoadChart` e da importação), `VARCHAR`
   sem limite de tamanho (não há regra de tamanho).
9. **Registros do catálogo na porta** (`application/ports/crane_catalog_repository.py`): o domínio não
   tem essas entidades e `domain/` é da TASK-028. Quando o domínio as tiver, a porta passa a usá-las.
10. **Uma transação por chamada** de repositório (recebem `sessionmaker`): não há porta de unidade de
    trabalho; gravar catálogo e tabela numa só transação exigiria uma (pendência 5).
11. **Migration sem banco vivo**: renderizei os `ops` do autogenerate (`CreateTableOp.from_table`,
    `render_python_code`) a partir de `Base.metadata` contra esquema vazio, que é o que o
    `--autogenerate` produziria num banco vazio, e revisei à mão (comentários, valores literais). O
    teste de integração confere a sincronia com `compare_metadata`.
12. **Teste de descida protegido**: só roda `downgrade base` se as 5 tabelas estiverem vazias (senão
    pula, ou falha com `REQUIRE_INTEGRATION_DB=1`), para não apagar um banco local com dados; sempre
    volta a `head` no `finally`. Os testes de repositório rodam dentro de transação desfeita no fim
    (`join_transaction_mode="create_savepoint"`), sem sujar o banco do CI.

## 6. Regras de negócio aplicadas

- RN-001 — `load_charts.configuration_id` obrigatório com FK para a configuração.
- RN-003 — a ficha técnica vem do cadastro, nunca do GLB (colunas próprias da configuração).
- RN-005 — versão obrigatória e única por configuração.
- RN-006 — colunas em unidades internas, com a unidade no nome (`_m`, `_deg`, `_kg`).
- RF-008/RNF-005 — nome, tipo e SHA-256 do arquivo-fonte obrigatórios; URI opcional.
- Regras **não documentadas** encontradas → § 8.

## 7. O que NÃO foi feito e por quê

- **Testes de integração e `alembic upgrade/downgrade` conectados: NÃO EXECUTADOS localmente;
  validados no CI** (Docker sem virtualização). Não os vi passar: se o CI falhar, o suspeito mais
  provável é o `compare_metadata` apontar alguma diferença de reflexão (índice parcial ou tipo).
- Armazenamento do arquivo-fonte (`infrastructure/storage/`), endpoints e casos de uso de cadastro e
  ativação: fora do escopo.
- `docs/*.md`, `README.md` e `handoffs/current.md` não foram tocados (regra da leva A); ver § 10.

## 8. Pendências / decisões necessárias (para a pessoa responsável)

| # | Pergunta | Bloqueia? | Resposta | Respondida em |
|---|----------|-----------|----------|---------------|
| 1 | Quais transições de status são permitidas (doc-fonte § 13.2)? Ativar uma tabela deve marcar a `ACTIVE` anterior como `SUPERSEDED` automaticamente? Hoje não valida e recusa a segunda `ACTIVE` | não | | |
| 2 | Nome de fabricante, modelo de guindaste ou nome de configuração devem ser únicos? Hoje não há unicidade além do id | não | | |
| 3 | Guardar de qual documento/revisão veio cada valor da ficha técnica (ADR-013 C-4, regra 1, "proposta")? Não criei colunas para isso | não | | |
| 4 | Tabelas `INVALID` devem ser gravadas (com o relatório)? Hoje só se grava `DRAFT`; o relatório de inconsistências não é persistido | não | | |
| 5 | Criar uma porta de unidade de trabalho quando um caso de uso precisar gravar em mais de um repositório na mesma transação | não | | |
| 6 | Onde o arquivo-fonte será guardado (doc-fonte § 19.2)? Até lá `source_uri` é opcional | não | | |

## 9. ⚠️ Segurança

- nada a relatar (URLs e dados de teste são FICTÍCIOS; nenhuma credencial gravada).

## 10. Próximo passo

**Papel:** Revisor (outra sessão/ferramenta), depois Pessoa responsável

**O que fazer, concretamente:**
1. Conferir no CI o job de backend (migration + `pytest` com `REQUIRE_INTEGRATION_DB=1`).
2. Revisar o diff `git diff a5b1ab0...task/TASK-022-persistencia-catalogo-e-tabelas`.
3. **Mudanças de documentação para a tarefa final de consolidação** (não feitas aqui):
   - `docs/architecture.md` § 5: trocar "Nenhuma tabela existe ainda" pelas 5 tabelas criadas; campos-chave
     de `manufacturers` (id, name), `cranes` (id, manufacturer_id, model_name), `crane_configurations`
     (id, crane_id, name + ficha do ADR-013 C-4), `load_charts` (id, configuration_id, version, status,
     source_file_name/type/sha256/uri) e `load_chart_points` (load_chart_id, position, boom_length_m,
     working_radius_m, max_capacity_kg); `ACTIVE` único por índice parcial; `ON DELETE` (§ 5.4).
   - `docs/development-guide.md` § 3: tirar "ainda não há nenhuma revisão" da linha de migrations; na
     linha dos testes de integração, dizer que precisam do banco em `head` e que o teste de migration
     só desce com as tabelas vazias; § 4: `database/models/` e `repositories/` existem.
   - `docs/testing-strategy.md`: padrão de transação desfeita (`create_savepoint`) para testes de
     repositório.
   - `docs/known-gaps.md`: transições de status não definidas; arquivo-fonte ainda não armazenado.
   - `handoffs/current.md`: registrar a TASK-022 e as pendências da § 8.

**Ler primeiro (nesta ordem):**
1. `AGENTS.md`
2. este handoff
3. `tasks/in-progress/TASK-022-persistencia-catalogo-e-tabelas.md` § 3
4. `backend/app/infrastructure/database/models/load_chart.py` (restrições)
5. `backend/app/infrastructure/repositories/sqlalchemy_load_chart_repository.py`

**Cuidado com:**
- Qualquer modelo novo precisa ser importado em `app/infrastructure/database/models/__init__.py`, ou o
  autogenerate proporá apagar a tabela.
- A tradução de erros depende dos nomes das restrições (convenção da `Base`): renomear uma restrição
  exige ajustar as constantes nos repositórios.

## 11. Como revisar este trabalho

- Comece pela migration e compare com `models/`; depois os repositórios.
- Tenho menos certeza sobre o `compare_metadata` sair vazio (não rodou contra banco) e sobre o padrão de
  savepoint com `IntegrityError` dentro do `commit` (documentado no SQLAlchemy 2, não visto rodando aqui).
- Os testes sem banco cobrem mapeamento e tradução de erros; o comportamento real das restrições só é
  coberto pelos de integração.
