# Arquitetura

> **Status deste documento:** descreve a arquitetura **como ela está** com a leva D integrada
> (2026-09-26: TASK-001..043 concluídas, leva D no PR #39; consolidado na TASK-037 e atualizado na
> TASK-045). Implementado: backend em Clean Architecture com PostgreSQL, API REST e WebSocket de
> avaliação, cadastros, importação com gravação e ativação de tabelas, login com perfis `ADMIN` e
> `OPERATOR` (ADR-016), seed de demonstração FICTÍCIO; frontend com casca e páginas no design system
> escuro (ADR-017), simulador guiado, catálogo, tabelas, usuários, sessão e guardas de rota, cena 3D
> enriquecida e modelo GLB ilustrativo do guindaste sobre caminhão; Docker Compose, CI e E2E. Ainda
> **não** existem: simulações persistidas, `SafetyValidator`/níveis de alerta, upload de modelo 3D. A
> lista de rotas da API (linha "Apresentação — REST" da § 2) está sendo atualizada pela TASK-044.
> Onde a implementação difere do planejado na documentação técnica v0.1
> ([`produto/documentacao-tecnica-v0.1.md`](produto/documentacao-tecnica-v0.1.md), citada como
> "doc-fonte § N"), o texto diz. Mudanças de arquitetura passam por ADR em [`decisions/`](decisions/README.md).

| Campo | Valor |
|-------|-------|
| Última revisão | 2026-09-26 (TASK-045) |
| ADRs que afetam este documento | ADR-002, ADR-003; ADR-004..011 (decisões da doc-fonte § 7); ADR-012 (toolchain); ADR-013 (geometria, provisório); ADR-014 (ORM, proposto); ADR-015 (consulta conservadora, provisório); ADR-016 (autenticação e perfis); ADR-017 (navegação e design system do frontend) |

---

## 1. Visão geral

Aplicação web 3D em monorepo (doc-fonte § 1 e § 7; ADR-011):
- **frontend** em React + TypeScript + Three.js: visualização, interação e estado gráfico; calcula a
  geometria só como **pré-visualização** (o backend é a fonte de verdade, RN-008, ADR-013 C-7);
- **backend** em FastAPI + Python, em Clean Architecture: domínio, importação/validação das tabelas
  de carga, geometria operacional, consulta de capacidade, cadastros, persistência e, com banco,
  login e autorização por perfil (ADR-016);
