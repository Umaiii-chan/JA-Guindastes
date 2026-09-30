# Guia de desenvolvimento

> **Status deste documento:** consolidado com a leva C integrada (2026-09-26, TASK-037) e
> atualizado com a leva D (TASK-045). Os
> comandos do **backend** (TASK-004, ADR-012), do **frontend** (TASK-007), do **banco local e do
> Alembic** (TASK-011, TASK-022), do **Docker Compose** (TASK-027, TASK-035), do **seed da demo**
> (TASK-035), do **E2E** (TASK-036, com login na TASK-040), do **primeiro admin** (TASK-038) e da
> **conversão do modelo 3D** (TASK-043) são reais. Os comandos listados
> aqui são os **únicos** que os agentes devem executar. Se um comando não está aqui, ou está
> "A VALIDAR", o agente pergunta antes de rodar.
> Mantenha este documento sincronizado com o CI (`.github/workflows/ci.yml`): os dois devem rodar
> os mesmos comandos.

| Campo | Valor |
|-------|-------|
| Última revisão | 2026-09-26 (TASK-045) |
| Stack | Python 3.14 + FastAPI, uv (backend; `python-multipart` para upload, `openpyxl` para XLSX, `argon2-cffi` para senhas) / Node 24 + TypeScript + React + Three.js, npm + Vite (frontend; `react-router`, `lucide-react` e fontes `@fontsource-variable/*` no runtime; `jsdom` e Testing Library só nos testes) / PostgreSQL 18 no Docker Compose, SQLAlchemy 2 + psycopg 3 + Alembic (persistência) / Docker Compose com postgres, backend e frontend (nginx) — ADR-007, ADR-012, ADR-014 (proposto) |

---

## 1. Pré-requisitos

| Ferramenta | Versão | Como instalar / verificar |
|------------|--------|---------------------------|
| Git | 2.x | `git --version` |
| Bash (Git Bash no Windows) | — | necessário para `scripts/check-structure.sh` |
| uv (gerencia o Python e as dependências do backend) | 0.12+ | `uv --version`; instala o Python 3.14 sozinho a partir de `backend/.python-version` |
| Node.js + npm (frontend) | Node 24 LTS, npm 11 | `node --version`, `npm --version` |
| Docker + Docker Compose (PostgreSQL local e testes de integração; ou a stack completa) | Docker 29, Compose v2 ou mais novo (instalados na máquina de desenvolvimento: Docker 29.8.0, Compose v5.5.1) | `docker --version`, `docker compose version`; no Windows, o Docker Desktop precisa estar rodando (ver § 9) |

---

## 2. Instalação

Duas formas. Roteiro de demonstração com dados FICTÍCIOS, passo a passo:
[`demo.md`](demo.md) (TASK-035).

### 2.1 Stack completa no Docker

```bash
git clone https://github.com/Umaiii-chan/JA-Guindastes.git
cd JA-Guindastes
cp .env.example .env
# edite .env (nunca commitar): POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB e
# SESSION_COOKIE_SECURE=false, porque a stack local é servida em HTTP (ver § 6)

docker compose up -d --build                           # postgres + backend + frontend
docker compose ps                                      # esperar os três "healthy"
docker compose run --rm backend sh -c "alembic upgrade head && python -m app.demo_seed"
                                                       # migrations + demonstração FICTÍCIA (idempotente)
docker compose run --rm backend python -m app.create_admin --username admin
                                                       # primeiro admin (senha pedida duas vezes, sem eco)
# frontend: http://127.0.0.1:8080/    API/OpenAPI: http://127.0.0.1:8000/docs
```

Com banco, a tela e a API exigem login (ADR-016). Entre com o admin criado acima; os demais
usuários são criados por ele na página Usuários.

No container, `FILE_STORAGE_DIR` é fixo em `/data/load-charts`, montado no volume nomeado
`ja-guindastes_load-chart-files` (TASK-035); o `FILE_STORAGE_DIR` do `.env` não é lido pelo
container. Sem o seed, só as migrations: `docker compose run --rm backend alembic upgrade head`.

### 2.2 Backend e frontend direto na máquina

```bash
# instalar dependências
cd backend && uv sync --locked && cd ..
cd frontend && npm ci && cd ..

# configurar ambiente
cp .env.example .env
# edite .env com valores locais (nunca commitar): POSTGRES_*, DATABASE_URL, FILE_STORAGE_DIR e
# SESSION_COOKIE_SECURE=false (uvicorn e Vite em HTTP; ver § 6)

# subir só o banco e aplicar as migrations (precisa do Docker rodando)
docker compose up -d postgres
cd backend && set -a && source ../.env && set +a && uv run alembic upgrade head && cd ..

# opcional: demonstração FICTÍCIA (exige DATABASE_URL e FILE_STORAGE_DIR exportadas)
cd backend && set -a && source ../.env && set +a && uv run python -m app.demo_seed && cd ..

# primeiro admin (exige DATABASE_URL exportada e o banco em head)
cd backend && set -a && source ../.env && set +a && uv run python -m app.create_admin --username admin && cd ..

# rodar (dois terminais)
cd backend && set -a && source ../.env && set +a && uv run uvicorn app.main:app --reload   # porta 8000
cd frontend && npm run dev                                                               # proxy /api → localhost:8000
```

