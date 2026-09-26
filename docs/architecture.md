# Arquitetura

> **Status deste documento:** descreve a arquitetura **como ela está** em `development` @ `d58edf6`
> (2026-09-26, TASK-001..032 concluídas; consolidado na TASK-037). Implementado: backend em Clean
> Architecture com PostgreSQL, API REST e WebSocket de avaliação, cadastros, importação com gravação e
> ativação de tabelas; frontend com cena 3D, loader GLB/glTF e painel ligado ao backend; Docker Compose
> e CI. Ainda **não** existem: simulações persistidas, `SafetyValidator`/níveis de alerta, upload de
> modelo 3D, autenticação. Onde a implementação difere do planejado na documentação técnica v0.1
> ([`produto/documentacao-tecnica-v0.1.md`](produto/documentacao-tecnica-v0.1.md), citada como
> "doc-fonte § N"), o texto diz. Mudanças de arquitetura passam por ADR em [`decisions/`](decisions/README.md).

| Campo | Valor |
|-------|-------|
| Última revisão | 2026-09-26 (TASK-037) |
| ADRs que afetam este documento | ADR-002, ADR-003; ADR-004..011 (decisões da doc-fonte § 7); ADR-012 (toolchain); ADR-013 (geometria, provisório); ADR-014 (ORM, proposto); ADR-015 (consulta conservadora, provisório) |

---

## 1. Visão geral

Aplicação web 3D em monorepo (doc-fonte § 1 e § 7; ADR-011):
- **frontend** em React + TypeScript + Three.js: visualização, interação e estado gráfico; calcula a
  geometria só como **pré-visualização** (o backend é a fonte de verdade, RN-008, ADR-013 C-7);
- **backend** em FastAPI + Python, em Clean Architecture: domínio, importação/validação das tabelas
  de carga, geometria operacional, consulta de capacidade, cadastros e persistência;
- **PostgreSQL** para o catálogo (fabricantes, guindastes, configurações com a ficha técnica) e as
  tabelas de carga normalizadas;
- **storage local de arquivos** para o arquivo-fonte das tabelas importadas (`FILE_STORAGE_DIR`).

REST para saúde, cadastros, importação e avaliação avulsa; WebSocket para o ciclo interativo de
avaliação (ADR-010). O frontend usa o WebSocket de preferência e cai para o REST enquanto ele não
está aberto (TASK-032).

### Diagramas

Diagramas originais em Graphviz, versionados em [`produto/diagrams/`](produto/diagrams/). Mostram a
arquitetura **planejada** da doc-fonte (com simulações, `SafetyValidator` e storage de modelos 3D,
que ainda não existem):

- contexto: [`01_contexto_sistema.png`](produto/diagrams/01_contexto_sistema.png)
- containers: [`02_arquitetura_containers.png`](produto/diagrams/02_arquitetura_containers.png)
- dependências da Clean Architecture: [`03_clean_architecture.png`](produto/diagrams/03_clean_architecture.png)
- deployment: [`08_deployment.png`](produto/diagrams/08_deployment.png)

---

## 2. Componentes

### Backend (`backend/app/`)