- **PostgreSQL** para o catálogo (fabricantes, guindastes, configurações com a ficha técnica), as
  tabelas de carga normalizadas, os usuários e as sessões de login;
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
| Aplicação — portas | `CraneGeometryProvider`, `ActiveLoadChartProvider`, `CraneCatalogRepository`, `CraneCatalogListing`, `CraneCatalogEditing` (TASK-044), `CraneCatalogStore` (as três juntas), `LoadChartRepository`, `LoadChartActivationRepository`, `LoadChartListing` (TASK-044), `LoadChartParser`, `FileStoragePort`, `LoadChartFileLimitExceededError` | `application/ports/` | domínio |
| Aplicação — casos de uso | `EvaluateOperation` (`execute`, `execute_for_load`), `ManageCraneCatalog` (inclui a edição, TASK-044), `ValidateLoadChartImport`, `ImportLoadChart`, `ActivateLoadChart`, `ListConfigurationLoadCharts` (TASK-044) | `application/use_cases/` | domínio, portas |
| Infraestrutura — banco | `DatabaseSettings` (`DATABASE_URL`), engine, fábrica de sessões, `Base` e modelos SQLAlchemy | `infrastructure/database/` | aplicação, domínio |
| Infraestrutura — repositórios | `SqlAlchemyCraneCatalogRepository` (catálogo com edição + `CraneGeometryProvider`), `SqlAlchemyLoadChartRepository` (tabelas + `ActiveLoadChartProvider` + `LoadChartListing`), `SqlAlchemyLoadChartActivationRepository` (troca atômica da `ACTIVE`) | `infrastructure/repositories/` | aplicação, domínio |
| Infraestrutura — storage | `LocalFileStorage`: grava em `<FILE_STORAGE_DIR>/<sha256>`, URI `local://<sha256>`, nunca sobrescreve | `infrastructure/storage/` | aplicação |
| Infraestrutura — importadores | `CsvLoadChartParser`, `XlsxLoadChartParser` (primeira planilha), `select_load_chart_parser`, limites do XLSX (`xlsx_resource_limits.py`, provisórios, P-008) | `infrastructure/importers/` | aplicação, domínio |
| Apresentação — REST | `create_app` e os routers: saúde, avaliação, validação de tabela, catálogo (com edição), importação/consulta/ativação, tabelas de uma configuração (lista de rotas no § 4); schemas Pydantic; limite de upload (`upload_limits.py`); handler do 422 para números não finitos | `presentation/api/` | aplicação |
| Apresentação — WebSocket | `/api/v1/ws/evaluation`: mensagens `simulation.state.changed` → `simulation.evaluated` / `simulation.error`, limite de 8 KiB por mensagem (provisório, P-008) | `presentation/websocket/` | aplicação |
| Raiz de composição | escolhe a composição por `DATABASE_URL` (`compose_app`) e liga os adapters da infraestrutura à apresentação; a importação com gravação é montada em módulo à parte | `app/main.py`, `app/load_chart_persistence_composition.py` | todas as camadas |
| Domínio — usuário (TASK-038) | `User` (id, username, display_name, role, active, created_at), `UserRole` (`ADMIN`, `OPERATOR`), `normalize_username` (3–64 `[a-z0-9._-]`, minúsculas), `normalize_display_name`, `validate_password` (10–128); erros `InvalidUserError` e `LastAdminError` | `domain/entities/user.py`, `domain/exceptions/user_errors.py` | nada |
| Aplicação — autenticação (TASK-038) | portas `UserRepository`, `SessionRepository`, `PasswordHasher`, `LoginAttemptLimiter`; casos de uso `Login` (token aleatório, só o SHA-256 gravado, 8 h, erro genérico, limite de tentativas, limpeza de sessões expiradas), `Logout`, `GetCurrentUser`, `ManageUsers` (listar, criar, editar; o admin não se desativa nem se rebaixa; desativar revoga as sessões) | `application/ports/`, `application/use_cases/authentication.py`, `manage_users.py` | domínio, portas |
| Infraestrutura — usuários e segurança (TASK-038) | `SqlAlchemyUserRepository` (a regra do "último admin ativo" é conferida e gravada na mesma transação, com `SELECT ... FOR UPDATE` nos admins ativos), `SqlAlchemyUserSessionRepository`, `Argon2PasswordHasher` (Argon2id), `InMemoryLoginAttemptLimiter` (5 falhas/15 min por username, por processo) | `infrastructure/repositories/sqlalchemy_user_*.py`, `infrastructure/security/` | aplicação, domínio |
| Apresentação — autenticação (TASK-038) | cookie de sessão, `CsrfHeaderMiddleware`, `AuthGuards` (sessão e perfil), corpo de erro `{detail, code}`, conferência de origem do WebSocket; routers `/api/v1/auth/*` e `/api/v1/users*` (contrato no ADR-016 § 4); schemas em camelCase | `presentation/api/authorization.py`, `auth.py`, `users.py`, `auth_schemas.py` | aplicação |
| Composição do login e primeiro admin (TASK-038) | `build_auth` (lê `SESSION_COOKIE_SECURE`) e liga os adapters de autenticação na composição com banco; `python -m app.create_admin` cria o primeiro admin (senha por `ADMIN_PASSWORD` ou `getpass`; idempotente); fora das camadas | `app/auth_composition.py`, `app/create_admin.py` | todas as camadas |
| Seed da demonstração (TASK-035) | cadastra, pelos casos de uso reais, fabricante, guindaste e configuração FICTÍCIOS com ficha técnica e importa e ativa a tabela FICTÍCIA v1; idempotente (ids fixos `demo-ficticio-*`); fora das camadas, como a raiz de composição | `app/demo_seed.py`, `app/demo_data/` (CSVs FICTÍCIOS v1, v2 e com erros) | todas as camadas |

Composição (`backend/app/main.py`):

- **com `DATABASE_URL`**: repositórios SQLAlchemy; REST com uma conexão do pool por requisição;
  WebSocket com sessões abertas e fechadas a cada mensagem; saúde com `SELECT 1`; rotas de catálogo
  (com edição) e a listagem das tabelas de uma configuração (TASK-044); rotas de importação com
  gravação, consulta e ativação só se `FILE_STORAGE_DIR` também estiver definida; login ligado
  (`create_app(auth=...)`): middleware de CSRF, guardas de sessão e perfil em toda rota menos
  `GET /api/v1/health` e `GET /api/v1/auth/session`, rotas de escrita só para `ADMIN` e o WebSocket
  com a guarda de conexão.