---

## 3. Comandos do dia a dia

**Estes comandos são a referência oficial.** O CI e os agentes usam exatamente estes.

| Ação | Comando | Observações |
|------|---------|-------------|
| Rodar o backend em desenvolvimento | `uv run uvicorn app.main:app --reload` | em `backend/`; OpenAPI em `/docs`. `app.main:app` é a raiz de composição (API completa). Sem `DATABASE_URL`: modo "persistência não configurada" (avaliação `NOT_EVALUABLE`, sem rotas de catálogo nem de tabelas gravadas). Com `DATABASE_URL`: precisa do banco em `head`, e toda rota menos `/health` e `/auth/session` exige login (ADR-016). Rotas de importação com gravação: também `FILE_STORAGE_DIR`. **Não use** `app.presentation.api.main:app` (sobe sem as rotas que dependem de adapters) |
| Conferir a saúde da API | `curl http://localhost:8000/api/v1/health` | `{"status": "UP", "database": "NOT_CONFIGURED" \| "UP" \| "DOWN"}`; responde 200 mesmo com o banco `DOWN`; é a rota usada pelo healthcheck do container do backend (TASK-035) |
| Rodar testes (backend) | `uv run pytest` | em `backend/`; ver [`testing-strategy.md`](testing-strategy.md) e doc-fonte § 20 |
| Rodar um teste específico (backend) | `uv run pytest tests/<arquivo>.py::<teste>` | em `backend/` |
| Lint (backend) | `uv run ruff check .` | em `backend/` |
| Formatação — verificar (backend) | `uv run ruff format --check .` | em `backend/` |
| Formatação — corrigir (backend) | `uv run ruff format .` | em `backend/` |
| Verificação de tipos (backend) | `uv run mypy app` | em `backend/`; modo strict (RNF-008) |
| Regras de camadas (backend) | `uv run lint-imports` | em `backend/`; contratos em `backend/pyproject.toml` (ADR-004, RNF-002) |
| Testes do WebSocket (backend) | `uv run pytest tests/presentation/websocket` | em `backend/`; `TestClient.websocket_connect`, sem servidor real |
| Rodar o frontend em desenvolvimento | `npm run dev` | em `frontend/` (Vite, porta 5173); `/api` e o WebSocket vão para `http://localhost:8000` (proxy em `vite.config.ts`); sem backend na 8000 o painel mostra erro de rede e "reconectando…" |
| Rodar testes (frontend) | `npm test` | em `frontend/`; Vitest, testes em `frontend/tests/`; ambiente `node` por padrão, e os `.test.tsx` que declaram `// @vitest-environment jsdom` rodam em jsdom com Testing Library (TASK-039) |
| Rodar um teste específico (frontend) | `npx vitest run tests/<caminho>.test.ts` | em `frontend/` (ou `.test.tsx`) |
| Regenerar o GLB de exemplo FICTÍCIO | `UPDATE_EXAMPLE_GLB=1 npx vitest run tests/three/loaders/exampleModel.test.ts` | em `frontend/`, no Bash (PowerShell: `$env:UPDATE_EXAMPLE_GLB='1'; npx vitest run ...`); só quando o guindaste provisório mudar; sem a variável, o teste confere que `assets/example-models/guindaste-provisorio.ficticio.glb` está em dia |
| Regenerar o GLB do guindaste sobre caminhão | `node scripts/convert-crane-model.mjs` | em `frontend/`; lê `../assets/source/cgtrader_optimized_prop_crane.fbx` (fora do Git; copie o FBX para lá) e grava `public/models/guindaste-caminhao.glb`; recusa um FBX com SHA-256 diferente daquele para o qual as regras foram calibradas; saída determinística (imprime o SHA-256); `--listar` imprime a classificação peça a peça; aceita `[entrada.fbx] [saida.glb]`. Depois: `npx vitest run tests/three/loaders/truckCraneModel.test.ts`, que confere o SHA-256 do GLB (TASK-043) |
| Lint (frontend) | `npm run lint` | em `frontend/`; ESLint, inclui a regra "Three.js só em `src/three/`" (ADR-005) |
| Formatação — verificar (frontend) | `npm run format:check` | em `frontend/`; Prettier |
| Formatação — corrigir (frontend) | `npm run format` | em `frontend/` |
| Verificação de tipos (frontend) | `npm run typecheck` | em `frontend/`; `tsc -b && tsc -p e2e` (aplicação e testes E2E) com `strict` |
| Build (frontend) | `npm run build` | em `frontend/`; saída em `frontend/dist/`; o pacote sai dividido em `react`, `three-core`, `three`, `three-addons` e a aplicação, sem o aviso de chunk > 500 kB (TASK-036) |
| Instalar o navegador do E2E | `npx playwright install chromium` | em `frontend/`, uma vez por máquina (o CI usa `--with-deps chromium`) |
| Testes ponta a ponta (E2E) — local | `npm run e2e` | em `frontend/`; Playwright (`e2e/playwright.config.ts`) faz `npm run build`, sobe `vite preview` em `127.0.0.1:4173` (ou `E2E_PREVIEW_PORT`) e roda os testes em Chromium (WebGL no SwiftShader); os testes que precisam do backend são pulados, e sem backend a aplicação fica no modo sem autenticação |
| Testes ponta a ponta (E2E) — contra a stack Docker | `E2E_BASE_URL=http://127.0.0.1:8080 E2E_BACKEND=1 E2E_ADMIN_USERNAME=<admin> E2E_ADMIN_PASSWORD=<senha> npm run e2e` | em `frontend/`, com a stack no ar, migrada, semeada e com um admin criado por `python -m app.create_admin` (os testes entram como ele; TASK-040); o fluxo com dados semeados só roda com `E2E_SEED_MANUFACTURER_ID`, `E2E_SEED_CRANE_ID` e `E2E_SEED_CONFIGURATION_ID` (§ 6; no CI, os ids `demo-ficticio-*`) |
| Abrir o relatório do E2E | `npx playwright show-report node_modules/.tmp/e2e/report` | em `frontend/`; relatório HTML e traces ficam em `node_modules/.tmp/e2e/` (fora do Git) |
| Subir a stack completa (postgres + backend + frontend) | `docker compose up -d --build` | na raiz; lê o `.env` da raiz; constrói `ja-guindastes-backend:local` e `ja-guindastes-frontend:local`; pronta quando `docker compose ps` mostrar os três `healthy`; frontend em `http://127.0.0.1:8080/`, API em `http://127.0.0.1:8000/docs` (portas só em `127.0.0.1`) |
| Subir só o banco local (PostgreSQL 18) | `docker compose up -d postgres` | na raiz; para rodar backend e frontend direto na máquina; porta `127.0.0.1:${POSTGRES_PORT:-5432}`. (`docker compose up -d` sem nome sobe a stack inteira) |
| Migrations na stack Docker | `docker compose run --rm backend alembic upgrade head` | na raiz, com o `postgres` no ar; não é automático na subida (TASK-027 § 8 item 5) |
| Migrations + seed da demo na stack Docker | `docker compose run --rm backend sh -c "alembic upgrade head && python -m app.demo_seed"` | na raiz; cadastra os dados FICTÍCIOS de [`demo.md`](demo.md) § 1 e ativa a tabela v1; idempotente |
| Seed da demo sem Docker | `uv run python -m app.demo_seed` | em `backend/`, com `DATABASE_URL` e `FILE_STORAGE_DIR` exportadas e o banco em `head` |
| Criar o primeiro admin na stack Docker | `docker compose run --rm backend python -m app.create_admin --username <nome> [--display-name <nome>]` | na raiz, com as migrations aplicadas; a senha (10 a 128 caracteres) é pedida duas vezes, sem eco, ou vem de `ADMIN_PASSWORD` (`-e ADMIN_PASSWORD`, como no job `e2e`); nunca por argumento; idempotente (usuário existente: nada muda, exit 0); exit 1 falha no banco, 2 configuração ou entrada inválida (TASK-038) |
| Criar o primeiro admin sem Docker | `uv run python -m app.create_admin --username <nome> [--display-name <nome>]` | em `backend/`, com `DATABASE_URL` exportada e o banco em `head`; mesmas regras da linha acima |
| Ver o estado dos serviços | `docker compose ps` | na raiz |
| Ver os logs de um serviço | `docker compose logs -f <serviço>` | na raiz; `postgres`, `backend` ou `frontend` |
| Parar a stack (mantém os dados) | `docker compose down` | na raiz; **não** use `down -v` sem querer: o `-v` apaga os volumes `ja-guindastes_postgres-data` (banco) e `ja-guindastes_load-chart-files` (arquivos importados) |
| Recomeçar a demonstração do zero | `docker compose down --volumes` | na raiz; apaga os dois volumes locais; depois, subir de novo e rodar migrations + seed ([`demo.md`](demo.md) § 8) |
| Exportar as variáveis do `.env` no shell | `set -a && source ../.env && set +a` | em `backend/`, no Bash/Git Bash; o backend, o Alembic e o pytest **não** leem o `.env` sozinhos (§ 6) |
| Migrations (aplicar) | `uv run alembic upgrade head` | em `backend/`, com `DATABASE_URL` exportada e o banco no ar (o CI roda contra um PostgreSQL de serviço, TASK-018); duas revisões: `1f4cfaff16e8` (catálogo e tabelas de carga, TASK-022) e `7c2e9a4d1b36` (usuários e sessões, TASK-038) |
| Migrations (criar) | `uv run alembic revision --autogenerate -m "<descrição>"` | em `backend/`, com o banco no ar; compara o banco com `Base.metadata` (os modelos precisam estar importados em `backend/alembic/env.py`); o arquivo sai em `backend/alembic/versions/` já passado pelo `ruff format` e `ruff check --fix`; **revise-o** antes de commitar |
| Migrations (gerar o SQL sem conectar) | `uv run alembic upgrade head --sql` | em `backend/`; só precisa de `DATABASE_URL` definida |
| Testes de integração com banco | `uv run pytest -m integration` | em `backend/`, com o banco no ar **em `head`** e `DATABASE_URL` exportada; sem banco, são pulados; com `REQUIRE_INTEGRATION_DB=1` (como no CI), falham em vez de pular. O teste da migration só desce (`downgrade base`) com as tabelas vazias |
| Auditoria de dependências | A VALIDAR | ferramenta não definida; ver [`security.md`](security.md) § 5 |
| Validar estrutura do repo | `bash scripts/check-structure.sh` | universal, já funciona |