| Componente | Responsabilidade | Localização no código | Depende de |
|------------|------------------|-----------------------|------------|
| Domínio — tabela de carga | `LoadChart`, `LoadChartPoint`, quantidades com unidade (`Length`, `Mass`, `Angle`), `CapacityQuery`/`CapacityResult` | `domain/entities/`, `domain/value_objects/` | nada |
| Domínio — geometria (ADR-013) | `CraneGeometry` (ficha técnica), `OperationalState`, `OperationalGeometry`; `calculate_operational_geometry` (raio, posições do pino, ponta e gancho) | `domain/value_objects/`, `domain/services/geometry_service.py` | nada |
| Domínio — consulta de capacidade | porta `LoadChartInterpolator`; estratégias `ExactPointLookup` (ponto exato) e `ConservativeTabulatedLookup` (ADR-015, provisória, **a usada na composição**); `utilization.py` | `domain/services/` | nada |
| Domínio — carga | `Load`, `LoadDimensions`, `LoadCenterOfGravity`, `weight_compared_with_capacity` (ponto único onde a PEND-006 entrará) | `domain/entities/load.py`, `domain/services/compared_load_weight.py` | nada |
| Aplicação — portas | `CraneGeometryProvider`, `ActiveLoadChartProvider`, `CraneCatalogRepository`, `CraneCatalogListing`/`CraneCatalogStore`, `LoadChartRepository`, `LoadChartActivationRepository`, `LoadChartParser`, `FileStoragePort`, `LoadChartFileLimitExceededError` | `application/ports/` | domínio |
| Aplicação — casos de uso | `EvaluateOperation` (`execute`, `execute_for_load`), `ManageCraneCatalog`, `ValidateLoadChartImport`, `ImportLoadChart`, `ActivateLoadChart` | `application/use_cases/` | domínio, portas |
| Infraestrutura — banco | `DatabaseSettings` (`DATABASE_URL`), engine, fábrica de sessões, `Base` e modelos SQLAlchemy | `infrastructure/database/` | aplicação, domínio |
| Infraestrutura — repositórios | `SqlAlchemyCraneCatalogRepository` (catálogo + `CraneGeometryProvider`), `SqlAlchemyLoadChartRepository` (tabelas + `ActiveLoadChartProvider`), `SqlAlchemyLoadChartActivationRepository` (troca atômica da `ACTIVE`) | `infrastructure/repositories/` | aplicação, domínio |
| Infraestrutura — storage | `LocalFileStorage`: grava em `<FILE_STORAGE_DIR>/<sha256>`, URI `local://<sha256>`, nunca sobrescreve | `infrastructure/storage/` | aplicação |
| Infraestrutura — importadores | `CsvLoadChartParser`, `XlsxLoadChartParser` (primeira planilha), `select_load_chart_parser`, limites do XLSX (`xlsx_resource_limits.py`, provisórios, P-008) | `infrastructure/importers/` | aplicação, domínio |
| Apresentação — REST | `create_app` e os routers: saúde, avaliação, validação de tabela, catálogo, importação/consulta/ativação; schemas Pydantic; limite de upload (`upload_limits.py`); handler do 422 para números não finitos | `presentation/api/` | aplicação |
| Apresentação — WebSocket | `/api/v1/ws/evaluation`: mensagens `simulation.state.changed` → `simulation.evaluated` / `simulation.error`, limite de 8 KiB por mensagem (provisório, P-008) | `presentation/websocket/` | aplicação |
| Raiz de composição | escolhe a composição por `DATABASE_URL` (`compose_app`) e liga os adapters da infraestrutura à apresentação; a importação com gravação é montada em módulo à parte | `app/main.py`, `app/load_chart_persistence_composition.py` | todas as camadas |

Composição (`backend/app/main.py`):

- **com `DATABASE_URL`**: repositórios SQLAlchemy; REST com uma conexão do pool por requisição;
  WebSocket com sessões abertas e fechadas a cada mensagem; saúde com `SELECT 1`; rotas de catálogo;
  rotas de importação com gravação só se `FILE_STORAGE_DIR` também estiver definida.
- **sem `DATABASE_URL`**: provedores "não configurados" (sempre `None`): a avaliação responde
  `NOT_EVALUABLE` sem inventar dados, a saúde mostra `NOT_CONFIGURED`, um aviso vai para o log, e as
  rotas de catálogo e de tabelas gravadas não são registradas.
- `DATABASE_URL` **inválida**: a aplicação não sobe (`DatabaseConfigurationError`, sem repetir a URL).
- REST e WebSocket usam a mesma montagem do `EvaluateOperation` e a mesma estratégia
  (`ConservativeTabulatedLookup`).

O planejado na doc-fonte § 14.1 como `LoadChartResolver` é, hoje, a porta `ActiveLoadChartProvider`;
o `SafetyValidator` não existe (PEND-004).

### Frontend (`frontend/src/`)