- **sem `DATABASE_URL`**: provedores "não configurados" (sempre `None`): a avaliação responde
  `NOT_EVALUABLE` sem inventar dados, a saúde mostra `NOT_CONFIGURED`, um aviso vai para o log, e as
  rotas de catálogo e de tabelas gravadas não são registradas. **Sem login** (ADR-016 § 5): só
  `GET /api/v1/auth/session` existe (`authEnabled: false`), sem CSRF, e as rotas restantes ficam
  abertas.
- `DATABASE_URL` **inválida**: a aplicação não sobe (`DatabaseConfigurationError`, sem repetir a URL).
- REST e WebSocket usam a mesma montagem do `EvaluateOperation` e a mesma estratégia
  (`ConservativeTabulatedLookup`).

O planejado na doc-fonte § 14.1 como `LoadChartResolver` é, hoje, a porta `ActiveLoadChartProvider`;
o `SafetyValidator` não existe (PEND-004).

### Frontend (`frontend/src/`)

| Componente | Responsabilidade | Localização no código | Depende de |
|------------|------------------|-----------------------|------------|
| Domínio | geometria operacional de pré-visualização (fórmulas do ADR-013, paridade com o backend), tipos da avaliação, do catálogo (`Manufacturer`, `Crane`, `CraneConfiguration`, `CraneTechnicalSheet`) e do usuário (`User`, `UserRole`, `AuthSession`, `AuthRequestError`) | `domain/geometry/`, `domain/evaluation/`, `domain/catalog/`, `domain/auth/` | nada |
| Aplicação | `EvaluationSession` (debounce, `sequence` crescente, descarte de respostas antigas, escolha do transporte WebSocket/REST, reenvio ao reconectar); `CatalogBrowser` (seleção em cascata fabricante → guindaste → configuração) e formulários do catálogo, árvore e busca do catálogo (`catalogTree.ts`), resumo do Início; tabela de carga (matriz lança × raio sem interpolar, comparação entre versões, conferência do arquivo, versões conhecidas); validação da carga (`loadForm.ts`, mesmas regras provisórias da `Load` do backend); passos do simulador guiado (`guidedSteps.ts`) e situação da avaliação (`evaluationStatus.ts`: `ok` até 100 %, `over` acima, `unknown` sem resultado; `warning` sem uso, PEND-004); permissões por perfil (`permissionsFor`) e formulário de usuário | `application/evaluation/`, `application/catalog/`, `application/loadChart/`, `application/load/`, `application/simulator/`, `application/auth/` | domínio, portas |
| Infraestrutura | `apiFetch` (todo pedido com `credentials: 'same-origin'`; `POST`/`PUT`/`PATCH`/`DELETE` com `X-Requested-With: crane-simulator`; avisa 401 `NOT_AUTHENTICATED` e 403 `FORBIDDEN`), usado por todos os clientes REST: avaliação, catálogo, tabelas (validação, importação, consulta e ativação), sessão/login/logout e usuários; `knownChartsStorage` (ids de tabelas no `localStorage`, contorno da TASK-042 que a TASK-044 substitui); `EvaluationSocket` (reconexão a cada 2 s, sem limite) e mensagens do WebSocket; leitura defensiva de JSON | `infrastructure/api/`, `infrastructure/storage/`, `infrastructure/websocket/`, `infrastructure/shared/` | backend |
| Apresentação — design system (ADR-017) | tokens em CSS custom properties (fundo grafite-azulado, acento ciano, cores de situação iguais às da cena), fontes locais, tema escuro fixo, foco visível, `prefers-reduced-motion` e fundo sólido quando não há `backdrop-filter`; componentes próprios em CSS Modules: Button, IconButton, Panel, Field/Input/Select, Badge/StatusPill, Tabs, Dialog, Drawer, Toast, Table, EmptyState, Skeleton, Stepper, Gauge, Slider, Notice, Spinner, Dropzone | `presentation/theme/`, `presentation/ui/` | — |
| Apresentação — casca e páginas | `AppShell` (trilho de navegação recolhível, barra superior com título, ajuda e menu do usuário com "Sair"); páginas Login, Início, Simulador, Catálogo, Tabelas, Usuários, Sem permissão e Não encontrada; componentes de cada página (passos e barra de status do simulador, colunas e Drawer do catálogo, matriz, linha do tempo de versões e Dialog de ativação das tabelas, Drawer de usuário); painéis de seleção, controle, carga, geometria e resultado do backend; viewport da cena (sem importar `three`). As páginas recebem dados por props e não importam de `app/` | `presentation/layout/`, `presentation/pages/`, `presentation/simulator/`, `presentation/catalog/`, `presentation/tables/`, `presentation/users/`, `presentation/panels/`, `presentation/components/` | aplicação |
| Composição | `App.tsx`, `AppProviders.tsx` (sessão; catálogo e rascunho do simulador só montam com sessão válida ou no modo sem banco e recomeçam quando o usuário muda), `AppRoutes.tsx` (rotas e guardas), uma composição por página em `app/routes/` (hooks e clientes ligados às páginas), `AuthProvider`, `RouteGuards` e `usePermissions`, `CatalogProvider` (seleção compartilhada entre páginas), `SimulatorDraftProvider` (carga digitada sobrevive à navegação), `useEvaluationSession.ts`, `evaluationInput.ts`, `craneSetup.ts` (limites dos sliders e a/h da pré-visualização a partir da ficha técnica; sem ficha, os FICTÍCIOS do guindaste provisório, com aviso) | `app/` | todas |
| Cena 3D | cena montada com um `CraneSetup` (limites + a/h); ambiente escuro (céu em gradiente, névoa, grade técnica em shader, sol com sombra, tone mapping ACES); anel do raio de pré-visualização com rótulo HTML e arcos dos raios mínimo e máximo (`RadiusIndicator`); carga pendurada no gancho com lingas (`HookLoad`); cores de situação (`palette.ts`) no anel e no halo; câmeras `perspectiva`, `lateral`, `topo` e `operador` com transição de 700 ms e limites acima do chão; desenho sob demanda e pausa com a aba oculta; `CraneController` atrás de um `SwitchableCrane` (comandos `setTurretRotation`, `setBoomAngle`, `setBoomLength`, `setCableLength`, `getOperationalGeometry`); guindaste provisório (valores FICTÍCIOS em `provisionalCraneSpec.ts`, a = −1,56 m) trocado pelo GLB do caminhão quando ele carrega (`upgradeCraneModel`, `loadTruckCraneModel`), com volta ao provisório se o download, o parse ou o mapeamento falhar; loader GLB/glTF (`loadGltf`) e mapeamento cinemático com relatório de calibração (`mapCraneKinematics`); **nunca decide capacidade ou segurança** (doc-fonte § 12.2) | `three/` | Three.js |