Os comandos que precisam do banco ou do Docker no ar (`docker compose ...`, `alembic upgrade head`
conectado, `pytest -m integration` com banco, seed, E2E contra a stack) rodam no CI (jobs `backend`,
`docker` e `e2e`), mas **não foram verificados na máquina de desenvolvimento**, onde o Docker não
sobe por falta de virtualização ([`known-gaps.md`](known-gaps.md) L-005; § 9). Localmente rodaram o
modo sem conexão (`alembic upgrade head --sql`), os testes sem banco e a API sem `DATABASE_URL`.

Comando único que roda tudo antes de abrir PR (o E2E fica à parte: `npm run e2e`, e o CI o roda no
job `e2e`):

```bash
bash scripts/check-structure.sh && (cd backend && uv run ruff check . && uv run ruff format --check . && uv run mypy app && uv run lint-imports && uv run pytest)
(cd frontend && npm run lint && npm run format:check && npm run typecheck && npm test && npm run build)
```

---

## 4. Estrutura de pastas do código

Estrutura **real** com a leva D integrada (doc-fonte § 9, adaptada à raiz deste repositório).

```text
frontend/
├── Dockerfile, nginx.conf.template, .dockerignore   ← imagem (build do Vite + nginx sem root, porta 8080)
├── vite.config.ts       ← proxy /api (com WebSocket) para localhost:8000; divisão do pacote; config do Vitest (node; jsdom por arquivo)
├── e2e/                 ← Playwright: playwright.config.ts, tests/ (scene, evaluation, auth, loadChartImport, catalogEdit; fixture de login auth.ts; catalogMock.ts; backendCatalog.ts), tsconfig.json
├── public/models/       ← guindaste-caminhao.glb (modelo ilustrativo do caminhão, TASK-043)
├── scripts/             ← convert-crane-model.mjs (FBX → GLB, TASK-043)
├── src/
│   ├── app/             ← App.tsx, AppProviders, AppRoutes, routes/ (uma composição por página), auth/ (AuthProvider, RouteGuards, usePermissions), catalog/ e simulator/ (estado compartilhado), useEvaluationSession, evaluationInput, craneSetup
│   ├── domain/          ← geometry/ (pré-visualização do ADR-013), evaluation/, catalog/, auth/ (tipos)
│   ├── application/     ← evaluation/ (EvaluationSession, evaluationStatus), catalog/ (CatalogBrowser, formulários, árvore, resumo), loadChart/ (matriz, comparação, versões), load/, simulator/ (passos), auth/ (permissões, formulário de usuário)
│   ├── infrastructure/  ← api/ (apiFetch; REST: avaliação, catálogo com edição, tabelas com a listagem por configuração, auth, usuários), websocket/, shared/
│   ├── presentation/    ← theme/ (tokens, fontes, global), ui/ (design system), layout/ (casca, menu do usuário), pages/, simulator/, catalog/, tables/, users/, panels/, components/ (viewport, error boundary)
│   └── three/           ← scene/ (ambiente, anel de raio, carga, paleta, troca do modelo), camera/ (predefinições e transição), controls/, loaders/ (GLB/glTF, modelo do caminhão), crane/ (CraneController, SwitchableCrane, guindaste provisório, provisionalCraneSpec, mapeamento cinemático)
└── tests/               ← espelha src/ (app, application, domain, infrastructure, presentation, three) + fixtures/, helpers/ (inclui fakeAuthBackend), setup.ts
backend/
├── Dockerfile, .dockerignore                        ← imagem (Python 3.14, sem o uv, usuário 10001, porta 8000)
├── alembic.ini, alembic/ ← migrations (env.py, script.py.mako, versions/)
├── app/
│   ├── main.py          ← raiz de composição (app.main:app), fora das camadas
│   ├── load_chart_persistence_composition.py  ← composição da importação com gravação (parte da raiz)
│   ├── auth_composition.py, create_admin.py    ← composição do login e comando do primeiro admin (TASK-038; parte da raiz)
│   ├── demo_seed.py, demo_data/                ← seed da demonstração FICTÍCIA e CSVs FICTÍCIOS (TASK-035)
│   ├── domain/          ← entities/, value_objects/, services/, exceptions/
│   ├── application/     ← ports/, use_cases/
│   ├── infrastructure/  ← database/ (config, engine, Base, models/), repositories/, storage/, importers/, security/ (Argon2id, limite de tentativas)
│   └── presentation/    ← api/ (routers, schemas, autorização), websocket/
└── tests/               ← domain/, application/, infrastructure/ (database/, repositories/), presentation/ (websocket/, matriz de autorização), fixtures/ (FICTÍCIOS), test_composition*.py, test_auth_integration.py, test_create_admin*.py, test_demo_seed*.py, test_openapi.py
assets/example-models/   ← GLB de exemplo FICTÍCIO (guindaste-provisorio.ficticio.glb) e README com os requisitos de um GLB real
assets/source/           ← FBX de origem do modelo do caminhão, só local (no .gitignore; TASK-043)
docker-compose.yml       ← stack local: postgres, backend e frontend, volumes do banco e dos arquivos importados (TASK-011, 027, 035)
docs/                    ← documentação do projeto (este diretório); doc-fonte em docs/produto/; capturas em docs/assets/screenshots/
```