| Componente | Responsabilidade | Localização no código | Depende de |
|------------|------------------|-----------------------|------------|
| Domínio | geometria operacional de pré-visualização (fórmulas do ADR-013, paridade com o backend) e tipos da avaliação | `domain/geometry/`, `domain/evaluation/` | nada |
| Aplicação | `EvaluationSession`: debounce, `sequence` crescente, descarte de respostas antigas, escolha do transporte (WebSocket ou REST), reenvio ao reconectar | `application/evaluation/` | domínio, portas |
| Infraestrutura | cliente REST de `POST /api/v1/evaluations`; `EvaluationSocket` (reconexão a cada 2 s, sem limite) e mensagens do WebSocket; leitura defensiva de JSON | `infrastructure/api/`, `infrastructure/websocket/`, `infrastructure/shared/` | backend |
| Apresentação | viewport da cena (sem importar `three`), painéis de controle, de geometria (pré-visualização), de entrada da avaliação e do resultado do backend | `presentation/components/`, `presentation/panels/` | aplicação |
| Composição | `App.tsx`, `useEvaluationSession.ts`, `evaluationInput.ts` | `app/` | todas |
| Cena 3D | cena, câmera, controles orbitais, `CraneController` (comandos `setTurretRotation`, `setBoomAngle`, `setBoomLength`, `setCableLength`, `getOperationalGeometry`), guindaste provisório FICTÍCIO, loader GLB/glTF (`loadGltf`) e mapeamento cinemático com relatório de calibração (`mapCraneKinematics`); **nunca decide capacidade ou segurança** (doc-fonte § 12.2) | `three/` | Three.js |

Em desenvolvimento, o Vite encaminha `/api` (inclusive WebSocket) para `http://localhost:8000`
(`frontend/vite.config.ts`). No container, quem faz isso é o nginx (`frontend/nginx.conf.template`).
O GLB de exemplo FICTÍCIO fica em `assets/example-models/`.

---

## 3. Camadas e regras de dependência

Backend (doc-fonte § 18.2; ADR-004), verificado pelo import-linter (`uv run lint-imports`, contratos
em `backend/pyproject.toml`):

```text
Presentation | Infrastructure ──► Application ──► Domain
Domain       ─X─► FastAPI / Starlette / Pydantic / SQLAlchemy
Application  ─X─► FastAPI / Starlette / SQLAlchemy
Presentation ─X─► Infrastructure  (e vice-versa: camadas independentes)
```

- Só a raiz de composição (`app/main.py` e `app/load_chart_persistence_composition.py`, fora das
  camadas) importa apresentação e infraestrutura ao mesmo tempo; nenhum módulo das camadas a importa.
- Schemas Pydantic ficam na apresentação; entidades de domínio não dependem de framework (RNF-002).

Frontend (doc-fonte § 17.3; ADR-005): Three.js só em `src/three/` (regra do ESLint). React não
manipula os `Object3D` da cena; usa os comandos do `CraneController`.

**Agentes:** antes de criar um import, confira se a direção é permitida. Se precisar violar, é uma
decisão — abra um ADR.

---

## 4. Fluxo de dados principal

Avaliação em tempo real, como está implementada (TASK-024, 025, 029, 032):

```mermaid
sequenceDiagram
    participant U as Usuário
    participant F as Frontend (CraneController + EvaluationSession)
    participant WS as Backend (WebSocket /api/v1/ws/evaluation)
    participant UC as EvaluateOperation
    participant DB as PostgreSQL
    U->>F: manipula giro, lança, extensão ou cabo; informa configuração e peso
    F->>F: geometria de pré-visualização (ADR-013) e debounce (150 ms, espera máx. 400 ms)
    F->>WS: simulation.state.changed (sequence N, configuration_id, estado, load_weight_kg)
    WS->>WS: tamanho ≤ 8 KiB, JSON sem NaN, validação Pydantic estrita
    WS->>UC: execute (numa thread)
    UC->>DB: ficha técnica da configuração (CraneGeometryProvider)
    UC->>UC: calculate_operational_geometry (raio, alturas)
    UC->>DB: tabela ACTIVE da configuração (ActiveLoadChartProvider)
    UC->>UC: ConservativeTabulatedLookup (capacidade ou motivo) e utilização
    WS-->>F: simulation.evaluated (sequence N, EVALUATED ou NOT_EVALUABLE com motivos)
    F->>F: descarta a resposta se sequence < último enviado
    F-->>U: capacidade, utilização, raio do backend, ponto usado, tabela e versão
```

- Recusas do WebSocket (mensagem grande demais, JSON malformado, tipo desconhecido, payload
  inválido, erro interno) viram `simulation.error`, com o `sequence` quando legível, e a conexão
  continua.
- Enquanto o WebSocket não está aberto, a `EvaluationSession` envia o mesmo estado por
  `POST /api/v1/evaluations` (mesmo caso de uso; resposta com `status` em vez de `result`).