Páginas e rotas do frontend (React Router; ADR-017 § 1). As rotas dentro da casca passam por
`RequireAuth`, que leva a `/login` guardando o destino:

| Rota | Página | Perfil |
|------|--------|--------|
| `/login` | Login (fora da casca); com o modo sem banco, vai ao Início com o aviso | público |
| `/` | Início: atalhos, resumo do catálogo e avisos (dados FICTÍCIOS, estratégia PROVISÓRIA, "o backend decide") | todos |
| `/simulador` | Simulador guiado: cena ocupando a página, passos 1 Guindaste → 2 Carga → 3 Posição à esquerda, resultado do backend à direita (situação, medidor de utilização, capacidade, raio, selo PROVISÓRIO), barra de conexão e câmeras no rodapé | todos |
| `/catalogo` | Catálogo mestre-detalhe (fabricante → guindaste → configuração), busca, ficha técnica e cadastros em Drawer | todos; só `ADMIN` edita |
| `/tabelas` | Tabelas de carga: validação prévia, prévia da matriz, importação, linha do tempo de versões e ativação com confirmação | todos; só `ADMIN` importa e ativa |
| `/usuarios` | Usuários: busca, criar, editar, desativar e reativar | `ADMIN` (`RequireRole`) |
| `*` | Não encontrada | — |

No simulador, a configuração escolhida vai para a avaliação e a carga só entra (como
`load_weight_kg`) quando o formulário inteiro é válido; descrição, dimensões e CG ficam no frontend,
e as dimensões desenham a caixa pendurada no gancho. A cor da situação na cena e no medidor vem só do
resultado do backend. Para o Operador, Catálogo e Tabelas escondem as ações de escrita
(`usePermissions().canEdit`). As guardas e a ocultação são só apresentação: quem recusa é o backend
(401/403).