A pasta `docker/` prevista na doc-fonte não foi usada: cada Dockerfile fica junto do seu serviço
(TASK-027). As pastas `three/animation/` e `three/collision/` da doc-fonte não existem.

Regras de dependência entre pastas estão em [`architecture.md`](architecture.md) § 3.

---

## 5. Convenções de código

| Tema | Convenção |
|------|-----------|
| Estilo | seguir o linter configurado (ruff no backend, ESLint no frontend); não desligar regras sem ADR |
| Nomes de arquivos | backend: `snake_case.py` (PEP 8); frontend: componentes React em `PascalCase.tsx`, demais módulos em `camelCase.ts` |
| Nomes de classes/funções | entidades de domínio com os nomes em inglês da doc-fonte § 10.2 (`Crane`, `LoadChart`, `CraneConfiguration`...); casos de uso como na § 11.1 (`CreateCrane`, `CalculateCapacity`...) |
| Campos com unidade | sufixo da unidade no nome, como nos contratos da doc-fonte §§ 14–15 (`boom_length_m`, `boom_angle_deg`, `load_weight_kg`) |
| Tratamento de erros | consulta fora do domínio da tabela é erro/resultado de domínio explícito, nunca extrapolação silenciosa (RN-007; doc-fonte § 14.4) |
| Logs | não substituem os dados persistidos necessários para reproduzir um resultado (doc-fonte § 21) |
| Comentários | explicam **por quê**, não **o quê** |
| Idioma | código em inglês; docs e commits em português; comentários no código: A VALIDAR |