- Resultado "não avaliável" (`NOT_EVALUABLE`) traz motivos legíveis por máquina, em três categorias:
  `EVALUATION` (ex.: `CRANE_GEOMETRY_NOT_FOUND`, `ACTIVE_LOAD_CHART_NOT_FOUND`, `UTILIZATION_UNDEFINED`),
  `OPERATIONAL_LIMIT` (faixa da ficha técnica violada) e `LOAD_CHART_DOMAIN` (ex.:
  `BOOM_LENGTH_NOT_IN_CHART`, `RADIUS_BELOW_CHART_MIN`, `RADIUS_ABOVE_CHART_MAX`).
- Não há `SafetyValidator`, nível de alerta (`WARNING`/`CRITICAL`) nem registro persistente do
  resultado (PEND-004; `SimulationResult` não existe).

Importação de tabela (TASK-031; doc-fonte § 13, diagrama
[`07_sequencia_importacao_tabela.png`](produto/diagrams/07_sequencia_importacao_tabela.png)):
`POST /api/v1/load-charts/import` escolhe o parser pelo nome/tipo do arquivo (CSV ou XLSX com limites),
valida; inválida → 422 com o relatório e nada gravado; válida → grava o arquivo-fonte no storage
(conferindo o SHA-256) e a tabela como `DRAFT`. `POST /api/v1/load-charts/{id}/activate` leva
`DRAFT → VALIDATED → ACTIVE` e rebaixa a `ACTIVE` anterior da configuração para `SUPERSEDED` na
mesma transação (`SELECT … FOR UPDATE`; interpretação a confirmar, TASK-031 § 8).

---

## 5. Modelo de dados

Persistência: SQLAlchemy 2 + psycopg 3 (ADR-014, proposto), configurados em
`backend/app/infrastructure/database/`; migrations com Alembic (ADR-012) em `backend/alembic/`.
Uma revisão: `1f4cfaff16e8_criar_catalogo_e_tabelas_de_carga.py` (TASK-022). Diagrama de classes
planejado: [`05_diagrama_classes_dominio.png`](produto/diagrams/05_diagrama_classes_dominio.png).

Tabelas existentes (todas as chaves são texto; ids de catálogo gerados no servidor como UUID):

| Entidade | Tabela | Campos-chave | Restrições relevantes |
|----------|--------|--------------|-----------------------|
| Manufacturer | `manufacturers` | `id`, `name` | nomes não são únicos (pendência TASK-022/030) |
| Crane | `cranes` | `id`, `manufacturer_id`, `model_name` | FK para `manufacturers`, `ON DELETE RESTRICT` |
| CraneConfiguration + ficha técnica (ADR-013 C-4) | `crane_configurations` | `id`, `crane_id`, `name`; `boom_pivot_offset_m`, `boom_pivot_height_m`, `boom_length_min_m`/`max_m`, `boom_angle_min_deg`/`max_deg`, `cable_length_min_m` (os 7 juntos ou nenhum); `cable_length_max_m`, `turret_rotation_min_deg`/`max_deg` (opcionais) | FK para `cranes`, `RESTRICT`; `CHECK` de "todos ou nenhum", limites de giro juntos e comprimentos ≥ 0 |
| LoadChart | `load_charts` | `id`, `configuration_id`, `version`, `status` (`DRAFT`, `VALIDATED`, `ACTIVE`, `SUPERSEDED`, `INVALID`), `source_file_name`, `source_file_type`, `source_sha256`, `source_uri` (opcional) | FK para `crane_configurations`, `RESTRICT`; versão única por configuração (RN-005); **no máximo uma `ACTIVE` por configuração** (índice único parcial) |
| LoadChartPoint | `load_chart_points` | `load_chart_id`, `position`, `boom_length_m`, `working_radius_m`, `max_capacity_kg` | PK (`load_chart_id`, `position`); FK `ON DELETE CASCADE`; valores ≥ 0 |

Entidades da doc-fonte § 10 e § 19.1 que **não têm tabela** ainda: `Crane3DModel`, `CraneKinematics`
(o mapeamento de nós existe só no frontend, TASK-026), `Load` (existe só no domínio, TASK-028),
`Simulation`, `SimulationState`, `SimulationResult`. Os atributos de `CraneConfiguration` que
selecionam a tabela continuam **PENDENTES** (PEND-005); hoje a configuração tem só nome e ficha técnica.

Arquivos ficam fora do banco (doc-fonte § 19.2): o arquivo-fonte da tabela vai para
`FILE_STORAGE_DIR`, nomeado pelo SHA-256; o banco guarda nome, tipo, hash e URI.