Em desenvolvimento, o Vite encaminha `/api` (inclusive WebSocket) para `http://localhost:8000`
(`frontend/vite.config.ts`). No container, quem faz isso é o nginx (`frontend/nginx.conf.template`).
O build divide o pacote em arquivos (`react`, `three-core`, `three`, `three-addons` e a aplicação;
TASK-036), todos carregados na abertura da página; o `three-addons` inclui o `GLTFLoader` e o
`CSS2DRenderer`. O modelo do guindaste sobre caminhão fica em
`frontend/public/models/guindaste-caminhao.glb` (1,81 MiB, cerca de 103 mil triângulos, TASK-043) e é
baixado uma vez por página. Ele é gerado a partir do FBX do CGTrader, que fica fora do Git, pelo script
`frontend/scripts/convert-crane-model.mjs`, e é ilustrativo: as medidas de cálculo vêm da ficha
técnica (RN-003). O GLB de exemplo FICTÍCIO do guindaste provisório fica em `assets/example-models/`.

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
  O seed `app/demo_seed.py` também fica fora das camadas (liga casos de uso e repositórios).
- Schemas Pydantic ficam na apresentação; entidades de domínio não dependem de framework (RNF-002).

Frontend (doc-fonte § 17.3; ADR-005): Three.js só em `src/three/` (regra do ESLint). React não
manipula os `Object3D` da cena; usa os comandos do `CraneController`. Os tipos públicos da cena
(`palette.ts`, `loadBox.ts`, `cameraPresets.ts`) não dependem de Three.js e são importados pela UI com
`import type`. Páginas em `presentation/pages` recebem dados por props; hooks e clientes ficam em
`app/routes/*`. A apresentação só importa `react-router` para `Link`/`NavLink`.

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

Com banco, o WebSocket só abre com a sessão válida no cookie e o `Origin` do mesmo host (ver o
fluxo de autenticação abaixo). A sessão é conferida só na abertura da conexão.

Autenticação, como está implementada (ADR-016; TASK-038 e TASK-040). Só com `DATABASE_URL`:

```mermaid
sequenceDiagram
    participant U as Usuário
    participant F as Frontend (AuthProvider + apiFetch)
    participant API as Backend (/api/v1)
    participant DB as PostgreSQL
    F->>API: GET /auth/session (na abertura)
    API-->>F: { authEnabled, user | null }
    Note over F: sem backend (rede, 404, 502, 503, 504) → modo sem autenticação;<br/>outra falha ou sem usuário → /login
    U->>F: usuário e senha em /login
    F->>API: POST /auth/login + X-Requested-With: crane-simulator
    API->>API: limite de 5 falhas / 15 min por username (em memória)
    API->>DB: usuário ativo e hash Argon2id
    API->>DB: grava o SHA-256 do token (expira em 8 h)
    API-->>F: 200 { user } + Set-Cookie crane_session (HttpOnly, SameSite=Strict)
    F->>API: demais pedidos com o cookie (e o cabeçalho nos métodos inseguros)
    API->>API: CSRF → sessão (401) → perfil (403) → validação do corpo (422)
    API-->>F: 401 NOT_AUTHENTICATED em qualquer rota → frontend volta a /login ("A sessão acabou")
    F->>API: WS /ws/evaluation (mesmo cookie, mesma origem)
    API-->>F: aceita, ou fecha com 4401 (sem sessão) / 4403 (Origin de outro host)
```

- Erros: `{"detail": "<mensagem>", "code": "<CÓDIGO>"}`. Login errado é sempre
  `401 INVALID_CREDENTIALS`; excesso de tentativas, `429 TOO_MANY_ATTEMPTS`; sem o cabeçalho,
  `403 CSRF_HEADER_MISSING`.
- Rotas de login e de usuários: `GET /api/v1/auth/session`, `POST /api/v1/auth/login`,
  `POST /api/v1/auth/logout`, `GET`/`POST /api/v1/users` e `PATCH /api/v1/users/{id}` (contrato
  completo no ADR-016 § 4). A gestão de usuários recusa com `409 USERNAME_TAKEN`, `409 LAST_ADMIN`,
  `409 OWN_ADMIN_ACCESS` (o admin tentando se desativar ou se rebaixar) e `404 USER_NOT_FOUND`.
- Logout e desativação do usuário apagam as sessões; trocar a senha não apaga.
- Detalhes de segurança em [`security.md`](security.md) § 2.

Importação de tabela (TASK-031; doc-fonte § 13, diagrama
[`07_sequencia_importacao_tabela.png`](produto/diagrams/07_sequencia_importacao_tabela.png)):
`POST /api/v1/load-charts/import` escolhe o parser pelo nome/tipo do arquivo (CSV ou XLSX com limites),
valida; inválida → 422 com o relatório e nada gravado; válida → grava o arquivo-fonte no storage
(conferindo o SHA-256) e a tabela como `DRAFT`. `POST /api/v1/load-charts/{id}/activate` leva
`DRAFT → VALIDATED → ACTIVE` e rebaixa a `ACTIVE` anterior da configuração para `SUPERSEDED` na
mesma transação (`SELECT … FOR UPDATE`; interpretação a confirmar, TASK-031 § 8).