---

## 6. Variáveis de ambiente

Documentadas em [`.env.example`](../.env.example) na raiz. Regras:
- toda variável nova entra em `.env.example` **na mesma tarefa** em que passa a ser lida;
- valores reais nunca vão para o repositório;
- em CI, variáveis vêm do próprio workflow;
- em desenvolvimento, homologação e produção, os valores vêm dos *secrets* do GitHub Environment de
  mesmo nome da branch (`development`, `homologation`, `production`) — o mesmo nome de variável nos
  três, com valores diferentes. Ver [`guides/git-github.md`](guides/git-github.md) § 8.3.

Variáveis em uso (TASK-011, 018, 027, 031, 035, 036, 038, 040):

| Variável | Quem lê | Obrigatória? | Observação |
|----------|---------|--------------|------------|
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | `docker-compose.yml` (serviço `postgres`; e a `DATABASE_URL` padrão do `backend`) | sim, para `docker compose up` | só valem na primeira subida, quando o volume é criado |
| `POSTGRES_PORT` | `docker-compose.yml` | não (padrão `5432`) | porta do host, publicada só em `127.0.0.1` |
| `DATABASE_URL` | backend (`app/infrastructure/database/config.py`, `app/main.py`), Alembic (`backend/alembic/env.py`), testes de integração | sim, para o Alembic e para a API com persistência; sem ela a API sobe em modo "persistência não configurada" | formato `postgresql+psycopg://<usuario>:<senha>@localhost:<porta>/<banco>`, com os mesmos valores de `POSTGRES_*`; outro esquema (`postgresql://`, `sqlite://`...) é recusado com erro claro, e a API não sobe; `?connect_timeout=5` no fim faz falhar mais rápido sem banco |
| `FILE_STORAGE_DIR` | backend (`app/infrastructure/storage/local_file_storage.py`, via `app/load_chart_persistence_composition.py`) | não; sem ela (ou sem `DATABASE_URL`) a API sobe sem `POST /load-charts/import`, `GET /load-charts/{id}` e `POST /load-charts/{id}/activate` | diretório do arquivo-fonte das tabelas importadas, nomeado pelo SHA-256, nunca sobrescrito; criado na primeira gravação; use um caminho **fora** do repositório (não há entrada no `.gitignore`); também obrigatória para o seed fora do Docker; no container do Compose é fixa (`/data/load-charts`, volume `ja-guindastes_load-chart-files`) e o valor do `.env` não é lido |
| `SESSION_COOKIE_SECURE` | backend (`app/auth_composition.py`); repassada ao container pelo `docker-compose.yml` (padrão `true`) | não (padrão `true`, também quando vazia); só vale com `DATABASE_URL` | `true` ou `false`, sem diferenciar maiúsculas (outro valor: `AuthConfigurationError` ao montar a API com banco). Com `true`, o navegador só devolve o cookie de sessão em HTTPS. Use `false` **só** em HTTP local (stack em `http://127.0.0.1:8080`, uvicorn + Vite); **nunca** em produção. Depois de mudar o `.env`, recrie o backend (`docker compose up -d backend`). No CI, `false` só no `.env` efêmero do job `e2e` (TASK-038) |
| `ADMIN_PASSWORD` | `app/create_admin.py` | não | senha do primeiro admin para `python -m app.create_admin`; sem ela, o comando pede a senha sem eco (preferível). Se usar, defina só no shell do comando e apague depois; nunca commitar. No CI, valor descartável só no job `e2e` (TASK-038) |
| `BACKEND_PORT`, `FRONTEND_PORT` | `docker-compose.yml` | não (padrões `8000` e `8080`) | portas do host para a API e o frontend dos containers, só em `127.0.0.1` |
| `BACKEND_DATABASE_URL` | `docker-compose.yml` | não | `DATABASE_URL` usada dentro do container do backend; vazia = montada com `POSTGRES_*` e o host `postgres`; preencha só se a senha tiver caracteres especiais de URL (já codificada) |
| `API_UPSTREAM` | nginx do frontend (`frontend/nginx.conf.template`) | fixa no `docker-compose.yml` (`http://backend:8000`) | destino do proxy de `/api/`; não vai no `.env` |
| `RENDER_API_ORIGIN` | `frontend/vercel.mjs`, durante o build da Vercel | sim, na Vercel | origem HTTPS pública do backend Render, sem caminho; nunca é embutida como segredo e não deve terminar em `/` |
| `VITE_EVALUATION_TRANSPORT` | composição da avaliação no frontend | não (padrão `websocket`) | `websocket` ou `rest`; `npm run build:vercel` fixa `rest` porque o proxy externo da Vercel é usado para a API REST |
| `REQUIRE_INTEGRATION_DB` | testes de integração do backend | não; `1` no CI | com `1`, teste de integração sem banco falha em vez de pular |
| `UPDATE_EXAMPLE_GLB` | `frontend/tests/three/loaders/exampleModel.test.ts` | não | com `1`, regenera o GLB de exemplo (§ 3) |
| `E2E_BASE_URL` | `frontend/e2e/playwright.config.ts` | não | sem ela, o Playwright sobe `vite preview` em `127.0.0.1:4173`; com ela (CI: `http://127.0.0.1:8080`), usa o frontend já servido |
| `E2E_PREVIEW_PORT` | `frontend/e2e/playwright.config.ts` | não | porta do `vite preview` local (padrão `4173`); ex.: `5210`, para não colidir com outro preview aberto (TASK-040) |
| `E2E_BACKEND` | `frontend/e2e/tests/auth.ts`, `evaluation.spec.ts`, `auth.spec.ts` | não; `1` no CI | com `1`, roda os testes que precisam do backend atrás de `/api`; como toda rota exige login (ADR-016), os testes entram antes como o admin de E2E |
| `E2E_ADMIN_USERNAME`, `E2E_ADMIN_PASSWORD` | `frontend/e2e/tests/auth.ts` | com `E2E_BACKEND=1`, sim (sem elas, os testes com backend são pulados) | admin de E2E; no CI, o job `e2e` cria `e2e-admin` com `python -m app.create_admin` e uma senha que só existe no CI (TASK-038) |
| `E2E_SEED_MANUFACTURER_ID`, `E2E_SEED_CRANE_ID`, `E2E_SEED_CONFIGURATION_ID` | `frontend/e2e/tests/evaluation.spec.ts` | não | ids dos dados semeados; com os três, roda o fluxo com dados semeados; no CI: `demo-ficticio-fabricante`, `demo-ficticio-guindaste`, `demo-ficticio-configuracao` (ids fixos do seed) |