---

## 6. Integrações

Sem integração com sistemas externos em tempo de execução no MVP. As entradas externas são arquivos.

| Integração | Direção | Protocolo | Autenticação | Onde está o cliente no código | Tratamento de falha |
|------------|---------|-----------|--------------|-------------------------------|---------------------|
| Importação de tabela de carga | entrada | upload multipart REST: `POST /api/v1/load-charts/validate` (CSV, sem gravar) e `POST /api/v1/load-charts/import` (CSV/XLSX, grava) | nenhuma (P-009) | `backend/app/infrastructure/importers/`, `backend/app/presentation/api/load_charts.py` e `load_chart_persistence.py` | relatório de inconsistências; tabela inválida não é gravada (RNF-006); 413 acima de 1 MiB ou dos limites do XLSX; 415 para formato não reconhecido |
| Arquivo-fonte da tabela | saída (disco local) | sistema de arquivos | — | `backend/app/infrastructure/storage/local_file_storage.py` | conteúdo diferente com o mesmo hash → erro de integridade, sem sobrescrever |
| Modelo 3D | entrada | arquivo GLB/glTF lido no navegador (`loadGltf`); **sem upload nem storage no backend** | — | `frontend/src/three/loaders/`, `frontend/src/three/crane/craneKinematics.ts` | erros de arquivo e de mapeamento no relatório (`errors`), calibração em `warnings` |

---

## 7. Configuração e ambientes

Cada ambiente corresponde a uma branch permanente (ver [ADR-002](decisions/ADR-002-modelo-de-branches-por-ambiente.md)
e [`guides/git-github.md`](guides/git-github.md) § 1). A doc-fonte só prevê o ambiente de
desenvolvimento local (§ 22). O significado de homologação e produção num projeto acadêmico está
**PENDENTE** (P-011).

| Ambiente | Branch | Onde roda | Como é configurado | Diferenças relevantes |
|----------|--------|-----------|--------------------|-----------------------|
| local (Docker) | — | `docker-compose.yml` (TASK-011, 027): `postgres` (`postgres:18`, volume `ja-guindastes_postgres-data`), `backend` (uvicorn `app.main:app`, usuário sem root) e `frontend` (nginx sem root servindo o build do Vite e encaminhando `/api/`, inclusive WebSocket, ao backend); portas só em `127.0.0.1` (5432, 8000, 8080 por padrão); `depends_on` com healthchecks | `.env` da raiz: `POSTGRES_*`, `BACKEND_PORT`, `FRONTEND_PORT`, `BACKEND_DATABASE_URL` | migrations sob demanda (`docker compose run --rm backend alembic upgrade head`); healthcheck do backend ainda em `/openapi.json`; `FILE_STORAGE_DIR` não é passado ao container em `d58edf6` |
| local (sem Docker) | — | backend com `uv run uvicorn app.main:app --reload`, frontend com `npm run dev` (proxy `/api` → `localhost:8000`) | variáveis exportadas no shell (`DATABASE_URL`, `FILE_STORAGE_DIR`) | o backend não lê o `.env` sozinho |
| CI | — | GitHub Actions (`.github/workflows/ci.yml`): jobs `structure`, `backend` (com PostgreSQL 18 de serviço, `alembic upgrade head` e `REQUIRE_INTEGRATION_DB=1`), `quality` (frontend) e `docker` (build das imagens, `docker compose up --wait`, migrations e teste de fumaça) | variáveis do próprio workflow (credenciais descartáveis, não são segredo) | job `deploy` é placeholder (só avisa que não está configurado) |
| desenvolvimento | `development` | PENDENTE (sem implantação definida) | GitHub Environment `development` | dados sintéticos; pode ser recriado a qualquer momento |
| homologação | `homologation` | PENDENTE | GitHub Environment `homologation` | PENDENTE |
| produção | `production` | PENDENTE | GitHub Environment `production` | PENDENTE |

Variáveis de ambiente estão documentadas em `.env.example` (nomes, sem valores) e em
[`development-guide.md`](development-guide.md) § 6. **Valores reais nunca ficam no repositório.**

---

## 8. Decisões arquiteturais relevantes

Resumo com link. O detalhe está no ADR. Status conferidos com o [índice](decisions/README.md) em 2026-09-26.