Rotas REST (prefixo `/api/v1`; perfis do ADR-016, que só valem com `DATABASE_URL`; "escrita" =
perfil `ADMIN` e cabeçalho `X-Requested-With: crane-simulator`):

| Método e caminho | Acesso | Observação |
|------------------|--------|------------|
| `GET /health` | público | sempre registrada |
| `GET /auth/session`, `POST /auth/login`, `POST /auth/logout` | público / sessão | TASK-038 |
| `GET /users`, `POST /users`, `PATCH /users/{user_id}` | `ADMIN` | TASK-038 |
| `POST /evaluations` | qualquer perfil | avaliação REST (mesma do WebSocket `/ws/evaluation`) |
| `POST /load-charts/validate` | qualquer perfil | CSV, sem gravar |
| `GET/POST /manufacturers`, `GET /manufacturers/{id}` | leitura / escrita | TASK-030 |
| `PATCH /manufacturers/{id}` `{name}` | escrita | TASK-044; 200, 404, 422 |
| `GET/POST /cranes` (filtro `manufacturer_id`), `GET /cranes/{id}` | leitura / escrita | TASK-030 |
| `PATCH /cranes/{id}` `{model_name}` | escrita | TASK-044; o fabricante não muda |
| `GET/POST /cranes/{id}/configurations` | leitura / escrita | TASK-030 |
| `GET /configurations/{id}` | leitura | TASK-030 |
| `PATCH /configurations/{id}` `{name?, geometry?}` | escrita | TASK-044; ao menos um campo, sem `null`; a ficha substitui a inteira e vale para as próximas avaliações, sem mexer nas tabelas |
| `GET /configurations/{id}/load-charts` | leitura | TASK-044; `{items, active_chart_id}`, itens sem `points`, da maior versão para a menor (ordem natural; não há data de importação gravada); 404 se a configuração não existe |
| `POST /load-charts/import` | escrita | TASK-031; exige `FILE_STORAGE_DIR` |
| `GET /load-charts/{chart_id}` | leitura | TASK-031; exige `FILE_STORAGE_DIR` |
| `POST /load-charts/{chart_id}/activate` | escrita | TASK-031; exige `FILE_STORAGE_DIR` |

Nomes de fabricante, guindaste e configuração não são únicos (pendência 2 da TASK-022): nem o
cadastro nem a edição respondem 409 por nome.

---

## 5. Modelo de dados

Persistência: SQLAlchemy 2 + psycopg 3 (ADR-014, proposto), configurados em
`backend/app/infrastructure/database/`; migrations com Alembic (ADR-012) em `backend/alembic/`.
Duas revisões: `1f4cfaff16e8_criar_catalogo_e_tabelas_de_carga.py` (TASK-022) e
`7c2e9a4d1b36_criar_usuarios_e_sessoes.py` (TASK-038). Diagrama de classes
planejado: [`05_diagrama_classes_dominio.png`](produto/diagrams/05_diagrama_classes_dominio.png).

Tabelas existentes (todas as chaves são texto; ids de catálogo gerados no servidor como UUID):