O Docker Compose lê o `.env` da raiz sozinho. O backend, o Alembic e o pytest **não**: exporte as
variáveis no shell antes (`set -a && source ../.env && set +a`, em `backend/`) ou defina-as no
próprio comando (`DATABASE_URL=... uv run alembic upgrade head`). No `.env`, deixe o comentário na
linha de cima da variável: o Compose lê `NOME=   # comentário` como se o comentário fosse o valor.

---

## 7. Fluxo de branches e commits

Resumo (detalhes em [`guides/git-github.md`](guides/git-github.md)):
- Três branches longas, uma por ambiente: `development` (default), `homologation` e `production`.
  Nenhuma recebe commit direto — só PR.
- Uma branch por tarefa: `task/<TASK-ID>-<slug>`, criada a partir de `development` e mesclada de
  volta em `development` por **squash**.
- Promoção entre ambientes por PR de merge em cascata, sempre com **merge commit** (nunca squash).
- Commits no formato Conventional Commits, sempre com o ID da tarefa na mensagem (entre parênteses
  no final, ou na descrição quando a tarefa é o próprio assunto).
- **Nenhum commit leva rodapé de co-autoria de IA** (`Co-authored-by:` e equivalentes). Verificado
  por `scripts/check-structure.sh`.
- Antes de abrir PR: rodar o comando único da seção 3.