| ADR | Decisão | Status |
|-----|---------|--------|
| [ADR-001](decisions/ADR-001-workflow-baseado-em-arquivos.md) | Workflow de IAs baseado em arquivos versionados, sem API | Substituído por ADR-003 |
| [ADR-002](decisions/ADR-002-modelo-de-branches-por-ambiente.md) | Três branches por ambiente: `development`, `homologation`, `production` | Aceito |
| [ADR-003](decisions/ADR-003-orquestracao-local-via-clis-de-assinatura.md) | Agentes acionados manualmente ou por orquestrador local via CLIs de assinatura; sem API paga; CI sem IA | Aceito |
| [ADR-004](decisions/ADR-004-clean-architecture-no-backend.md) | Clean Architecture (doc-fonte § 7) | Aceito |
| [ADR-005](decisions/ADR-005-frontend-react-typescript-threejs.md) | Frontend React + TypeScript + Three.js (doc-fonte § 7) | Aceito |
| [ADR-006](decisions/ADR-006-backend-fastapi-python.md) | Backend FastAPI + Python (doc-fonte § 7) | Aceito |
| [ADR-007](decisions/ADR-007-postgresql.md) | PostgreSQL (doc-fonte § 7) | Aceito |
| [ADR-008](decisions/ADR-008-glb-gltf-como-formato-3d-interno.md) | GLB/glTF como formato 3D interno (doc-fonte § 7) | Aceito |
| [ADR-009](decisions/ADR-009-tabelas-de-carga-estruturadas-no-banco.md) | Tabelas estruturadas no banco (doc-fonte § 7) | Aceito |
| [ADR-010](decisions/ADR-010-rest-e-websocket.md) | REST + WebSocket (doc-fonte § 7) | Aceito |
| [ADR-011](decisions/ADR-011-monorepo.md) | Monorepo (doc-fonte § 7) | Aceito |
| [ADR-012](decisions/ADR-012-toolchain-de-desenvolvimento.md) | Toolchain: Python 3.14 + uv, ruff, mypy, pytest, import-linter, Alembic; Node 24 + npm, Vite, Three.js puro, Vitest, ESLint, Prettier | Aceito |
| [ADR-013](decisions/ADR-013-convencoes-geometricas-provisorias.md) | Convenções geométricas provisórias: sistema destro com Y para cima, metros e graus; raio medido do eixo de giro até a vertical do gancho (A VALIDAR); parâmetros geométricos vindos da ficha técnica no backend, que é a fonte de verdade | Aceito |
| [ADR-014](decisions/ADR-014-orm-e-driver-postgresql.md) | SQLAlchemy 2 (ORM) e psycopg 3 (driver), só na infraestrutura | Proposto |
| [ADR-015](decisions/ADR-015-consulta-conservadora-provisoria.md) | Entre pontos da tabela, menor capacidade dos vizinhos (provisório, lado seguro); fora da faixa, "fora do domínio" | Aceito (provisório) |

Decisões locais sem ADR próprio, registradas nos handoffs: raiz de composição fora das camadas
(TASK-019, pendência 6), `python-multipart` e `openpyxl` como dependências (TASK-019, TASK-023).

---

## 9. O que os agentes NÃO devem presumir

- Que existe simulação persistida (`Simulation`, `SimulationResult`), `SafetyValidator`, nível de alerta, upload de modelo 3D ou autenticação: não existem (2026-09-26).
- Que a rota de avaliação encontra dados sem banco: sem `DATABASE_URL`, tudo volta `NOT_EVALUABLE`; com banco, é preciso cadastrar a configuração com ficha técnica e ativar uma tabela.
- Que a capacidade mostrada é a oficial: vem da consulta conservadora **provisória** (ADR-015) sobre dados FICTÍCIOS.
- Que os números dos exemplos da doc-fonte (§§ 14.2, 14.3 e 15.4) são capacidades ou tolerâncias reais: são ilustrativos.
- Qualquer regra de interpolação, arredondamento, nível de alerta ou extrapolação: estão **PENDENTES** (PEND-001..004; RN-007).
- Que a geometria de cálculo é definitiva: ela segue o ADR-013 (aceito, **provisório**), com itens A VALIDAR com a empresa.
- Que os limites dos sliders da cena são os da ficha técnica: são os FICTÍCIOS da PoC (TASK-032 § 8).
- Veja também [`known-gaps.md`](known-gaps.md).