| Entidade | Tabela | Campos-chave | Restrições relevantes |
|----------|--------|--------------|-----------------------|
| Manufacturer | `manufacturers` | `id`, `name` | nomes não são únicos (pendência TASK-022/030) |
| Crane | `cranes` | `id`, `manufacturer_id`, `model_name` | FK para `manufacturers`, `ON DELETE RESTRICT` |
| CraneConfiguration + ficha técnica (ADR-013 C-4) | `crane_configurations` | `id`, `crane_id`, `name`; `boom_pivot_offset_m`, `boom_pivot_height_m`, `boom_length_min_m`/`max_m`, `boom_angle_min_deg`/`max_deg`, `cable_length_min_m` (os 7 juntos ou nenhum); `cable_length_max_m`, `turret_rotation_min_deg`/`max_deg` (opcionais) | FK para `cranes`, `RESTRICT`; `CHECK` de "todos ou nenhum", limites de giro juntos e comprimentos ≥ 0 |
| LoadChart | `load_charts` | `id`, `configuration_id`, `version`, `status` (`DRAFT`, `VALIDATED`, `ACTIVE`, `SUPERSEDED`, `INVALID`), `source_file_name`, `source_file_type`, `source_sha256`, `source_uri` (opcional) | FK para `crane_configurations`, `RESTRICT`; versão única por configuração (RN-005); **no máximo uma `ACTIVE` por configuração** (índice único parcial) |
| LoadChartPoint | `load_chart_points` | `load_chart_id`, `position`, `boom_length_m`, `working_radius_m`, `max_capacity_kg` | PK (`load_chart_id`, `position`); FK `ON DELETE CASCADE`; valores ≥ 0 |
| User (ADR-016) | `app_user` | `id`, `username` (≤ 64), `display_name`, `role`, `active`, `password_hash` (Argon2id), `created_at` | `username` único e em minúsculas (`CHECK`); `role` em `ADMIN`/`OPERATOR` (`CHECK`) |
| Sessão de login (ADR-016) | `user_session` | `token_hash` (SHA-256 do token, PK), `user_id`, `created_at`, `expires_at` | FK para `app_user` com `ON DELETE CASCADE`; `token_hash` com 64 dígitos hexadecimais (`CHECK`); índice em `user_id` |

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
| Importação de tabela de carga | entrada | upload multipart REST: `POST /api/v1/load-charts/validate` (CSV, sem gravar) e `POST /api/v1/load-charts/import` (CSV/XLSX, grava) | com banco, sessão: qualquer perfil valida, só `ADMIN` importa (ADR-016) | `backend/app/infrastructure/importers/`, `backend/app/presentation/api/load_charts.py` e `load_chart_persistence.py` | relatório de inconsistências; tabela inválida não é gravada (RNF-006); 413 acima de 1 MiB ou dos limites do XLSX; 415 para formato não reconhecido |
| Arquivo-fonte da tabela | saída (disco local) | sistema de arquivos | — | `backend/app/infrastructure/storage/local_file_storage.py` | conteúdo diferente com o mesmo hash → erro de integridade, sem sobrescrever |
| Modelo 3D | entrada | GLB estático servido pelo frontend (`/models/guindaste-caminhao.glb`) e lido no navegador (`loadGltf`, `loadTruckCraneModel`); convertido fora do runtime do FBX do CGTrader (licença confirmada pela pessoa responsável para versionar e distribuir o derivado; registrada nos `extras` do GLB); **sem upload nem storage no backend** | — | `frontend/src/three/loaders/`, `frontend/src/three/crane/craneKinematics.ts`, `frontend/scripts/convert-crane-model.mjs` | erros de arquivo e de mapeamento no relatório (`errors`), calibração em `warnings`; na cena, falha → fica o guindaste provisório, com aviso no console |

---

## 7. Configuração e ambientes

Cada ambiente corresponde a uma branch permanente (ver [ADR-002](decisions/ADR-002-modelo-de-branches-por-ambiente.md)
e [`guides/git-github.md`](guides/git-github.md) § 1). A doc-fonte só prevê o ambiente de
desenvolvimento local (§ 22). O significado de homologação e produção num projeto acadêmico está
**PENDENTE** (P-011).