---

## 8. Arquivos protegidos

Agentes **não alteram** estes arquivos sem autorização explícita registrada no handoff:

| Arquivo/pasta | Motivo | Quem pode alterar |
|---------------|--------|-------------------|
| `docs/business-rules.md` | regras de negócio vêm da pessoa responsável | pessoa responsável |
| `docs/decisions/ADR-*` com status Aceito | histórico de decisões | ninguém (criar novo ADR) |
| `handoffs/history/`, `tasks/completed/` | histórico | ninguém |
| `.github/workflows/*` | segurança do CI | pessoa responsável |
| `docs/produto/documentacao-tecnica-v0.1.md` e `docs/produto/diagrams/` | cópia congelada da doc-fonte v0.1; uma versão nova entra como arquivo novo | ninguém (nova versão = novo arquivo) |

---

## 9. Solução de problemas comuns

| Sintoma | Causa provável | Solução |
|---------|----------------|---------|
| No Windows, `python` abre a Microsoft Store ou diz "Python não foi encontrado" | alias de execução do Windows para a Store | desativar o alias em Configurações > Aplicativos > Configurações avançadas > Aliases de execução, ou usar o Python do gerenciador definido na tarefa de toolchain |
| `git push` recusado com "refusing to allow a Personal Access Token to create or update workflow ... without `workflow` scope" | o token usado pelo git (no Windows, o do Git Credential Manager) não tem o escopo `workflow`, exigido para alterar `.github/workflows/` | `gh auth refresh -h github.com -s workflow` (concluir no navegador) e fazer o push com a credencial do gh: `gh auth setup-git` (permanente) ou `git -c credential.helper= -c "credential.helper=!gh auth git-credential" push ...` (só naquele comando) |
| No Windows, `uv run lint-imports >/dev/null` sai com exit 1 (`UnicodeEncodeError: 'charmap' codec can't encode characters`), embora os contratos passem | o `rich`, usado pelo import-linter, escreve no dispositivo nulo com a codificação cp1252 e falha nos caracteres que ela não tem | rodar sem redirecionar para `/dev/null` ou com `PYTHONIOENCODING=utf-8 uv run lint-imports >/dev/null` |
| No Windows, mensagens em português aparecem com `�` no lugar dos acentos (ex.: erros do Alembic sobre `DATABASE_URL`) | o Python escreve na codificação cp1252 e o Git Bash exibe em UTF-8 | rodar com `PYTHONIOENCODING=utf-8` (ex.: `PYTHONIOENCODING=utf-8 uv run alembic upgrade head`) |
| `docker compose ...` falha com "failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine" | o Docker Desktop não está rodando | abrir o Docker Desktop ou rodar `docker desktop start` e esperar `docker info` responder |
| O Docker Desktop não termina de subir; `docker desktop logs` mostra "Virtual Machine Platform not enabled" / "No virtualization available" | o motor do Docker (WSL 2) precisa de virtualização, desligada no Windows ou no firmware (BIOS/UEFI) | quem administra a máquina ativa o recurso "Plataforma de Máquina Virtual" do Windows e a virtualização no firmware, reinicia e sobe o Docker de novo (agentes não mudam configurações do sistema) |
| `uv run alembic upgrade head` (ou a aplicação) fica parado mais de 2 minutos e termina com `connection timeout expired` | o banco não está no ar e o psycopg espera o tempo-limite padrão de conexão antes de desistir | subir o banco (`docker compose up -d postgres`) e conferir `docker compose ps`; para falhar mais rápido, acrescentar `?connect_timeout=5` ao fim do `DATABASE_URL` local |
| A API sobe, mas `/docs` não mostra as rotas de catálogo nem de tabelas gravadas, e a avaliação sempre volta `NOT_EVALUABLE` com `CRANE_GEOMETRY_NOT_FOUND` e `ACTIVE_LOAD_CHART_NOT_FOUND`; o log avisa "DATABASE_URL não definida" | a API está em modo "persistência não configurada" (o `.env` não foi exportado no shell) | exportar as variáveis (`set -a && source ../.env && set +a`, em `backend/`) e reiniciar o uvicorn |
| Com `DATABASE_URL`, faltam `POST /api/v1/load-charts/import`, `GET /api/v1/load-charts/{id}` e `/activate` (a importação pela tela responde 404) | `FILE_STORAGE_DIR` não definida no backend fora do container (no Compose ela é fixa) | definir `FILE_STORAGE_DIR` com um diretório fora do repositório e reiniciar o backend |
| Seed: `ERRO: defina DATABASE_URL` / `defina FILE_STORAGE_DIR`, `falha no banco (ProgrammingError)` ou `(OperationalError)` | variável ausente no processo; migrations não aplicadas; banco fora do ar | exportar as duas variáveis (ou usar o comando do Compose); `alembic upgrade head` antes do seed; conferir o banco ([`demo.md`](demo.md) § 9) |
| Seed de novo não reativa a tabela v1 da demo | ela ficou `SUPERSEDED` depois de ativar outra versão; reativar não está no fluxo | recomeçar do zero: `docker compose down --volumes` (ou banco vazio + `FILE_STORAGE_DIR` limpo) |
| A lista de fabricantes da tela mostra "HTTP 404" ou "HTTP 502" | backend sem `DATABASE_URL` (rotas do catálogo não registradas) ou backend fora do ar | subir o backend com `DATABASE_URL` e o banco em `head` |
| `npm run e2e` falha dizendo que o navegador não está instalado | o Chromium do Playwright não foi baixado nesta máquina | `npx playwright install chromium` (em `frontend/`) |
| No E2E local, os testes de avaliação aparecem como pulados | sem `E2E_BACKEND=1` (e sem os `E2E_SEED_*`) eles não rodam | rodar contra a stack Docker semeada, com as variáveis do § 3 |
| A avaliação volta `NOT_EVALUABLE` mesmo com banco | a configuração não existe, não tem ficha técnica, não tem tabela `ACTIVE`, o estado viola uma faixa da ficha, ou o raio está fora da tabela | ler os motivos da resposta (`reasons[].code`); cadastrar a configuração com `geometry`, importar e ativar a tabela |
| A API sobe com `uvicorn app.presentation.api.main:app`, mas faltam a validação de tabela, a avaliação e o WebSocket | esse `app` é só a base do contrato OpenAPI | usar `uv run uvicorn app.main:app --reload` |
| `docker compose up` falha porque a porta 8000, 8080 ou 5432 já está em uso | outro processo (por exemplo, um uvicorn ou Vite local) usa a porta no host | parar o outro processo ou definir `BACKEND_PORT`, `FRONTEND_PORT` ou `POSTGRES_PORT` no `.env` |
| O teste de integração da migration falha no `downgrade base` | ficaram dados nas tabelas (por exemplo, um teste de integração da composição que grava e apaga falhou no `finally`) | limpar as tabelas do banco de teste e rodar de novo (TASK-029 § 10) |
| No `npm run dev`, o painel fica em "reconectando…" e mostra erro de rede | o backend não está rodando na porta 8000 | subir o backend (`uv run uvicorn app.main:app --reload`, em `backend/`) |
| O login responde 200, mas o pedido seguinte volta `401 NOT_AUTHENTICATED` e a tela volta ao login | a stack roda em HTTP e o cookie saiu com `Secure` (`SESSION_COOKIE_SECURE` vazia ou `true`), então o navegador não o devolve | `SESSION_COOKIE_SECURE=false` no `.env` (só local) e recriar o backend (`docker compose up -d backend`, ou reiniciar o uvicorn com a variável exportada) |
| `curl` com `POST`/`PUT`/`PATCH`/`DELETE` responde `403` com `"code":"CSRF_HEADER_MISSING"` | falta o cabeçalho anti-CSRF (ADR-016) | enviar `-H 'X-Requested-With: crane-simulator'` ([`demo.md`](demo.md) § 3.1) |
| Login responde `429` com `"code":"TOO_MANY_ATTEMPTS"` | 5 senhas erradas em 15 min para o mesmo usuário | esperar a janela passar ou reiniciar o backend (o limite é em memória, por processo) |
| `create_admin`: `ERRO: falha no banco (ProgrammingError)` | migrations não aplicadas (tabela `app_user` ausente) | `alembic upgrade head` antes |
| `create_admin`: "sem terminal para pedir a senha" | o comando rodou sem terminal interativo (ex.: `docker compose run -T`) e sem `ADMIN_PASSWORD` | rodar com terminal ou passar `ADMIN_PASSWORD` só no shell do comando (`-e ADMIN_PASSWORD` no Compose) |
| A tela entra direto, sem login, e o menu mostra "Modo sem autenticação" | o backend está sem `DATABASE_URL` (ADR-016 § 5) ou não responde (a conferência da sessão caiu no modo sem backend) | subir o backend com `DATABASE_URL` e o banco em `head` |
| `node scripts/convert-crane-model.mjs` recusa o FBX pelo SHA-256 | o arquivo não é o FBX para o qual as regras de classificação foram calibradas | usar o FBX original em `assets/source/`; outro modelo exige revisar as regras R1–R9 do script (TASK-043) |

Agentes: ao resolver um problema de ambiente que tomou tempo, adicione uma linha aqui.