| Ambiente | Branch | Onde roda | Como é configurado | Diferenças relevantes |
|----------|--------|-----------|--------------------|-----------------------|
| local (Docker) | — | `docker-compose.yml` (TASK-011, 027, 035): `postgres` (`postgres:18`, volume `ja-guindastes_postgres-data`), `backend` (uvicorn `app.main:app`, usuário sem root, `FILE_STORAGE_DIR=/data/load-charts` no volume `ja-guindastes_load-chart-files`) e `frontend` (nginx sem root servindo o build do Vite e encaminhando `/api/`, inclusive WebSocket, ao backend); portas só em `127.0.0.1` (5432, 8000, 8080 por padrão); `depends_on` com healthchecks; healthcheck do backend em `/api/v1/health` | `.env` da raiz: `POSTGRES_*`, `BACKEND_PORT`, `FRONTEND_PORT`, `BACKEND_DATABASE_URL`, `SESSION_COOKIE_SECURE` (repassada ao backend; `false` para a stack em HTTP) (o `FILE_STORAGE_DIR` do `.env` não é lido pelo container) | migrations, seed e primeiro admin sob demanda (`docker compose run --rm backend sh -c "alembic upgrade head && python -m app.demo_seed"` e `docker compose run --rm backend python -m app.create_admin --username <nome>`); o healthcheck responde 200 mesmo com o banco `DOWN` |
| local (sem Docker) | — | backend com `uv run uvicorn app.main:app --reload`, frontend com `npm run dev` (proxy `/api` → `localhost:8000`); seed com `uv run python -m app.demo_seed` | variáveis exportadas no shell (`DATABASE_URL`, `FILE_STORAGE_DIR`, `SESSION_COOKIE_SECURE`) | o backend não lê o `.env` sozinho; primeiro admin com `uv run python -m app.create_admin` |
| CI | — | GitHub Actions (`.github/workflows/ci.yml`): jobs `structure`, `backend` (com PostgreSQL 18 de serviço, `alembic upgrade head` e `REQUIRE_INTEGRATION_DB=1`), `quality` (frontend), `docker` (build das imagens, `docker compose up --wait`, migrations e teste de fumaça; pelo proxy, um `POST` com o cabeçalho CSRF e sem sessão tem de dar 401) e `e2e` (mesma stack com `SESSION_COOKIE_SECURE=false` + migrations + seed da demo + admin `e2e-admin` criado por `create_admin` com senha só de CI, Playwright/Chromium contra o nginx, com `E2E_BASE_URL`, `E2E_BACKEND=1`, `E2E_ADMIN_*` e `E2E_SEED_*` apontando para os ids fixos do seed) | variáveis do próprio workflow (credenciais descartáveis, não são segredo) | job `deploy` é placeholder (só avisa que não está configurado); `deploy` não depende de `docker` nem de `e2e` |
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
| [ADR-016](decisions/ADR-016-autenticacao-e-perfis.md) | Login com sessão opaca no banco e cookie `HttpOnly`, perfis `ADMIN`/`OPERATOR`, contas criadas só pelo admin, CSRF por cabeçalho, WebSocket com a mesma sessão; sem banco, sem login | Aceito |
| [ADR-017](decisions/ADR-017-navegacao-e-design-system-do-frontend.md) | Páginas com React Router, casca com trilho e barra superior, simulador guiado sobre a cena, design system próprio em tema escuro com CSS Modules | Aceito |

Decisões locais sem ADR próprio, registradas nos handoffs: raiz de composição fora das camadas
(TASK-019, pendência 6), `python-multipart` e `openpyxl` como dependências (TASK-019, TASK-023),
código `409 OWN_ADMIN_ACCESS` e comparação de origem do WebSocket sem a porta (TASK-038 § 5 e § 8),
jsdom e Testing Library só para testes (TASK-039), carregamento do GLB em segundo plano com o
provisório como reserva e desenho sob demanda (TASK-041 § 12).

---

## 9. O que os agentes NÃO devem presumir

- Que existe simulação persistida (`Simulation`, `SimulationResult`), `SafetyValidator`, nível de alerta ou upload de modelo 3D: não existem (2026-09-26, leva D).
- Que a API sempre exige login: só com `DATABASE_URL`. Sem banco, as rotas que existem ficam abertas (ADR-016 § 5).
- Que esconder um botão ou uma rota no frontend protege algo: as guardas e `canEdit` são só apresentação; a autorização é do backend.
- Que a cor âmbar ("atenção", `warning`) tem critério: não tem (PEND-004); hoje só `ok`, `over` e `unknown` são usados.
- Que a rota de avaliação encontra dados sem banco: sem `DATABASE_URL`, tudo volta `NOT_EVALUABLE`; com banco, é preciso cadastrar a configuração com ficha técnica e ativar uma tabela.
- Que a capacidade mostrada é a oficial: vem da consulta conservadora **provisória** (ADR-015) sobre dados FICTÍCIOS.
- Que os números dos exemplos da doc-fonte (§§ 14.2, 14.3 e 15.4) são capacidades ou tolerâncias reais: são ilustrativos.
- Qualquer regra de interpolação, arredondamento, nível de alerta ou extrapolação: estão **PENDENTES** (PEND-001..004; RN-007).
- Que a geometria de cálculo é definitiva: ela segue o ADR-013 (aceito, **provisório**), com itens A VALIDAR com a empresa.
- Que a cena desenha o guindaste real da empresa: desenha o modelo **ilustrativo** do guindaste sobre caminhão (TASK-043), ou o provisório enquanto o GLB carrega ou se ele falhar. Os limites e o a/h vêm da ficha técnica quando a configuração tem ficha (sem ficha, valores FICTÍCIOS rotulados); com ficha diferente do modelo, o erro é só visual (aviso de calibração no console).
- Que a carga completa (descrição, dimensões, CG) vai ao backend: só o peso vai (TASK-034).
- Veja também [`known-gaps.md`](known-gaps.md).
